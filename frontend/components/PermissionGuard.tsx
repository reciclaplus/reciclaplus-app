"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/auth-context";
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
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return null; // redirecting
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
