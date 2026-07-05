"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import RecyclingIcon from "@mui/icons-material/Recycling";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ListAltIcon from "@mui/icons-material/ListAlt";
import MapIcon from "@mui/icons-material/Map";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import { PermissionGuard } from "@/components/PermissionGuard";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { strings } from "@/lib/strings";
import { COLORS } from "@/lib/theme";
import type { IsoWeek } from "@/lib/week";
import type { Status } from "@/lib/collection-status";

interface CollectionPassRow {
  pdr_id: string;
  status: Status | null;
}

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("es-DO", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function ProgressDonut({ percent }: { percent: number }) {
  const size = 74;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,.18)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={COLORS.lime}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
          {percent}%
        </Typography>
      </Box>
    </Box>
  );
}

function QuickLinkCard({
  href,
  icon,
  title,
  description,
  emphasized,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  emphasized?: boolean;
}) {
  return (
    <Card
      sx={{
        height: "100%",
        border: emphasized ? `2px solid ${COLORS.emeraldStart}` : `1px solid ${COLORS.hairline}`,
        transition: "transform 150ms ease, box-shadow 150ms ease",
        "&:hover": { transform: "translateY(-2px)", boxShadow: "0 8px 22px -10px rgba(13,51,32,.18)" },
      }}
    >
      <CardActionArea component={Link} href={href} sx={{ height: "100%", p: 2.25 }}>
        <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: emphasized ? COLORS.emeraldEnd : COLORS.hairlineAlt,
              color: emphasized ? COLORS.lime : COLORS.emeraldEnd,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)", color: COLORS.ink }}>
              {title}
            </Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: COLORS.mutedAlt, mt: 0.25 }}>
              {description}
            </Typography>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

function HomeContent() {
  const { user, loading } = useAuth();
  const [week, setWeek] = useState<IsoWeek | null>(null);
  const [rows, setRows] = useState<CollectionPassRow[] | null>(null);

  useEffect(() => {
    apiFetch<IsoWeek>("/collections/current")
      .then((w) => {
        setWeek(w);
        return apiFetch<CollectionPassRow[]>(`/collections/${w.year}/${w.week}`);
      })
      .then(setRows)
      .catch(() => {
        setRows([]);
      });
  }, []);

  const { recorded, total, percent } = useMemo(() => {
    if (!rows) return { recorded: 0, total: 0, percent: 0 };
    const recordedCount = rows.filter((r) => r.status !== null).length;
    const totalCount = rows.length;
    return {
      recorded: recordedCount,
      total: totalCount,
      percent: totalCount > 0 ? Math.round((recordedCount / totalCount) * 100) : 0,
    };
  }, [rows]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const firstName = (user?.name ?? user?.email ?? "").split(" ")[0];
  const today = WEEKDAY_FORMAT.format(new Date());
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <Stack spacing={3}>
      {/* Greeting row */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
      >
        <Box>
          <Typography sx={{ fontSize: { xs: 26, sm: 34 }, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: "-0.03em", color: COLORS.ink }}>
            ¡Hola, {firstName}! 👋
          </Typography>
          <Typography sx={{ fontSize: 14.5, fontWeight: 600, color: COLORS.body, mt: 0.5 }}>
            {todayCapitalized}
            {week ? ` · ${strings.collectionPass.week} ${week.week}` : ""}
          </Typography>
        </Box>
        {user && (
          <Chip
            label={`${strings.home.role}: ${strings.roles[user.role]}`}
            sx={{
              bgcolor: COLORS.roleBadgeBg,
              color: "#9a5f10",
              fontWeight: 800,
              fontSize: 12.5,
              height: 32,
            }}
          />
        )}
      </Stack>

      {/* Hero row */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7.5 }}>
          <Card
            sx={{
              height: "100%",
              borderRadius: "22px",
              border: `1px solid ${COLORS.hairline}`,
              boxShadow: "0 8px 22px -10px rgba(13,51,32,.18)",
            }}
          >
            <CardActionArea component={Link} href="/collection-pass/route" sx={{ height: "100%", p: { xs: 2.5, sm: 3 } }}>
              <Stack direction="row" spacing={2.5} sx={{ alignItems: "center" }}>
                <Box
                  sx={{
                    width: 62,
                    height: 62,
                    borderRadius: "18px",
                    bgcolor: COLORS.emeraldEnd,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <RecyclingIcon sx={{ color: COLORS.lime, fontSize: 32 }} />
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 25, fontWeight: 800, fontFamily: "var(--font-display)", color: COLORS.ink }}>
                    {strings.home.routePass}
                  </Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: COLORS.body, mt: 0.25 }}>
                    {strings.home.routePassDesc}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "13px",
                    bgcolor: COLORS.lime,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <ArrowForwardIcon sx={{ color: COLORS.emeraldDeepest }} />
                </Box>
              </Stack>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4.5 }}>
          <Card
            sx={{
              height: "100%",
              borderRadius: "22px",
              bgcolor: COLORS.emeraldEnd,
              border: "none",
              p: { xs: 2.5, sm: 3 },
              display: "flex",
              alignItems: "center",
              gap: 2.5,
            }}
          >
            <ProgressDonut percent={percent} />
            <Box>
              <Typography sx={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-display)", color: "#fff" }}>
                {recorded} / {total}
              </Typography>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,.8)", mt: 0.25 }}>
                {strings.home.weekProgress}
              </Typography>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Quick links */}
      <Box>
        <Typography sx={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.02em", color: COLORS.mutedAlt, textTransform: "uppercase", mb: 1.5 }}>
          {strings.home.quickLinks}
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <QuickLinkCard
              href="/collection-pass"
              icon={<PlaylistAddCheckIcon />}
              title={strings.nav.collectionPass}
              description={strings.home.routePassDesc}
              emphasized
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <QuickLinkCard
              href="/dashboard"
              icon={<DashboardIcon />}
              title={strings.nav.dashboard}
              description={strings.home.dashboardDesc}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <QuickLinkCard
              href="/list"
              icon={<ListAltIcon />}
              title={strings.nav.list}
              description={strings.home.listDesc}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <QuickLinkCard
              href="/map"
              icon={<MapIcon />}
              title={strings.nav.map}
              description={strings.home.mapDesc}
            />
          </Grid>
        </Grid>
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
