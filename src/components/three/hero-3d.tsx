"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { HeroPoster } from "./hero-poster";
import type { SceneTier } from "./hero-scene";
import type { MobiusLightState } from "./liquid-obsidian-mobius";
import { ErrorBoundary } from "@/components/error-boundary";
import { useMounted } from "@/hooks/use-mounted";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { cn } from "@/lib/utils";

const MOBIUS_HINT_KEY = "mobius-interaction-discovered";

const HeroScene = dynamic(
  () => import("./hero-scene").then((m) => m.HeroScene),
  { ssr: false },
);

interface Gates {
  ok: boolean;
  /** "full" = pointer-driven desktop scene; "lite" = touch-driven phone scene. */
  tier: SceneTier;
  highDpr: boolean;
}

const BLOCKED: Gates = { ok: false, tier: "lite", highDpr: false };

/**
 * Capability gates. Phones are no longer excluded outright — they clear a
 * lower bar and get the `lite` tier, which is budgeted for them. The hard
 * blockers (saveData, 2G, very low memory) still drop to the poster; WebGL2
 * support is probed separately, once the page is idle (see `supportsWebGL2`).
 */
function evaluateGates(): Gates {
  if (typeof window === "undefined") return BLOCKED;

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };

  // Never spend the user's data or battery against their wishes.
  if (nav.connection?.saveData === true) return BLOCKED;
  if (/(^|-)2g$/.test(nav.connection?.effectiveType ?? "")) return BLOCKED;

  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const mem = nav.deviceMemory;
  const tier: SceneTier =
    finePointer || window.innerWidth >= 1024 ? "full" : "lite";
  const memoryFloor = tier === "full" ? 4 : 3;
  if (mem !== undefined && mem < memoryFloor) return BLOCKED;
  if (
    tier === "lite" &&
    navigator.hardwareConcurrency !== undefined &&
    navigator.hardwareConcurrency < 4
  ) {
    return BLOCKED;
  }

  return {
    ok: true,
    tier,
    highDpr: (window.devicePixelRatio || 1) >= 1.5,
  };
}

/**
 * Creating a GL context is synchronous and can block for a long while on a
 * cold GPU process, so this runs from the idle callback rather than during
 * hydration. The probe context is released straight away — three.js creates
 * its own, and browsers cap how many can be alive at once.
 */
function supportsWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Gates → lazy (post-idle) load of the WebGL scene → crossfade over the poster.
 * On reduced motion, failed gates or a runtime error the static poster simply
 * stays — no three.js bytes downloaded.
 */
export function Hero3D({ className }: { className?: string }) {
  const reduced = useReducedMotionSafe();
  const { theme } = useTheme();
  const themeMounted = useMounted();
  const underworld = themeMounted && theme === "underworld";
  const containerRef = useRef<HTMLDivElement>(null);
  const lightTargetsRef = useRef<HTMLElement[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [tier, setTier] = useState<SceneTier>("full");
  const [highDpr, setHighDpr] = useState(false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const [showHint, setShowHint] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(MOBIUS_HINT_KEY) !== "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (reduced) return;
    const gates = evaluateGates();
    if (!gates.ok) return;
    const win = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    // Phones get a longer leash so the shader compile never lands on LCP.
    const timeout = gates.tier === "lite" ? 3000 : 2000;
    const fallbackDelay = gates.tier === "lite" ? 1400 : 800;
    let idleHandle = 0;
    let fallbackHandle = 0;
    let scrollSettleHandle = 0;
    let started = false;

    const cancelScheduledStart = () => {
      if (idleHandle && win.cancelIdleCallback) {
        win.cancelIdleCallback(idleHandle);
        idleHandle = 0;
      }
      if (fallbackHandle) {
        window.clearTimeout(fallbackHandle);
        fallbackHandle = 0;
      }
    };

    const start = () => {
      if (started) return;
      started = true;
      window.removeEventListener("scroll", handleEarlyScroll);
      if (!supportsWebGL2()) return;
      setTier(gates.tier);
      setHighDpr(gates.highDpr);
      setEnabled(true);
    };

    const scheduleStart = () => {
      cancelScheduledStart();
      if (win.requestIdleCallback) {
        idleHandle = win.requestIdleCallback(start, { timeout });
      } else {
        fallbackHandle = window.setTimeout(start, fallbackDelay);
      }
    };

    function handleEarlyScroll() {
      if (started) return;
      cancelScheduledStart();
      window.clearTimeout(scrollSettleHandle);
      scrollSettleHandle = window.setTimeout(scheduleStart, 260);
    }

    window.addEventListener("scroll", handleEarlyScroll, { passive: true });
    scheduleStart();
    return () => {
      cancelScheduledStart();
      window.clearTimeout(scrollSettleHandle);
      window.removeEventListener("scroll", handleEarlyScroll);
    };
  }, [reduced]);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;
    let inView = true;
    let visible = !document.hidden;
    const update = () => setActive(inView && visible);

    const io = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
      update();
    });
    io.observe(el);
    const onVisibility = () => {
      visible = !document.hidden;
      update();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  function handleFirstInteraction() {
    setShowHint(false);
    try {
      localStorage.setItem(MOBIUS_HINT_KEY, "true");
    } catch {
      // Storage can be unavailable in private/restricted browser contexts.
    }
  }

  function handleLightChange({ x, y, energy, angle }: MobiusLightState) {
    // Custom properties inherit, so writing them on #hero restyled the whole
    // hero subtree — the ~200 poster paths included — on every update, which
    // dominated the frame on slower phones. Only the `[data-mobius-light]`
    // nodes read them; #hero keeps the defaults.
    let targets = lightTargetsRef.current;
    if (!targets) {
      const host = containerRef.current?.closest("#hero");
      if (!host) return;
      targets = Array.from(
        host.querySelectorAll<HTMLElement>("[data-mobius-light]"),
      );
      lightTargetsRef.current = targets;
    }
    const values: [string, string][] = [
      ["--mobius-light-x", `${x.toFixed(2)}%`],
      ["--mobius-light-y", `${y.toFixed(2)}%`],
      ["--mobius-light-energy", energy.toFixed(3)],
      ["--mobius-light-angle", `${angle.toFixed(2)}deg`],
      ["--mobius-aura-opacity", (0.62 + energy * 0.38).toFixed(3)],
      ["--mobius-caustic-opacity", (0.3 + energy * 0.42).toFixed(3)],
      ["--mobius-title-opacity", (0.16 + energy * 0.5).toFixed(3)],
      ["--mobius-title-blur", `${(5 + energy * 10).toFixed(2)}px`],
      ["--mobius-cta-blur", `${(3 + energy * 10).toFixed(2)}px`],
      ["--mobius-social-blur", `${(2 + energy * 8).toFixed(2)}px`],
    ];
    for (const target of targets) {
      for (const [name, value] of values) target.style.setProperty(name, value);
    }
  }

  // `reduced` flips to true one tick after hydration. The effect above cancels
  // the pending idle callback, but deriving here also covers the race where it
  // already fired — reduced motion never keeps a live canvas.
  const showScene = enabled && !reduced;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Persistent ambient glow (compensates for dropped postprocessing bloom). */}
      <div
        aria-hidden
        className="mobius-ambient-glow pointer-events-none absolute -inset-1/4"
      />
      <HeroPoster
        underworld={underworld}
        className={cn(
          "absolute inset-0",
          showScene && ready ? "opacity-0" : "opacity-100",
        )}
      />
      {showScene ? (
        <div
          className={cn(
            "absolute inset-y-0",
            // A wider render surface expands the camera's horizontal frustum
            // without changing the sculpture's on-screen size. This prevents
            // fast rotations from exposing the hard edge of the WebGL canvas.
            tier === "full" ? "inset-x-[-24%]" : "inset-x-[-12%]",
            ready ? "opacity-100" : "opacity-0",
          )}
        >
          <ErrorBoundary fallback={null}>
            <HeroScene
              active={active}
              tier={tier}
              highDpr={highDpr}
              underworld={underworld}
              onReady={() => setReady(true)}
              onFirstInteraction={handleFirstInteraction}
              onLightChange={handleLightChange}
            />
          </ErrorBoundary>
        </div>
      ) : null}
      {showScene && ready && tier === "lite" && showHint ? (
        <div className="text-smoke pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/8 bg-black/35 px-3 py-1.5 font-mono text-[0.625rem] tracking-[0.08em] whitespace-nowrap backdrop-blur-sm">
          <span className="text-molten" aria-hidden>
            ↔
          </span>
          Arraste · toque · segure
        </div>
      ) : null}
    </div>
  );
}
