"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { useIdleStart, parseRgb } from "@/components/three/stage-utils";
import type { DustInks, PhotoDust } from "@/components/three/photo-dust";
import type { Rgba } from "@/components/three/gl-utils";
import { cue } from "@/lib/sound";

/**
 * `"use client"`: the live portrait needs the DOM (canvas, observers,
 * pointer input). The duotone `<Portrait>` passed as `children` stays the
 * Server Component it was: it is the first paint, the alt text, and all
 * there is under reduced motion, Save-Data or without WebGL2. Once the dust
 * is drawn, `data-live` fades the photo out under it (globals.css).
 */

/** Head and shoulders of minha-foto.webp, face in the upper third. */
const CROP = { x: 0.29, y: 0.02, w: 0.39, h: 0.39 };

/**
 * Any CSS colour → 0–1 RGBA. A computed `color-mix(in oklab, …)` comes back
 * as `oklab(…)`, which `parseRgb` would misread as near black, so the colour
 * is painted into one pixel and read back as sRGB.
 */
function toRgba(color: string): Rgba {
  const pixel = document.createElement("canvas");
  pixel.width = 1;
  pixel.height = 1;
  const ctx = pixel.getContext("2d", { willReadFrequently: true });
  if (!ctx) return parseRgb(color);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r = 255, g = 255, b = 255, a = 255] = ctx.getImageData(
    0,
    0,
    1,
    1,
  ).data;
  return [r / 255, g / 255, b / 255, a / 255];
}

function readInks(root: HTMLElement): DustInks {
  const ink = (name: string) => {
    const el = root.querySelector<HTMLElement>(`[data-ink="${name}"]`);
    return toRgba(el ? getComputedStyle(el).color : "#fff");
  };
  return { dot: ink("dot"), heat: ink("heat"), core: ink("core") };
}

export function PortraitDust({
  src,
  children,
}: {
  src: string | null;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotionSafe();
  const enabled = useIdleStart(reduced);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!enabled || !src || !root || !canvas) return;

    let cancelled = false;
    let dust: PhotoDust | null = null;
    const cleanups: (() => void)[] = [];

    (async () => {
      const [{ createPhotoDust }, image] = await Promise.all([
        import("@/components/three/photo-dust"),
        (async () => {
          const img = new Image();
          img.decoding = "async";
          img.src = src;
          await img.decode();
          return img;
        })(),
        document.fonts.ready,
      ]);
      if (cancelled) return;

      dust = createPhotoDust({
        canvas,
        frame: root,
        image,
        crop: CROP,
        inks: readInks(root),
        fontFamily: getComputedStyle(canvas).fontFamily,
        onShock: () => cue("ping", 0.5),
      });
      if (!dust) return;
      const live = dust;
      root.dataset.live = "";

      let onScreen = false;
      const sync = () => live.setActive(onScreen && !document.hidden);
      const io = new IntersectionObserver(
        ([entry]) => {
          onScreen = entry?.isIntersecting ?? false;
          sync();
        },
        { rootMargin: "10% 0px" },
      );
      io.observe(canvas);
      document.addEventListener("visibilitychange", sync);

      const ro = new ResizeObserver(() => live.resize());
      ro.observe(root);

      const mo = new MutationObserver(() => {
        requestAnimationFrame(() => live.setInks(readInks(root)));
      });
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class"],
      });

      const onMove = (event: PointerEvent) =>
        live.pointer(event.clientX, event.clientY);
      const onLeave = () => live.pointerLeave();
      const onDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        live.shock(event.clientX, event.clientY);
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
      root.addEventListener("pointerdown", onDown);

      const onLost = (event: Event) => {
        event.preventDefault();
        delete root.dataset.live;
        live.setActive(false);
      };
      canvas.addEventListener("webglcontextlost", onLost);

      cleanups.push(() => {
        io.disconnect();
        ro.disconnect();
        mo.disconnect();
        document.removeEventListener("visibilitychange", sync);
        window.removeEventListener("pointermove", onMove);
        document.documentElement.removeEventListener("pointerleave", onLeave);
        root.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("webglcontextlost", onLost);
      });
    })().catch(() => {
      delete root.dataset.live;
    });

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
      dust?.dispose();
      delete root.dataset.live;
    };
  }, [enabled, src]);

  return (
    <div ref={rootRef} className="portrait-dust">
      {children}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="portrait-dust__canvas font-mono"
      />
      <span aria-hidden data-ink="dot" className="portrait-dust__ink" />
      <span aria-hidden data-ink="heat" className="portrait-dust__ink" />
      <span aria-hidden data-ink="core" className="portrait-dust__ink" />
    </div>
  );
}
