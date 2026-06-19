import type { ExpenseExtractionData } from "@/lib/types";

const TOTAL_ROW_PATTERN = /^total$/i;

export function normalizeExpenseExtraction(
  expense: ExpenseExtractionData,
): ExpenseExtractionData {
  const entries = expense.entries.filter((line) => {
    const vendor = line.vendor_name.trim();
    if (!vendor || TOTAL_ROW_PATTERN.test(vendor)) {
      return false;
    }
    return line.total_amount > 0;
  });

  const isReport = expense.is_multi_line_report || entries.length > 1;

  if (isReport && entries.length > 0) {
    return {
      ...expense,
      is_valid_receipt: true,
      is_multi_line_report: true,
      entries,
    };
  }

  return {
    ...expense,
    entries,
  };
}
