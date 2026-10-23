import { SectionHeading } from "@/components/ui/section-heading";
import { CopyEmail } from "@/components/sections/copy-email";
import { ContactForm } from "@/components/sections/contact-form";
import { ScrollSection } from "@/components/layout/scroll-flow";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function Contact({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <ScrollSection
      id="contato"
      className="container-hades section-pad scroll-mt-24"
      flowStrength={18}
    >
      <SectionHeading
        eyebrow={dict.contact.eyebrow}
        title={dict.contact.title}
        description={dict.contact.description}
      />

      <div className="mt-10 flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-3">
          <p className="text-smoke text-sm">{dict.contact.preferEmail}</p>
          <CopyEmail />
          <p className="text-smoke text-sm">{dict.contact.replyTime}</p>
        </div>

        <ContactForm locale={locale} />
      </div>
    </ScrollSection>
  );
}
