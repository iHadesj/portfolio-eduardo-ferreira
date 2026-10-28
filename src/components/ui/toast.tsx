"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";

interface ToastData {
  id: number;
  message: string;
}

interface ToastContextValue {
  toast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/** One toast at a time, slide-in from the bottom, auto-dismiss after 3.5s. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ToastData | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);

  const toast = useCallback((message: string) => {
    idRef.current += 1;
    setCurrent({ id: idRef.current, message });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCurrent(null), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--status-line-h)+1rem)] z-[var(--z-toast)] flex justify-center px-4"
      >
        <AnimatePresence>
          {current ? (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.25 }}
              className="glow-signal rounded-sm border-ash bg-basalt text-bone pointer-events-auto border px-4 py-2 font-mono text-sm"
            >
              {current.message}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
