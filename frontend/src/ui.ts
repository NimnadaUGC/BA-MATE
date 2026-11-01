import { useEffect, useRef, type RefObject, type KeyboardEvent as ReactKeyboardEvent } from "react";

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
  "summary",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

// Only the uppermost dialog handles keys; nested confirmation and context dialogs
// must not close or steal focus from the dialog that opened them.
const dialogStack: HTMLElement[] = [];
const topDialog = () => dialogStack.filter(item => item.isConnected).at(-1);

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
    dialogStack.push(dialog);
    const focusable = () =>
      [...dialog.querySelectorAll<HTMLElement>(focusableSelector)].filter(
        (element) =>
          element.tabIndex >= 0 && element.getClientRects().length > 0 &&
          !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
          ![...dialog.querySelectorAll('details:not([open])')].some(details =>
            details.contains(element) && !details.querySelector('summary')?.contains(element)),
      );
    const firstTarget =
      dialog.querySelector<HTMLElement>("[autofocus]") ?? focusable()[0];
    const focusFrame = window.requestAnimationFrame(() => {
      if (topDialog() !== dialog || dialog.contains(document.activeElement)) return;
      if (firstTarget) firstTarget.focus();
      else { dialog.tabIndex = -1; dialog.focus(); }
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (topDialog() !== dialog || event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); dialog.tabIndex = -1; dialog.focus(); return; }
      const first = items[0];
      const last = items.at(-1)!;
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
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
      window.cancelAnimationFrame(focusFrame);
      const index = dialogStack.lastIndexOf(dialog);
      if (index >= 0) dialogStack.splice(index, 1);
      window.requestAnimationFrame(() => {
        const remaining = topDialog();
        if (previouslyFocused?.isConnected && (!remaining || remaining.contains(previouslyFocused))) previouslyFocused.focus();
      });
    };
  }, [active, root]);
};


/** Standard keyboard navigation for the application’s automatically activated tabs. */
export function onTabListKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')];
  const current = tabs.indexOf(event.target as HTMLButtonElement);
  if (current < 0 || !tabs.length) return;
  event.preventDefault();
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
    : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[index].focus();
  tabs[index].click();
}
