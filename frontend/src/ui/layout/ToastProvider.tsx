// src/layout/ToastProvider.tsx
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

/**
* ToastProvider + useToast
* ------------------------
* App-wide toast system with a small API and a capped queue.
*
* Highlights
* - Context exposes: toast(), success(), error(), info(), dismiss(), clear()
* - At most MAX_TOASTS are visible at once; oldest are dropped when over capacity
* - Each toast auto-dismisses after `duration` ms; manual close button included
* - Viewport is portaled to <body> and uses aria-live for assistive tech
*/

type ToastVariant = "default" | "success" | "error" | "info";

export type ToastOptions = {
  id?: string;
  message: string;
  variant?: ToastVariant;
  duration?: number; // ms
};

// Concrete item stored in state (all fields required) + creation timestamp
type ToastItem = Required<ToastOptions> & { createdAt: number };

// Public API for consumers via useToast()
type ToastContextValue = {
  toast: (opts: ToastOptions | string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
  success: (msg: string, opts?: Omit<ToastOptions, "message" | "variant">) => string;
  error: (msg: string, opts?: Omit<ToastOptions, "message" | "variant">) => string;
  info: (msg: string, opts?: Omit<ToastOptions, "message" | "variant">) => string;
};

const MAX_TOASTS = 3; // cap visible toasts

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  // Keep timeout handles to cancel when a toast is dismissed early
  const timeouts = useRef<Map<string, number>>(new Map());

  /** Remove a toast (and cancel its auto-dismiss if pending). */
  const dismiss = useCallback((id: string) => {
    setItems(xs => xs.filter(t => t.id !== id));
    const handle = timeouts.current.get(id);
    if (handle) {
      window.clearTimeout(handle);
      timeouts.current.delete(id);
    }
  }, []);

  /** Core creator: builds a ToastItem, trims queue, schedules auto-dismiss, returns id. */
  const push = useCallback(
    (opts: ToastOptions | string): string => {
      const next: ToastItem = {
        id:
          (typeof crypto !== "undefined" ? crypto.randomUUID?.() : undefined) ||
          Math.random().toString(36).slice(2),
        message: typeof opts === "string" ? opts : opts.message,
        variant: typeof opts === "string" ? "default" : opts.variant ?? "default",
        duration: typeof opts === "string" ? 4000 : opts.duration ?? 4000,
        createdAt: Date.now(),
      };

      setItems(xs => {
        // drop the OLDEST if we’re at capacity
        const trimmed =
          xs.length >= MAX_TOASTS
            ? [...xs].sort((a, b) => a.createdAt - b.createdAt).slice(1)
            : xs;
        return [...trimmed, next];
      });

      const handle = window.setTimeout(() => dismiss(next.id), next.duration);
      timeouts.current.set(next.id, handle);

      return next.id;
    },
    [dismiss]
  );

  // Variant helpers
  const success = useCallback(
    (msg: string, opts?: Omit<ToastOptions, "message" | "variant">) => push({ ...opts, message: msg, variant: "success" }),
    [push]
  );
  const error = useCallback(
    (msg: string, opts?: Omit<ToastOptions, "message" | "variant">) => push({ ...opts, message: msg, variant: "error" }),
    [push]
  );
  const info = useCallback(
    (msg: string, opts?: Omit<ToastOptions, "message" | "variant">) => push({ ...opts, message: msg, variant: "info" }),
    [push]
  );

  // Memoized context value
  const value = useMemo(
    () => ({ toast: push, dismiss, clear: () => setItems([]), success, error, info }),
    [push, dismiss, success, error, info]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(<ToastViewport items={items} onDismiss={dismiss} />, document.body)}
    </ToastContext.Provider>
  );
}

/** Hook to access the toast API */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/** Container for toasts */
function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 right-4 z-[9999] flex w-[min(92vw,24rem)] flex-col-reverse gap-2"
    >
      {items.map(t => (
        <Toast key={t.id} item={t} onClose={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

/** Visual for a single toast with variant styling and a close button. */
function Toast({
  item,
  onClose,
}: {
  item: ToastItem;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const palette: Record<ToastVariant, string> = {
    default: "border-zinc-200 bg-white text-zinc-900",
    success: "border-emerald-300 bg-emerald-50 text-emerald-900",
    error: "border-rose-300 bg-rose-50 text-rose-900",
    info: "border-sky-300 bg-sky-50 text-sky-900",
  };

  return (
    <div
      role="status"
      className={[
        "pointer-events-auto overflow-hidden rounded-lg border shadow-sm",
        palette[item.variant],
      ].join(" ")}
    >
      <div className="flex items-start gap-3 px-3 py-2">
        <span className="mt-0.5 text-sm leading-5">{item.message}</span>
        <button
          onClick={onClose}
          aria-label={t('a11y.dismiss')}
          className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded hover:bg-black/5"
          title={t('a11y.dismiss')}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
