import { NextResponse } from "next/server";
import {
  buildProjectActivityFeed,
  calculateLaborCost,
  calculateProjectPnL,
  sumApprovedExpenses,
  sumPaidRevenue,
} from "@/lib/project-pl";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ExpenseRecord,
  RevenueEntryRecord,
  TimeEntryRecord,
} from "@/lib/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*, client:clients(*)")
      .eq("id", id)
      .single();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    const [expensesResult, timeResult, revenueResult] = await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .eq("project_id", id)
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
      supabase
        .from("time_entries")
        .select("*, team_member:team_members(*)")
        .eq("project_id", id)
        .order("date", { ascending: false }),
      supabase
        .from("revenue_entries")
        .select("*")
        .eq("project_id", id)
        .order("date", { ascending: false }),
    ]);

    if (expensesResult.error) {
      return NextResponse.json(
        { error: expensesResult.error.message },
        { status: 500 },
      );
    }
    if (timeResult.error) {
      return NextResponse.json(
        { error: timeResult.error.message },
        { status: 500 },
      );
    }
    if (revenueResult.error) {
      return NextResponse.json(
        { error: revenueResult.error.message },
        { status: 500 },
      );
    }

    const expenses = (expensesResult.data ?? []) as ExpenseRecord[];
    const timeEntries = (timeResult.data ?? []) as TimeEntryRecord[];
    const revenueEntries = (revenueResult.data ?? []) as RevenueEntryRecord[];

    const grossRevenue = sumPaidRevenue(revenueEntries);
    const totalExpenses = sumApprovedExpenses(expenses);
    const laborCost = calculateLaborCost(timeEntries);

    const pnl = calculateProjectPnL({
      grossRevenue,
      totalExpenses,
      laborCost,
      targetMarginPercent: Number(project.target_margin_percent ?? 40),
    });

    const activity = buildProjectActivityFeed({
      timeEntries,
      expenses,
      revenueEntries,
    });

    return NextResponse.json({
      project,
      expenses,
      time_entries: timeEntries,
      revenue_entries: revenueEntries,
      pnl,
      activity,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load project details";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
