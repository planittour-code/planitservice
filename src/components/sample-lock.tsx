import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Sample File is read-only. Any attempt to edit sends the visitor to signup. */
export function SampleLock({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div
      onClickCapture={(e) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const control = target.closest(
          "button, input, select, textarea, label, [role='button']",
        );
        if (!control) return;
        if (control.closest("nav") || control.closest("a[href^='#']") || control.closest("[data-preview-ok]")) return;
        e.preventDefault();
        e.stopPropagation();
        void navigate({ to: "/start" });
      }}
    >
      {children}
    </div>
  );
}
