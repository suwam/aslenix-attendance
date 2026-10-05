import { ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

const cardTones = ["mint", "rose", "blue", "cyan", "amber", "lavender"] as const;
type CardTone = (typeof cardTones)[number];

function toneFromId(id: string): CardTone {
  const hash = Array.from(id).reduce((total, character) => total + character.charCodeAt(0), 0);
  return cardTones[hash % cardTones.length];
}

export function GlassCard({
  children,
  className,
  glow,
  tone,
}: {
  children: ReactNode;
  className?: string;
  glow?: "red" | "blue" | "none";
  /** Defaults to a stable rotating pastel tone so adjacent dashboard cards stay distinct. */
  tone?: CardTone;
}) {
  const cardId = useId();
  const cardTone = tone ?? toneFromId(cardId);

  return (
    <div
      className={cn("glass rounded-2xl p-6 relative", `card-tone-${cardTone}`, className)}
      style={
        glow === "red"
          ? { boxShadow: "var(--shadow-neon-red), var(--shadow-glass)" }
          : glow === "blue"
            ? { boxShadow: "var(--shadow-neon-blue), var(--shadow-glass)" }
            : undefined
      }
    >
      {children}
    </div>
  );
}
