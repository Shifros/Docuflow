import OpenAI from "openai";
import { ZodError } from "zod";
import { normalizeExpenseExtraction } from "@/lib/normalize-extraction";
import {
  DOCUMENT_EXTRACTION_JSON_SCHEMA,
  DocumentExtractionSchema,
  ExpenseExtractionSchema,
  type DocumentExtractionData,
  type ExpenseExtractionData,
} from "@/lib/types";

export const DEEPSEEK_MODEL =
  process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";

export function createDeepSeekClient() {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  });
}

export async function extractDocumentData(
  text: string,
  activeProjects: string[],
  teamMemberNames: string[],
): Promise<DocumentExtractionData> {
  const systemPrompt = `You are an AI Financial Controller for a digital agency.
Analyze the document text and classify it into ONE of two actionable types, or reject it.

DOCUMENT TYPE A — Single Receipt / Invoice / Purchase Order
- Set document_type to "expense"
- Set is_multi_line_report to false
- Populate vendor_name, total_amount, expense_type, category for that ONE transaction
- Do NOT use the entries array

DOCUMENT TYPE A2 — Expense Report / Statement with MULTIPLE line items
- Set document_type to "expense"
- Set is_multi_line_report to true
- Set is_valid_receipt to true
- Populate entries[] with ONE object per table row / subscription / line item
- CRITICAL: Extract EACH row separately — never collapse the report into one expense
- Each entry.vendor_name = the service or vendor on that row (e.g. "Microsoft 365", "Adobe Creative Cloud", "Salesforce CRM")
- Each entry.total_amount = the amount on THAT row only (e.g. 500, 1200, 600) — NOT the document grand total
- Ignore summary/total rows when building entries (e.g. skip a row that only says "Total" with $4,500)
- Software subscriptions (Microsoft, Adobe, AWS, Slack, etc.) => expense_type "overhead", category "Software"
- Use line_description for account codes or subscription labels when present
- Use default_date when row dates are placeholders (XX-XX-XXXX) or missing

DOCUMENT TYPE B — Timesheet / Activity Log / Hours Report
- Set document_type to "timesheet" when you detect rows of people, hours, dates, or project/task descriptions
- Populate timesheet.entries as an array of rows extracted from the document
- Use team_member_name exactly as written in the document
- Use suggested_project_name when a project/client is referenced per row
- Use default_date when a single date applies to the whole sheet (YYYY-MM-DD)

If the document is junk, unrelated, or unreadable, set document_type to "invalid" with rejection_reason.

Active projects:
${JSON.stringify(activeProjects, null, 2)}

Known team members (prefer matching these names when possible):
${JSON.stringify(teamMemberNames, null, 2)}

For single expense documents:
- Software subscriptions, rent, utilities => overhead
- Freelancer/contractor/client-specific costs => project_direct

Return ONLY valid JSON matching this schema:
${JSON.stringify(DOCUMENT_EXTRACTION_JSON_SCHEMA, null, 2)}

When document_type is "expense", include expense fields:
${JSON.stringify({
  is_valid_receipt: "boolean",
  rejection_reason: "string | null",
  is_multi_line_report: "boolean",
  vendor_name: "string | null (single receipt only)",
  date: "string | null",
  total_amount: "number | null (single receipt only)",
  expense_type: "overhead | project_direct | unknown",
  category: "Software | Contractor | Payroll | Hosting | Misc",
  suggested_project_name: "string | null",
  confidence_score: "number (0-100)",
  default_date: "string | null",
  entries: "array of line items when is_multi_line_report is true",
}, null, 2)}`;

  const client = createDeepSeekClient();

  const completion = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    thinking: { type: "disabled" },
  } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek returned an empty response");
  }

  const parsedJson = JSON.parse(content);

  try {
    const parsed = DocumentExtractionSchema.parse(parsedJson);

    if (parsed.document_type === "expense") {
      return {
        ...parsed,
        expense: normalizeExpenseExtraction(parsed.expense),
      };
    }

    return parsed;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(
        `AI response validation failed: ${error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    throw error;
  }
}

/** @deprecated Use extractDocumentData */
export async function extractExpenseData(
  text: string,
  activeProjects: string[],
): Promise<ExpenseExtractionData> {
  const result = await extractDocumentData(text, activeProjects, []);
  if (result.document_type !== "expense") {
    throw new Error(result.rejection_reason ?? "Document is not an expense");
  }
  return result.expense;
}

export { ExpenseExtractionSchema };
