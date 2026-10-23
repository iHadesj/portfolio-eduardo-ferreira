import type { CSSProperties } from "react";
import {
  LAYOUTS,
  idlePose,
  rasterizeAscii,
  type LayoutName,
} from "./ascii-ribbon";

/**
 * The ribbon's first frame, rasterized to text on the server at build time.
 * It ships as plain characters in the HTML — complete at first paint, no
 * script — and it is what stays wherever the live scene does not run
 * (reduced motion, Save-Data, no WebGL2).
 *
 * Each layout is three stacked `<pre>` layers, near to far, so depth can be
 * inked like the live scene does; the stage reads those same colours back
 * for the GPU. CSS shows the layout that matches the breakpoint.
 */
export function RibbonPoster() {
  const pose = idlePose(0);
  return (Object.keys(LAYOUTS) as LayoutName[]).map((name) => (
    <div
      key={name}
      data-layout={name}
      className="ribbon-art"
      style={{ "--cols": LAYOUTS[name].cols } as CSSProperties}
    >
      {rasterizeAscii(LAYOUTS[name], pose).map((text, depth) => (
        <pre key={depth} data-depth={depth}>
          {text}
        </pre>
      ))}
    </div>
  ));
}
