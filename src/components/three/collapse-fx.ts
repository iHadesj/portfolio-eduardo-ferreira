/**
 * What the collapse does to the screen around the hole:
 *
 * - a veil that darkens the page from the edges in — light being drawn
 *   toward the hole — clear around the hole itself;
 * - a shake of the hero (the `translate` property, so it never fights the
 *   section's own scroll-driven `transform`);
 * - a shockwave: one ring of light thrown out from the hole across the
 *   whole screen the moment the last of the hero goes in.
 *
 * Overlays live on <body>: the hero's scroll animation gives it a transform,
 * which would otherwise trap `position: fixed` inside it.
 */

export interface CollapseFx {
  /** `dim` 0–1 (the veil), `shake` in px (amplitude). */
  frame(dim: number, shake: number): void;
  shock(): void;
  dispose(): void;
}

export function createCollapseFx(
  root: HTMLElement,
  hole: HTMLElement,
): CollapseFx {
  let veil: HTMLDivElement | null = null;
  let shaking = false;
  /** The hole's centre (viewport px), measured when the veil goes up and
      again only if a scroll moved it: never once per frame. */
  let spot = { x: 0, y: 0 };
  let scrolled = 0;

  const centre = () => {
    const box = hole.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  };

  return {
    frame(dim, shake) {
      if (dim > 0.004) {
        if (!veil || scrolled !== window.scrollY) {
          if (!veil) {
            veil = document.createElement("div");
            veil.className = "hole-veil";
            veil.setAttribute("aria-hidden", "true");
            document.body.append(veil);
          }
          scrolled = window.scrollY;
          spot = centre();
          veil.style.setProperty("--hx", `${spot.x.toFixed(0)}px`);
          veil.style.setProperty("--hy", `${spot.y.toFixed(0)}px`);
        }
        veil.style.opacity = Math.min(dim, 1).toFixed(3);
      } else if (veil) {
        veil.remove();
        veil = null;
      }

      if (shake > 0.05) {
        shaking = true;
        const angle = Math.random() * Math.PI * 2;
        const r = shake * (0.5 + 0.5 * Math.random());
        root.style.translate = `${(Math.cos(angle) * r).toFixed(1)}px ${(Math.sin(angle) * r).toFixed(1)}px`;
      } else if (shaking) {
        shaking = false;
        root.style.translate = "";
      }
    },

    shock() {
      const { x, y } = veil ? spot : centre();
      const ring = document.createElement("div");
      ring.className = "hole-shock";
      ring.setAttribute("aria-hidden", "true");
      document.body.append(ring);
      const at = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
      ring
        .animate(
          [
            { transform: `${at} scale(0.03)`, opacity: 0 },
            { transform: `${at} scale(0.08)`, opacity: 1, offset: 0.06 },
            { transform: `${at} scale(0.75)`, opacity: 0.8, offset: 0.45 },
            { transform: `${at} scale(1.35)`, opacity: 0 },
          ],
          { duration: 1400, easing: "cubic-bezier(0.25, 0.7, 0.4, 1)" },
        )
        .finished.catch(() => undefined)
        .finally(() => ring.remove());
    },

    dispose() {
      veil?.remove();
      veil = null;
      if (shaking) root.style.translate = "";
      shaking = false;
      for (const ring of document.querySelectorAll(".hole-shock"))
        ring.remove();
    },
  };
}
