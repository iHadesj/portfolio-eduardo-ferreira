import { renderCv } from "@/lib/terminal";
import { isLocale, locales } from "@/lib/i18n/config";

/** The résumé for a terminal (`curl <host>/cv`, `/en/cv`); a browser asking
 *  for `/cv` is redirected to the PDF instead (next.config.ts). */
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
  return new Response(renderCv(locale), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
