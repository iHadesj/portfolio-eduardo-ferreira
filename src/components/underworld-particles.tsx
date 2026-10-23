"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/use-mounted";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

interface Ember {
  x: number;
  y: number;
  radius: number;
  speed: number;
  sway: number;
  frequency: number;
  phase: number;
  opacity: number;
  flicker: number;
  hot: boolean;
}

function createEmbers(width: number, height: number) {
  const count = Math.min(76, Math.max(34, Math.round(width / 26)));

  return Array.from({ length: count }, (): Ember => {
    const depth = 0.45 + Math.random() * 0.85;

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      radius: (0.55 + Math.random() * 1.55) * depth,
      speed: (9 + Math.random() * 24) * depth,
      sway: 7 + Math.random() * 22,
      frequency: 0.35 + Math.random() * 0.75,
      phase: Math.random() * Math.PI * 2,
      opacity: 0.2 + Math.random() * 0.55,
      flicker: 1.4 + Math.random() * 3.2,
      hot: Math.random() > 0.78,
    };
  });
}

function createGlowSprite(core: string, glow: string) {
  const sprite = document.createElement("canvas");
  const size = 48;
  sprite.width = size;
  sprite.height = size;
  const context = sprite.getContext("2d");
  if (!context) return sprite;

  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(200, 255, 217, 1)");
  gradient.addColorStop(0.12, core);
  gradient.addColorStop(0.42, glow);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return sprite;
}

export function UnderworldParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const mounted = useMounted();
  const reducedMotion = useReducedMotionSafe();
  const active = mounted && theme === "underworld";

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let embers: Ember[] = [];
    let frame = 0;
    let previousTime = performance.now();
    const emberSprite = createGlowSprite(
      "rgba(90, 247, 142, 0.9)",
      "rgba(29, 107, 59, 0.3)",
    );
    const hotSprite = createGlowSprite(
      "rgba(200, 255, 217, 1)",
      "rgba(90, 247, 142, 0.42)",
    );

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      embers = createEmbers(width, height);
    };

    const paint = (time: number, delta: number, move: boolean) => {
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";

      for (const ember of embers) {
        if (move) {
          ember.y -= ember.speed * delta;
          if (ember.y < -18) {
            ember.y = height + 18;
            ember.x = Math.random() * width;
          }
        }

        const seconds = time * 0.001;
        const x =
          ember.x +
          Math.sin(seconds * ember.frequency + ember.phase) * ember.sway;
        const flicker =
          0.62 +
          Math.sin(seconds * ember.flicker + ember.phase * 1.7) * 0.22 +
          Math.sin(seconds * 7.1 + ember.phase) * 0.08;
        const alpha = Math.max(0.08, flicker) * ember.opacity;

        const sprite = ember.hot ? hotSprite : emberSprite;
        const diameter = ember.radius * (ember.hot ? 12 : 9);
        context.globalAlpha = alpha;
        context.drawImage(
          sprite,
          x - diameter / 2,
          ember.y - diameter / 2,
          diameter,
          diameter,
        );
      }

      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
    };

    const animate = (time: number) => {
      const delta = Math.min(0.04, (time - previousTime) / 1000);
      previousTime = time;
      paint(time, delta, true);
      frame = requestAnimationFrame(animate);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
      } else if (!reducedMotion) {
        previousTime = performance.now();
        frame = requestAnimationFrame(animate);
      }
    };

    const handleResize = () => {
      resize();
      if (reducedMotion) paint(performance.now(), 0, false);
    };

    resize();
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);

    if (reducedMotion) paint(performance.now(), 0, false);
    else frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active, reducedMotion]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[2] h-dvh w-full opacity-90"
    />
  );
}
