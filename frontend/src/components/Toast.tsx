import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function Toast({ message, tone }: { message: string; tone: "info" | "error" }) {
  return (
    <div className={`toast toast-${tone}`} role="status">
      {tone === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
      <span>{message}</span>
    </div>
  );
}
