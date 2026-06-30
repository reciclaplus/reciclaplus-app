"use client";

import { createTheme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    accent: Palette["primary"];
    statusCollected: Palette["primary"];
    statusEmpty: Palette["primary"];
    statusUnavailable: Palette["primary"];
    statusClosed: Palette["primary"];
  }
  interface PaletteOptions {
    accent?: PaletteOptions["primary"];
    statusCollected?: PaletteOptions["primary"];
    statusEmpty?: PaletteOptions["primary"];
    statusUnavailable?: PaletteOptions["primary"];
    statusClosed?: PaletteOptions["primary"];
  }
}

/**
 * Design tokens for the "emerald" redesign. Fonts are wired in via
 * next/font/google in app/layout.tsx and exposed here as CSS variables.
 */
export const COLORS = {
  emeraldStart: "#0e7a47",
  emeraldEnd: "#0a6238",
  emeraldDeepest: "#0a4d2c",
  ink: "#0d3320",
  body: "#5a6b5c",
  muted: "#9aa69b",
  mutedAlt: "#7a867b",
  lime: "#bef264",
  limeSoft: "#e8f4d8",
  roleBadgeBg: "#d3ecbf",
  canvas: "#f4f8f0",
  surface: "#ffffff",
  hairline: "#e6ece1",
  hairlineAlt: "#edf1e8",
  hairlineSoft: "#e0e7da",
  status: {
    collected: { dot: "#0a6238", bg: "#dff3e3", text: "#1f8a44" },
    empty: { dot: "#f0a020", bg: "#fdedd3", text: "#b9740b" },
    unavailable: { dot: "#d6453f", bg: "#fbe3e3", text: "#c62828" },
    closed: { dot: "#aab3a8", bg: "#eef1ec", text: "#7a867b" },
  },
} as const;

export const theme = createTheme({
  palette: {
    primary: { main: COLORS.emeraldEnd, dark: COLORS.emeraldDeepest, light: COLORS.emeraldStart },
    secondary: { main: COLORS.lime, contrastText: COLORS.emeraldDeepest },
    accent: { main: COLORS.lime, contrastText: COLORS.emeraldDeepest },
    success: { main: COLORS.status.collected.dot },
    warning: { main: COLORS.status.empty.dot },
    error: { main: COLORS.status.unavailable.dot },
    statusCollected: {
      main: COLORS.status.collected.dot,
      light: COLORS.status.collected.bg,
      dark: COLORS.status.collected.text,
    },
    statusEmpty: {
      main: COLORS.status.empty.dot,
      light: COLORS.status.empty.bg,
      dark: COLORS.status.empty.text,
    },
    statusUnavailable: {
      main: COLORS.status.unavailable.dot,
      light: COLORS.status.unavailable.bg,
      dark: COLORS.status.unavailable.text,
    },
    statusClosed: {
      main: COLORS.status.closed.dot,
      light: COLORS.status.closed.bg,
      dark: COLORS.status.closed.text,
    },
    background: { default: COLORS.canvas, paper: COLORS.surface },
    text: { primary: COLORS.ink, secondary: COLORS.body },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: "var(--font-body), 'Hanken Grotesk', sans-serif",
    h1: { fontFamily: "var(--font-display), 'Bricolage Grotesque', sans-serif", fontWeight: 800, letterSpacing: "-0.03em" },
    h2: { fontFamily: "var(--font-display), 'Bricolage Grotesque', sans-serif", fontWeight: 800, letterSpacing: "-0.03em" },
    h3: { fontFamily: "var(--font-display), 'Bricolage Grotesque', sans-serif", fontWeight: 800, letterSpacing: "-0.02em" },
    h4: { fontFamily: "var(--font-display), 'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "30px", letterSpacing: "-0.02em" },
    h5: { fontFamily: "var(--font-display), 'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: "20px" },
    h6: { fontFamily: "var(--font-display), 'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: "16px" },
    body1: { fontSize: "14.5px", fontWeight: 500 },
    body2: { fontSize: "13.5px", fontWeight: 500 },
    button: { fontWeight: 700, textTransform: "none" },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: `1px solid ${COLORS.hairline}`,
          boxShadow: "0 2px 6px rgba(0,0,0,.05)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 13,
          fontWeight: 700,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 99,
          fontWeight: 700,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});
