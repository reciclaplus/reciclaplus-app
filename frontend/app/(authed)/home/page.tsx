"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { PermissionGuard } from "@/components/PermissionGuard";
import { useAuth } from "@/lib/auth-context";
import { strings } from "@/lib/strings";

function HomeContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {strings.home.title}
      </Typography>
      {user && (
        <Card>
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">
                {strings.home.welcome}, {user.name ?? user.email}
              </Typography>
              <Typography color="text.secondary">{user.email}</Typography>
              <Typography>
                {strings.home.role}: {strings.roles[user.role]}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

export default function HomePage() {
  return (
    <PermissionGuard minimum="read">
      <HomeContent />
    </PermissionGuard>
  );
}
