"use client";

import { useToast } from "@/components/ui/toast";
import { siteConfig } from "@/lib/site-config";
import { useI18n } from "@/lib/i18n/locale-provider";

/**
 * Giant clickable e-mail — copies to clipboard and toasts. The display face
 * is monospaced (0.6em a glyph), so the size floor is low enough for the
 * whole address to fit a 320px screen, and it may break anywhere before it
 * would ever run off the edge.
 */
export function CopyEmail() {
  const { toast } = useToast();
  const { dict } = useI18n();

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(siteConfig.email);
        toast(dict.common.emailCopied);
      }}
      className="link-underline font-display text-bone hover:text-signal w-fit max-w-full text-left text-[length:clamp(1rem,5vw,3rem)] leading-tight [overflow-wrap:anywhere] transition-colors hover:bg-[length:100%_1px]"
    >
      {siteConfig.email}
    </button>
  );
}
