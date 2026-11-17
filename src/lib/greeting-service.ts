/**
 * ASLENIX Smart Employee Greeting System
 *
 * Core service for managing AI-inspired morning & evening company-approved greetings,
 * smart message rotation without back-to-back repetitions, and duplicate prevention.
 */

export interface GreetingMessage {
  id: string;
  text: string;
  category: "morning" | "evening";
  tag?: string;
}

export const APPROVED_MORNING_MESSAGES: GreetingMessage[] = [
  {
    id: "m-1",
    text: "A new day brings new opportunities. Let's create something meaningful today.",
    category: "morning",
    tag: "Fresh Start",
  },
  {
    id: "m-2",
    text: "Every great achievement starts with a small step. Make today count.",
    category: "morning",
    tag: "Focus & Momentum",
  },
  {
    id: "m-3",
    text: "Welcome back! Let's turn ideas into achievements.",
    category: "morning",
    tag: "Innovation",
  },
  {
    id: "m-4",
    text: "A fresh day, fresh opportunities. Let's build something great.",
    category: "morning",
    tag: "Creativity",
  },
  {
    id: "m-5",
    text: "Your next great idea could start today.",
    category: "morning",
    tag: "High Impact",
  },
];

export const APPROVED_EVENING_MESSAGES: GreetingMessage[] = [
  {
    id: "e-1",
    text: "Your dedication and contribution help us move forward. Thank you for being part of the ASLENIX journey.",
    category: "evening",
    tag: "Appreciation",
  },
  {
    id: "e-2",
    text: "Progress is built one day at a time. Thank you for today's effort.",
    category: "evening",
    tag: "Consistency",
  },
  {
    id: "e-3",
    text: "Another day of learning, building and growing. Well done!",
    category: "evening",
    tag: "Growth",
  },
  {
    id: "e-4",
    text: "Your contribution matters. Take some time to recharge.",
    category: "evening",
    tag: "Wellness",
  },
  {
    id: "e-5",
    text: "Great work today. Tomorrow is another opportunity to grow.",
    category: "evening",
    tag: "Excellence",
  },
];

/**
 * Gets a dynamically selected greeting message rotating without immediate repeats
 */
export function getSmartGreetingMessage(category: "morning" | "evening"): GreetingMessage {
  const pool = category === "morning" ? APPROVED_MORNING_MESSAGES : APPROVED_EVENING_MESSAGES;
  const storageKey = `aslenix_greeting_last_idx_${category}`;

  try {
    const lastIdxStr = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    let nextIdx = 0;
    if (lastIdxStr !== null) {
      const lastIdx = parseInt(lastIdxStr, 10);
      nextIdx = (isNaN(lastIdx) ? 0 : lastIdx + 1) % pool.length;
    } else {
      nextIdx = Math.floor(Math.random() * pool.length);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, String(nextIdx));
    }
    return pool[nextIdx] || pool[0];
  } catch {
    return pool[0];
  }
}

/**
 * Returns time-aware dynamic greeting title for morning check-in
 */
export function getDynamicMorningTitle(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning!";
  if (hour < 17) return "Good Afternoon!";
  return "Welcome to Your Shift!";
}

/**
 * Duplicate Prevention Helpers
 */
export function hasSeenGreeting(type: "morning" | "evening", userId: string, eventKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(`aslenix_greeting_${type}_${userId}_${eventKey}`) === "true";
  } catch {
    return false;
  }
}

export function markGreetingSeen(type: "morning" | "evening", userId: string, eventKey: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`aslenix_greeting_${type}_${userId}_${eventKey}`, "true");
  } catch {
    // ignore storage quota issues
  }
}
