import { NextResponse } from "next/server";
import { parseChatResponse } from "@/lib/chat-utils";
import type {
  ChatMode,
  ChatRequestBody,
  OpenRouterMessage,
} from "@/types/lesson";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PRIMARY_MODEL = "openrouter/free";
const FALLBACK_MODEL = "google/gemma-4-31b-it:free";

function getOpenRouterApiKey(): string | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || !apiKey.startsWith("sk-or-")) {
    return null;
  }
  return apiKey;
}

function buildSystemPrompt(mode: ChatMode): string {
  const modeContext =
    mode === "image-flashcard"
      ? "You are grading a spoken description of an image flashcard. Compare the student's spoken words to the reference explanation and what is visible in the image."
      : mode === "custom-text"
        ? "You are teaching from a custom reading text the student imported. Ask comprehension questions drawn from that text."
        : mode === "listening-comprehension"
          ? "You are teaching from a listening exercise the student heard. Ask comprehension questions about the listening transcript. Assume they listened to the audio or read the transcript."
          : "You are helping Aghas practice spoken English, often while driving. Keep responses short and easy to hear.";

  return `You are a warm but honest English teacher for Aghas (address him as "Aghas jan").

${modeContext}

CRITICAL RULES:
1. Every question or instructional sentence you generate MUST begin with "Aghas jan".
2. HONEST GRADING — never say an answer is good or correct when it is wrong, incomplete, or off-topic:
   - If the answer is wrong or mostly wrong: validation must NOT praise correctness. Say something brief like "Aghas jan, I heard your answer" then focus on corrections.
   - If partially correct: acknowledge only what was actually right, then clearly explain what was wrong or missing.
   - If fully correct: then give genuine validation.
3. Wait for the full spoken answer before judging. Base feedback on the complete transcription.
4. Structure spoken feedback in this order:
   a) validation — only what was genuinely correct (skip false praise);
   b) corrections — clear grammar, vocabulary, factual, or missing-detail fixes;
   c) tips — one or two actionable improvements;
   d) encouragement — brief and sincere.
5. Be kind but accurate. Never lie about correctness.
6. Keep language simple. Short sentences for driving/listening.

You MUST respond with ONLY valid JSON — no markdown, no code fences, no extra text.
Use this exact shape:
{
  "validation": "what was actually right, starting with Aghas jan (minimal if answer was wrong)",
  "corrections": "what was wrong or missing, starting with Aghas jan",
  "tips": "actionable improvement tips, starting with Aghas jan",
  "encouragement": "brief warm encouragement, starting with Aghas jan",
  "nextQuestion": "the next question or instruction, MUST start with Aghas jan",
  "shouldAdvance": true or false,
  "feedback": "short combined summary for on-screen display"
}

Set shouldAdvance to true ONLY when the answer is substantially correct.
Set shouldAdvance to false when the answer is wrong, incomplete, or needs more practice.`;
}

function buildTextUserPrompt(body: ChatRequestBody): string {
  const historyText = body.conversationHistory
    .slice(-8)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  if (body.mode === "image-flashcard") {
    return `Reference explanation (what the image should convey):
"${body.standardExplanation ?? ""}"

Recent conversation:
${historyText || "(none)"}

Aghas jan's spoken description (transcription):
"${body.userAnswer}"

Grade honestly against the image and reference. Return JSON only.`;
  }

  if (body.mode === "custom-text") {
    return `Reading text title: ${body.lessonTitle ?? "Custom text"}

Full reading text:
"""
${body.sourceText ?? ""}
"""

Current question: "${body.currentQuestion ?? "Ask the first comprehension question from this text."}"
${body.contextHint ? `Context hint: ${body.contextHint}` : ""}
${body.expectedKeywords?.length ? `Expected keywords: ${body.expectedKeywords.join(", ")}` : ""}

Recent conversation:
${historyText || "(none)"}

Aghas jan's spoken answer:
"${body.userAnswer}"

Evaluate honestly and prepare the next spoken prompt. Return JSON only.`;
  }

  if (body.mode === "listening-comprehension") {
    return `Listening title: ${body.lessonTitle ?? "Listening exercise"}

Listening transcript (what Aghas jan heard or studied):
"""
${body.sourceText ?? ""}
"""

Current question: "${body.currentQuestion ?? "Ask the first comprehension question about this listening."}"
${body.contextHint ? `Context hint: ${body.contextHint}` : ""}

Recent conversation:
${historyText || "(none)"}

Aghas jan's spoken answer:
"${body.userAnswer}"

Evaluate honestly based on the listening content. Return JSON only.`;
  }

  return `Lesson: ${body.lessonTitle ?? "English practice"}

Current question: "${body.currentQuestion ?? ""}"
${body.contextHint ? `Context hint: ${body.contextHint}` : ""}
${body.expectedKeywords?.length ? `Expected keywords: ${body.expectedKeywords.join(", ")}` : ""}

Recent conversation:
${historyText || "(none)"}

Aghas jan's spoken answer:
"${body.userAnswer}"

Evaluate honestly and prepare the next spoken prompt. Return JSON only.`;
}

function buildUserMessage(body: ChatRequestBody): OpenRouterMessage {
  const textPrompt = buildTextUserPrompt(body);

  if (body.mode === "image-flashcard" && body.imageBase64) {
    return {
      role: "user",
      content: [
        { type: "text", text: textPrompt },
        {
          type: "image_url",
          image_url: { url: body.imageBase64 },
        },
      ],
    };
  }

  return { role: "user", content: textPrompt };
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
  jsonMode: boolean,
): Promise<Response> {
  return fetch(OPENROUTER_URL, {
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
      temperature: 0.4,
      max_tokens: 800,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });
}

async function fetchChatCompletion(
  apiKey: string,
  messages: OpenRouterMessage[],
): Promise<string> {
  let response = await callOpenRouter(apiKey, PRIMARY_MODEL, messages, true);

  if (!response.ok) {
    const primaryError = await response.text();
    console.warn("Primary model failed, trying fallback:", primaryError);
    response = await callOpenRouter(apiKey, FALLBACK_MODEL, messages, true);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenRouter error:", errorText);

    let clientMessage = "Failed to get AI response. Please try again.";
    try {
      const parsed = JSON.parse(errorText) as {
        error?: { message?: string; code?: number };
      };
      if (parsed.error?.code === 401) {
        clientMessage =
          "AI service authentication failed. Check OPENROUTER_API_KEY in your environment.";
      }
    } catch {
      // Keep generic message.
    }

    throw new Error(clientMessage);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";

  if (!content.trim()) {
    throw new Error("Empty response from AI.");
  }

  return content;
}

export async function POST(request: Request) {
  try {
    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OpenRouter API key is missing or invalid. Add OPENROUTER_API_KEY to your environment (starts with sk-or-).",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as ChatRequestBody;

    if (!body.userAnswer?.trim()) {
      return NextResponse.json(
        { error: "Missing user answer." },
        { status: 400 },
      );
    }

    if (body.mode === "image-flashcard" && !body.imageBase64) {
      return NextResponse.json(
        { error: "Image data is required for flashcard grading." },
        { status: 400 },
      );
    }

    const messages: OpenRouterMessage[] = [
      { role: "system", content: buildSystemPrompt(body.mode) },
      buildUserMessage(body),
    ];

    let content: string;
    try {
      content = await fetchChatCompletion(apiKey, messages);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to get AI response.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    try {
      const result = parseChatResponse(content);
      return NextResponse.json(result);
    } catch (parseError) {
      console.warn("JSON parse failed, retrying with repair prompt:", parseError);

      const repairMessages: OpenRouterMessage[] = [
        ...messages,
        { role: "assistant", content },
        {
          role: "user",
          content:
            'Your previous reply was not valid JSON. Reply again with ONLY a single JSON object matching the required schema. No markdown.',
        },
      ];

      try {
        const repaired = await fetchChatCompletion(apiKey, repairMessages);
        const result = parseChatResponse(repaired);
        return NextResponse.json(result);
      } catch (retryError) {
        console.error("Chat route retry error:", retryError);
        return NextResponse.json(
          { error: "Could not parse AI response. Please try again." },
          { status: 502 },
        );
      }
    }
  } catch (error) {
    console.error("Chat route error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
