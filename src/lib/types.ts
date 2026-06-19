import { z } from "zod";

/** AI responses often omit nullable fields or send false/empty values instead of null. */
const aiNullableString = () =>
  z.preprocess((value) => {
    if (value === null || value === undefined || value === false) {
      return null;
    }
    if (typeof value === "number" && Number.isNaN(value)) {
      return null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return null;
  }, z.string().nullable());

export type ExpenseStatus = "pending_approval" | "approved" | "failed";

export const ExpenseLineSchema = z.object({
  vendor_name: z.string().min(1),
  total_amount: z.coerce.number().positive(),
  date: aiNullableString(),
  expense_type: z.enum(["overhead", "project_direct", "unknown"]).default("overhead"),
  category: z.string().default("Misc"),
  suggested_project_name: aiNullableString(),
  line_description: aiNullableString(),
});

export type ExpenseLine = z.infer<typeof ExpenseLineSchema>;

export const ExpenseExtractionSchema = z.object({
  is_valid_receipt: z.boolean(),
  rejection_reason: aiNullableString(),
  is_multi_line_report: z.boolean().default(false),
  vendor_name: aiNullableString(),
  date: aiNullableString(),
  total_amount: z.number().nullable().optional().transform((v) => v ?? null),
  expense_type: z.enum(["overhead", "project_direct", "unknown"]).default("unknown"),
  category: z.string().default("Misc"),
  suggested_project_name: aiNullableString().describe(
    "Match to an active project if this is a project_direct expense",
  ),
  confidence_score: z.number().min(0).max(100).default(80),
  entries: z.array(ExpenseLineSchema).default([]),
  default_date: aiNullableString().optional(),
});

export type ExpenseExtractionData = z.infer<typeof ExpenseExtractionSchema>;

export const EXPENSE_JSON_SCHEMA = {
  is_valid_receipt: "boolean",
  rejection_reason: "string | null",
  is_multi_line_report: "boolean — true when document has a table/list of multiple expenses",
  vendor_name: "string | null (single receipt only)",
  date: "string | null",
  total_amount: "number | null (single receipt only — NOT the report grand total)",
  expense_type: "overhead | project_direct | unknown",
  category: "Software | Contractor | Payroll | Hosting | Misc",
  suggested_project_name: "string | null",
  confidence_score: "number (0-100)",
  default_date: "string | null (YYYY-MM-DD) when dates are missing or placeholders",
  entries: [
    {
      vendor_name: "string — service/vendor for this row e.g. Adobe Creative Cloud",
      total_amount: "number — amount for THIS row only",
      date: "string | null",
      expense_type: "overhead | project_direct | unknown",
      category: "Software | Contractor | Payroll | Hosting | Misc",
      suggested_project_name: "string | null",
      line_description: "string | null — account code or subscription label",
    },
  ],
};

export type ClientRecord = {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
};

export type BillingType = "fixed" | "hourly" | "retainer";
export type ProjectStatus = "active" | "completed" | "on_hold";

export type ProjectRecord = {
  id: string;
  org_id: string;
  client_id: string | null;
  name: string;
  fixed_budget: number;
  billing_type: BillingType;
  target_margin_percent: number;
  status: ProjectStatus;
  created_at: string;
  client?: ClientRecord | null;
};

export type ExpenseRecord = {
  id: string;
  org_id: string;
  vendor_name: string | null;
  total_amount: number | null;
  expense_type: "overhead" | "project_direct" | "unknown";
  category: string;
  project_id: string | null;
  receipt_url: string;
  file_name: string | null;
  status: ExpenseStatus;
  raw_extracted_data: ExpenseExtractionData | null;
  error_message: string | null;
  created_at: string;
  project?: ProjectRecord | null;
};

export type TeamMemberRole = "admin" | "manager" | "employee";

export type TeamMemberRecord = {
  id: string;
  org_id: string;
  user_id: string | null;
  name: string;
  role: TeamMemberRole;
  hourly_cost: number;
  created_at: string;
};

export type TimeEntryRecord = {
  id: string;
  org_id: string;
  project_id: string;
  team_member_id: string;
  hours: number;
  date: string;
  description: string | null;
  source_file_url: string | null;
  created_at: string;
  project?: ProjectRecord | null;
  team_member?: TeamMemberRecord | null;
};

export type RevenueStatus = "expected" | "paid";
export type RevenueType = "one_off" | "retainer_monthly";

export type RevenueEntryRecord = {
  id: string;
  org_id: string;
  project_id: string;
  client_id: string | null;
  amount: number;
  date: string;
  status: RevenueStatus;
  type: RevenueType;
  created_at: string;
  project?: ProjectRecord | null;
  client?: ClientRecord | null;
};

export type ProjectActivityType = "time" | "expense" | "revenue" | "timesheet_import";

export type ProjectActivityItem = {
  id: string;
  type: ProjectActivityType;
  date: string;
  title: string;
  subtitle: string;
  amount: number;
  created_at: string;
};

export type ProjectPnLSummary = {
  grossRevenue: number;
  totalExpenses: number;
  laborCost: number;
  netProfit: number;
  netProfitMarginPercent: number;
  targetMarginPercent: number;
  marginHealth: "healthy" | "warning" | "critical";
};

export const TimesheetLineSchema = z.object({
  team_member_name: z.string(),
  hours: z.number().positive(),
  date: aiNullableString(),
  description: aiNullableString(),
  suggested_project_name: aiNullableString(),
});

export const TimesheetExtractionSchema = z.object({
  entries: z.array(TimesheetLineSchema).default([]),
  default_date: aiNullableString(),
});

export type TimesheetLine = z.infer<typeof TimesheetLineSchema>;
export type TimesheetExtractionData = z.infer<typeof TimesheetExtractionSchema>;

export type TimesheetImportRow = {
  team_member_name: string;
  hours: number;
  date: string | null;
  description: string | null;
  suggested_project_name: string | null;
  team_member_id: string | null;
  project_id: string | null;
};

export type TimesheetImportData = {
  default_date: string | null;
  rows: TimesheetImportRow[];
};

export type TimesheetImportStatus = "pending_approval" | "approved" | "failed";

export type TimesheetImportRecord = {
  id: string;
  org_id: string;
  source_file_url: string | null;
  file_name: string | null;
  status: TimesheetImportStatus;
  extracted_data: TimesheetImportData;
  error_message: string | null;
  created_at: string;
};

export const DocumentExtractionSchema = z.discriminatedUnion("document_type", [
  z.object({
    document_type: z.literal("expense"),
    rejection_reason: aiNullableString(),
    expense: ExpenseExtractionSchema,
  }),
  z.object({
    document_type: z.literal("timesheet"),
    rejection_reason: aiNullableString(),
    timesheet: TimesheetExtractionSchema,
  }),
  z.object({
    document_type: z.literal("invalid"),
    rejection_reason: z.string(),
    expense: z.null().optional(),
    timesheet: z.null().optional(),
  }),
]);

export type DocumentExtractionData = z.infer<typeof DocumentExtractionSchema>;

export const DOCUMENT_EXTRACTION_JSON_SCHEMA = {
  document_type: "expense | timesheet | invalid",
  rejection_reason: "string | null",
  expense: "ExpenseExtractionSchema object when document_type is expense, else null",
  timesheet: {
    default_date: "string | null (YYYY-MM-DD)",
    entries: [
      {
        team_member_name: "string",
        hours: "number",
        date: "string | null (YYYY-MM-DD)",
        description: "string | null",
        suggested_project_name: "string | null",
      },
    ],
  },
};

export type IngestionResult =
  | { document_type: "expense"; expense: ExpenseRecord }
  | {
      document_type: "expense";
      expense_count: number;
      expenses: ExpenseRecord[];
    }
  | {
      document_type: "timesheet";
      time_entries: TimeEntryRecord[];
      unmatched: TimesheetLine[];
      source_file_url: string;
    };

export type VendorSummary = {
  vendor_name: string;
  total_spend: number;
  average_monthly_spend: number;
  last_paid_amount: number;
  previous_paid_amount: number | null;
  price_increased: boolean;
  increase_percent: number | null;
  invoice_count: number;
  monthly_amounts: { month: string; amount: number }[];
};

export type DashboardAnalytics = {
  category_breakdown: { name: string; value: number; type: "overhead" | "project_direct" }[];
  expense_type_split: { name: string; value: number }[];
  cashflow_months: {
    month: string;
    revenue: number;
    costs: number;
    net: number;
  }[];
};
