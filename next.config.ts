import type { NextConfig } from "next";
import { siteConfig } from "./src/lib/site-config";

/**
 * A request from a terminal client (`curl edu-ferreira.vercel.app`). Next
 * matches `has` values as whole strings, so the version after the slash is
 * part of the pattern.
 */
const terminal = [
  {
    type: "header" as const,
    key: "user-agent",
    value: "(?:curl|Wget|HTTPie|xh)/.*",
  },
];

/**
 * No locale rewrites here on purpose: both locales are real routes (see
 * `src/app/(pt)` and `src/app/(en)`), so `/`, `/projetos/:slug` and `/en/*` all
 * resolve directly. The only rewrites answer terminals with text.
 */
const nextConfig: NextConfig = {
  images: {
    // Next only negotiates WebP by default. AVIF lands first in the Accept
    // chain and is typically 20-30% smaller again on these UI screenshots;
    // browsers without it fall through to WebP and then to the source.
    formats: ["image/avif", "image/webp"],
  },

  // Before the filesystem: `/` is a page, so an ordinary rewrite would
  // never get the chance to answer a terminal with the text résumé.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", has: terminal, destination: "/api/terminal/pt" },
        { source: "/en", has: terminal, destination: "/api/terminal/en" },
        { source: "/cv", has: terminal, destination: "/api/terminal/pt/cv" },
        {
          source: "/en/cv",
          has: terminal,
          destination: "/api/terminal/en/cv",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },

  // `/cv` in a browser is the PDF; only terminals get the text version.
  async redirects() {
    return ["/cv", "/en/cv"].map((source) => ({
      source,
      missing: terminal,
      destination: siteConfig.cvUrl,
      permanent: false,
    }));
  },

  async headers() {
    return [
      {
        // The `download` attribute alone is a hint the browser's built-in PDF
        // viewer may ignore. Forcing the disposition makes the CV save to disk
        // from every entry point — hero button, command palette, direct URL.
        source: siteConfig.cvUrl,
        headers: [
          {
            key: "Content-Disposition",
            value: `attachment; filename="${siteConfig.cvFileName}"`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
