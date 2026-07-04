import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth-utils";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
/** Free multimodal model on OpenRouter that accepts audio input (no paid balance required). */
const FREE_AUDIO_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
const FALLBACK_AUDIO_MODEL = "openrouter/free";

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

function extractTranscript(content: string): string {
  let text = content.trim();

  text = text.replace(/[\s\S]*?<\/think>/gi, "").trim();
  text = text.replace(/[\s\S]*?<\/reasoning>/gi, "").trim();
  text = text.replace(/```(?:text|plaintext)?\s*([\s\S]*?)```/gi, "$1").trim();

  const labeled = text.match(
    /(?:transcript|transcription)\s*:\s*([\s\S]+)/i,
  );
  if (labeled?.[1]) {
    text = labeled[1].trim();
  }

  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function callFreeAudioTranscription(
  apiKey: string,
  model: string,
  audioBase64: string,
  format: string,
): Promise<Response> {
  return fetch(OPENROUTER_CHAT_URL, {
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
      temperature: 0.1,
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content:
            "You transcribe English speech from audio. Return ONLY the spoken words as plain text. No commentary, labels, markdown, or reasoning.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe all spoken English in this audio verbatim for language study. Return only the transcript text.",
            },
            {
              type: "input_audio",
              input_audio: {
                data: audioBase64,
                format,
              },
            },
          ],
        },
      ],
    }),
  });
}

function parseErrorMessage(errorText: string): string {
  try {
    const parsed = JSON.parse(errorText) as {
      error?: { message?: string; code?: number };
    };
    const message = parsed.error?.message ?? "";

    if (
      message.includes("credit") ||
      message.includes("balance") ||
      message.includes("402")
    ) {
      return "Free transcription is temporarily unavailable. Paste or scan the text manually, or try again later.";
    }

    return message || "Failed to transcribe audio. Please try again.";
  } catch {
    return "Failed to transcribe audio. Please try again.";
  }
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

    let response = await callFreeAudioTranscription(
      apiKey,
      FREE_AUDIO_MODEL,
      audioBase64,
      format,
    );

    if (!response.ok) {
      const primaryError = await response.text();
      console.warn("Primary free STT failed, trying fallback:", primaryError);
      response = await callFreeAudioTranscription(
        apiKey,
        FALLBACK_AUDIO_MODEL,
        audioBase64,
        format,
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Transcription OpenRouter error:", errorText);
      return NextResponse.json(
        { error: parseErrorMessage(errorText) },
        { status: response.status },
      );
    }

    const data = await response.json();
    const rawContent: string = data.choices?.[0]?.message?.content ?? "";
    const text = extractTranscript(rawContent);

    if (!text) {
      return NextResponse.json(
        {
          error:
            "No speech was detected. Try a clearer recording or paste the text manually.",
        },
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
