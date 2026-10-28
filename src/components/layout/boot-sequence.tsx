import type { CSSProperties } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Runs before the first paint and sets the page's motion up:
 *
 * - `data-motion="on"` unless reduced motion is asked for: the scenes may
 *   wait offscreen for their entrance (motion/motion-director.tsx). If the
 *   director has not shown up a few seconds later, the attribute goes and
 *   everything simply shows.
 * - `data-intro`: the hero's opening sequence waits ("wait") while the boot
 *   runs and plays ("go") as it fades, is skipped, or right away on visits
 *   without a boot; "done" once it has played, so its rules let go of the
 *   hero before the black hole's collapse animates the same pieces.
 * - `data-boot`: only the first visit of a session boots, and any key or
 *   tap skips it; once it has faded it is switched off, so a late key
 *   cannot replay the fade. Storage blocked → no boot at all (it would
 *   otherwise replay on every page).
 */
const GATE = `(function(){var d=document.documentElement,m=!matchMedia("(prefers-reduced-motion: reduce)").matches,o;if(m){d.dataset.motion="on";setTimeout(function(){if(!("director" in d.dataset))delete d.dataset.motion},6000)}function g(){if(!m||o)return;o=1;d.dataset.intro="go";setTimeout(function(){d.dataset.intro="done"},2400)}try{if(sessionStorage.getItem("hades:booted")){d.dataset.boot="off";g();return}sessionStorage.setItem("hades:booted","1")}catch(e){d.dataset.boot="off";g();return}if(m)d.dataset.intro="wait";function e(v){d.dataset.boot=v;removeEventListener("keydown",s,true);removeEventListener("pointerdown",s,true)}function s(){e("skip");g()}addEventListener("keydown",s,true);addEventListener("pointerdown",s,true);setTimeout(g,820);setTimeout(function(){e("off")},1500)})();`;

/**
 * The first visit opens on a terminal boot: a few `[ ok ]` lines over a
 * dim veil, under a second, then it fades as the hero's opening plays.
 * Server-rendered and animated in CSS only (`.boot` in globals.css), so it
 * costs no JavaScript beyond the gate above. It never blocks anything: the
 * overlay takes no pointer events — a tap skips it and still lands on what
 * is under it. Hidden from assistive tech, and absent under reduced motion.
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
