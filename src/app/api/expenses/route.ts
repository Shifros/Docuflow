import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractDocumentData } from "@/lib/deepseek";
import { matchByName } from "@/lib/match-entities";
import { normalizeExpenseExtraction } from "@/lib/normalize-extraction";
import { createAdminClient, getDefaultOrgId } from "@/lib/supabase/admin";
import {
  buildTimesheetImportData,
  countMatchedRows,
  countTotalHours,
} from "@/lib/timesheet-imports";
import type { TimesheetLine, ExpenseExtractionData, ExpenseLine } from "@/lib/types";

export const runtime = "nodejs";

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

async function cleanupFailedDocument(
  supabase: SupabaseClient,
  expenseId: string,
  storagePath: string,
  errorMessage?: string,
) {
  await supabase.storage.from("documents").remove([storagePath]);

  await supabase
    .from("expenses")
    .update({
      status: "failed",
      error_message: errorMessage ?? null,
    })
    .eq("id", expenseId);
}

async function removeStorageFile(supabase: SupabaseClient, storagePath: string) {
  await supabase.storage.from("documents").remove([storagePath]);
}

export async function GET() {
  try {
    const supabase = createAdminClient();
    const orgId = getDefaultOrgId();

    const { data, error } = await supabase
      .from("expenses")
      .select("*, project:projects(*)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ expenses: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load expenses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const clientExtractedText = formData.get("extracted_text");
    const textOnlyName = formData.get("file_name");

    const hasFile = file instanceof File;
    const extractedTextOnly =
      typeof clientExtractedText === "string"
        ? clientExtractedText.trim()
        : "";

    if (!hasFile && !extractedTextOnly) {
      return NextResponse.json(
        { error: "A file or pasted text is required" },
        { status: 400 },
      );
    }

    if (hasFile && !ACCEPTED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only PDF and image files (PNG, JPG, WEBP) are supported" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const orgId = getDefaultOrgId();
    let storagePath: string | null = null;
    let fileName =
      typeof textOnlyName === "string" && textOnlyName.trim()
        ? textOnlyName.trim()
        : "pasted-text.txt";

    if (hasFile) {
      const buffer = Buffer.from(await file.arrayBuffer());
      storagePath = `${orgId}/${crypto.randomUUID()}-${file.name}`;
      fileName = file.name;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }
    }

    const [{ data: projects }, { data: teamMembers }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name")
        .eq("org_id", orgId)
        .eq("status", "active"),
      supabase.from("team_members").select("id, name").eq("org_id", orgId),
    ]);

    const activeProjectNames = projects?.map((p) => p.name) ?? [];
    const teamMemberNames = teamMembers?.map((m) => m.name) ?? [];

    try {
      let extractedText = extractedTextOnly;

      if (!extractedText && hasFile && file.type === "application/pdf") {
        const buffer = Buffer.from(await file.arrayBuffer());
        const { extractTextFromPdf } = await import("@/lib/pdf");
        extractedText = await extractTextFromPdf(buffer);
      }

      if (!extractedText.trim()) {
        if (storagePath) {
          await removeStorageFile(supabase, storagePath);
        }
        throw new Error("No readable text found in the document");
      }

      const aiData = await extractDocumentData(
        extractedText,
        activeProjectNames,
        teamMemberNames,
      );

      if (aiData.document_type === "invalid") {
        if (storagePath) {
          await removeStorageFile(supabase, storagePath);
        }
        return NextResponse.json(
          { error: aiData.rejection_reason ?? "Document could not be processed" },
          { status: 400 },
        );
      }

      if (aiData.document_type === "timesheet") {
        return await handleTimesheetIngestion({
          supabase,
          orgId,
          storagePath,
          fileName,
          timesheet: aiData.timesheet,
          projects: projects ?? [],
          teamMembers: teamMembers ?? [],
        });
      }

      if (!storagePath) {
        return NextResponse.json(
          { error: "Receipts and invoices require a file upload" },
          { status: 400 },
        );
      }

      return await handleExpenseIngestion({
        supabase,
        orgId,
        storagePath,
        fileName,
        expenseData: normalizeExpenseExtraction(aiData.expense),
        projects: projects ?? [],
      });
    } catch (error) {
      if (storagePath) {
        await removeStorageFile(supabase, storagePath);
      }
      const message = error instanceof Error ? error.message : "Processing failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleExpenseIngestion({
  supabase,
  orgId,
  storagePath,
  fileName,
  expenseData,
  projects,
}: {
  supabase: SupabaseClient;
  orgId: string;
  storagePath: string;
  fileName: string;
  expenseData: ExpenseExtractionData;
  projects: { id: string; name: string }[];
}) {
  if (
    !expenseData.is_valid_receipt &&
    !(expenseData.is_multi_line_report && expenseData.entries.length > 0)
  ) {
    const rejectionReason =
      expenseData.rejection_reason ??
      "This document is not a valid receipt or invoice.";

    const { data: failedExpense, error: insertError } = await supabase
      .from("expenses")
      .insert({
        org_id: orgId,
        file_name: fileName,
        receipt_url: storagePath,
        status: "pending_approval",
      })
      .select("id")
      .single();

    if (failedExpense) {
      await cleanupFailedDocument(
        supabase,
        failedExpense.id,
        storagePath,
        rejectionReason,
      );
    } else if (insertError) {
      await removeStorageFile(supabase, storagePath);
    }

    return NextResponse.json({ error: rejectionReason }, { status: 400 });
  }

  const isMultiLine =
    expenseData.is_multi_line_report || expenseData.entries.length > 1;

  if (isMultiLine && expenseData.entries.length > 0) {
    return handleMultiLineExpenseIngestion({
      supabase,
      orgId,
      storagePath,
      fileName,
      expenseData,
      projects,
    });
  }

  const { data: expense, error: insertError } = await supabase
    .from("expenses")
    .insert({
      org_id: orgId,
      file_name: fileName,
      receipt_url: storagePath,
      status: "pending_approval",
    })
    .select("*")
    .single();

  if (insertError || !expense) {
    throw new Error(insertError?.message ?? "Failed to create expense record");
  }

  let projectId: string | null = null;
  if (
    expenseData.expense_type === "project_direct" &&
    expenseData.suggested_project_name
  ) {
    const matchedProject = matchByName(expenseData.suggested_project_name, projects);
    if (matchedProject) {
      projectId = matchedProject.id;
    }
  }

  const { data: completedExpense, error: updateError } = await supabase
    .from("expenses")
    .update({
      vendor_name: expenseData.vendor_name,
      total_amount: expenseData.total_amount,
      expense_type: expenseData.expense_type,
      category: expenseData.category || "Misc",
      project_id: projectId,
      raw_extracted_data: expenseData,
      status: "pending_approval",
      error_message: null,
    })
    .eq("id", expense.id)
    .select("*, project:projects(*)")
    .single();

  if (updateError) {
    await cleanupFailedDocument(supabase, expense.id, storagePath, updateError.message);
    throw new Error(updateError.message);
  }

  return NextResponse.json({
    document_type: "expense",
    expense: completedExpense,
  });
}

async function handleMultiLineExpenseIngestion({
  supabase,
  orgId,
  storagePath,
  fileName,
  expenseData,
  projects,
}: {
  supabase: SupabaseClient;
  orgId: string;
  storagePath: string;
  fileName: string;
  expenseData: ExpenseExtractionData;
  projects: { id: string; name: string }[];
}) {
  const inserted = [];

  for (const line of expenseData.entries) {
    let projectId: string | null = null;
    if (
      line.expense_type === "project_direct" &&
      line.suggested_project_name
    ) {
      const matchedProject = matchByName(line.suggested_project_name, projects);
      if (matchedProject) {
        projectId = matchedProject.id;
      }
    }

    const linePayload: ExpenseLine & {
      source_report: true;
      parent_file: string;
      default_date?: string | null;
    } = {
      ...line,
      source_report: true,
      parent_file: fileName,
      default_date: expenseData.default_date,
    };

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        org_id: orgId,
        file_name: fileName,
        receipt_url: storagePath,
        vendor_name: line.vendor_name,
        total_amount: line.total_amount,
        expense_type: line.expense_type,
        category: line.category || "Misc",
        project_id: projectId,
        raw_extracted_data: linePayload,
        status: "pending_approval",
      })
      .select("*, project:projects(*)")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    inserted.push(data);
  }

  return NextResponse.json({
    document_type: "expense",
    expense_count: inserted.length,
    expenses: inserted,
    message: `${inserted.length} expenses extracted from report and sent to Triage`,
  });
}

async function handleTimesheetIngestion({
  supabase,
  orgId,
  storagePath,
  fileName,
  timesheet,
  projects,
  teamMembers,
}: {
  supabase: SupabaseClient;
  orgId: string;
  storagePath: string | null;
  fileName: string;
  timesheet: {
    entries: TimesheetLine[];
    default_date: string | null;
  };
  projects: { id: string; name: string }[];
  teamMembers: { id: string; name: string }[];
}) {
  if (timesheet.entries.length === 0) {
    if (storagePath) {
      await removeStorageFile(supabase, storagePath);
    }
    return NextResponse.json(
      { error: "No timesheet rows could be extracted from this document" },
      { status: 400 },
    );
  }

  const extractedData = buildTimesheetImportData({
    entries: timesheet.entries,
    defaultDate: timesheet.default_date,
    projects,
    teamMembers,
    matchByName,
  });

  const { data: importRecord, error: insertError } = await supabase
    .from("timesheet_imports")
    .insert({
      org_id: orgId,
      source_file_url: storagePath,
      file_name: fileName,
      status: "pending_approval",
      extracted_data: extractedData,
    })
    .select("*")
    .single();

  if (insertError || !importRecord) {
    if (storagePath) {
      await removeStorageFile(supabase, storagePath);
    }
    throw new Error(insertError?.message ?? "Failed to queue timesheet import");
  }

  const counts = countMatchedRows(extractedData);
  const totalHours = countTotalHours(extractedData);

  return NextResponse.json({
    document_type: "timesheet",
    timesheet_import: importRecord,
    matched_count: counts.matched,
    unmatched_count: counts.unmatched,
    total_hours: totalHours,
    message: `Timesheet queued for review (${counts.total} rows, ${totalHours}h total)`,
  });
}
