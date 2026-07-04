import type { Lesson } from "@/types/lesson";

export const lessons: Lesson[] = [
  {
    id: "daily-conversation",
    title: "Daily Conversation",
    description: "Simple questions about everyday life",
    items: [
      {
        id: "dc-1",
        question: "How are you feeling today?",
        expectedKeywords: ["good", "fine", "well", "tired", "happy", "okay"],
        contextHint: "Answer with how you feel. Example: I am feeling good today.",
      },
      {
        id: "dc-2",
        question: "What did you have for breakfast this morning?",
        expectedKeywords: ["breakfast", "ate", "had", "coffee", "bread", "eggs"],
        contextHint: "Talk about food you ate. Example: I had coffee and bread.",
      },
      {
        id: "dc-3",
        question: "Where are you driving to right now?",
        expectedKeywords: ["driving", "going", "work", "home", "store", "city"],
        contextHint: "Say your destination. Example: I am driving to work.",
      },
      {
        id: "dc-4",
        question: "What is the weather like outside?",
        expectedKeywords: ["sunny", "rainy", "cloudy", "hot", "cold", "weather"],
        contextHint: "Describe the weather. Example: It is sunny and warm.",
      },
      {
        id: "dc-5",
        question: "What are you looking forward to this week?",
        expectedKeywords: ["looking forward", "weekend", "family", "plan", "hope"],
        contextHint: "Share something positive. Example: I am looking forward to seeing my family.",
      },
    ],
  },
  {
    id: "past-tense",
    title: "Past Tense Practice",
    description: "Questions that encourage past tense answers",
    items: [
      {
        id: "pt-1",
        question: "What did you do yesterday evening?",
        expectedKeywords: ["yesterday", "watched", "went", "stayed", "did"],
        contextHint: "Use past tense. Example: I watched TV yesterday evening.",
      },
      {
        id: "pt-2",
        question: "Where did you go last weekend?",
        expectedKeywords: ["went", "visited", "last weekend", "park", "home"],
        contextHint: "Talk about last weekend. Example: I went to the park last weekend.",
      },
      {
        id: "pt-3",
        question: "What was your favorite subject in school?",
        expectedKeywords: ["favorite", "subject", "math", "history", "english"],
        contextHint: "Name a school subject. Example: My favorite subject was history.",
      },
    ],
  },
];

export const defaultLesson = lessons[0];
