"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DocumentsTable } from "./documents-table";
import { UploadZone } from "./upload-zone";

export function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  function handleUploaded() {
    setRefreshKey((current) => current + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
      <div className="space-y-2">
        <Badge variant="secondary">Internal Tool Showcase</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">DocuFlow AI</h1>
        <p className="max-w-2xl text-muted-foreground">
          Upload PDF invoices and purchase orders. DeepSeek V4 Flash extracts
          structured data into your Supabase database.
        </p>
      </div>

      <UploadZone onUploaded={handleUploaded} />
      <DocumentsTable refreshKey={refreshKey} />
    </div>
  );
}
