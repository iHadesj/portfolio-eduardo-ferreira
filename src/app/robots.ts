import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";
import { absoluteUrl } from "@/lib/i18n/routes";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The design-system bench and the terminal résumé are not content.
        disallow: ["/api/", "/dev/", "/en/dev/"],
      },
    ],
    sitemap: absoluteUrl(siteConfig.url, "/sitemap.xml"),
  };
}
