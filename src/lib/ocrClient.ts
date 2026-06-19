"use client";

import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";

// Serve from /public — copied from node_modules on postinstall (see scripts/copy-pdf-worker.mjs).
// Avoids CDN fetch failures and version mismatches with the installed pdfjs-dist package.
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MIN_NATIVE_TEXT_LENGTH = 50;

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const ACCEPTED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export function isAcceptedDocument(file: File) {
  return ACCEPTED_DOCUMENT_TYPES.includes(file.type);
}

async function ocrImageFile(file: File): Promise<string> {
  const worker = await Tesseract.createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    return text.trim();
  } finally {
    await worker.terminate();
  }
}

async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    fullText += `${pageText}\n`;
  }

  if (fullText.trim().length >= MIN_NATIVE_TEXT_LENGTH) {
    return fullText.trim();
  }

  const worker = await Tesseract.createWorker("eng");

  try {
    fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Failed to create canvas for OCR");
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport, canvas }).promise;

      const {
        data: { text },
      } = await worker.recognize(canvas);
      fullText += `${text}\n`;
    }
  } finally {
    await worker.terminate();
  }

  return fullText.trim();
}

/** @deprecated Use extractTextFromDocument */
export async function extractTextWithOCR(file: File): Promise<string> {
  return extractTextFromDocument(file);
}

export async function extractTextFromDocument(file: File): Promise<string> {
  if (IMAGE_MIME_TYPES.has(file.type)) {
    return ocrImageFile(file);
  }

  if (file.type === "application/pdf") {
    const arrayBuffer = await file.arrayBuffer();
    return extractPdfText(arrayBuffer);
  }

  throw new Error("Unsupported file type");
}
