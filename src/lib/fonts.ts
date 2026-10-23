import { Geist, Geist_Mono } from "next/font/google";

/**
 * Mono — Geist Mono (Google). The protagonist: headings, labels, navigation
 * and everything that should read like a terminal. Weights 400 / 500 / 600.
 * Body — Geist (Google). Only running text, where a proportional face keeps
 * long paragraphs comfortable. Weights 400 / 500.
 *
 * adjustFontFallback (default for next/font) computes fallback metrics to
 * keep CLS ~0. latin-ext covers the PT-BR accents.
 */

export const geist = Geist({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-geist",
  display: "swap",
});

export const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const fontVariables = `${geist.variable} ${geistMono.variable}`;
