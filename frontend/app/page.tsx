"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GoogleIcon from "@mui/icons-material/Google";
import RecyclingIcon from "@mui/icons-material/Recycling";
import { createClient } from "@/lib/supabase/client";
import { strings } from "@/lib/strings";

/**
 * Public landing page. Entry point for unauthenticated users with the
 * "Sign in with Google" button that kicks off the Supabase OAuth flow.
 */
export default function LandingPage() {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          textAlign: "center",
          py: 6,
        }}
      >
        <Stack spacing={3} sx={{ alignItems: "center" }}>
          <RecyclingIcon color="primary" sx={{ fontSize: 72 }} />
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
            {strings.appName}
          </Typography>
          <Typography variant="h6" color="text.secondary">
            {strings.landing.tagline}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {strings.landing.description}
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<GoogleIcon />}
            onClick={handleSignIn}
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {strings.landing.signInWithGoogle}
          </Button>
        </Stack>
      </Box>
    </Container>
  );
}
