"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { defaultLesson, lessons } from "@/data/lessons";
import type {
  AppTab,
  ConversationMessage,
  DriveStatus,
  Lesson,
  LessonImage,
  LessonItem,
  LessonText,
} from "@/types/lesson";

interface LessonContextValue {
  lesson: Lesson;
  setLesson: (lesson: Lesson) => void;
  lessons: Lesson[];
  customTexts: LessonText[];
  customImages: LessonImage[];
  isLoadingUserData: boolean;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  selectedTextId: string | null;
  setSelectedTextId: (id: string | null) => void;
  useCustomText: boolean;
  setUseCustomText: (value: boolean) => void;
  currentItemIndex: number;
  currentItem: LessonItem;
  conversationHistory: ConversationMessage[];
  driveMode: boolean;
  status: DriveStatus;
  lastUserAnswer: string;
  lastAiFeedback: string;
  apiError: string | null;
  setDriveMode: (on: boolean) => void;
  setStatus: (status: DriveStatus) => void;
  setLastUserAnswer: (answer: string) => void;
  setLastAiFeedback: (feedback: string) => void;
  setApiError: (error: string | null) => void;
  addMessage: (role: ConversationMessage["role"], content: string) => void;
  advanceToNextItem: () => void;
  resetLesson: () => void;
  addCustomText: (title: string, content: string) => Promise<void>;
  removeCustomText: (id: string) => Promise<void>;
  addCustomImage: (
    title: string,
    imageSrc: string,
    standardExplanation: string,
  ) => Promise<void>;
  removeCustomImage: (id: string) => Promise<void>;
  selectedCustomText: LessonText | null;
}

const LessonContext = createContext<LessonContextValue | null>(null);

function createMessage(
  role: ConversationMessage["role"],
  content: string,
): ConversationMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

export function LessonProvider({ children }: { children: ReactNode }) {
  const { status: sessionStatus } = useSession();
  const [lesson, setLesson] = useState<Lesson>(defaultLesson);
  const [customTexts, setCustomTexts] = useState<LessonText[]>([]);
  const [customImages, setCustomImages] = useState<LessonImage[]>([]);
  const [isLoadingUserData, setIsLoadingUserData] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>("drive");
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [useCustomText, setUseCustomText] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<
    ConversationMessage[]
  >([]);
  const [driveMode, setDriveMode] = useState(false);
  const [status, setStatus] = useState<DriveStatus>("idle");
  const [lastUserAnswer, setLastUserAnswer] = useState("");
  const [lastAiFeedback, setLastAiFeedback] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus !== "authenticated") {
      if (sessionStatus === "unauthenticated") {
        setCustomTexts([]);
        setCustomImages([]);
        setIsLoadingUserData(false);
      }
      return;
    }

    let cancelled = false;

    async function loadUserData() {
      setIsLoadingUserData(true);
      try {
        const [textRes, imageRes] = await Promise.all([
          fetch("/api/lessons/text"),
          fetch("/api/lessons/image"),
        ]);

        if (!textRes.ok || !imageRes.ok) {
          throw new Error("Failed to load saved lesson data.");
        }

        const textData = (await textRes.json()) as { texts: LessonText[] };
        const imageData = (await imageRes.json()) as { images: LessonImage[] };

        if (cancelled) return;

        setCustomTexts(textData.texts);
        setCustomImages(imageData.images);

        if (textData.texts.length > 0) {
          setSelectedTextId((prev) => prev ?? textData.texts[0]?.id ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setApiError("Could not load your saved texts and images.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingUserData(false);
        }
      }
    }

    void loadUserData();

    return () => {
      cancelled = true;
    };
  }, [sessionStatus]);

  const currentItem = lesson.items[currentItemIndex] ?? lesson.items[0];

  const selectedCustomText = useMemo(
    () => customTexts.find((t) => t.id === selectedTextId) ?? null,
    [customTexts, selectedTextId],
  );

  const addMessage = useCallback(
    (role: ConversationMessage["role"], content: string) => {
      setConversationHistory((prev) => [...prev, createMessage(role, content)]);
    },
    [],
  );

  const advanceToNextItem = useCallback(() => {
    setCurrentItemIndex((prev) => {
      if (prev < lesson.items.length - 1) return prev + 1;
      return 0;
    });
  }, [lesson.items.length]);

  const resetLesson = useCallback(() => {
    setCurrentItemIndex(0);
    setConversationHistory([]);
    setLastUserAnswer("");
    setLastAiFeedback("");
    setApiError(null);
    setStatus("idle");
  }, []);

  const addCustomText = useCallback(async (title: string, content: string) => {
    const res = await fetch("/api/lessons/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });

    if (!res.ok) {
      throw new Error("Failed to save text.");
    }

    const data = (await res.json()) as { text: LessonText };
    setCustomTexts((prev) => [data.text, ...prev]);
    setSelectedTextId(data.text.id);
  }, []);

  const removeCustomText = useCallback(async (id: string) => {
    const res = await fetch(`/api/lessons/text?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      throw new Error("Failed to delete text.");
    }

    setCustomTexts((prev) => prev.filter((t) => t.id !== id));
    setSelectedTextId((prev) => (prev === id ? null : prev));
  }, []);

  const addCustomImage = useCallback(
    async (title: string, imageSrc: string, standardExplanation: string) => {
      const res = await fetch("/api/lessons/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          imageBufferOrBase64: imageSrc,
          correctExplanation: standardExplanation,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save image.");
      }

      const data = (await res.json()) as { image: LessonImage };
      setCustomImages((prev) => [data.image, ...prev]);
    },
    [],
  );

  const removeCustomImage = useCallback(async (id: string) => {
    const res = await fetch(
      `/api/lessons/image?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );

    if (!res.ok) {
      throw new Error("Failed to delete image.");
    }

    setCustomImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      lesson,
      setLesson,
      lessons,
      customTexts,
      customImages,
      isLoadingUserData,
      activeTab,
      setActiveTab,
      selectedTextId,
      setSelectedTextId,
      useCustomText,
      setUseCustomText,
      currentItemIndex,
      currentItem,
      conversationHistory,
      driveMode,
      status,
      lastUserAnswer,
      lastAiFeedback,
      apiError,
      setDriveMode,
      setStatus,
      setLastUserAnswer,
      setLastAiFeedback,
      setApiError,
      addMessage,
      advanceToNextItem,
      resetLesson,
      addCustomText,
      removeCustomText,
      addCustomImage,
      removeCustomImage,
      selectedCustomText,
    }),
    [
      lesson,
      customTexts,
      customImages,
      isLoadingUserData,
      activeTab,
      selectedTextId,
      useCustomText,
      currentItemIndex,
      currentItem,
      conversationHistory,
      driveMode,
      status,
      lastUserAnswer,
      lastAiFeedback,
      apiError,
      addMessage,
      advanceToNextItem,
      resetLesson,
      addCustomText,
      removeCustomText,
      addCustomImage,
      removeCustomImage,
      selectedCustomText,
    ],
  );

  return (
    <LessonContext.Provider value={value}>{children}</LessonContext.Provider>
  );
}

export function useLesson() {
  const ctx = useContext(LessonContext);
  if (!ctx) throw new Error("useLesson must be used within LessonProvider");
  return ctx;
}
