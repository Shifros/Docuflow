import { NextResponse } from "next/server";
import { createAdminClient, getDefaultOrgId } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");

    const supabase = createAdminClient();
    const orgId = getDefaultOrgId();

    let query = supabase
      .from("time_entries")
      .select("*, project:projects(*), team_member:team_members(*)")
      .eq("org_id", orgId)
      .order("date", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ time_entries: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load time entries";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { project_id, team_member_id, hours, date, description } = body;

    if (!project_id || !team_member_id || !hours || !date) {
      return NextResponse.json(
        { error: "project_id, team_member_id, hours, and date are required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const orgId = getDefaultOrgId();

    const { data, error } = await supabase
      .from("time_entries")
      .insert({
        org_id: orgId,
        project_id,
        team_member_id,
        hours,
        date,
        description: description ?? null,
      })
      .select("*, project:projects(*), team_member:team_members(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ time_entry: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create time entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
