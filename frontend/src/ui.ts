import { useEffect, useRef, type RefObject } from "react";

export type NoticeTone = "success" | "info" | "warning" | "danger";

export interface AppNoticeDetail {
  message: string;
  title?: string;
  tone?: NoticeTone;
}

export const notify = (
  message: string,
  tone: NoticeTone = "success",
  title?: string,
) =>
  window.dispatchEvent(
    new CustomEvent<AppNoticeDetail>("ba-mate-notice", {
      detail: { message, tone, title },
    }),
  );

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Keeps keyboard focus inside an open modal and restores it on close. */
export const useDialogAccessibility = (
  root: RefObject<HTMLElement | null>,
  onClose: () => void,
  active = true,
) => {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!active || !root.current) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = root.current;
    const focusable = () =>
      [...dialog.querySelectorAll<HTMLElement>(focusableSelector)].filter(
        (element) =>
          element.offsetParent !== null &&
          element.getAttribute("aria-hidden") !== "true",
      );
    const firstTarget =
      dialog.querySelector<HTMLElement>("[autofocus]") ?? focusable()[0];
    window.requestAnimationFrame(() => firstTarget?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => previouslyFocused?.focus());
    };
  }, [active, root]);
};
