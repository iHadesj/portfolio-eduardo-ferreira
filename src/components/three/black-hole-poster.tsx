import type { CSSProperties } from "react";
import {
  HEAT_INKS,
  HOLE_LAYOUTS,
  idleView,
  rasterizeHole,
  type HoleLayoutName,
} from "./black-hole";

/** Traced once per build: every locale's page shares the same frames. */
const frames = new Map<HoleLayoutName, string[]>();
function frame(name: HoleLayoutName): string[] {
  let layers = frames.get(name);
  if (!layers) {
    layers = rasterizeHole(HOLE_LAYOUTS[name], idleView(0));
    frames.set(name, layers);
  }
  return layers;
}

/**
 * The black hole's first frame, traced to text on the server at build time.
 * It ships as plain characters in the HTML — complete at first paint, no
 * script — and it is what stays wherever the live scene does not run
 * (reduced motion, Save-Data, no WebGL2).
 *
 * Each layout is a stack of `<pre>` layers, one per blackbody ink (red rim
 * to blue-white core), inked like the live scene; the stage reads those
 * same colours back for the GPU. CSS shows the layout that matches the
 * breakpoint.
 */
export function BlackHolePoster() {
  return (Object.keys(HOLE_LAYOUTS) as HoleLayoutName[]).map((name) => (
    <div
      key={name}
      data-layout={name}
      className="hole-art"
      style={{ "--cols": HOLE_LAYOUTS[name].cols } as CSSProperties}
    >
      {frame(name).map((text, layer) => (
        <pre key={HEAT_INKS[layer]} data-ink={HEAT_INKS[layer]}>
          {text}
        </pre>
      ))}
    </div>
  ));
}
