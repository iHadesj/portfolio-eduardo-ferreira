"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";
import { useI18n } from "@/lib/i18n/locale-provider";

/**
 * Cycles dark ↔ light (the secret "underworld" theme is driven by the Fase 7
 * easter egg, not this toggle). Both icons come from the server and CSS shows
 * the one for the theme next-themes already wrote on <html> before paint
 * (`.theme-toggle__*` in globals.css), so the button is never an empty box
 * while the page hydrates. Only the label waits for the mount.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();
  const { dict } = useI18n();

  const isLight = resolvedTheme === "light";

  return (
    <button
      type="button"
      aria-label={
        mounted
          ? isLight
            ? dict.common.themeToDark
            : dict.common.themeToLight
          : dict.common.themeToggle
      }
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className={cn(
        "rounded-sm border-ash text-smoke hover:border-signal hover:text-bone inline-flex h-9 w-9 items-center justify-center border transition-colors duration-200",
        className,
      )}
    >
      <Sun
        aria-hidden
        size={18}
        strokeWidth={1.5}
        className="theme-toggle__sun"
      />
      <Moon
        aria-hidden
        size={18}
        strokeWidth={1.5}
        className="theme-toggle__moon"
      />
    </button>
  );
}
