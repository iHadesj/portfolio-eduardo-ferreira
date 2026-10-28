import { renderHome } from "@/lib/terminal";
import { isLocale, locales } from "@/lib/i18n/config";

/**
 * The home page for a terminal. `next.config.ts` rewrites `/` and `/en` here
 * when the request comes from curl, Wget, HTTPie or xh; browsers never see
 * it. Built once per locale at build time.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response("not found\n", { status: 404 });
  return new Response(renderHome(locale), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
