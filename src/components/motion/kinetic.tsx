import { Fragment, type CSSProperties } from "react";

/**
 * A line of copy split into words for motion, on the server: no client
 * splitting, no layout read, nothing to hydrate. Words stay real text with
 * real spaces between them, so wrapping, selection and screen readers see
 * the same sentence.
 *
 * - `rise`: each word sits in a mask (`.k-mask`, a clip-path, so baselines
 *   are untouched) and comes up from under it; `--i` orders the stagger.
 *   The scene or the hero's opening decides when (globals.css, "Motion").
 * - `read`: plain words (`.k-read`) that the manifesto lights one by one as
 *   it is scrolled through (motion/scrub-scenes.ts).
 */
export function Kinetic({
  text,
  mode = "rise",
  from = 0,
}: {
  text: string;
  mode?: "rise" | "read";
  /** Index of the first word, to continue a stagger across lines. */
  from?: number;
}) {
  const words = text.split(" ").filter(Boolean);

  return words.map((word, index) => (
    <Fragment key={index}>
      {index > 0 ? " " : null}
      {mode === "read" ? (
        <span className="k-read">{word}</span>
      ) : (
        <span className="k-mask">
          <span
            className="k-unit"
            style={{ "--i": from + index } as CSSProperties}
          >
            {word}
          </span>
        </span>
      )}
    </Fragment>
  ));
}
