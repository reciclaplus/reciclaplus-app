"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GoogleIcon from "@mui/icons-material/Google";
import RecyclingIcon from "@mui/icons-material/Recycling";
import { createClient } from "@/lib/supabase/client";
import { strings } from "@/lib/strings";

export default function LandingPage() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/home");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

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

  if (checking) return null;

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
