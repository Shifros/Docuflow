"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { UploadZone } from "@/components/dashboard/upload-zone";

type UploadHeroProps = {
  pendingCount: number;
  onUploaded?: () => void;
};

const supportedTypes = [
  "Receipts & expense reports",
  "Timesheets",
  "Clipboard paste",
];

export function UploadHero({ pendingCount, onUploaded }: UploadHeroProps) {
  return (
    <section className="upload-hero">
      <div className="upload-hero-glow" aria-hidden />
      <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-8">
        <div className="space-y-4">
          <p className="text-sm font-medium text-primary/80">Smart Ingestion</p>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              Drop a document. Skip the data entry.
            </h2>
            <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
              Upload receipts, expense reports, or timesheets. OCR reads the file
              and AI extracts each line item separately.
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            {supportedTypes.join(" · ")}
          </p>

          {pendingCount > 0 ? (
            <Link
              href="/dashboard/triage"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              {pendingCount} item{pendingCount === 1 ? "" : "s"} awaiting review
              <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </div>

        <UploadZone variant="hero" onUploaded={onUploaded} />
      </div>
    </section>
  );
}
