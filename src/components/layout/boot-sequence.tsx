import type { CSSProperties } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Runs before the overlay paints: only the first visit of a session boots,
 * and any key or tap skips it; once it has faded it is switched off, so a
 * late key cannot replay the fade. Storage blocked → no boot at all (it would
 * otherwise replay on every page).
 */
const GATE = `(function(){var d=document.documentElement;try{if(sessionStorage.getItem("hades:booted")){d.dataset.boot="off";return}sessionStorage.setItem("hades:booted","1")}catch(e){d.dataset.boot="off";return}function e(v){d.dataset.boot=v;removeEventListener("keydown",s,true);removeEventListener("pointerdown",s,true)}function s(){e("skip")}addEventListener("keydown",s,true);addEventListener("pointerdown",s,true);setTimeout(function(){e("off")},2600)})();`;

/**
 * The first visit opens on a terminal boot: a few `[ ok ]` lines over a
 * dim veil, ~1.5 s, then it fades and is gone. Server-rendered and animated
 * in CSS only (`.boot` in globals.css), so it costs no JavaScript beyond
 * the gate above. It never blocks anything: the page renders underneath
 * from the start, the veil lets it show through, and the overlay takes no
 * pointer events — a tap skips it and still lands on what is under it.
 * Hidden from assistive tech, and absent under reduced motion.
 */
export function BootSequence({ copy }: { copy: Dictionary["boot"] }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: GATE }} />
      <div aria-hidden className="boot">
        <div className="boot__panel container-hades">
          <p className="boot__title">{copy.title}</p>
          {copy.lines.map((line, i) => (
            <p
              key={line}
              className="boot__line"
              style={{ "--i": i } as CSSProperties}
            >
              <span className="boot__ok">[ ok ]</span> {line}
            </p>
          ))}
          <p
            className="boot__line boot__ready"
            style={{ "--i": copy.lines.length } as CSSProperties}
          >
            {copy.ready}
            <span className="boot__caret">_</span>
          </p>
          <p className="boot__skip">{copy.skip}</p>
        </div>
      </div>
    </>
  );
}
