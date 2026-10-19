import { AudioLines, Flag, MessageSquareText, Sparkles, type LucideIcon } from "lucide-react";
import type { NodeKind } from "../types";

export interface NodeVisual {
  icon: LucideIcon;
  tone: string;
  kicker: string;
}

export const nodeVisuals: Record<NodeKind, NodeVisual> = {
  userInput: { icon: MessageSquareText, tone: "teal", kicker: "INPUT" },
  llm: { icon: Sparkles, tone: "indigo", kicker: "MODEL" },
  tts: { icon: AudioLines, tone: "coral", kicker: "TOOL" },
  end: { icon: Flag, tone: "green", kicker: "OUTPUT" },
};
