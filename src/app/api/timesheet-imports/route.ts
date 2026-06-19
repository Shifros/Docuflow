import { NextResponse } from "next/server";
import { createAdminClient, getDefaultOrgId } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const orgId = getDefaultOrgId();

    const { data, error } = await supabase
      .from("timesheet_imports")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ imports: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load timesheet imports";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
