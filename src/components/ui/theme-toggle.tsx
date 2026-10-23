"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";
import { useI18n } from "@/lib/i18n/locale-provider";

/**
 * Cycles dark ↔ light (the secret "underworld" theme is driven by the Fase 7
 * easter egg, not this toggle). No hydration flash: a fixed-size placeholder
 * renders until mounted, then the icon swaps in.
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
      {mounted ? (
        isLight ? (
          <Moon size={18} strokeWidth={1.5} />
        ) : (
          <Sun size={18} strokeWidth={1.5} />
        )
      ) : (
        <span className="size-[18px]" aria-hidden />
      )}
    </button>
  );
}
