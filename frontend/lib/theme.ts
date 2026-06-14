"use client";

import { createTheme } from "@mui/material/styles";

/**
 * App-wide MUI theme. Green palette to match the recycling/sustainability theme.
 */
export const theme = createTheme({
  palette: {
    primary: { main: "#2e7d32" },
    secondary: { main: "#00897b" },
  },
  shape: { borderRadius: 10 },
});
