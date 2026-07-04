export interface LessonItem {
  id: string;
  question: string;
  expectedKeywords: string[];
  contextHint: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  items: LessonItem[];
}

export interface LessonText {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

export interface LessonImage {
  id: string;
  title: string;
  imageSrc: string;
  standardExplanation: string;
  createdAt: number;
}

export interface LessonListening {
  id: string;
  title: string;
  transcript: string;
  audioSrc: string | null;
  createdAt: number;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export type AppTab =
  | "drive"
  | "listening-hub"
  | "text-import"
  | "image-trainer";

export type ListeningHubView = "import" | "listen" | "study" | "practice";

export type DriveStatus =
  | "idle"
  | "speaking"
  | "listening"
  | "awaiting-done"
  | "processing"
  | "error"
  | "mic-denied";

export type ChatMode =
  | "drive-lesson"
  | "custom-text"
  | "listening-comprehension"
  | "image-flashcard";

export interface MultimodalContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string | MultimodalContentPart[];
}

export interface ChatRequestBody {
  mode: ChatMode;
  userAnswer: string;
  conversationHistory: ConversationMessage[];
  lessonTitle?: string;
  currentQuestion?: string;
  contextHint?: string;
  expectedKeywords?: string[];
  sourceText?: string;
  imageBase64?: string;
  standardExplanation?: string;
}

export interface ChatResponseBody {
  feedback: string;
  validation: string;
  corrections: string;
  tips: string;
  encouragement: string;
  nextQuestion: string;
  shouldAdvance: boolean;
}

export interface ConversationState {
  history: ConversationMessage[];
  currentQuestion: string;
  lastUserAnswer: string;
  lastAiFeedback: string;
  itemIndex: number;
}
