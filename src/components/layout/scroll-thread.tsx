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

/** Start, two control points, end. */
type Cubic = [Point, Point, Point, Point];

interface Sampled {
  length: number;
  points: Point[];
  /** Running maximum of y, so a loop never makes the lookup go backwards. */
  reach: number[];
  step: number;
}

interface Route {
  d: string;
  width: number;
  height: number;
  sampled: Sampled;
}

const SAMPLE_STEP = 6;
/** Chords per Bézier when measuring: far finer than SAMPLE_STEP needs. */
const FLATTEN = 16;

/** Catmull-Rom through `points`, as cubic Béziers. */
function catmullRom(points: Point[]): Cubic[] {
  const cubics: Cubic[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[Math.min(points.length - 1, index + 2)]!;
    cubics.push([
      p1,
      [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
      [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
      p2,
    ]);
  }
  return cubics;
}

const fmt = ([x, y]: Point) => `${x.toFixed(1)} ${y.toFixed(1)}`;

function pathData(cubics: Cubic[]): string {
  const [first] = cubics;
  if (!first) return "";
  let d = `M${fmt(first[0])}`;
  for (const [, c1, c2, end] of cubics) {
    d += `C${fmt(c1)} ${fmt(c2)} ${fmt(end)}`;
  }
  return d;
}

/**
 * Evenly spaced points along the route, measured from the same Béziers the
 * path is drawn with. Not `getPointAtLength`: Chrome walks the path from its
 * start on every call, so sampling a page-long route that way is quadratic —
 * it cost seconds of main thread on every rebuild during load.
 */
function sampleRoute(cubics: Cubic[]): Sampled {
  const points: Point[] = [];
  const reach: number[] = [];
  const start = cubics[0]?.[0];
  if (!start) return { length: 0, points, reach, step: SAMPLE_STEP };

  let highest = Number.NEGATIVE_INFINITY;
  let length = 0;
  let nextAt = 0;
  let previous: Point = start;
  for (const [p0, c1, c2, p3] of cubics) {
    for (let index = 1; index <= FLATTEN; index += 1) {
      const t = index / FLATTEN;
      const u = 1 - t;
      const w0 = u * u * u;
      const w1 = 3 * u * u * t;
      const w2 = 3 * u * t * t;
      const w3 = t * t * t;
      const point: Point = [
        w0 * p0[0] + w1 * c1[0] + w2 * c2[0] + w3 * p3[0],
        w0 * p0[1] + w1 * c1[1] + w2 * c2[1] + w3 * p3[1],
      ];
      const chord = Math.hypot(point[0] - previous[0], point[1] - previous[1]);
      while (nextAt <= length + chord) {
        const k = chord === 0 ? 0 : (nextAt - length) / chord;
        const y = previous[1] + (point[1] - previous[1]) * k;
        points.push([previous[0] + (point[0] - previous[0]) * k, y]);
        highest = Math.max(highest, y);
        reach.push(highest);
        nextAt += SAMPLE_STEP;
      }
      length += chord;
      previous = point;
    }
  }
  return { length, points, reach, step: SAMPLE_STEP };
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

  const cubics = catmullRom(points);
  return { d: pathData(cubics), width, height, sampled: sampleRoute(cubics) };
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
    const { sampled } = route;
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
