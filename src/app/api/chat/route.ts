import { NextResponse } from "next/server";
import type {
  ChatMode,
  ChatRequestBody,
  ChatResponseBody,
  MultimodalContentPart,
  OpenRouterMessage,
} from "@/types/lesson";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PRIMARY_MODEL = "meta-llama/llama-4-maverick:free";
const FALLBACK_MODEL = "google/gemma-3-27b-it:free";

function buildSystemPrompt(mode: ChatMode): string {
  const modeContext =
    mode === "image-flashcard"
      ? "You are grading a spoken description of an image flashcard. Compare the student's spoken words to the reference explanation and what is visible in the image."
      : mode === "custom-text"
        ? "You are teaching from a custom reading text the student imported. Ask comprehension questions drawn from that text."
        : "You are helping Aghas practice spoken English, often while driving. Keep responses short and easy to hear.";

  return `You are a warm, patient, and encouraging English teacher for Aghas (address him as "Aghas jan").

${modeContext}

CRITICAL RULES:
1. Every question or instructional sentence you generate MUST begin with the friendly phrase "Aghas jan".
2. When checking answers, structure your spoken feedback in this order:
   a) validation — clearly state what Aghas jan did right;
   b) corrections — constructive notes on grammar, word choice, or missing details (use the transcription text for pronunciation/word hints);
   c) tips — one or two actionable ways to say it better next time.
3. Be kind and supportive. Never shame mistakes.
4. Keep language simple. Avoid long paragraphs.

Respond ONLY with valid JSON in this exact shape:
{
  "validation": "what he did right, starting with Aghas jan",
  "corrections": "constructive grammar/detail feedback, starting with Aghas jan",
  "tips": "actionable improvement tips, starting with Aghas jan",
  "encouragement": "brief warm encouragement, starting with Aghas jan",
  "nextQuestion": "the next question or instruction, MUST start with Aghas jan",
  "shouldAdvance": true or false,
  "feedback": "a short combined summary for display (validation + corrections + tips)"
}

Set shouldAdvance to true when the answer is good enough to move on.
Set shouldAdvance to false when more practice on the same topic is needed.`;
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

Grade this description against the image and reference explanation. Return JSON only.`;
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

Evaluate and prepare the next spoken prompt from this text. Return JSON only.`;
  }

  return `Lesson: ${body.lessonTitle ?? "English practice"}

Current question: "${body.currentQuestion ?? ""}"
${body.contextHint ? `Context hint: ${body.contextHint}` : ""}
${body.expectedKeywords?.length ? `Expected keywords: ${body.expectedKeywords.join(", ")}` : ""}

Recent conversation:
${historyText || "(none)"}

Aghas jan's spoken answer:
"${body.userAnswer}"

Evaluate and prepare the next spoken prompt. Return JSON only.`;
}

function buildUserMessage(body: ChatRequestBody): OpenRouterMessage {
  const textPrompt = buildTextUserPrompt(body);

  if (body.mode === "image-flashcard" && body.imageBase64) {
    const parts: MultimodalContentPart[] = [
      { type: "text", text: textPrompt },
      {
        type: "image_url",
        image_url: { url: body.imageBase64 },
      },
    ];
    return { role: "user", content: parts };
  }

  return { role: "user", content: textPrompt };
}

function parseAIResponse(content: string): ChatResponseBody {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI response did not contain JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<ChatResponseBody>;

  const validation =
    parsed.validation ?? "Aghas jan, good effort on your answer.";
  const corrections =
    parsed.corrections ?? "Aghas jan, keep practicing — small mistakes are normal.";
  const tips =
    parsed.tips ?? "Aghas jan, try speaking in full sentences next time.";
  const encouragement =
    parsed.encouragement ?? "Aghas jan, you are doing great!";
  const nextQuestion =
    parsed.nextQuestion ?? "Aghas jan, can you tell me more?";

  return {
    validation,
    corrections,
    tips,
    encouragement,
    nextQuestion,
    shouldAdvance: parsed.shouldAdvance ?? true,
    feedback:
      parsed.feedback ??
      `${validation} ${corrections} ${tips}`.trim(),
  };
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
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
      temperature: 0.7,
      max_tokens: 600,
      messages,
    }),
  });
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key is not configured. Add OPENROUTER_API_KEY to .env" },
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

    let response = await callOpenRouter(apiKey, PRIMARY_MODEL, messages);

    if (!response.ok) {
      console.warn("Primary model failed, trying fallback:", await response.text());
      response = await callOpenRouter(apiKey, FALLBACK_MODEL, messages);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter error:", errorText);
      return NextResponse.json(
        { error: "Failed to get AI response. Please try again." },
        { status: response.status },
      );
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    if (!content) {
      return NextResponse.json(
        { error: "Empty response from AI." },
        { status: 502 },
      );
    }

    const result = parseAIResponse(content);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Chat route error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
