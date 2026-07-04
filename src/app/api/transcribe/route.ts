import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth-utils";

const OPENROUTER_TRANSCRIBE_URL =
  "https://openrouter.ai/api/v1/audio/transcriptions";
const PRIMARY_MODEL = "openai/whisper-large-v3";
const FALLBACK_MODEL = "openai/whisper-1";

const ALLOWED_FORMATS = new Set([
  "wav",
  "mp3",
  "flac",
  "m4a",
  "ogg",
  "webm",
  "aac",
]);

function getOpenRouterApiKey(): string | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || !apiKey.startsWith("sk-or-")) {
    return null;
  }
  return apiKey;
}

async function callTranscription(
  apiKey: string,
  model: string,
  audioBase64: string,
  format: string,
): Promise<Response> {
  return fetch(OPENROUTER_TRANSCRIBE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
      "X-Title": "Aghas English Practice",
    },
    body: JSON.stringify({
      model,
      language: "en",
      input_audio: {
        data: audioBase64,
        format,
      },
    }),
  });
}

export async function POST(request: Request) {
  try {
    const authResult = await requireSessionUserId();
    if (authResult.error) return authResult.error;

    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OpenRouter API key is missing. Add OPENROUTER_API_KEY to your environment.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      audioBase64?: string;
      format?: string;
    };

    const audioBase64 = body.audioBase64?.trim();
    if (!audioBase64) {
      return NextResponse.json(
        { error: "Audio data is required." },
        { status: 400 },
      );
    }

    const format = (body.format ?? "mp3").toLowerCase();
    if (!ALLOWED_FORMATS.has(format)) {
      return NextResponse.json(
        { error: `Unsupported audio format: ${format}` },
        { status: 400 },
      );
    }

    let response = await callTranscription(
      apiKey,
      PRIMARY_MODEL,
      audioBase64,
      format,
    );

    if (!response.ok) {
      const primaryError = await response.text();
      console.warn("Primary STT model failed, trying fallback:", primaryError);
      response = await callTranscription(
        apiKey,
        FALLBACK_MODEL,
        audioBase64,
        format,
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Transcription OpenRouter error:", errorText);

      let clientMessage = "Failed to transcribe audio. Please try again.";
      try {
        const parsed = JSON.parse(errorText) as {
          error?: { message?: string; code?: number };
        };
        if (parsed.error?.message) {
          clientMessage = parsed.error.message;
        }
      } catch {
        // Keep generic message.
      }

      return NextResponse.json(
        { error: clientMessage },
        { status: response.status },
      );
    }

    const data = (await response.json()) as { text?: string };
    const text = data.text?.trim() ?? "";

    if (!text) {
      return NextResponse.json(
        { error: "No speech was detected in the audio." },
        { status: 422 },
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Transcribe route error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
