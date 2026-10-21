"use client";

import { CommandMenuProvider } from "@/components/layout/command-menu";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SkipLink } from "@/components/layout/skip-link";
import { CustomCursor } from "@/components/ui/custom-cursor";
import { ToastProvider } from "@/components/ui/toast";
import { EasterEggs } from "@/components/easter-eggs";
import { UnderworldParticles } from "@/components/underworld-particles";
import { AmbientBackdrop } from "@/components/layout/ambient-backdrop";

/**
 * The persistent shell around every page: toasts, skip link, navbar (+ mobile
 * nav and ⌘K palette via CommandMenuProvider), footer, overlay cursor, contour
 * backdrop, grain overlay and the easter-egg controller (Konami → Underworld).
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <CommandMenuProvider>
        <AmbientBackdrop />
        <SkipLink />
        <Navbar />
        {children}
        <Footer />
        <UnderworldParticles />
        <CustomCursor />
        <div aria-hidden className="grain-overlay" />
        <EasterEggs />
      </CommandMenuProvider>
    </ToastProvider>
  );
}
