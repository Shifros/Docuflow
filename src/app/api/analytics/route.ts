import { NextResponse } from "next/server";
import { buildDashboardAnalytics } from "@/lib/analytics";
import { createAdminClient, getDefaultOrgId } from "@/lib/supabase/admin";
import type {
  ExpenseRecord,
  RevenueEntryRecord,
  TimeEntryRecord,
} from "@/lib/types";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const orgId = getDefaultOrgId();

    const [expensesResult, revenueResult, timeResult] = await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .eq("org_id", orgId),
      supabase
        .from("revenue_entries")
        .select("*")
        .eq("org_id", orgId),
      supabase
        .from("time_entries")
        .select("*, team_member:team_members(*)")
        .eq("org_id", orgId),
    ]);

    if (expensesResult.error) {
      return NextResponse.json(
        { error: expensesResult.error.message },
        { status: 500 },
      );
    }
    if (revenueResult.error) {
      return NextResponse.json(
        { error: revenueResult.error.message },
        { status: 500 },
      );
    }
    if (timeResult.error) {
      return NextResponse.json(
        { error: timeResult.error.message },
        { status: 500 },
      );
    }

    const analytics = buildDashboardAnalytics({
      expenses: (expensesResult.data ?? []) as ExpenseRecord[],
      revenueEntries: (revenueResult.data ?? []) as RevenueEntryRecord[],
      timeEntries: (timeResult.data ?? []) as TimeEntryRecord[],
    });

    return NextResponse.json({ analytics });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
