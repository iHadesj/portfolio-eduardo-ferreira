import { ScrollSection } from "@/components/layout/scroll-flow";
import { TechStackMotionGrid } from "@/components/sections/tech-stack-motion";
import { SectionHeading } from "@/components/ui/section-heading";
import { siteConfig } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The visual identity of each card — number, glyph, accent token and the tool
 * list. All of it is locale-independent (product names, not prose), so it stays
 * here and is zipped with the translated copy from the dictionary by position.
 */
const STACK_VISUALS = [
  {
    index: "01",
    code: "</>",
    accent: "molten",
    tools: ["TypeScript", "React", "Next.js", "Vite", "Tailwind CSS"],
  },
  {
    index: "02",
    code: "API",
    accent: "styx",
    tools: [
      "Java",
      "Spring",
      "Node.js",
      "Express",
      "Socket.IO",
      "Firebase",
      "Zod",
    ],
  },
  {
    index: "03",
    code: "DB",
    accent: "hybrid",
    tools: [
      "Zustand",
      "TanStack Query",
      "Dexie / IndexedDB",
      "PostgreSQL",
      "JPA / Hibernate",
    ],
  },
  {
    index: "04",
    code: "3D",
    accent: "ember",
    tools: [
      "Motion",
      "Three.js",
      "React Three Fiber",
      "Material UI",
      "Web Audio API",
    ],
  },
  {
    index: "05",
    code: "QA",
    accent: "bone",
    tools: ["Vitest", "JUnit", "ESLint", "PWA", "Vercel", "Git"],
  },
] as const;

export function TechStack({ dict }: { dict: Dictionary }) {
  // Positional pairing. `flatMap` rather than `map` so a copy entry without a
  // matching visual is dropped instead of rendering a half-built card — under
  // `noUncheckedIndexedAccess` that possibility has to be handled explicitly.
  const groups = dict.stack.groups.flatMap((copy, index) => {
    const visual = STACK_VISUALS[index];
    return visual ? [{ ...visual, ...copy }] : [];
  });

  return (
    <ScrollSection
      lean={-1}
      id="stack"
      className="tech-stack section-pad scroll-mt-24"
    >
      <div className="container-hades">
        <div className="tech-stack__intro">
          <SectionHeading
            eyebrow={dict.stack.eyebrow}
            title={dict.stack.title}
            description={dict.stack.description}
          />

          <a
            className="tech-stack__github-proof"
            href={`${siteConfig.links.github}?tab=repositories`}
            target="_blank"
            rel="noreferrer"
            aria-label={dict.stack.proofAria}
          >
            <span className="tech-stack__proof-dot" aria-hidden />
            <span>
              <strong>{dict.stack.proofTitle}</strong>
              <small>{dict.stack.proofLink}</small>
            </span>
          </a>
        </div>

        <TechStackMotionGrid
          groups={groups}
          toolsAria={dict.stack.toolsAria}
          whereUsed={dict.stack.whereUsed}
        />
      </div>
    </ScrollSection>
  );
}
