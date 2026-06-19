import type {
  ExpenseRecord,
  ProjectActivityItem,
  ProjectPnLSummary,
  RevenueEntryRecord,
  TimeEntryRecord,
} from "@/lib/types";

type CalculateProjectPnLInput = {
  grossRevenue: number;
  totalExpenses: number;
  laborCost: number;
  targetMarginPercent: number;
};

export function calculateProjectPnL({
  grossRevenue,
  totalExpenses,
  laborCost,
  targetMarginPercent,
}: CalculateProjectPnLInput): ProjectPnLSummary {
  const netProfit = grossRevenue - totalExpenses - laborCost;
  const netProfitMarginPercent =
    grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  let marginHealth: ProjectPnLSummary["marginHealth"] = "critical";
  if (netProfitMarginPercent >= targetMarginPercent) {
    marginHealth = "healthy";
  } else if (netProfitMarginPercent >= targetMarginPercent * 0.5) {
    marginHealth = "warning";
  }

  return {
    grossRevenue,
    totalExpenses,
    laborCost,
    netProfit,
    netProfitMarginPercent,
    targetMarginPercent,
    marginHealth,
  };
}

export function sumPaidRevenue(entries: RevenueEntryRecord[]): number {
  return entries
    .filter((entry) => entry.status === "paid")
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export function sumExpectedRevenue(entries: RevenueEntryRecord[]): number {
  return entries
    .filter((entry) => entry.status === "expected")
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export function sumApprovedExpenses(expenses: ExpenseRecord[]): number {
  return expenses
    .filter((expense) => expense.status === "approved")
    .reduce((sum, expense) => sum + (expense.total_amount ?? 0), 0);
}

export function calculateLaborCost(
  timeEntries: TimeEntryRecord[],
): number {
  return timeEntries.reduce((sum, entry) => {
    const hourlyCost = entry.team_member?.hourly_cost ?? 0;
    return sum + entry.hours * hourlyCost;
  }, 0);
}

export function buildProjectActivityFeed({
  timeEntries,
  expenses,
  revenueEntries,
}: {
  timeEntries: TimeEntryRecord[];
  expenses: ExpenseRecord[];
  revenueEntries: RevenueEntryRecord[];
}): ProjectActivityItem[] {
  const manualTimeEntries: TimeEntryRecord[] = [];
  const importGroups = new Map<string, TimeEntryRecord[]>();

  for (const entry of timeEntries) {
    if (entry.source_file_url) {
      const group = importGroups.get(entry.source_file_url) ?? [];
      group.push(entry);
      importGroups.set(entry.source_file_url, group);
    } else {
      manualTimeEntries.push(entry);
    }
  }

  const importItems: ProjectActivityItem[] = Array.from(
    importGroups.entries(),
  ).map(([sourceKey, group]) => {
    const sortedGroup = [...group].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const totalHours = group.reduce((sum, entry) => sum + entry.hours, 0);
    const laborCost = group.reduce(
      (sum, entry) =>
        sum + entry.hours * (entry.team_member?.hourly_cost ?? 0),
      0,
    );
    const members = [
      ...new Set(
        group
          .map((entry) => entry.team_member?.name)
          .filter((name): name is string => Boolean(name)),
      ),
    ];

    return {
      id: `timesheet-import-${sourceKey}`,
      type: "timesheet_import",
      date: sortedGroup[0]?.date ?? sortedGroup[0]?.created_at.slice(0, 10),
      title: `AI imported ${totalHours}h from timesheet`,
      subtitle: `${group.length} ${group.length === 1 ? "entry" : "entries"} · ${members.join(", ") || "Team"}`,
      amount: laborCost,
      created_at: sortedGroup[0]?.created_at ?? new Date().toISOString(),
    };
  });

  const timeItems: ProjectActivityItem[] = manualTimeEntries.map((entry) => ({
    id: entry.id,
    type: "time",
    date: entry.date,
    title: `${entry.team_member?.name ?? "Team member"} logged ${entry.hours}h`,
    subtitle: entry.description ?? "Time entry",
    amount: entry.hours * (entry.team_member?.hourly_cost ?? 0),
    created_at: entry.created_at,
  }));

  const expenseItems: ProjectActivityItem[] = expenses.map((expense) => ({
    id: expense.id,
    type: "expense",
    date: expense.created_at.slice(0, 10),
    title: expense.vendor_name ?? expense.file_name ?? "Expense",
    subtitle: `${expense.category} · ${expense.expense_type}`,
    amount: expense.total_amount ?? 0,
    created_at: expense.created_at,
  }));

  const revenueItems: ProjectActivityItem[] = revenueEntries.map((entry) => ({
    id: entry.id,
    type: "revenue",
    date: entry.date,
    title:
      entry.status === "paid"
        ? "Payment received"
        : "Expected payment scheduled",
    subtitle: entry.type === "retainer_monthly" ? "Retainer" : "One-off",
    amount: entry.amount,
    created_at: entry.created_at,
  }));

  return [...importItems, ...timeItems, ...expenseItems, ...revenueItems].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function marginHealthClass(
  health: ProjectPnLSummary["marginHealth"],
): string {
  if (health === "healthy") return "text-success";
  if (health === "warning") return "text-amber-400";
  return "text-destructive";
}
