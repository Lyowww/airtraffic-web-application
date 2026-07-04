"use client";

const TRANSFORMERS_ESM =
  "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm";
const ORT_WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/";

type WhisperTranscriber = (
  input: Float32Array | string,
  options?: Record<string, unknown>,
) => Promise<{ text?: string }>;

let transcriberPromise: Promise<WhisperTranscriber> | null = null;

async function loadWhisperTranscriber(
  onProgress?: (message: string) => void,
): Promise<WhisperTranscriber> {
  onProgress?.("Loading free speech model (first time may take a minute)…");

  // Load from CDN — avoids Next.js/webpack serving HTML for model/WASM files.
  const transformers = (await import(
    /* webpackIgnore: true */
    TRANSFORMERS_ESM
  )) as {
    pipeline: (
      task: string,
      model: string,
    ) => Promise<WhisperTranscriber>;
    env: {
      allowLocalModels: boolean;
      useBrowserCache: boolean;
      backends: {
        onnx: {
          wasm: {
            wasmPaths: string;
            numThreads: number;
          };
        };
      };
    };
  };

  const { pipeline, env } = transformers;
  env.allowLocalModels = false;
  env.useBrowserCache = typeof caches !== "undefined";
  env.backends.onnx.wasm.wasmPaths = ORT_WASM_PATH;
  env.backends.onnx.wasm.numThreads = 1;

  return pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en");
}

async function decodeToMono16k(dataUrl: string): Promise<Float32Array> {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("Could not read the audio file.");
  }

  const buffer = await response.arrayBuffer();
  const decodeContext = new AudioContext();

  let decoded: AudioBuffer;
  try {
    decoded = await decodeContext.decodeAudioData(buffer.slice(0));
  } finally {
    await decodeContext.close();
  }

  const targetRate = 16000;
  const offline = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(decoded.duration * targetRate)),
    targetRate,
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

function toFriendlyError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);

  if (
    message.includes("Unexpected token") ||
    message.includes("<!DOCTYPE") ||
    message.includes("is not valid JSON") ||
    message.includes("JSON Parse")
  ) {
    return new Error(
      "Speech model failed to load. Check your internet connection, then try again.",
    );
  }

  return err instanceof Error ? err : new Error(message);
}

export async function transcribeAudioInBrowser(
  audioDataUrl: string,
  onProgress?: (message: string) => void,
): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Transcription must run in the browser.");
  }

  try {
    if (!transcriberPromise) {
      transcriberPromise = loadWhisperTranscriber(onProgress);
    }

    const transcriber = await transcriberPromise;

    onProgress?.("Decoding audio…");
    const audio = await decodeToMono16k(audioDataUrl);

    onProgress?.("Transcribing audio…");
    const result = await transcriber(audio, {
      sampling_rate: 16000,
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    const text = result?.text?.trim();
    if (!text) {
      throw new Error(
        "No speech was detected. Try a clearer recording or paste the text manually.",
      );
    }

    return text;
  } catch (err) {
    transcriberPromise = null;
    throw toFriendlyError(err);
  }
}
