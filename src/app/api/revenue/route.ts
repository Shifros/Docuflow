import { NextResponse } from "next/server";
import { createAdminClient, getDefaultOrgId } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");

    const supabase = createAdminClient();
    const orgId = getDefaultOrgId();

    let query = supabase
      .from("revenue_entries")
      .select("*, project:projects(*), client:clients(*)")
      .eq("org_id", orgId)
      .order("date", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ revenue_entries: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load revenue entries";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { project_id, client_id, amount, date, status, type } = body;

    if (!project_id || amount == null || !date) {
      return NextResponse.json(
        { error: "project_id, amount, and date are required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const orgId = getDefaultOrgId();

    const { data, error } = await supabase
      .from("revenue_entries")
      .insert({
        org_id: orgId,
        project_id,
        client_id: client_id ?? null,
        amount,
        date,
        status: status ?? "expected",
        type: type ?? "one_off",
      })
      .select("*, project:projects(*), client:clients(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ revenue_entry: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create revenue entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
