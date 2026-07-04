"use client";

type WhisperPipeline = (
  audio: string,
  options?: { chunk_length_s?: number; stride_length_s?: number },
) => Promise<{ text?: string } | string>;

let pipelinePromise: Promise<WhisperPipeline> | null = null;

async function getWhisperPipeline(
  onProgress?: (message: string) => void,
): Promise<WhisperPipeline> {
  if (!pipelinePromise) {
    onProgress?.("Loading free speech model (first time may take a minute)…");

    pipelinePromise = import("@xenova/transformers").then(({ pipeline, env }) => {
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      return pipeline(
        "automatic-speech-recognition",
        "Xenova/whisper-tiny.en",
      ) as Promise<WhisperPipeline>;
    });
  }

  return pipelinePromise;
}

async function dataUrlToObjectUrl(dataUrl: string): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

function extractText(
  result: { text?: string } | string | null | undefined,
): string {
  if (!result) return "";
  if (typeof result === "string") return result.trim();
  return result.text?.trim() ?? "";
}

export async function transcribeAudioInBrowser(
  audioDataUrl: string,
  onProgress?: (message: string) => void,
): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Transcription must run in the browser.");
  }

  const transcriber = await getWhisperPipeline(onProgress);
  onProgress?.("Transcribing audio…");

  const objectUrl = await dataUrlToObjectUrl(audioDataUrl);

  try {
    const result = await transcriber(objectUrl, {
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    const text = extractText(result);
    if (!text) {
      throw new Error(
        "No speech was detected. Try a clearer recording or paste the text manually.",
      );
    }

    return text;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
