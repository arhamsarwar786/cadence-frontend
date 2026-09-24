"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/shared/lib/cn";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastOptions {
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastContextValue {
  toast: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: Omit<ToastOptions, "tone">) => void;
  error: (message: string, options?: Omit<ToastOptions, "tone">) => void;
  info: (message: string, options?: Omit<ToastOptions, "tone">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_MS = 4000;

const TONE_CLASSES: Record<ToastTone, string> = {
  success: "border-cadence-lime/50 bg-card text-on-card",
  error: "border-cadence-red/40 bg-card text-on-card",
  info: "border-cadence-yellow/60 bg-card text-on-card",
};

const TONE_DOT: Record<ToastTone, string> = {
  success: "bg-cadence-lime",
  error: "bg-cadence-red",
  info: "bg-cadence-yellow",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((message: string, options?: ToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tone = options?.tone ?? "info";
    setItems((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => dismiss(id), options?.durationMs ?? DISMISS_MS);
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message, options) => toast(message, { ...options, tone: "success" }),
      error: (message, options) => toast(message, { ...options, tone: "error" }),
      info: (message, options) => toast(message, { ...options, tone: "info" }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const labelId = useId();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--toast-offset,1rem)+env(safe-area-inset-bottom,0px))] z-[90] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
      aria-relevant="additions"
      aria-atomic="false"
      aria-labelledby={labelId}
    >
      <span id={labelId} className="sr-only">
        Notifications
      </span>
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 font-body text-sm shadow-card",
        TONE_CLASSES[item.tone],
      )}
    >
      <span
        aria-hidden
        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE_DOT[item.tone])}
      />
      <p className="min-w-0 flex-1 text-on-card">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="shrink-0 rounded-full px-1.5 py-0.5 text-xs text-on-card-muted hover:bg-white/5 hover:text-on-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cadence-yellow"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
