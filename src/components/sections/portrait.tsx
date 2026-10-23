import Image from "next/image";
import { siteConfig } from "@/lib/site-config";

/**
 * Duotone portrait.
 *
 * The photo is desaturated in CSS and then remapped between two theme tokens by
 * two blend layers (`lighten` lifts the blacks to abyss, `darken` pulls the
 * whites down to signal). Doing it with tokens rather than a baked-in treatment
 * means the same file follows Obsidian, Elysium and Underworld without ever
 * fighting the palette — and there is nothing to re-export when the accent
 * changes.
 *
 * With no photo configured it renders the monogram plate instead of a broken
 * image, so the layout is already correct the moment the file lands.
 */
export function Portrait({
  alt,
  pendingLabel,
}: {
  alt: string;
  pendingLabel: string;
}) {
  const src = siteConfig.portrait;

  if (!src) {
    return (
      <div className="portrait portrait--empty">
        <span aria-hidden className="portrait__monogram">
          EF
        </span>
        <span aria-hidden className="portrait__pending">
          {pendingLabel}
        </span>
      </div>
    );
  }

  return (
    <figure className="portrait">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 19rem, (min-width: 640px) 50vw, 100vw"
        className="portrait__img"
      />
      <span aria-hidden className="portrait__shadow" />
      <span aria-hidden className="portrait__highlight" />
      <span aria-hidden className="portrait__sheen" />
    </figure>
  );
}
