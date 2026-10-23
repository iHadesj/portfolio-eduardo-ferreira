"use client";

import { useCallback, useEffect } from "react";
import { useTheme } from "next-themes";
import { useToast } from "@/components/ui/toast";
import { useKonami } from "@/hooks/use-konami";
import { siteConfig } from "@/lib/site-config";
import { useI18n } from "@/lib/i18n/locale-provider";
import { fill } from "@/lib/i18n/format";

const TRIDENT = `
      Ψ
   ╲  │  ╱
    ╲ │ ╱
      │       I H A D E S J (meu nick)
      │
   ───┴───
`;

export function EasterEggs() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { dict } = useI18n();
  const t = dict.easterEggs;

  const toggleUnderworld = useCallback(() => {
    if (theme === "underworld") {
      setTheme("dark");
      toast(t.toSurface);
    } else {
      setTheme("underworld");
      toast(t.toUnderworld);
    }
  }, [theme, setTheme, toast, t.toSurface, t.toUnderworld]);

  useKonami(toggleUnderworld);

  // Console art for the curious recruiter (dev + prod).
  useEffect(() => {
    /* eslint-disable no-console */
    console.log(`%c${TRIDENT}`, "color:#c8cbd4; font-family:monospace");
    console.log(
      `%c${fill(t.consoleHint, { email: siteConfig.email })}`,
      "color:#9198a5",
    );
    /* eslint-enable no-console */
  }, [t.consoleHint]);

  // Charming tab-title swap when the user leaves the tab.
  useEffect(() => {
    const original = document.title;
    const onVisibility = () => {
      document.title = document.hidden ? t.tabTitle : original;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.title = original;
    };
  }, [t.tabTitle]);

  return null;
}
