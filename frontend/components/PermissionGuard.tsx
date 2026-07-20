"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { hasRole, type Role } from "@/lib/roles";
import { strings } from "@/lib/strings";

/**
 * Wraps a page and only renders it if the current user meets the minimum role.
 * Redirects unauthenticated users to the landing page; shows a friendly
 * message for authenticated users without sufficient role. Backend enforces
 * access independently — this is UX only.
 */
export function PermissionGuard({
  minimum,
  children,
}: {
  minimum: Role;
  children: React.ReactNode;
}) {
  const { user, loading, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect when there is no session at all. An authenticated but
    // unprovisioned user keeps a valid session, so redirecting to "/" would
    // bounce them straight back here (the landing page sends any session to
    // /home) — instead we show them a dead-end screen with a sign-out button.
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status === "unauthenticated") {
    return null; // redirecting
  }

  if (status === "unprovisioned") {
    return <UnprovisionedScreen />;
  }

  if (!user) {
    return null;
  }

  if (!hasRole(user.role, minimum)) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography color="error">{strings.common.noAccess}</Typography>
      </Box>
    );
  }

  return <>{children}</>;
}

/**
 * Shown to a user with a valid Supabase session whose email has not been
 * provisioned in the platform. It is a dead end (no redirect) so they can read
 * the message and sign out — signing out clears the session and lets them try a
 * different account without getting caught in a redirect loop.
 */
function UnprovisionedScreen() {
  const router = useRouter();

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.replace("/");
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8, px: 2 }}>
      <Stack spacing={3} sx={{ maxWidth: 420, textAlign: "center", alignItems: "center" }}>
        <Typography color="text.secondary">{strings.common.notProvisioned}</Typography>
        <Button variant="contained" startIcon={<LogoutIcon />} onClick={handleSignOut}>
          {strings.common.signOut}
        </Button>
      </Stack>
    </Box>
  );
}
