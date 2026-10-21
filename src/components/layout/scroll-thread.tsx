"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

/**
 * The ribbon from the hero, unspooled: one thread that leaves the scroll cue
 * and weaves down the page, switching sides between sections — sometimes
 * with a loop where it crosses — and is drawn in as you read.
 *
 * Why it is shaped from the DOM instead of hard-coded: section heights move
 * with copy, locale and viewport. The route is rebuilt from the sections'
 * real positions whenever the content box resizes, so a crossing always lands
 * in the empty padding between two sections rather than across a paragraph.
 *
 * Decorative only (`aria-hidden`), desktop-sized screens only, and fully
 * drawn but static under reduced motion.
 */

type Point = [number, number];

interface Route {
  d: string;
  width: number;
  height: number;
}

interface Sampled {
  length: number;
  points: Point[];
  /** Running maximum of y, so a loop never makes the lookup go backwards. */
  reach: number[];
  step: number;
}

/** Catmull-Rom through `points`, emitted as cubic Béziers. */
function smoothPath(points: Point[]): string {
  if (points.length < 2) return "";
  const [first] = points;
  let d = `M${first![0].toFixed(1)} ${first![1].toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[Math.min(points.length - 1, index + 2)]!;
    const c1: Point = [
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
    ];
    const c2: Point = [
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
    ];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Sections whose crossing gets a loop instead of a plain swoop. */
const LOOP_AT = new Set(["projetos", "github"]);

function buildRoute(host: HTMLElement): Route | null {
  const sections = Array.from(
    host.querySelectorAll<HTMLElement>(":scope > [data-scroll-section]"),
  );
  if (sections.length < 2) return null;

  const width = host.clientWidth;
  const height = host.scrollHeight;
  const container = host.querySelector<HTMLElement>(".container-hades");
  let contentLeft = 40;
  if (container) {
    const style = getComputedStyle(container);
    contentLeft =
      container.getBoundingClientRect().left -
      host.getBoundingClientRect().left +
      Number.parseFloat(style.paddingLeft);
  }
  // Hug the content column from just outside it, never the screen edge.
  const gutter = Math.max(14, Math.min(contentLeft - 30, contentLeft * 0.62));
  const sideX = (side: number) => (side < 0 ? gutter : width - gutter);
  const middle = width / 2;

  const hero = sections[0]!;
  const heroBottom = hero.offsetTop + hero.offsetHeight;
  const points: Point[] = [
    [middle, heroBottom - 92],
    [middle, heroBottom - 30],
  ];

  let previousSide = 0;
  let previousPad = 40;
  sections.slice(1).forEach((section, index) => {
    const side = index % 2 === 0 ? 1 : -1;
    const top = section.offsetTop;
    const bottom = top + section.offsetHeight;
    const pad = Math.max(
      48,
      Number.parseFloat(getComputedStyle(section).paddingTop) || 0,
    );
    const fromX = previousSide === 0 ? middle : sideX(previousSide);
    const toX = sideX(side);
    const direction = Math.sign(toX - fromX) || 1;
    const crossX = (fromX + toX) / 2 + direction * width * 0.04;

    if (previousSide !== 0) points.push([fromX, top - previousPad * 0.62]);
    points.push([fromX + (crossX - fromX) * 0.42, top - 16]);

    if (LOOP_AT.has(section.id)) {
      const r = 24;
      points.push(
        [crossX, top],
        [crossX + direction * r, top - r * 1.05],
        [crossX, top - r * 2.1],
        [crossX - direction * r, top - r * 1.05],
        [crossX, top],
      );
    } else {
      points.push([crossX, top + 2]);
    }

    points.push([crossX + (toX - crossX) * 0.58, top + 18]);
    points.push([toX, top + pad * 0.6]);

    // Down the gutter with a slow sway, so the run is never a ruled line.
    const runEnd = bottom - pad * 0.62;
    const span = runEnd - (top + pad * 0.6);
    const steps = Math.max(1, Math.round(span / 280));
    for (let step = 1; step <= steps; step += 1) {
      const y = top + pad * 0.6 + (span * step) / steps;
      const sway = Math.sin(step * 1.7 + index) * 9 * (step === steps ? 0 : 1);
      points.push([toX + sway * -side, y]);
    }

    previousSide = side;
    previousPad = pad;
  });

  // Ease back toward the centre and fade out above the footer.
  const last = points[points.length - 1]!;
  points.push([last[0] + (middle - last[0]) * 0.55, last[1] + 70]);
  points.push([middle, last[1] + 110]);

  return { d: smoothPath(points), width, height };
}

function sample(path: SVGPathElement): Sampled {
  const length = path.getTotalLength();
  const step = 6;
  const points: Point[] = [];
  const reach: number[] = [];
  let highest = Number.NEGATIVE_INFINITY;
  for (let at = 0; at <= length; at += step) {
    const point = path.getPointAtLength(at);
    points.push([point.x, point.y]);
    highest = Math.max(highest, point.y);
    reach.push(highest);
  }
  return { length, points, reach, step };
}

export function ScrollThread({
  hostRef,
}: {
  hostRef: React.RefObject<HTMLElement | null>;
}) {
  const reduced = useReducedMotionSafe();
  const [route, setRoute] = useState<Route | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawnRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let frame = 0;
    const rebuild = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRoute(buildRoute(host)));
    };
    rebuild();
    const observer = new ResizeObserver(rebuild);
    observer.observe(host);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [hostRef]);

  useEffect(() => {
    const path = drawnRef.current;
    const svg = svgRef.current;
    if (!route || !path || !svg) return;
    const sampled = sample(path);
    path.style.strokeDasharray = `${sampled.length} ${sampled.length}`;

    if (reduced) {
      path.style.strokeDashoffset = "0";
      return;
    }

    let current = 0;
    let target = 0;
    let frame = 0;

    const lengthAtY = (y: number) => {
      const { reach } = sampled;
      let low = 0;
      let high = reach.length - 1;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (reach[mid]! < y) low = mid + 1;
        else high = mid;
      }
      return low;
    };

    const paint = () => {
      current += (target - current) * 0.16;
      if (Math.abs(target - current) < 0.4) current = target;
      const index = Math.min(
        sampled.points.length - 1,
        Math.max(0, Math.round(current / sampled.step)),
      );
      path.style.strokeDashoffset = `${sampled.length - current}`;
      const head = headRef.current;
      const point = sampled.points[index];
      if (head && point) {
        head.style.transform = `translate(${point[0]}px, ${point[1]}px)`;
        head.style.opacity =
          current > 4 && current < sampled.length - 4 ? "1" : "0";
      }
      frame = current === target ? 0 : requestAnimationFrame(paint);
    };

    const update = () => {
      const top = svg.getBoundingClientRect().top;
      const reading = window.innerHeight * 0.64 - top;
      target = Math.min(sampled.length, lengthAtY(reading) * sampled.step);
      if (!frame) frame = requestAnimationFrame(paint);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [route, reduced]);

  if (!route) return null;

  return (
    <svg
      ref={svgRef}
      aria-hidden
      className="scroll-thread pointer-events-none absolute top-0 left-0 hidden md:block"
      width={route.width}
      height={route.height}
      viewBox={`0 0 ${route.width} ${route.height}`}
    >
      <path className="scroll-thread__ghost" d={route.d} />
      <path ref={drawnRef} className="scroll-thread__drawn" d={route.d} />
      {reduced ? null : (
        <g ref={headRef} className="scroll-thread__head">
          <circle r="7" className="scroll-thread__halo" />
          <circle r="2.6" className="scroll-thread__tip" />
        </g>
      )}
    </svg>
  );
}
