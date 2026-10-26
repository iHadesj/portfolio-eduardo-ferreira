import { fontVariables } from "@/lib/fonts";
import { Providers } from "@/components/providers";
import { SiteChrome } from "@/components/layout/site-chrome";
import { htmlLang, type Locale } from "@/lib/i18n/config";
import { BootSequence } from "@/components/layout/boot-sequence";
import { getClientDictionary, getDictionary } from "@/lib/i18n/dictionaries";
import { LocaleProvider } from "@/lib/i18n/locale-provider";

/**
 * The shared body of both root layouts.
 *
 * Each locale has its own root layout (`app/(pt)` and `app/(en)`) so that
 * `<html lang>` is a static, server-rendered fact rather than something patched
 * after hydration. Everything below the `<html>` element is identical, so it
 * lives here instead of being copied per locale.
 */
export function RootDocument({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <html
      lang={htmlLang[locale]}
      suppressHydrationWarning
      className={fontVariables}
    >
      <body className="bg-abyss font-body text-bone min-h-dvh antialiased">
        <BootSequence copy={getDictionary(locale).boot} />
        <LocaleProvider locale={locale} dict={getClientDictionary(locale)}>
          <Providers>
            <SiteChrome>{children}</SiteChrome>
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
