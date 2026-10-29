"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { navItems } from "@/lib/site-config";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SoundToggle } from "@/components/ui/sound-toggle";
import { LocaleToggle } from "@/components/ui/locale-toggle";
import { Kbd } from "@/components/ui/kbd";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { useSmoothScroll } from "@/hooks/use-smooth-scroll";
import { useCommandMenu } from "@/components/layout/command-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";
import { localePath, sectionPath } from "@/lib/i18n/routes";

export function Navbar() {
  const ids = useMemo(() => navItems.map((item) => item.id), []);
  const active = useScrollSpy(ids);
  const scrollTo = useSmoothScroll();
  const router = useRouter();
  const { setOpen } = useCommandMenu();
  const { locale, dict } = useI18n();

  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const previous = scrollY.getPrevious() ?? 0;
    setScrolled(y > 24);
    setHidden(y > 400 && y > previous);
  });

  function handleNav(event: React.MouseEvent, href: string) {
    event.preventDefault();
    // The nav is part of the persistent chrome, so it also renders on case
    // study pages where these sections do not exist. Scrolling there would be a
    // no-op click; route home to the anchor instead.
    if (document.querySelector(href)) {
      scrollTo(href);
      return;
    }
    router.push(sectionPath(locale, href));
  }

  return (
    <motion.header
      animate={{ y: hidden ? "-100%" : "0%" }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onFocusCapture={() => setHidden(false)}
      className={cn(
        "fixed inset-x-0 top-0 z-[var(--z-nav)] transition-colors duration-300",
        scrolled && "nav-surface border-ash border-b",
      )}
    >
      <nav
        aria-label={dict.nav.main}
        className="container-hades flex h-16 items-center justify-between"
      >
        <Link
          href={localePath(locale, "/")}
          aria-label={dict.nav.home}
          className="font-display text-bone text-xl tracking-tight"
        >
          EF
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const isActive = active === item.id;
            return (
              <li key={item.id} className="relative">
                <a
                  href={item.href}
                  onClick={(event) => handleNav(event, item.href)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "relative inline-block px-3 py-2 text-sm transition-colors",
                    isActive ? "text-bone" : "text-smoke hover:text-bone",
                  )}
                >
                  {item.label[locale]}
                  {isActive ? (
                    <motion.span
                      layoutId="nav-underline"
                      className="bg-signal absolute inset-x-3 -bottom-0.5 h-px"
                    />
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <LocaleToggle />
          <SoundToggle />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={dict.nav.openCommands}
            className="rounded-sm border-ash text-smoke hover:border-signal hover:text-bone hidden items-center gap-1.5 border px-3 py-1.5 text-sm transition-colors md:inline-flex"
          >
            <span>{dict.nav.commands}</span>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </button>
          <MobileNav />
        </div>
      </nav>
    </motion.header>
  );
}
