import OpenAI from "openai";
import type { ExtractedDocumentData } from "@/lib/types";

export const DEEPSEEK_MODEL =
  process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";

const EXTRACTION_PROMPT = `Extract the Vendor Name, Date, Total Amount, and Line Items from this document.
Return strictly as JSON with this shape:
{
  "vendor_name": "string",
  "date": "ISO date string or best-effort date text",
  "total_amount": 0,
  "currency": "USD",
  "line_items": [
    {
      "description": "string",
      "quantity": 0,
      "unit_price": 0,
      "amount": 0
    }
  ]
}`;

export function createDeepSeekClient() {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  });
}

export async function extractDocumentData(
  documentText: string,
): Promise<ExtractedDocumentData> {
  const client = createDeepSeekClient();

  const completion = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      {
        role: "system",
        content: EXTRACTION_PROMPT,
      },
      {
        role: "user",
        content: documentText,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    thinking: { type: "disabled" },
  } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek returned an empty response");
  }

  return JSON.parse(content) as ExtractedDocumentData;
}
