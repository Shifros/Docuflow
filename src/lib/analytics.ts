import type {
  DashboardAnalytics,
  ExpenseRecord,
  RevenueEntryRecord,
  TimeEntryRecord,
} from "@/lib/types";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function getLastNMonths(count: number) {
  const months: string[] = [];
  const now = new Date();

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(date));
  }

  return months;
}

export function buildDashboardAnalytics({
  expenses,
  revenueEntries,
  timeEntries,
}: {
  expenses: ExpenseRecord[];
  revenueEntries: RevenueEntryRecord[];
  timeEntries: TimeEntryRecord[];
}): DashboardAnalytics {
  const now = new Date();
  const currentMonth = monthKey(now);

  const approvedThisMonth = expenses.filter((expense) => {
    if (expense.status !== "approved") return false;
    return monthKey(new Date(expense.created_at)) === currentMonth;
  });

  const categoryMap = new Map<
    string,
    { value: number; type: "overhead" | "project_direct" }
  >();

  for (const expense of approvedThisMonth) {
    const key = expense.category || "Misc";
    const current = categoryMap.get(key) ?? {
      value: 0,
      type:
        expense.expense_type === "project_direct" ? "project_direct" : "overhead",
    };
    current.value += expense.total_amount ?? 0;
    categoryMap.set(key, current);
  }

  const category_breakdown = Array.from(categoryMap.entries()).map(
    ([name, data]) => ({
      name,
      value: data.value,
      type: data.type,
    }),
  );

  const overheadTotal = approvedThisMonth
    .filter((e) => e.expense_type === "overhead")
    .reduce((sum, e) => sum + (e.total_amount ?? 0), 0);

  const cogsTotal = approvedThisMonth
    .filter((e) => e.expense_type === "project_direct")
    .reduce((sum, e) => sum + (e.total_amount ?? 0), 0);

  const expense_type_split = [
    { name: "Overhead (OpEx)", value: overheadTotal },
    { name: "Project Direct (COGS)", value: cogsTotal },
  ].filter((item) => item.value > 0);

  const months = getLastNMonths(6);

  const cashflow_months = months.map((month) => {
    const revenue = revenueEntries
      .filter(
        (entry) =>
          entry.status === "paid" && monthKey(new Date(entry.date)) === month,
      )
      .reduce((sum, entry) => sum + entry.amount, 0);

    const expenseCosts = expenses
      .filter(
        (entry) =>
          entry.status === "approved" &&
          monthKey(new Date(entry.created_at)) === month,
      )
      .reduce((sum, entry) => sum + (entry.total_amount ?? 0), 0);

    const laborCosts = timeEntries
      .filter((entry) => monthKey(new Date(entry.date)) === month)
      .reduce(
        (sum, entry) =>
          sum + entry.hours * (entry.team_member?.hourly_cost ?? 0),
        0,
      );

    const costs = expenseCosts + laborCosts;

    return {
      month: monthLabel(month),
      revenue,
      costs,
      net: revenue - costs,
    };
  });

  return {
    category_breakdown,
    expense_type_split,
    cashflow_months,
  };
}
