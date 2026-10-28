"use client";

import { CommandMenuProvider } from "@/components/layout/command-menu";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SkipLink } from "@/components/layout/skip-link";
import { ToastProvider } from "@/components/ui/toast";
import { EasterEggs } from "@/components/easter-eggs";
import { AnomalyLog } from "@/components/anomaly-log";
import { UnderworldParticles } from "@/components/underworld-particles";
import { AmbientBackdrop } from "@/components/layout/ambient-backdrop";
import { StatusLine } from "@/components/shell/status-line";
import { MotionDirector } from "@/components/motion/motion-director";
import type { ShellProject } from "@/components/shell/commands";

/**
 * The persistent shell around every page: toasts, skip link, navbar (+ mobile
 * nav and ⌘K palette via CommandMenuProvider), footer, contour
 * backdrop, grain overlay, the easter-egg controller (Konami → Underworld),
 * the log of anomalies found, the status line that opens the shell and the
 * director that runs the page's motion.
 * `projects` is the compact list the shell can `ls` and `open`, handed down
 * from the server so the case-study collection never ships to the client.
 */
export function SiteChrome({
  children,
  projects,
}: {
  children: React.ReactNode;
  projects: ShellProject[];
}) {
  return (
    <ToastProvider>
      <CommandMenuProvider>
        <AmbientBackdrop />
        <SkipLink />
        <Navbar />
        {children}
        <Footer />
        <UnderworldParticles />
        <div aria-hidden className="grain-overlay" />
        <EasterEggs />
        <AnomalyLog />
        <StatusLine projects={projects} />
        <MotionDirector />
      </CommandMenuProvider>
    </ToastProvider>
  );
}
