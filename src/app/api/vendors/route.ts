import { NextResponse } from "next/server";
import { buildVendorSummaries } from "@/lib/vendors";
import { createAdminClient, getDefaultOrgId } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const orgId = getDefaultOrgId();

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const vendors = buildVendorSummaries(data ?? []);

    return NextResponse.json({ vendors });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load vendor analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
