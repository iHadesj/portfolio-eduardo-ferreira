"use client";

import { useToast } from "@/components/ui/toast";
import { siteConfig } from "@/lib/site-config";
import { useI18n } from "@/lib/i18n/locale-provider";

/** Giant clickable e-mail — copies to clipboard and toasts. */
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
      className="link-underline font-display text-bone hover:text-signal w-fit text-left text-[length:clamp(1.5rem,5vw,3rem)] leading-tight transition-colors hover:bg-[length:100%_1px]"
    >
      {siteConfig.email}
    </button>
  );
}
