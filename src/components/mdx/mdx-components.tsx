import Link from "next/link";
import Image from "next/image";
import type { ComponentProps } from "react";

/** Internal links → next/link; external → new tab with rel. */
function Anchor({ href = "", children, ...props }: ComponentProps<"a">) {
  const internal = href.startsWith("/") || href.startsWith("#");
  if (internal) {
    return (
      <Link href={href} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="not-prose inline-flex flex-col rounded-md border border-ash bg-basalt px-4 py-3">
      <span className="font-mono text-label text-smoke uppercase">{label}</span>
      <span className="font-display text-xl text-bone">{value}</span>
    </span>
  );
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="not-prose my-6 rounded-md border border-signal/30 bg-signal/5 px-4 py-3 text-sm text-smoke">
      {children}
    </div>
  );
}

export function Figure({
  src,
  alt,
  caption,
  width = 1280,
  height = 800,
}: {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}) {
  return (
    <figure className="not-prose my-6">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="rounded-md border border-ash"
      />
      {caption ? (
        <figcaption className="mt-2 text-center text-sm text-smoke">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export const mdxComponents = {
  a: Anchor,
  Metric,
  Callout,
  Figure,
};
