"use client";

import { useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";
import { setSoundEnabled, soundEnabled, subscribeSound } from "@/lib/sound";

/**
 * Turns the site's sound effects on and off (lib/sound). On by default;
 * the server renders it on, and a stored "off" shows once hydrated.
 * Client: it reads and writes the reader's preference.
 */
export function SoundToggle({ className }: { className?: string }) {
  const { dict } = useI18n();
  const on = useSyncExternalStore(subscribeSound, soundEnabled, () => true);

  return (
    <button
      type="button"
      aria-label={dict.common.sound}
      aria-pressed={on}
      title={dict.common.sound}
      // It plays its own on/off blips.
      data-sound="off"
      onClick={() => setSoundEnabled(!on)}
      className={cn(
        "rounded-sm border-ash text-smoke hover:border-signal hover:text-bone inline-flex h-9 w-9 items-center justify-center border transition-colors duration-200",
        on && "text-term-green",
        className,
      )}
    >
      {on ? (
        <Volume2 aria-hidden size={18} strokeWidth={1.5} />
      ) : (
        <VolumeX aria-hidden size={18} strokeWidth={1.5} />
      )}
    </button>
  );
}
