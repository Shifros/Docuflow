import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { hourly_cost, role, name } = body;

    const updateData: Record<string, unknown> = {};
    if (hourly_cost !== undefined) updateData.hourly_cost = hourly_cost;
    if (role !== undefined) updateData.role = role;
    if (name !== undefined) updateData.name = name;

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("team_members")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ team_member: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update team member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
