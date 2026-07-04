import type { ChatResponseBody } from "@/types/lesson";

export function extractJsonString(content: string): string | null {
  let cleaned = content.trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    cleaned = fenceMatch[1].trim();
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  return cleaned.slice(start, end + 1);
}

export function parseChatResponse(content: string): ChatResponseBody {
  const jsonStr = extractJsonString(content);
  if (!jsonStr) {
    throw new Error("AI response did not contain JSON");
  }

  let parsed: Partial<ChatResponseBody>;
  try {
    parsed = JSON.parse(jsonStr) as Partial<ChatResponseBody>;
  } catch {
    throw new Error("AI response contained invalid JSON");
  }

  const validation =
    parsed.validation ?? "Aghas jan, thank you for your answer.";
  const corrections =
    parsed.corrections ??
    "Aghas jan, review the question and try to include more detail.";
  const tips =
    parsed.tips ?? "Aghas jan, try speaking in complete sentences.";
  const encouragement =
    parsed.encouragement ?? "Aghas jan, keep practicing — you are improving.";
  const nextQuestion =
    parsed.nextQuestion ?? "Aghas jan, can you tell me more?";

  return {
    validation,
    corrections,
    tips,
    encouragement,
    nextQuestion,
    shouldAdvance: parsed.shouldAdvance ?? false,
    feedback:
      parsed.feedback ??
      `${validation} ${corrections} ${tips}`.trim().replace(/\s+/g, " "),
  };
}

/** Collapse stuttered repeated words from speech recognition (e.g. "hello hello hello"). */
export function dedupeSpeechTranscript(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  const result: string[] = [];
  let streak = 1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prev = words[i - 1];

    if (prev && word.toLowerCase() === prev.toLowerCase()) {
      streak += 1;
      if (streak > 2) continue;
    } else {
      streak = 1;
    }

    result.push(word);
  }

  return result.join(" ");
}

export function buildSpokenFeedback(
  result: ChatResponseBody,
  includeNextQuestion = true,
): string {
  const parts: string[] = [];

  if (result.shouldAdvance) {
    if (result.validation) parts.push(result.validation);
    if (result.tips) parts.push(result.tips);
  } else {
    if (result.corrections) parts.push(result.corrections);
    if (result.validation && !result.validation.toLowerCase().includes("good job")) {
      parts.push(result.validation);
    }
    if (result.tips) parts.push(result.tips);
  }

  if (result.encouragement) parts.push(result.encouragement);
  if (includeNextQuestion && result.nextQuestion) {
    parts.push(result.nextQuestion);
  }

  return parts.filter(Boolean).join(" ").trim();
}
