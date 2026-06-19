import { NextResponse } from "next/server";
import { extractDocumentData } from "@/lib/deepseek";
import { extractTextFromPdf } from "@/lib/pdf";
import { createAdminClient, getDefaultOrgId } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const orgId = getDefaultOrgId();

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ documents: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load documents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const orgId = getDefaultOrgId();
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${orgId}/${crypto.randomUUID()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: document, error: insertError } = await supabase
      .from("documents")
      .insert({
        org_id: orgId,
        file_name: file.name,
        file_url: storagePath,
        status: "processing",
      })
      .select("*")
      .single();

    if (insertError || !document) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to create document" },
        { status: 500 },
      );
    }

    try {
      const text = await extractTextFromPdf(buffer);

      if (!text) {
        throw new Error("No readable text found in the PDF");
      }

      const extractedData = await extractDocumentData(text);

      const { data: completedDocument, error: updateError } = await supabase
        .from("documents")
        .update({
          status: "completed",
          extracted_data: extractedData,
        })
        .eq("id", document.id)
        .select("*")
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      return NextResponse.json({ document: completedDocument });
    } catch (processingError) {
      const message =
        processingError instanceof Error
          ? processingError.message
          : "Extraction failed";

      await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", document.id);

      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
