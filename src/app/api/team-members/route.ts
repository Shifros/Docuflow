import { NextResponse } from "next/server";
import { createAdminClient, getDefaultOrgId } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const orgId = getDefaultOrgId();

    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("org_id", orgId)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ team_members: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load team members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, role, hourly_cost } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const orgId = getDefaultOrgId();

    const { data, error } = await supabase
      .from("team_members")
      .insert({
        org_id: orgId,
        name: name.trim(),
        role: role ?? "employee",
        hourly_cost: hourly_cost ?? 0,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ team_member: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create team member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
