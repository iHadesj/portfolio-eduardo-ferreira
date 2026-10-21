import { cn } from "@/lib/utils";
import { POSTER_QUADS } from "./hero-poster-shape";

/**
 * LCP-safe SVG counterpart to the interactive ribbon. The shape is baked by
 * `scripts/generate-hero-poster.mts` from the same curve as the WebGL mesh,
 * so the hand-off to the live scene does not jump. Shading is stored as
 * percentages and resolved with `color-mix`, which keeps one shape for both
 * the surface palette and the Underworld one.
 */
export function HeroPoster({
  className,
  underworld = false,
}: {
  className?: string;
  underworld?: boolean;
}) {
  const accent = underworld ? "#ed2018" : "#e8a33d";
  const accentBright = underworld ? "#ff5a3d" : "#f3c66a";
  const reflection = underworld ? "#4a0a0e" : "#2f6f78";
  const obsidian = underworld ? "#070304" : "#060509";

  return (
    <div
      aria-hidden
      className={cn("flex items-center justify-center", className)}
    >
      {/* The bake includes the desktop pose's nudge to the right; the touch
          scene is centred, so the poster follows it below lg. */}
      <svg
        viewBox="20 20 320 320"
        className="h-auto w-full overflow-visible max-lg:-translate-x-[6.9%]"
        role="presentation"
      >
        <defs>
          <radialGradient id="hp-ambient" cx="50%" cy="48%" r="52%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.105" />
            <stop offset="50%" stopColor={reflection} stopOpacity="0.045" />
            <stop offset="100%" stopColor="#07060a" stopOpacity="0" />
          </radialGradient>
          <filter id="hp-shadow" x="-40%" y="-100%" width="180%" height="300%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        <circle cx="180" cy="174" r="170" fill="url(#hp-ambient)" />
        <ellipse
          cx="190"
          cy="292"
          rx="104"
          ry="11"
          fill="#000"
          fillOpacity="0.5"
          filter="url(#hp-shadow)"
        />

        {POSTER_QUADS.map((quad, index) => {
          const [reflect, gold, edge, x1, y1, x2, y2, x3, y3, x4, y4] = quad;
          const fill = `color-mix(in oklab, ${accentBright} ${gold}%, color-mix(in oklab, ${reflection} ${reflect}%, ${obsidian}))`;
          return (
            <g key={index}>
              <path
                d={`M${x1} ${y1}L${x2} ${y2}L${x3} ${y3}L${x4} ${y4}Z`}
                style={{ fill, stroke: fill }}
                strokeWidth="0.7"
                strokeLinejoin="round"
              />
              <path
                d={`M${x2} ${y2}L${x3} ${y3}M${x4} ${y4}L${x1} ${y1}`}
                stroke={accent}
                strokeOpacity={(edge ?? 50) / 100}
                strokeWidth="1.15"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
