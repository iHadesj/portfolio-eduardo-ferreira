"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { LenisProvider } from "@/components/layout/lenis-provider";

/**
 * Global client providers: ThemeProvider → MotionConfig → Lenis → children.
 * (React Query left with the repository feed: nothing on the page fetches
 * from the client any more.)
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem={false}
      themes={["dark", "light", "underworld"]}
    >
      <MotionConfig reducedMotion="user">
        <LenisProvider>{children}</LenisProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
