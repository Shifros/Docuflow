"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DocumentRecord } from "@/lib/types";

const statusVariant: Record<
  DocumentRecord["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "outline",
  processing: "secondary",
  completed: "default",
  failed: "destructive",
};

type DocumentsTableProps = {
  refreshKey: number;
};

export function DocumentsTable({ refreshKey }: DocumentsTableProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/documents");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load documents");
        }

        if (!cancelled) {
          setDocuments(payload.documents ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : "Failed to load documents";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const completedCount = documents.filter(
    (document) => document.status === "completed",
  ).length;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Docs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{documents.length}</p>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Completed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{completedCount}</p>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Model
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium">deepseek-v4-flash</p>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50 backdrop-blur-sm md:col-span-3">
        <CardHeader>
          <CardTitle className="text-lg">Recent Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents yet. Upload a PDF to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => {
                  const extracted = document.extracted_data;

                  return (
                    <TableRow key={document.id}>
                      <TableCell className="font-medium">
                        {document.file_name}
                      </TableCell>
                      <TableCell>
                        {extracted?.vendor_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        {extracted?.total_amount != null
                          ? `${extracted.currency ?? "USD"} ${extracted.total_amount}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[document.status]}>
                          {document.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(document.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
