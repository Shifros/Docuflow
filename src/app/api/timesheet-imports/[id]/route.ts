import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TimesheetImportData } from "@/lib/types";

async function insertApprovedRows({
  supabase,
  orgId,
  importId,
  extractedData,
  sourceFileUrl,
}: {
  supabase: SupabaseClient;
  orgId: string;
  importId: string;
  extractedData: TimesheetImportData;
  sourceFileUrl: string | null;
}) {
  const inserted = [];

  for (const row of extractedData.rows) {
    if (!row.team_member_id || !row.project_id) {
      continue;
    }

    const entryDate =
      row.date ??
      extractedData.default_date ??
      new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("time_entries")
      .insert({
        org_id: orgId,
        project_id: row.project_id,
        team_member_id: row.team_member_id,
        hours: row.hours,
        date: entryDate,
        description: row.description ?? "Imported from timesheet upload",
        source_file_url: sourceFileUrl,
      })
      .select("*, project:projects(*), team_member:team_members(*)")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    inserted.push(data);
  }

  if (inserted.length === 0) {
    throw new Error(
      "No rows could be imported. Assign team members and projects to at least one row.",
    );
  }

  const { error: updateError } = await supabase
    .from("timesheet_imports")
    .update({
      status: "approved",
      extracted_data: extractedData,
      error_message: null,
    })
    .eq("id", importId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return inserted;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const extractedData = body.extracted_data as TimesheetImportData | undefined;

    if (!extractedData?.rows) {
      return NextResponse.json(
        { error: "extracted_data with rows is required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("timesheet_imports")
      .update({ extracted_data: extractedData })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ import: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update timesheet import";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: existing, error: fetchError } = await supabase
      .from("timesheet_imports")
      .select("source_file_url")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (existing?.source_file_url) {
      await supabase.storage
        .from("documents")
        .remove([existing.source_file_url]);
    }

    const { error } = await supabase
      .from("timesheet_imports")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete timesheet import";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const extractedData = body.extracted_data as TimesheetImportData | undefined;
    const supabase = createAdminClient();

    const { data: existing, error: fetchError } = await supabase
      .from("timesheet_imports")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: fetchError?.message ?? "Timesheet import not found" },
        { status: 404 },
      );
    }

    if (existing.status !== "pending_approval") {
      return NextResponse.json(
        { error: "This timesheet import has already been processed" },
        { status: 400 },
      );
    }

    const dataToApprove =
      extractedData ?? (existing.extracted_data as TimesheetImportData);

    const timeEntries = await insertApprovedRows({
      supabase,
      orgId: existing.org_id,
      importId: id,
      extractedData: dataToApprove,
      sourceFileUrl: existing.source_file_url,
    });

    return NextResponse.json({
      import: { ...existing, status: "approved" },
      time_entries: timeEntries,
      message: `${timeEntries.length} time ${timeEntries.length === 1 ? "entry" : "entries"} imported from timesheet`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to approve timesheet import";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
