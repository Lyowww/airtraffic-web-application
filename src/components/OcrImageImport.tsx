"use client";

import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { Camera, Loader2, ScanText, Upload } from "lucide-react";
import { extractTextFromImage, readFileAsDataUrl } from "@/lib/ocr";

interface OcrImageImportProps {
  onTextExtracted: (text: string) => void;
  label?: string;
  hint?: string;
}

export function OcrImageImport({
  onTextExtracted,
  label = "Scan text from photo",
  hint = "Take a photo or upload an image — AI will extract the English text automatically.",
}: OcrImageImportProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleImage = async (file: File) => {
    setError(null);
    setIsExtracting(true);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPreview(dataUrl);
      const text = await extractTextFromImage(dataUrl);
      onTextExtracted(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract text.");
    } finally {
      setIsExtracting(false);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleImage(file);
    event.target.value = "";
  };

  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <ScanText className="h-4 w-4 text-[var(--accent)]" aria-hidden />
        {label}
      </div>
      <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">{hint}</p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isExtracting}
          onClick={() => cameraInputRef.current?.click()}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-medium transition hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
        >
          <Camera className="h-4 w-4" aria-hidden />
          Take photo
        </button>
        <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-medium transition hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800">
          <Upload className="h-4 w-4" aria-hidden />
          Upload image
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isExtracting}
            onChange={onFileChange}
          />
        </label>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={isExtracting}
          onChange={onFileChange}
        />
      </div>

      {isExtracting && (
        <div className="mt-4 flex items-center gap-2 text-sm text-[var(--accent)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Extracting text from image…
        </div>
      )}

      {preview && !isExtracting && (
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Scanned preview"
            className="max-h-40 w-full object-contain"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
