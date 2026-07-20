"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import GoogleIcon from "@mui/icons-material/Google";
import RecyclingIcon from "@mui/icons-material/Recycling";
import { createClient } from "@/lib/supabase/client";
import { strings } from "@/lib/strings";

// Dev-only email/password login, shown only when explicitly enabled in the
// test environment. Never set this flag in production (see .env examples).
const DEV_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";

export default function LandingPage() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [devEmail, setDevEmail] = useState("");
  const [devPassword, setDevPassword] = useState("");
  const [devError, setDevError] = useState(false);
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

  async function handleDevSignIn(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setDevError(false);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: devEmail,
      password: devPassword,
    });
    if (error) {
      setDevError(true);
      setLoading(false);
      return;
    }
    // Session cookie is set by @supabase/ssr; guarded pages read it directly.
    router.replace("/home");
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

          {DEV_LOGIN_ENABLED && (
            <Box
              component="form"
              onSubmit={handleDevSignIn}
              sx={{ width: "100%", mt: 2 }}
            >
              <Divider sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {strings.landing.devLogin.title}
                </Typography>
              </Divider>
              <Stack spacing={2}>
                <TextField
                  type="email"
                  label={strings.landing.devLogin.email}
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  size="small"
                  fullWidth
                  required
                />
                <TextField
                  type="password"
                  label={strings.landing.devLogin.password}
                  value={devPassword}
                  onChange={(e) => setDevPassword(e.target.value)}
                  size="small"
                  fullWidth
                  required
                />
                {devError && (
                  <Alert severity="error">
                    {strings.landing.devLogin.error}
                  </Alert>
                )}
                <Button
                  type="submit"
                  variant="outlined"
                  disabled={loading}
                >
                  {strings.landing.devLogin.submit}
                </Button>
              </Stack>
            </Box>
          )}
        </Stack>
      </Box>
    </Container>
  );
}
