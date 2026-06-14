"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { strings } from "@/lib/strings";

type Role = "read" | "write" | "admin";

interface Me {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

/**
 * Minimal post-login page. Proves the full chain: Supabase session ->
 * bearer token -> FastAPI /auth/me -> real role from the users table.
 */
export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Me>("/auth/me")
      .then(setMe)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          {strings.home.title}
        </Typography>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && error && (
          <Typography color="error">{strings.home.error}</Typography>
        )}

        {!loading && me && (
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h6">
                  {strings.home.welcome}, {me.name ?? me.email}
                </Typography>
                <Typography color="text.secondary">{me.email}</Typography>
                <Typography>
                  {strings.home.role}: {strings.roles[me.role]}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        )}

        <Button variant="outlined" onClick={handleSignOut}>
          {strings.home.signOut}
        </Button>
      </Stack>
    </Container>
  );
}
