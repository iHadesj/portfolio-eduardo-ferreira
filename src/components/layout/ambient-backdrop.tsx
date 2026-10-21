import { LEMNISCATE_PATH } from "./ambient-trace";

/**
 * The fixed texture behind every page: contour lines of Cassini ovals (the
 * curves where the product of the distances to two points is constant). One
 * of them is Bernoulli's lemniscate — the infinity sign hiding in the field —
 * and it is the only line that carries light.
 *
 * Static markup on purpose: the drift on scroll is a CSS scroll-driven
 * animation and the travelling glint is a CSS dash animation, both switched
 * off under reduced motion (see `.ambient-*` in globals.css).
 */
export function AmbientBackdrop() {
  return (
    <div aria-hidden className="ambient-backdrop">
      <div className="ambient-field">
        <span className="ambient-field__lines" />
        <svg
          className="ambient-field__trace"
          viewBox="0 0 1600 1000"
          preserveAspectRatio="xMidYMid slice"
        >
          <path className="ambient-field__lemniscate" d={LEMNISCATE_PATH} />
          <path
            className="ambient-field__glint"
            d={LEMNISCATE_PATH}
            pathLength={100}
          />
        </svg>
      </div>
    </div>
  );
}
