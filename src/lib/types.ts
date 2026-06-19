export type DocumentStatus = "pending" | "processing" | "completed" | "failed";

export type LineItem = {
  description: string;
  quantity?: number;
  unit_price?: number;
  amount?: number;
};

export type ExtractedDocumentData = {
  vendor_name: string;
  date: string;
  total_amount: number;
  currency?: string;
  line_items: LineItem[];
};

export type DocumentRecord = {
  id: string;
  org_id: string;
  file_name: string;
  file_url: string;
  status: DocumentStatus;
  extracted_data: ExtractedDocumentData | null;
  created_at: string;
};
