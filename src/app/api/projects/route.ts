import { NextResponse } from "next/server";
import { createAdminClient, getDefaultOrgId } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const orgId = getDefaultOrgId();

    const { data, error } = await supabase
      .from("projects")
      .select("*, client:clients(*)")
      .eq("org_id", orgId)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ projects: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
