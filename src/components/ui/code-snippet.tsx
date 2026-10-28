import type { Snippet } from "@/lib/projects";

/**
 * A few lines quoted from a repository, numbered from 1 and with the lines
 * that carry the point marked (`.snippet` in globals.css). Monochrome on
 * purpose: the marked lines are the only emphasis, so the eye goes where the
 * decision lives instead of to whatever the syntax colours would pick.
 *
 * The block scrolls sideways rather than wrap (code keeps its shape), so it
 * is a focusable region for keyboards.
 */
export function CodeSnippet({
  snippet,
  label,
}: {
  snippet: Snippet;
  /** Accessible name of the scrollable region, e.g. "Código de money.ts". */
  label: string;
}) {
  const lines = snippet.code.replace(/\n+$/, "").split("\n");
  const marked = new Set(snippet.mark);

  return (
    <figure className="snippet">
      <figcaption className="snippet__file">
        <a href={snippet.url} target="_blank" rel="noopener noreferrer">
          {snippet.file}
        </a>
        <span aria-hidden className="snippet__lang">
          {snippet.lang}
        </span>
      </figcaption>
      <pre role="region" aria-label={label} tabIndex={0}>
        <code>
          {lines.map((line, index) => (
            <span
              key={index}
              className="snippet__line"
              data-mark={marked.has(index + 1) ? "" : undefined}
            >
              {line}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
