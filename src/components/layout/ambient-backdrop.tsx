/**
 * The fixed texture behind every page: contour lines of Cassini ovals (the
 * curves where the product of the distances to two points is constant). One
 * of them is Bernoulli's lemniscate — the infinity sign hiding in the field,
 * echoing the ribbon in the hero.
 *
 * Static markup on purpose: the drift on scroll is a CSS scroll-driven
 * animation, switched off under reduced motion (see `.ambient-*` in
 * globals.css).
 */
export function AmbientBackdrop() {
  return (
    <div aria-hidden className="ambient-backdrop">
      <div className="ambient-field">
        <span className="ambient-field__lines" />
      </div>
    </div>
  );
}
