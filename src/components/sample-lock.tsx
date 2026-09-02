import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Sample File is read-only. Edits send the visitor to the matching signup. */
export function SampleLock({
  children,
  to = "/start",
}: {
  children: ReactNode;
  to?: "/start" | "/open";
}) {
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
        void navigate({ to });
      }}
    >
      {children}
    </div>
  );
}
