"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { cn } from "@/lib/utils";
import {
  HOLE_LAYOUTS,
  NO_PULSE,
  idleView,
  type HoleLayout,
} from "./black-hole";
import type { HoleInks } from "./black-hole-gl";
import type { Gravity } from "./gravity";
import { parseRgb, useIdleStart } from "./stage-utils";

/**
 * `"use client"`: the live scene needs the DOM (canvas, observers, pointer
 * input). The poster passed as `children` is a Server Component, so the
 * first frame still arrives as HTML.
 */

/** The live scene inks with the poster's own layer colours. */
function readInks(stage: HTMLElement): HoleInks {
  const ink = (name: string) => {
    const layer = stage.querySelector<HTMLElement>(`pre[data-ink="${name}"]`);
    return parseRgb(layer ? getComputedStyle(layer).color : "rgb(255,255,255)");
  };
  return { hot: ink("hot"), warm: ink("warm"), cool: ink("cool") };
}

const WIDE = "(min-width: 64rem)";
const layoutFor = (): HoleLayout =>
  window.matchMedia(WIDE).matches ? HOLE_LAYOUTS.wide : HOLE_LAYOUTS.narrow;

/** Bounded offsets: the further you push, the harder it pushes back. */
const elastic = (x: number, limit: number) => limit * Math.tanh(x / limit);

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
/** Seconds of holding until everything is swallowed — and bursts back. */
const HOLD_FULL = 2.8;

/** The disk sends out a ring of light now and then on its own. */
const AUTO_PULSE_FROM = 5;
const AUTO_PULSE_EVERY = 9;

type Press = "none" | "pending" | "drag" | "hold";

/**
 * Server poster first; after the page is idle, a WebGL2 canvas takes over
 * with a crossfade and never stops moving: the disk turns, the camera
 * drifts round the hole and nods, stars twinkle and a ring of light runs
 * out through the disk now and then. On a desktop the view leans toward
 * the pointer. A drag (mouse or finger) orbits the camera — a flick keeps
 * it spinning — and, with a mouse, tilts it too, springing back. A tap
 * sends a ring of light out. Holding the hole down makes it pull: it looms
 * larger, spins faster, burns brighter, and the hero's content spirals in
 * (see gravity.ts) until it is let go — or, held long enough, everything
 * is swallowed and bursts back out in a flash. Paused off screen and in
 * background tabs, 30 fps on touch devices. On reduced motion or any
 * failure the poster stays.
 */
export function BlackHoleStage({
  className,
  hintMouse,
  hintTouch,
  children,
}: {
  className?: string;
  hintMouse: string;
  hintTouch: string;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotionSafe();
  const enabled = useIdleStart(reduced);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const [{ createHoleRenderer }, { createGravity }] = await Promise.all([
        import("./black-hole-gl"),
        import("./gravity"),
      ]);
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
      const gravity: Gravity = createGravity(root, stage);
      const minFrame = fine ? 0 : 1000 / 30;

      let inView = true;
      let visible = !document.hidden;
      let frame = 0;
      let last = performance.now();
      let lastDrawn = 0;
      let clock = 0;
      let diskTime = 0;
      let first = true;

      // Camera offsets: orbit (with inertia), tilt (springs back), lean.
      let orbit = 0;
      let orbitVelocity = 0;
      let tilt = 0;
      let tiltVelocity = 0;
      let leanOrbit = 0;
      let leanTilt = 0;
      let leanTargetOrbit = 0;
      let leanTargetTilt = 0;

      // Press state and the pull it drives.
      let press: Press = "none";
      let pressAt = 0;
      let pressX = 0;
      let pressY = 0;
      let lastX = 0;
      let lastY = 0;
      let lastMoveAt = 0;
      let pull = 0;
      let pulling = false;
      let lastPulse = -NO_PULSE;

      // Rows follow the box's real shape, so the scene can never be drawn
      // stretched — even if the CSS and this layout ever disagree.
      const resize = () => {
        const { width, height } = stage.getBoundingClientRect();
        const { cols } = layoutFor();
        const rows = Math.max(
          8,
          Math.round((cols * 0.6 * height) / (Math.max(width, 1) * 1.2)),
        );
        renderer.resize({ cols, rows }, width, height);
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

      const letGo = (burst: boolean) => {
        if (!pulling) return;
        pulling = false;
        gravity.release(burst);
        pulse();
        if (burst) flash();
      };

      const loop = (now: number) => {
        frame = requestAnimationFrame(loop);
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        clock += dt;

        // The hold: pull grows with time; held to the end, it all bursts.
        if (press === "pending" && clock - pressAt >= HOLD_DELAY) {
          press = "hold";
          pulling = true;
        }
        if (press === "hold") {
          pull = Math.min(1, (clock - pressAt - HOLD_DELAY) / HOLD_FULL);
          // Front-loaded, so the page starts to give the moment you hold.
          gravity.pull(Math.pow(pull, 0.8));
          if (pull >= 1) {
            press = "none";
            letGo(true);
          }
        } else {
          pull = Math.max(0, pull - dt * 1.4);
        }
        gravity.step(dt);

        if (now - lastDrawn < minFrame) return;
        lastDrawn = now;

        diskTime += dt * (1 + 3.5 * pull);
        if (press !== "drag") {
          tiltVelocity += (-SPRING * tilt - DAMPING * tiltVelocity) * dt;
          tilt += tiltVelocity * dt;
          orbit += orbitVelocity * dt;
          orbitVelocity *= Math.exp(-FRICTION * dt);
        }
        const ease = 1 - Math.exp(-dt * 4);
        leanOrbit += (leanTargetOrbit - leanOrbit) * ease;
        leanTilt += (leanTargetTilt - leanTilt) * ease;

        const idle = idleView(clock);
        const auto =
          clock < AUTO_PULSE_FROM
            ? NO_PULSE
            : (clock - AUTO_PULSE_FROM) % AUTO_PULSE_EVERY;
        renderer.render({
          ...idle,
          azimuth: idle.azimuth + orbit + leanOrbit,
          inclination: idle.inclination + elastic(tilt + leanTilt, TILT_LIMIT),
          zoom: 1 - 0.15 * pull,
          diskTime,
          pulse: Math.min(auto, clock - lastPulse),
          gain: 1 + 0.7 * pull,
        });
        if (first) {
          first = false;
          setLive(true);
        }
      };

      const sync = () => {
        const run = inView && visible;
        if (run && !frame) {
          last = performance.now();
          frame = requestAnimationFrame(loop);
        } else if (!run && frame) {
          cancelAnimationFrame(frame);
          frame = 0;
          // Nothing may stay half swallowed while the loop is asleep.
          press = "none";
          pulling = false;
          pull = 0;
          gravity.reset();
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
        if (press === "hold") letGo(false);
        if (press === "drag" && performance.now() - lastMoveAt > 120) {
          orbitVelocity = 0;
        }
        press = "none";
      };
      const onCancel = () => {
        if (press === "hold") letGo(false);
        press = "none";
      };
      const onContextMenu = (event: Event) => event.preventDefault();
      // Desktop: lean toward the pointer anywhere on the page.
      const onHover = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        const box = stage.getBoundingClientRect();
        const nx =
          (event.clientX - (box.left + box.width / 2)) / window.innerWidth;
        const ny =
          (event.clientY - (box.top + box.height / 2)) / window.innerHeight;
        leanTargetOrbit = Math.max(-1, Math.min(1, nx * 2)) * -0.3;
        leanTargetTilt = Math.max(-1, Math.min(1, ny * 2)) * 0.12;
      };
      stage.addEventListener("pointerdown", onDown);
      stage.addEventListener("pointermove", onMove);
      stage.addEventListener("pointerup", onUp);
      stage.addEventListener("pointercancel", onCancel);
      stage.addEventListener("contextmenu", onContextMenu);
      if (fine) {
        window.addEventListener("pointermove", onHover, { passive: true });
      }

      sync();

      cleanup = () => {
        cancelAnimationFrame(frame);
        gravity.reset();
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
        window.removeEventListener("pointermove", onHover);
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
    <div className={cn("hole flex flex-col items-center gap-3", className)}>
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
      <p
        aria-hidden
        className={cn(
          "stage-hint transition-opacity duration-500",
          live ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="stage-hint__mouse">{hintMouse}</span>
        <span className="stage-hint__touch">{hintTouch}</span>
      </p>
    </div>
  );
}
