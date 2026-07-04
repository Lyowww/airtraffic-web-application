"use client";

import { Headphones, ImageIcon, Trash2 } from "lucide-react";
import type { LessonImage, LessonListening, LessonText } from "@/types/lesson";

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function SavedTextsLibrary({
  texts,
  selectedTextId,
  onSelectText,
  onRemoveText,
}: {
  texts: LessonText[];
  selectedTextId?: string | null;
  onSelectText?: (id: string) => void;
  onRemoveText: (id: string) => void;
}) {
  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold sm:text-lg">
        Saved texts
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-[var(--muted)] dark:bg-zinc-800">
          {texts.length}
        </span>
      </h2>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Tap a text to use it in Drive mode.
      </p>

      {texts.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No saved texts yet.</p>
      ) : (
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
          {texts.map((text) => (
            <li
              key={text.id}
              className={`rounded-xl border p-3 ${
                selectedTextId === text.id
                  ? "border-[var(--accent)] bg-blue-50 dark:bg-blue-950"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-start gap-2">
                {onSelectText ? (
                  <button
                    type="button"
                    onClick={() => onSelectText(text.id)}
                    className="min-h-11 flex-1 text-left"
                  >
                    <p className="font-semibold leading-snug">{text.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-[var(--muted)]">
                      {text.content}
                    </p>
                  </button>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{text.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-[var(--muted)]">
                      {text.content}
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void onRemoveText(text.id)}
                  aria-label={`Delete ${text.title}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function SavedImagesLibrary({
  images,
  selectedImageId,
  onSelectImage,
  onRemoveImage,
}: {
  images: LessonImage[];
  selectedImageId?: string | null;
  onSelectImage?: (id: string) => void;
  onRemoveImage: (id: string) => void;
}) {
  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold sm:text-lg">
        <ImageIcon className="h-5 w-5" aria-hidden />
        Saved images
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-[var(--muted)] dark:bg-zinc-800">
          {images.length}
        </span>
      </h2>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Tap an image to study or practice.
      </p>

      {images.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No saved images yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {images.map((img) => (
            <li
              key={img.id}
              className={`overflow-hidden rounded-xl border ${
                selectedImageId === img.id
                  ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                  : "border-[var(--border)]"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectImage?.(img.id)}
                className="flex w-full items-center gap-3 p-2 text-left"
                disabled={!onSelectImage}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.imageSrc}
                  alt={img.title}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{img.title}</p>
                  <p className="line-clamp-2 text-xs text-[var(--muted)]">
                    {img.standardExplanation}
                  </p>
                </div>
              </button>
              <div className="border-t border-[var(--border)] px-2 py-1">
                <button
                  type="button"
                  onClick={() => void onRemoveImage(img.id)}
                  aria-label={`Delete ${img.title}`}
                  className="flex min-h-10 w-full items-center justify-center gap-1 rounded-lg text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function SavedListeningsLibrary({
  listenings,
  selectedListeningId,
  onSelectListening,
  onRemoveListening,
}: {
  listenings: LessonListening[];
  selectedListeningId?: string | null;
  onSelectListening?: (id: string) => void;
  onRemoveListening: (id: string) => void;
}) {
  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold sm:text-lg">
        <Headphones className="h-5 w-5" aria-hidden />
        Saved listenings
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-[var(--muted)] dark:bg-zinc-800">
          {listenings.length}
        </span>
      </h2>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Tap a listening to open it in the hub.
      </p>

      {listenings.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No saved listenings yet.</p>
      ) : (
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
          {listenings.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border p-3 ${
                selectedListeningId === item.id
                  ? "border-[var(--accent)] bg-blue-50 dark:bg-blue-950"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => onSelectListening?.(item.id)}
                  className="min-h-11 flex-1 text-left"
                  disabled={!onSelectListening}
                >
                  <p className="font-semibold leading-snug">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-[var(--muted)]">
                    {item.transcript}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {item.audioSrc ? "With audio" : "Text + auto speech"}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => void onRemoveListening(item.id)}
                  aria-label={`Delete ${item.title}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
