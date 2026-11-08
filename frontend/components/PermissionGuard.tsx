"use client";

import { Fragment, useEffect } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LogoutIcon from "@mui/icons-material/Logout";
import { TownPicker } from "@/components/TownPicker";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { hasRole, type Role } from "@/lib/roles";
import { strings } from "@/lib/strings";
import { useTownState } from "@/lib/town-context";

/**
 * Wraps a page and only renders it once a town is selected and loaded, and the
 * user meets the minimum role in that town. Redirects unauthenticated users to
 * the landing page; shows a dead-end screen to users with no town; asks users
 * with several towns to pick one. Backend enforces access independently: this
 * is UX only.
 *
 * The page is keyed by town, so switching towns remounts it and every page
 * reloads its data for the new town.
 */
export function PermissionGuard({
  minimum,
  children,
}: {
  minimum: Role;
  children: React.ReactNode;
}) {
  const { user, loading, status } = useAuth();
  const { towns, town, detail, detailError, refreshDetail } = useTownState();
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
    return <Spinner />;
  }

  if (status === "unauthenticated") {
    return null; // redirecting
  }

  if (status === "unprovisioned") {
    return <DeadEndScreen message={strings.common.notProvisioned} />;
  }

  if (!user) {
    return null;
  }

  if (towns.length === 0) {
    return <DeadEndScreen message={strings.common.noTowns} />;
  }

  if (!town) {
    return <TownPicker />;
  }

  if (detailError) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refreshDetail()}>
              {strings.common.retry}
            </Button>
          }
        >
          {strings.common.townLoadError}
        </Alert>
      </Box>
    );
  }

  if (!detail) {
    return <Spinner />;
  }

  if (!hasRole(town.role, minimum)) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography color="error">{strings.common.noAccess}</Typography>
      </Box>
    );
  }

  return <Fragment key={town.id}>{children}</Fragment>;
}

function Spinner() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  );
}

/**
 * A screen with no way forward but signing out: for a valid Supabase session
 * whose email isn't provisioned, or a user with no town. No redirect, so they
 * can read the message, and signing out lets them try another account without a
 * redirect loop.
 */
function DeadEndScreen({ message }: { message: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.replace("/");
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8, px: 2 }}>
      <Stack spacing={3} sx={{ maxWidth: 420, textAlign: "center", alignItems: "center" }}>
        <Typography color="text.secondary">{message}</Typography>
        <Button variant="contained" startIcon={<LogoutIcon />} onClick={handleSignOut}>
          {strings.common.signOut}
        </Button>
      </Stack>
    </Box>
  );
}
