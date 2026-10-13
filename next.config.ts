import type { NextConfig } from "next";
import { siteConfig } from "./src/lib/site-config";

/**
 * No locale rewrites here on purpose: both locales are real routes (see
 * `src/app/(pt)` and `src/app/(en)`), so `/`, `/projetos/:slug` and `/en/*` all
 * resolve directly.
 */
const nextConfig: NextConfig = {
  images: {
    // Next only negotiates WebP by default. AVIF lands first in the Accept
    // chain and is typically 20-30% smaller again on these UI screenshots;
    // browsers without it fall through to WebP and then to the source.
    formats: ["image/avif", "image/webp"],
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
