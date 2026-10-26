"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/locale-provider";
import { fill } from "@/lib/i18n/format";
import {
  ANOMALIES,
  ANOMALY_EVENT,
  discover,
  type AnomalyFound,
} from "@/lib/anomalies";

/** Let the toast that came with the find (a theme switch, say) be read
    first; the log line follows it. */
const DELAY = 1600;

/**
 * Reports each anomaly the first time it is found — `// anomalia 3/7 —
 * colapso do sistema` — through the site's toast. `"use client"`: it
 * listens for window events and reads the theme. The underworld is caught
 * here rather than at its two doors (Konami, the mobile nav's gate).
 */
export function AnomalyLog() {
  const { toast } = useToast();
  const { theme } = useTheme();
  const { dict } = useI18n();
  const t = dict.anomalies;

  useEffect(() => {
    if (theme === "underworld") discover("underworld");
  }, [theme]);

  useEffect(() => {
    const timers: number[] = [];
    const onFound = (event: Event) => {
      const { id, count } = (event as CustomEvent<AnomalyFound>).detail;
      timers.push(
        window.setTimeout(() => {
          toast(
            fill(t.found, {
              count: String(count),
              total: String(ANOMALIES.length),
              name: t.names[id],
            }),
          );
        }, DELAY),
      );
    };
    window.addEventListener(ANOMALY_EVENT, onFound);
    return () => {
      window.removeEventListener(ANOMALY_EVENT, onFound);
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [toast, t]);

  return null;
}
