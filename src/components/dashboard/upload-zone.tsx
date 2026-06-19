"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DocumentRecord } from "@/lib/types";

type UploadZoneProps = {
  onUploaded: (document: DocumentRecord) => void;
};

export function UploadZone({ onUploaded }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  async function uploadFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are supported");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Upload failed");
      }

      onUploaded(payload.document as DocumentRecord);
      toast.success("Document extracted successfully");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) {
      void uploadFile(file);
    }
  }

  return (
    <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div
          className={`flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border/80 bg-background/40"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleFiles(event.dataTransfer.files);
          }}
        >
          {isUploading ? (
            <>
              <Loader2 className="mb-3 size-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Processing with DeepSeek…</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Extracting vendor, date, total, and line items
              </p>
            </>
          ) : (
            <>
              <FileUp className="mb-3 size-8 text-muted-foreground" />
              <p className="text-sm font-medium">Drop a PDF invoice here</p>
              <p className="mt-1 text-xs text-muted-foreground">
                or choose a file from your computer
              </p>
              <Button
                className="mt-4"
                type="button"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
              >
                Select PDF
              </Button>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          accept="application/pdf"
          className="hidden"
          type="file"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </CardContent>
    </Card>
  );
}
