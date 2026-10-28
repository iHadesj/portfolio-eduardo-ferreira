/** How a scene enters (globals.css, "Motion"). */
export type SceneVariant =
  /** The block rises into place. */
  | "rise"
  /** A project card dealt onto the table: from low, tilted back. */
  | "card"
  /** A heading: the path is typed, the words come up, the rule draws. */
  | "heading"
  /** Lines of a log: every `[data-step]` in turn. */
  | "log"
  /** The portrait opens behind a scanline. */
  | "wipe"
  /** The contribution calendar is swept in. */
  | "scan";

/**
 * A scene: a block that plays its entrance once, when it first comes into
 * view. The director (motion/motion-director.tsx) marks it `data-in`; until
 * then its animations wait at their first frame. They are timed, not tied
 * to the scroll position, so each one plays through at its own pace like a
 * cut in a film — slow scrolling does not freeze it halfway, a fast flick
 * does not skip it.
 *
 * Without JavaScript or under reduced motion nothing is ever held back:
 * the waiting state only exists under `html[data-motion="on"]`.
 */
export function Reveal({
  variant = "rise",
  ...props
}: React.ComponentProps<"div"> & { variant?: SceneVariant }) {
  return <div data-scene={variant} {...props} />;
}
