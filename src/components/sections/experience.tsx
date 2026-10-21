import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { Badge } from "@/components/ui/badge";
import { ScrollSection } from "@/components/layout/scroll-flow";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Indent (in rem) of each stop from md up. The timeline wanders instead of
 * running down a ruled border: every stop sits on a different step and a
 * curve joins it to the next one.
 */
const STEPS = [0, 3.5, 1.5, 5, 2.5];

function stepAt(index: number) {
  return STEPS[index % STEPS.length] ?? 0;
}

export function Experience({ dict }: { dict: Dictionary }) {
  const items = dict.experience.items;

  return (
    <ScrollSection
      lean={-1}
      id="trajetoria"
      className="container-hades section-pad scroll-mt-24"
    >
      <SectionHeading
        eyebrow={dict.experience.eyebrow}
        title={dict.experience.title}
      />

      <ol className="experience-path relative mt-10 flex flex-col gap-10 pl-8">
        {items.map((item, index) => {
          const step = stepAt(index);
          const nextStep = stepAt(index + 1);
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.role}-${index}`}
              className="experience-stop group relative"
              style={
                {
                  "--stop-indent": `${step}rem`,
                  "--stop-span": `${Math.abs(nextStep - step)}rem`,
                  "--stop-lead": `${Math.min(0, nextStep - step)}rem`,
                } as React.CSSProperties
              }
            >
              {isLast ? null : (
                <svg
                  aria-hidden
                  className="experience-stop__curve"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {/* Straight on phones (no indent), an S-bend from md up. */}
                  <path
                    className="experience-stop__line"
                    d="M50 0 C50 55 50 45 50 100"
                  />
                  <path
                    className="experience-stop__bend"
                    d={
                      nextStep >= step
                        ? "M0 0 C0 55 100 45 100 100"
                        : "M100 0 C100 55 0 45 0 100"
                    }
                  />
                </svg>
              )}
              <span
                aria-hidden
                className="border-abyss bg-ash group-hover:bg-molten absolute top-1.5 -left-[37px] size-2.5 rounded-full border-2 transition-colors"
              />
              <Reveal
                delay={index * 0.06}
                from={index % 2 === 0 ? "left" : "right"}
                distance={24}
                className="flex flex-col gap-2"
              >
                <span className="text-label text-smoke font-mono uppercase">
                  {item.period}
                </span>
                <h3 className="font-display text-h3 text-bone">
                  {item.role}
                  {item.org ? (
                    <span className="text-smoke"> · {item.org}</span>
                  ) : null}
                </h3>
                <ul className="text-smoke flex flex-col gap-1 text-sm">
                  {item.bullets.map((bullet, bulletIndex) => (
                    <li key={bulletIndex} className="flex gap-2">
                      <span aria-hidden className="text-molten">
                        —
                      </span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 pt-1">
                  {item.stack.map((tech) => (
                    <Badge key={tech}>{tech}</Badge>
                  ))}
                </div>
              </Reveal>
            </li>
          );
        })}
      </ol>
    </ScrollSection>
  );
}
