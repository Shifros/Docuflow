import type { ExpenseRecord, VendorSummary } from "@/lib/types";

const PRICE_INCREASE_THRESHOLD = 0.05;

function monthKey(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date.slice(0, 7);
  }
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

export function buildVendorSummaries(expenses: ExpenseRecord[]): VendorSummary[] {
  const approved = expenses.filter(
    (expense) =>
      expense.status === "approved" &&
      expense.vendor_name &&
      expense.total_amount != null,
  );

  const grouped = new Map<string, ExpenseRecord[]>();

  for (const expense of approved) {
    const vendor = expense.vendor_name!.trim();
    const list = grouped.get(vendor) ?? [];
    list.push(expense);
    grouped.set(vendor, list);
  }

  return Array.from(grouped.entries())
    .map(([vendor_name, vendorExpenses]) => {
      const sorted = [...vendorExpenses].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      const total_spend = vendorExpenses.reduce(
        (sum, expense) => sum + (expense.total_amount ?? 0),
        0,
      );

      const months = new Set(
        vendorExpenses.map((expense) => monthKey(expense.created_at)),
      );
      const average_monthly_spend =
        months.size > 0 ? total_spend / months.size : total_spend;

      const last_paid_amount = sorted[0]?.total_amount ?? 0;
      const previous_paid_amount = sorted[1]?.total_amount ?? null;

      let price_increased = false;
      let increase_percent: number | null = null;

      if (
        previous_paid_amount != null &&
        previous_paid_amount > 0 &&
        last_paid_amount > previous_paid_amount
      ) {
        increase_percent =
          ((last_paid_amount - previous_paid_amount) / previous_paid_amount) *
          100;
        price_increased = increase_percent / 100 > PRICE_INCREASE_THRESHOLD;
      }

      const monthlyMap = new Map<string, number>();
      for (const expense of vendorExpenses) {
        const key = monthKey(expense.created_at);
        monthlyMap.set(
          key,
          (monthlyMap.get(key) ?? 0) + (expense.total_amount ?? 0),
        );
      }

      const monthly_amounts = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, amount]) => ({ month, amount }));

      return {
        vendor_name,
        total_spend,
        average_monthly_spend,
        last_paid_amount,
        previous_paid_amount,
        price_increased,
        increase_percent,
        invoice_count: vendorExpenses.length,
        monthly_amounts,
      };
    })
    .sort((a, b) => b.total_spend - a.total_spend);
}

export function getVendorDetail(
  vendors: VendorSummary[],
  vendorName: string,
): VendorSummary | null {
  return (
    vendors.find(
      (vendor) =>
        vendor.vendor_name.toLowerCase() === vendorName.toLowerCase(),
    ) ?? null
  );
}
