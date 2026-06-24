"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import RouteIcon from "@mui/icons-material/Route";
import BarChartIcon from "@mui/icons-material/BarChart";
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

      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        {strings.home.quickLinks}
      </Typography>
      <Box sx={{ display: "flex", gap: 1.5 }}>
        <Card sx={{ borderRadius: 2, border: "2px solid #4CAF50", bgcolor: "#f5f5f5", flex: "0 1 auto" }}>
          <CardActionArea component={Link} href="/collection-pass/route">
            <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 2, px: 3.5 }}>
              <RouteIcon sx={{ fontSize: 32, color: "#4CAF50" }} />
              <Typography variant="h6" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                {strings.home.routePass}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
        <Card sx={{ borderRadius: 2, border: "2px solid #1976D2", bgcolor: "#f5f5f5", flex: "0 1 auto" }}>
          <CardActionArea component={Link} href="/dashboard">
            <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 2, px: 3.5 }}>
              <BarChartIcon sx={{ fontSize: 32, color: "#1976D2" }} />
              <Typography variant="h6" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                {strings.home.dashboard}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Box>
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
