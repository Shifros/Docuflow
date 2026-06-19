"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardPaste, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseJsonResponse } from "@/lib/api-client";
import type { ExpenseRecord, TimesheetImportRecord } from "@/lib/types";

const ACCEPTED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

type UploadZoneProps = {
  onUploaded?: () => void;
  variant?: "default" | "hero";
};

type UploadPhase = "idle" | "extracting" | "processing";

export function UploadZone({
  onUploaded,
  variant = "default",
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");

  const submitIngestion = useCallback(
    async (formData: FormData) => {
      setUploadPhase("processing");

      const response = await fetch("/api/expenses", {
        method: "POST",
        body: formData,
      });

      const payload = await parseJsonResponse<{
        document_type?: "expense" | "timesheet";
        expense?: ExpenseRecord;
        expenses?: ExpenseRecord[];
        expense_count?: number;
        timesheet_import?: TimesheetImportRecord;
        matched_count?: number;
        unmatched_count?: number;
        message?: string;
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Upload failed");
      }

      if (payload.document_type === "timesheet") {
        toast.success(
          payload.message ?? "Timesheet queued for review in Triage",
        );
        if ((payload.unmatched_count ?? 0) > 0) {
          toast.warning(
            `${payload.unmatched_count} row${payload.unmatched_count === 1 ? "" : "s"} need manual mapping`,
          );
        }
      } else if (payload.expenses && (payload.expense_count ?? payload.expenses.length) > 1) {
        const count = payload.expense_count ?? payload.expenses.length;
        toast.success(
          payload.message ??
            `${count} expenses extracted from report and sent to Triage`,
        );
      } else if (payload.expense) {
        toast.success("Receipt routed to Triage Inbox for approval");
      } else {
        throw new Error("Unexpected response from upload");
      }

      onUploaded?.();
    },
    [onUploaded],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const { extractTextFromDocument, isAcceptedDocument } = await import(
        "@/lib/ocrClient"
      );

      if (!isAcceptedDocument(file)) {
        toast.error("Only PDF and image files (PNG, JPG, WEBP) are supported");
        return;
      }

      setUploadPhase("extracting");

      try {
        const extractedText = await extractTextFromDocument(file);

        if (!extractedText) {
          throw new Error("No readable text found in the document");
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("extracted_text", extractedText);

        await submitIngestion(formData);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";
        toast.error(message);
      } finally {
        setUploadPhase("idle");
      }
    },
    [submitIngestion],
  );

  const uploadPastedText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        toast.error("Clipboard is empty");
        return;
      }

      setUploadPhase("processing");

      try {
        const formData = new FormData();
        formData.append("extracted_text", trimmed);
        formData.append("file_name", "pasted-timesheet.txt");

        await submitIngestion(formData);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Paste upload failed";
        toast.error(message);
      } finally {
        setUploadPhase("idle");
      }
    },
    [submitIngestion],
  );

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();

      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const extension = imageType.split("/")[1] ?? "png";
          const file = new File([blob], `pasted-image.${extension}`, {
            type: imageType,
          });
          await uploadFile(file);
          return;
        }
      }

      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        await uploadPastedText(text);
        return;
      }

      toast.error("Clipboard has no supported image or text content");
    } catch {
      try {
        const text = await navigator.clipboard.readText();
        if (text.trim()) {
          await uploadPastedText(text);
          return;
        }
      } catch {
        // fall through
      }
      toast.error("Unable to read clipboard. Check browser permissions.");
    }
  }, [uploadFile, uploadPastedText]);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (uploadPhase !== "idle") return;

      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void uploadFile(file);
            return;
          }
        }
      }

      const text = event.clipboardData?.getData("text/plain")?.trim();
      if (text) {
        event.preventDefault();
        void uploadPastedText(text);
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [uploadFile, uploadPastedText, uploadPhase]);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) {
      void uploadFile(file);
    }
  }

  const isHero = variant === "hero";

  return (
    <div className={isHero ? undefined : "dashboard-panel"}>
      <div
        ref={dropZoneRef}
        className={`flex flex-col items-center justify-center rounded-lg border border-dashed text-center transition-colors ${
          isHero ? "min-h-48 p-6 sm:min-h-52" : "min-h-44 p-10"
        } ${
          isDragging
            ? "border-primary/40 bg-secondary ring-1 ring-primary/20"
            : isHero
              ? "border-primary/20 bg-secondary/40 hover:border-primary/30 hover:bg-secondary/60"
              : "border-border bg-secondary/30 hover:border-foreground/15"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          dragCounterRef.current += 1;
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragCounterRef.current -= 1;
          if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0;
            setIsDragging(false);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragCounterRef.current = 0;
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        {uploadPhase !== "idle" ? (
          <>
            <Loader2 className="mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">
              {uploadPhase === "extracting"
                ? "Reading document…"
                : "Routing with DeepSeek…"}
            </p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              {uploadPhase === "extracting"
                ? "Running OCR on PDFs, screenshots, and receipt images"
                : "Classifying as receipt, invoice, or timesheet"}
            </p>
          </>
        ) : (
          <>
            <div
              className={`mb-3 flex items-center justify-center rounded-lg bg-card ring-1 ring-border ${
                isHero ? "size-11" : "size-10"
              }`}
            >
              <FileUp
                className={`${isHero ? "size-5 text-primary/80" : "size-5 text-muted-foreground"}`}
              />
            </div>
            <p className={`font-medium ${isHero ? "text-sm sm:text-base" : "text-sm"}`}>
              {isDragging
                ? "Drop to upload"
                : isHero
                  ? "Drag & drop, paste, or browse"
                  : "Drop, paste, or select a receipt or timesheet"}
            </p>
            <p
              className={`mt-1 max-w-sm text-muted-foreground ${
                isHero ? "text-sm" : "text-xs"
              }`}
            >
              PDF, PNG, JPG, WEBP, or pasted Excel/text
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button
                className="rounded-lg"
                type="button"
                variant={isHero ? "default" : "secondary"}
                size={isHero ? "default" : "default"}
                onClick={() => inputRef.current?.click()}
              >
                Select File
              </Button>
              <Button
                className="rounded-lg"
                type="button"
                variant="outline"
                size={isHero ? "default" : "default"}
                onClick={() => void handlePasteFromClipboard()}
              >
                <ClipboardPaste className="mr-2 size-4" />
                Paste
              </Button>
            </div>
            {isHero ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Tip: press{" "}
                <kbd className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px]">
                  Ctrl+V
                </kbd>{" "}
                anywhere on this page
              </p>
            ) : null}
          </>
        )}
      </div>

      <input
        ref={inputRef}
        accept={ACCEPTED_DOCUMENT_TYPES.join(",")}
        className="hidden"
        type="file"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
