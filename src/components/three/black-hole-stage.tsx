"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { cn } from "@/lib/utils";
import { discover } from "@/lib/anomalies";
import {
  HEAT_INKS,
  HOLE_LAYOUTS,
  NO_PULSE,
  idleView,
  type HoleLayout,
} from "./black-hole";
import type { HoleInks } from "./black-hole-gl";
import type { CollapseFx } from "./collapse-fx";
import type { Gravity } from "./gravity";
import type { RebootCopy } from "./reboot";
import { parseRgb, useIdleStart } from "./stage-utils";

/**
 * `"use client"`: the live scene needs the DOM (canvas, observers, pointer
 * and key input). The poster passed as `children` is a Server Component, so
 * the first frame still arrives as HTML.
 */

/** The black hole's microcopy (dictionary `hero.hole`). */
export interface HoleCopy {
  tag: string;
  detected: string;
  how: string;
  orbitMouse: string;
  orbitTouch: string;
  idle: string;
  holding: string;
  collapsing: string;
  rebooting: string;
  cancelled: string;
  restored: string;
  keyLabel: string;
  statusCollapsing: string;
  statusRestored: string;
  /** The kernel log the hero reboots from. */
  console: RebootCopy;
}

/** The live scene inks with the poster's own layer colours. */
function readInks(stage: HTMLElement): HoleInks {
  return HEAT_INKS.map((name) => {
    const layer = stage.querySelector<HTMLElement>(`pre[data-ink="${name}"]`);
    return parseRgb(layer ? getComputedStyle(layer).color : "rgb(255,255,255)");
  });
}

const WIDE = "(min-width: 64rem)";
const layoutFor = (): HoleLayout =>
  window.matchMedia(WIDE).matches ? HOLE_LAYOUTS.wide : HOLE_LAYOUTS.narrow;

/** Bounded offsets: the further you push, the harder it pushes back. */
const elastic = (x: number, limit: number) => limit * Math.tanh(x / limit);
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Inclination: how far a drag can tilt the view — little enough that the
    disk, seen from above or below, still fits the box — and its return
    spring. */
const TILT_LIMIT = 0.35;
const SPRING = 60;
const DAMPING = 2 * Math.sqrt(SPRING) * 0.75;
/** Orbit: a flick keeps the camera going, slowed by this friction (1/s). */
const FRICTION = 1.4;

/** A press that stays this still for this long is a hold, not a drag. */
const HOLD_DELAY = 0.18;
const MOVE_TOLERANCE = 6;
/** Seconds of holding until the hero collapses (the countdown's 00:03). */
const HOLD_FULL = 3;
/** How long "aborted" / "restored" stay on the countdown line (s). */
const NOTICE = 1.6;
/** The last stretch of the hold, when the countdown turns red (s). */
const CRITICAL = 1;
/** The screen around the hole: how dark it gets while held, while the hero
    falls in, and in the dark beat after (0–1). */
const DIM_HOLD = 0.45;
const DIM_COLLAPSE = 0.78;
const DIM_VOID = 0.9;
/** The shake: the hold's last stretch, the collapse, the impact (px). */
const SHAKE_HOLD = 1.4;
const SHAKE_COLLAPSE = 3.5;
const SHAKE_IMPACT = 11;

/** The disk sends out a ring of light now and then on its own. */
const AUTO_PULSE_FROM = 5;
const AUTO_PULSE_EVERY = 9;

type Press = "none" | "pending" | "drag" | "hold";
type Phase = "idle" | "holding" | "collapsing" | "rebooting";

/** The countdown at rest: whole seconds, as the readout promises. */
const AT_REST = `00:0${HOLD_FULL}`;

/** `00:02.41` — the hold's countdown, terminal style. */
function countdown(seconds: number): string {
  const s = Math.max(0, seconds);
  const whole = Math.floor(s);
  const hundredths = Math.min(99, Math.floor((s - whole) * 100));
  return `00:${String(whole).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

/**
 * Server poster first; after the page is idle, a WebGL2 canvas takes over
 * with a crossfade and never stops moving: the disk turns, the camera
 * drifts round the hole and nods, stars twinkle, dust spirals in, and a
 * ring of light runs out through the disk now and then. With a mouse, the
 * view leans toward the pointer, dust near it falls in faster, and a small
 * system readout beside the hole fades in as the pointer nears it. A drag
 * orbits the camera (a flick keeps it spinning) and, with a mouse, tilts
 * it, springing back; a tap sends a ring of light out.
 *
 * Holding the hole — pointer, or Space / Enter on the countdown button —
 * is a small event. For three seconds the pull builds: the characters
 * swirl in, the dust speeds up, the page leans toward the hole and, in the
 * last stretch, trembles and glitches while the screen darkens around it
 * and the countdown turns red. Letting go before the end aborts it. At zero
 * the hero is torn apart in waves, its text streaming into the hole as
 * loose characters; the hole flares as it eats, and when the last piece is
 * in it flashes, a shockwave crosses the screen and everything shakes.
 * After a dark beat the hero reboots like a terminal (see gravity.ts,
 * debris.ts, reboot.ts, collapse-fx.ts); a tap or a key prints the rest at
 * once. Paused off screen and in background tabs, 30 fps on touch devices.
 * On reduced motion or any failure the poster stays, and with it none of
 * this.
 */
export function BlackHoleStage({
  className,
  copy,
  children,
}: {
  className?: string;
  copy: HoleCopy;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotionSafe();
  const enabled = useIdleStart(reduced);
  const holeRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const horizonRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const copyRef = useRef(copy);
  const [live, setLive] = useState(false);

  useEffect(() => {
    copyRef.current = copy;
  }, [copy]);

  useEffect(() => {
    if (!enabled) return;
    const hole = holeRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const trigger = triggerRef.current;
    if (!hole || !stage || !canvas || !trigger) return;

    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const [{ createHoleRenderer }, dustModule] = await Promise.all([
        import("./black-hole-gl"),
        import("./black-hole-dust"),
      ]);
      const { createDust, shadowRadius } = dustModule;
      const poster = stage.querySelector<HTMLElement>(".hole-art pre");
      if (!poster || disposed) return;
      const fontFamily = getComputedStyle(poster).fontFamily;
      try {
        await document.fonts.load(`500 16px ${fontFamily}`);
      } catch {
        // The fallback mono face is close enough for a frame or two.
      }
      if (disposed) return;

      const fine = window.matchMedia("(pointer: fine)").matches;
      const renderer = await createHoleRenderer(canvas, {
        fontFamily,
        inks: readInks(stage),
        halo: fine ? 0.22 : 0.16,
      });
      if (!renderer || disposed) {
        renderer?.dispose();
        return;
      }
      const root =
        stage.closest<HTMLElement>("[data-gravity-root]") ?? document.body;
      // The name warms as the pull builds; only it reads --pull.
      const name = root.querySelector<HTMLElement>(".hero-name");
      const minFrame = fine ? 0 : 1000 / 30;
      const dust = createDust(fine ? 46 : 26, fine ? 90 : 48);

      let inView = true;
      let visible = !document.hidden;
      let frame = 0;
      let last = performance.now();
      let lastDrawn = 0;
      let clock = 0;
      let diskTime = 0;
      let first = true;
      let layout = layoutFor();

      // Camera offsets: orbit (with inertia), tilt (springs back), lean.
      let orbit = 0;
      let orbitVelocity = 0;
      let tilt = 0;
      let tiltVelocity = 0;
      let leanOrbit = 0;
      let leanTilt = 0;
      let leanTargetOrbit = 0;
      let leanTargetTilt = 0;
      // The pointer: how near the hole (0–1), and where, in em from it.
      let near = 0;
      let shownNear = -1;
      let cursor: [number, number] | null = null;

      // Press state, and the event it drives.
      let press: Press = "none";
      let pressAt = 0;
      let pressX = 0;
      let pressY = 0;
      let lastX = 0;
      let lastY = 0;
      let lastMoveAt = 0;
      let keyHeld = false;
      let phase: Phase = "idle";
      let holdFrom = 0;
      let pull = 0;
      let surge = 0;
      // The collapse's aftershocks: the impact's flare and quake, and how
      // dark the screen is.
      let flare = 0;
      let quake = 0;
      let dim = 0;
      let shownPull = -1;
      let lastPulse = -NO_PULSE;
      let notice = "";
      let noticeUntil = 0;
      const shown = { phase: "", label: "", time: "", horizon: "" };

      // Rows follow the box's real shape, so the scene can never be drawn
      // stretched — even if the CSS and this layout ever disagree.
      const resize = () => {
        const { width, height } = stage.getBoundingClientRect();
        const { cols } = layoutFor();
        const rows = Math.max(
          8,
          Math.round((cols * 0.6 * height) / (Math.max(width, 1) * 1.2)),
        );
        layout = { cols, rows };
        renderer.resize(layout, width, height);
        dust.resize(layout);
      };
      resize();

      const pulse = () => {
        lastPulse = clock;
      };

      const flash = () => {
        flashRef.current?.animate(
          [{ opacity: 0 }, { opacity: 0.9, offset: 0.12 }, { opacity: 0 }],
          { duration: 900, easing: "ease-out" },
        );
      };

      const announce = (text: string) => {
        if (statusRef.current) statusRef.current.textContent = text;
      };

      // The collapse's machinery (gravity.ts and what it drives) is only
      // fetched once someone comes near or reaches for the hole: most
      // visitors never hold it, and the scene starts lighter without it.
      let gravity: Gravity | null = null;
      let fx: CollapseFx | null = null;
      let arming: Promise<void> | null = null;
      const arm = () => {
        arming ??= Promise.all([
          import("./gravity"),
          import("./collapse-fx"),
        ]).then(([{ createGravity }, { createCollapseFx }]) => {
          if (disposed) return;
          const screen = createCollapseFx(root, stage);
          fx = screen;
          gravity = createGravity(
            root,
            stage,
            {
              onSwallowed: () => {
                // The last of the hero just crossed the horizon.
                flash();
                pulse();
                screen.shock();
                flare = 1;
                quake = SHAKE_IMPACT;
              },
              onReboot: () => {
                phase = "rebooting";
              },
              onRestored: () => {
                phase = "idle";
                notice = copyRef.current.restored;
                noticeUntil = clock + NOTICE;
                announce(copyRef.current.statusRestored);
              },
            },
            () => copyRef.current.console,
            minFrame,
          );
        });
      };

      const beginHold = () => {
        if (phase !== "idle") return;
        arm();
        phase = "holding";
        holdFrom = clock;
        notice = "";
      };

      const endHold = () => {
        if (phase !== "holding") return;
        phase = "idle";
        gravity?.release();
        pulse();
        notice = copyRef.current.cancelled;
        noticeUntil = clock + NOTICE;
      };

      const collapse = () => {
        phase = "collapsing";
        press = "none";
        keyHeld = false;
        gravity?.collapse();
        announce(copyRef.current.statusCollapsing);
        discover("collapse");
      };

      /** The countdown line, written straight to the DOM (no re-render). */
      const paint = () => {
        const text = copyRef.current;
        let label = text.idle;
        let time = AT_REST;
        let horizon = 1;
        if (phase === "holding") {
          label = text.holding;
          time = countdown(HOLD_FULL * (1 - pull));
          horizon = 1 - pull;
        } else if (phase === "collapsing") {
          label = text.collapsing;
          time = countdown(0);
          horizon = 0;
        } else if (phase === "rebooting") {
          label = text.rebooting;
          time = "";
          horizon = 0;
        } else if (notice && clock < noticeUntil) {
          label = notice;
          time = "";
        }
        const scale = horizon.toFixed(3);
        if (shown.phase !== phase) {
          shown.phase = phase;
          hole.dataset.phase = phase;
        }
        const critical =
          phase === "holding" && HOLD_FULL * (1 - pull) < CRITICAL;
        if (critical !== (hole.dataset.critical === "on")) {
          hole.dataset.critical = critical ? "on" : "off";
          root.dataset.holeCritical = critical ? "on" : "off";
        }
        if (shown.label !== label && labelRef.current) {
          shown.label = label;
          labelRef.current.textContent = label;
        }
        if (shown.time !== time && timeRef.current) {
          shown.time = time;
          timeRef.current.textContent = time;
          hole.dataset.timer = time ? "on" : "off";
        }
        if (shown.horizon !== scale && horizonRef.current) {
          shown.horizon = scale;
          horizonRef.current.style.transform = `scaleX(${scale})`;
        }
        const glow = Math.max(pull, surge);
        if (Math.abs(glow - shownPull) > 0.01 || (!glow && shownPull)) {
          shownPull = glow;
          name?.style.setProperty("--pull", glow.toFixed(2));
        }
        if (Math.abs(near - shownNear) > 0.01) {
          shownNear = near;
          hole.style.setProperty("--near", near.toFixed(2));
        }
      };

      const loop = (now: number) => {
        frame = requestAnimationFrame(loop);
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        clock += dt;

        // The hold: pull grows with time; held to zero, the hero collapses.
        if (press === "pending" && clock - pressAt >= HOLD_DELAY) {
          press = "hold";
          beginHold();
        }
        // Everything below — the page's DOM included — runs at the scene's
        // pace (on touch devices, every other frame), integrating over the
        // time since the last drawn frame.
        if (now - lastDrawn < minFrame) return;
        const step = Math.min(
          (now - (lastDrawn || now - dt * 1000)) / 1000,
          0.05,
        );
        lastDrawn = now;

        if (phase === "holding") {
          pull = Math.min(1, (clock - holdFrom) / HOLD_FULL);
          // Front-loaded, so the page starts to give the moment you hold.
          gravity?.attract(Math.pow(pull, 0.8));
          // Should the machinery still be on its way, zero waits for it.
          if (pull >= 1) {
            if (gravity) collapse();
            else pull = 0.999;
          }
        } else if (phase === "collapsing") {
          pull = 1;
        } else {
          pull = Math.max(0, pull - step * 1.4);
        }
        const { absorbed } = gravity?.step(step) ?? { absorbed: 0 };
        // The hole burns brighter the more it has eaten.
        surge =
          phase === "collapsing"
            ? Math.max(surge, absorbed)
            : Math.max(0, surge - step * 1.2);
        flare *= Math.exp(-step * 2.6);
        quake *= Math.exp(-step * 5.5);

        // The screen: darker and shakier as it builds, black for a beat
        // after the impact, then the light comes back as it reboots.
        let dimTarget = 0;
        let shake = 0;
        if (phase === "holding") {
          dimTarget = DIM_HOLD * pull * pull;
          shake = SHAKE_HOLD * smoothstep(0.5, 1, pull);
        } else if (phase === "collapsing") {
          dimTarget = flare > 0.01 ? DIM_VOID : DIM_COLLAPSE;
          shake = SHAKE_HOLD + (SHAKE_COLLAPSE - SHAKE_HOLD) * absorbed;
        }
        const rate = dimTarget > dim ? 9 : 3.2;
        dim += (dimTarget - dim) * (1 - Math.exp(-step * rate));
        fx?.frame(dim, Math.max(shake, quake));
        paint();

        const strength = Math.max(pull, surge);
        diskTime += step * (1 + 3.5 * pull + 3 * surge + 4 * flare);
        if (press !== "drag") {
          tiltVelocity += (-SPRING * tilt - DAMPING * tiltVelocity) * step;
          tilt += tiltVelocity * step;
          orbit += orbitVelocity * step;
          orbitVelocity *= Math.exp(-FRICTION * step);
        }
        const ease = 1 - Math.exp(-step * 4);
        leanOrbit += (leanTargetOrbit - leanOrbit) * ease;
        leanTilt += (leanTargetTilt - leanTilt) * ease;

        const idle = idleView(clock);
        const auto =
          clock < AUTO_PULSE_FROM
            ? NO_PULSE
            : (clock - AUTO_PULSE_FROM) % AUTO_PULSE_EVERY;
        const zoom = 1 - 0.15 * pull;
        renderer.render(
          {
            ...idle,
            azimuth: idle.azimuth + orbit + leanOrbit,
            inclination:
              idle.inclination + elastic(tilt + leanTilt, TILT_LIMIT),
            zoom,
            diskTime,
            pulse: Math.min(auto, clock - lastPulse),
            gain: 1 + 0.7 * pull + 0.9 * surge + 1.6 * flare,
          },
          {
            warp: 0.8 * Math.pow(pull, 1.4) + 0.6 * surge,
            shadow: shadowRadius(layout.cols, zoom),
            dust: dust.step(step, {
              pull: strength,
              near,
              cursor,
              zoom,
              roll: idle.roll,
            }),
          },
        );
        if (first) {
          first = false;
          setLive(true);
        }
      };

      const settle = () => {
        // Nothing may stay half swallowed while the loop is asleep.
        press = "none";
        keyHeld = false;
        phase = "idle";
        pull = 0;
        surge = 0;
        flare = 0;
        quake = 0;
        dim = 0;
        notice = "";
        gravity?.reset();
        fx?.dispose();
        paint();
      };

      const sync = () => {
        const run = inView && visible;
        if (run && !frame) {
          last = performance.now();
          frame = requestAnimationFrame(loop);
        } else if (!run && frame) {
          cancelAnimationFrame(frame);
          frame = 0;
          settle();
        }
      };

      const io = new IntersectionObserver(([entry]) => {
        inView = entry?.isIntersecting ?? false;
        sync();
      });
      io.observe(stage);
      const ro = new ResizeObserver(resize);
      ro.observe(stage);
      const wide = window.matchMedia(WIDE);
      wide.addEventListener("change", resize);
      const onVisibility = () => {
        visible = !document.hidden;
        sync();
      };
      document.addEventListener("visibilitychange", onVisibility);

      // Theme switches change the inks; read them back from the poster.
      const mo = new MutationObserver(() => {
        requestAnimationFrame(() => renderer.setInks(readInks(stage)));
      });
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class"],
      });

      const onDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        // Mid-reboot, a tap is "any key": print the rest now.
        if (phase === "rebooting") gravity?.skip();
        arm();
        press = "pending";
        pressAt = clock;
        pressX = lastX = event.clientX;
        pressY = lastY = event.clientY;
        lastMoveAt = performance.now();
        orbitVelocity = 0;
        tiltVelocity = 0;
        stage.setPointerCapture(event.pointerId);
      };
      const onMove = (event: PointerEvent) => {
        if (press === "none" || press === "hold") return;
        const moved = Math.hypot(
          event.clientX - pressX,
          event.clientY - pressY,
        );
        if (press === "pending") {
          if (moved < MOVE_TOLERANCE) return;
          press = "drag";
          discover("orbit");
        }
        const now = performance.now();
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        const elapsed = Math.max((now - lastMoveAt) / 1000, 1 / 240);
        lastX = event.clientX;
        lastY = event.clientY;
        lastMoveAt = now;
        orbit -= dx * 0.008;
        orbitVelocity = orbitVelocity * 0.6 + ((-dx * 0.008) / elapsed) * 0.4;
        // Touch keeps vertical swipes for scrolling the page.
        if (event.pointerType !== "touch") tilt += dy * 0.006;
      };
      const onUp = () => {
        if (press === "pending") pulse();
        if (press === "hold") endHold();
        if (press === "drag" && performance.now() - lastMoveAt > 120) {
          orbitVelocity = 0;
        }
        press = "none";
      };
      const onCancel = () => {
        if (press === "hold") endHold();
        press = "none";
      };
      const onContextMenu = (event: Event) => event.preventDefault();
      // Desktop: lean toward the pointer anywhere on the page, and track
      // how near it is (the readout, the dust).
      const onHover = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        const box = stage.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        const nx = (event.clientX - cx) / window.innerWidth;
        const ny = (event.clientY - cy) / window.innerHeight;
        leanTargetOrbit = Math.max(-1, Math.min(1, nx * 2)) * -0.3;
        leanTargetTilt = Math.max(-1, Math.min(1, ny * 2)) * 0.12;
        const reach = Math.hypot(box.width, box.height) / 2;
        const distance = Math.hypot(event.clientX - cx, event.clientY - cy);
        near = 1 - smoothstep(0.3, 1.05, distance / reach);
        if (near > 0.5) arm();
        const em = (layout.cols * 0.6) / Math.max(box.width, 1);
        cursor =
          distance < reach * 1.2
            ? [(event.clientX - cx) * em, -(event.clientY - cy) * em]
            : null;
      };
      const onLeave = () => {
        near = 0;
        cursor = null;
      };

      // The keyboard way in: hold Space or Enter on the countdown button.
      const isHoldKey = (event: KeyboardEvent) =>
        event.key === " " || event.key === "Enter";
      const onKeyDown = (event: KeyboardEvent) => {
        if (phase === "rebooting") {
          gravity?.skip();
          return;
        }
        if (event.key === "Escape") {
          keyHeld = false;
          endHold();
          return;
        }
        if (!isHoldKey(event)) return;
        event.preventDefault();
        if (event.repeat || keyHeld) return;
        keyHeld = true;
        beginHold();
      };
      const onKeyUp = (event: KeyboardEvent) => {
        if (!isHoldKey(event) || !keyHeld) return;
        keyHeld = false;
        endHold();
      };
      const onBlur = () => {
        if (!keyHeld) return;
        keyHeld = false;
        endHold();
      };
      // Pressing the button itself holds at once (no drag to tell apart).
      const onTriggerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        arm();
        trigger.setPointerCapture(event.pointerId);
        press = "hold";
        beginHold();
      };
      const onTriggerUp = () => {
        if (press === "hold") endHold();
        press = "none";
      };

      stage.addEventListener("pointerdown", onDown);
      stage.addEventListener("pointermove", onMove);
      stage.addEventListener("pointerup", onUp);
      stage.addEventListener("pointercancel", onCancel);
      stage.addEventListener("contextmenu", onContextMenu);
      trigger.addEventListener("keydown", onKeyDown);
      trigger.addEventListener("keyup", onKeyUp);
      trigger.addEventListener("blur", onBlur);
      trigger.addEventListener("pointerdown", onTriggerDown);
      trigger.addEventListener("pointerup", onTriggerUp);
      trigger.addEventListener("pointercancel", onTriggerUp);
      trigger.addEventListener("contextmenu", onContextMenu);
      if (fine) {
        window.addEventListener("pointermove", onHover, { passive: true });
        document.documentElement.addEventListener("pointerleave", onLeave);
      }

      sync();

      cleanup = () => {
        cancelAnimationFrame(frame);
        gravity?.reset();
        fx?.dispose();
        name?.style.removeProperty("--pull");
        io.disconnect();
        ro.disconnect();
        mo.disconnect();
        wide.removeEventListener("change", resize);
        document.removeEventListener("visibilitychange", onVisibility);
        stage.removeEventListener("pointerdown", onDown);
        stage.removeEventListener("pointermove", onMove);
        stage.removeEventListener("pointerup", onUp);
        stage.removeEventListener("pointercancel", onCancel);
        stage.removeEventListener("contextmenu", onContextMenu);
        trigger.removeEventListener("keydown", onKeyDown);
        trigger.removeEventListener("keyup", onKeyUp);
        trigger.removeEventListener("blur", onBlur);
        trigger.removeEventListener("pointerdown", onTriggerDown);
        trigger.removeEventListener("pointerup", onTriggerUp);
        trigger.removeEventListener("pointercancel", onTriggerUp);
        trigger.removeEventListener("contextmenu", onContextMenu);
        window.removeEventListener("pointermove", onHover);
        document.documentElement.removeEventListener("pointerleave", onLeave);
        renderer.dispose();
      };
      if (disposed) cleanup();
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [enabled]);

  const showCanvas = enabled && !reduced;

  return (
    <div
      ref={holeRef}
      data-phase="idle"
      className={cn(
        "hole relative flex flex-col items-center gap-3",
        className,
      )}
    >
      <div
        ref={stageRef}
        aria-hidden
        className={cn(
          "hole-stage relative select-none",
          showCanvas && "cursor-grab touch-pan-y active:cursor-grabbing",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            showCanvas && live ? "opacity-0" : "opacity-100",
          )}
        >
          {children}
        </div>
        {showCanvas ? (
          <canvas
            ref={canvasRef}
            className={cn(
              "absolute inset-0 size-full transition-opacity duration-700",
              live ? "opacity-100" : "opacity-0",
            )}
          />
        ) : null}
        <div ref={flashRef} className="hole-flash" />
      </div>
      {showCanvas ? (
        <>
          {/* The system readout: near-invisible until the pointer nears
              the hole, so the curious find the mechanic and nobody else is
              interrupted. */}
          <div
            aria-hidden
            className={cn("hole-readout", live && "hole-readout--live")}
          >
            <p className="hole-readout__tag">{copy.tag}</p>
            <p className="hole-readout__more">{copy.detected}</p>
            <p className="hole-readout__more">{copy.how}</p>
            <p className="hole-readout__orbit">
              <span className="stage-hint__mouse">{copy.orbitMouse}</span>
              <span className="stage-hint__touch">{copy.orbitTouch}</span>
            </p>
          </div>
          <button
            ref={triggerRef}
            type="button"
            aria-label={copy.keyLabel}
            className={cn("hole-trigger", live && "hole-trigger--live")}
          >
            <span aria-hidden className="hole-trigger__text">
              <span ref={labelRef}>{copy.idle}</span>
              <span className="hole-trigger__time">
                {" // "}
                <span ref={timeRef}>{AT_REST}</span>
              </span>
            </span>
            <span aria-hidden className="hole-trigger__horizon">
              <span ref={horizonRef} />
            </span>
          </button>
          <p ref={statusRef} aria-live="polite" className="sr-only" />
        </>
      ) : null}
    </div>
  );
}
