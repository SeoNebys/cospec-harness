import type { ReactNode } from "react";

export interface StatusProps {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error";
  live?: "polite" | "assertive" | "off";
  className?: string;
}

export function Status({
  children,
  tone = "neutral",
  live = "polite",
  className = "",
}: StatusProps) {
  return (
    <div
      className={`status status--${tone} ${className}`.trim()}
      role={tone === "error" ? "alert" : "status"}
      aria-live={live}
      aria-atomic="true"
    >
      {children}
    </div>
  );
}
