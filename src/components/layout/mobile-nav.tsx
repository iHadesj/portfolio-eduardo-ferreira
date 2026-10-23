"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "next-themes";
import { Flame, Menu, X } from "lucide-react";
import { navItems } from "@/lib/site-config";
import { useMounted } from "@/hooks/use-mounted";
import { useSmoothScroll } from "@/hooks/use-smooth-scroll";
import { useToast } from "@/components/ui/toast";
import { fadeUpItem, staggerContainer } from "@/lib/motion-presets";
import { useI18n } from "@/lib/i18n/locale-provider";
import { sectionPath } from "@/lib/i18n/routes";

const UNDERWORLD_HOLD_MS = 1250;

function MobileUnderworldGate({ onComplete }: { onComplete: () => void }) {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const mounted = useMounted();
  const { dict } = useI18n();
  const gate = dict.easterEggs.gate;
  const underworld = mounted && theme === "underworld";
  const timerRef = useRef<number | undefined>(undefined);
  const triggeredRef = useRef(false);
  const [holding, setHolding] = useState(false);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  function cancelHold() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    setHolding(false);
  }

  function startHold() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    triggeredRef.current = false;
    setHolding(true);
    navigator.vibrate?.(14);

    timerRef.current = window.setTimeout(() => {
      triggeredRef.current = true;
      timerRef.current = undefined;
      setHolding(false);
      setTheme(underworld ? "dark" : "underworld");
      navigator.vibrate?.([45, 45, 90]);
      toast(underworld ? gate.toastExit : gate.toastEnter);
      window.setTimeout(onComplete, 180);
    }, UNDERWORLD_HOLD_MS);
  }

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (triggeredRef.current) {
      triggeredRef.current = false;
      return;
    }
    toast(underworld ? gate.hintExit : gate.hintEnter);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28, duration: 0.3 }}
      className="container-hades pb-8"
    >
      <div className="border-ash bg-basalt/35 rounded-lg border p-3">
        <p className="text-flare mb-2 font-mono text-[0.625rem] tracking-[0.18em] uppercase opacity-75 select-none">
          {gate.eyebrow}
        </p>
        <button
          type="button"
          aria-label={underworld ? gate.ariaExit : gate.ariaEnter}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            startHold();
          }}
          onPointerUp={cancelHold}
          onPointerCancel={cancelHold}
          onLostPointerCapture={cancelHold}
          onKeyDown={(event) => {
            if (event.repeat || !["Enter", " "].includes(event.key)) return;
            event.preventDefault();
            startHold();
          }}
          onKeyUp={(event) => {
            if (!["Enter", " "].includes(event.key)) return;
            event.preventDefault();
            cancelHold();
          }}
          onContextMenu={(event) => event.preventDefault()}
          onClick={handleClick}
          className="text-smoke hover:text-bone flex w-full touch-none items-center gap-3 text-left select-none"
        >
          <span className="relative grid size-11 shrink-0 place-items-center">
            <svg
              aria-hidden
              viewBox="0 0 44 44"
              className="absolute inset-0 size-11 -rotate-90"
            >
              <circle
                cx="22"
                cy="22"
                r="19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.2"
              />
              {holding ? (
                <motion.circle
                  cx="22"
                  cy="22"
                  r="19"
                  fill="none"
                  stroke="var(--color-flare)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0.5 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    duration: UNDERWORLD_HOLD_MS / 1000,
                    ease: "linear",
                  }}
                />
              ) : null}
            </svg>
            <Flame
              size={18}
              strokeWidth={1.4}
              className={holding || underworld ? "text-flare" : "text-smoke"}
            />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-bone font-mono text-xs tracking-wide uppercase">
              {underworld ? gate.titleExit : gate.titleEnter}
            </span>
            <span className="font-mono text-[0.6875rem] opacity-70">
              {gate.hint}
            </span>
          </span>
        </button>
      </div>
    </motion.div>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const mounted = useMounted();
  const scrollTo = useSmoothScroll();
  const router = useRouter();
  const { locale, dict } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingHrefRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const trigger = triggerRef.current;
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      window.scrollTo(0, scrollY);
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  // The scroll has to wait for the effect above to release the body lock —
  // `position: fixed` on the body collapses the document, and scrolling while
  // it is collapsed lands nowhere. Running it from an effect keyed on `open`
  // makes the ordering explicit: React flushes the lock cleanup before this
  // body, and passive effects run after layout, so `scrollTo` measures the
  // restored page. (The previous 60ms timeout was a guess that fired mid-unlock.)
  useEffect(() => {
    if (open) return;
    const href = pendingHrefRef.current;
    if (!href) return;
    pendingHrefRef.current = null;
    // Same rule as the desktop nav: from a case study there is no section to
    // scroll to, so go home to the anchor instead of clicking into nothing.
    if (document.querySelector(href)) {
      scrollTo(href);
      return;
    }
    router.push(sectionPath(locale, href));
  }, [open, scrollTo, router, locale]);

  function go(href: string) {
    pendingHrefRef.current = href;
    setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label={dict.nav.openMenu}
        className="rounded-sm border-ash text-smoke hover:border-signal hover:text-bone inline-flex size-9 items-center justify-center border transition-colors md:hidden"
      >
        <Menu size={18} strokeWidth={1.5} />
      </button>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  key="mobile-navigation"
                  ref={panelRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label={dict.nav.menuLabel}
                  data-lenis-prevent
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="bg-abyss fixed inset-0 z-[var(--z-palette)] isolate flex h-dvh min-h-dvh w-full flex-col overflow-y-auto overscroll-contain md:hidden"
                >
                  <div className="container-hades flex h-16 shrink-0 items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label={dict.nav.closeMenu}
                      className="rounded-sm border-ash text-smoke hover:border-signal hover:text-bone inline-flex size-9 items-center justify-center border"
                    >
                      <X size={18} strokeWidth={1.5} />
                    </button>
                  </div>
                  <motion.ul
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="container-hades flex flex-1 flex-col justify-center gap-2"
                  >
                    {navItems.map((item) => (
                      <motion.li key={item.id} variants={fadeUpItem}>
                        <a
                          href={item.href}
                          onClick={(event) => {
                            event.preventDefault();
                            go(item.href);
                          }}
                          className="font-display text-bone hover:text-signal text-4xl transition-colors"
                        >
                          {item.label[locale]}
                        </a>
                      </motion.li>
                    ))}
                  </motion.ul>
                  <MobileUnderworldGate onComplete={() => setOpen(false)} />
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
