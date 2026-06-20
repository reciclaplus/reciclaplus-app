"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { PermissionGuard } from "@/components/PermissionGuard";
import { apiFetch } from "@/lib/api";
import { strings } from "@/lib/strings";

interface NeighborhoodCount {
  neighborhood: string;
  count: number;
}
interface CommunityCount {
  community: string;
  count: number;
}
interface CategoryCount {
  category: string;
  count: number;
}
interface WeekCollections {
  year: number;
  week: number;
  collected: number;
  empty: number;
  unavailable: number;
  closed: number;
  total: number;
}
interface StatusBreakdown {
  status: string;
  count: number;
}
interface DashboardStats {
  total_pdrs: number;
  pdrs_by_neighborhood: NeighborhoodCount[];
  pdrs_by_community: CommunityCount[];
  pdrs_by_category: CategoryCount[];
  collections_by_week: WeekCollections[];
  current_status_breakdown: StatusBreakdown[];
}

const STATUS_COLORS: Record<string, string> = {
  collected: "#2e7d32",
  empty: "#ed6c02",
  unavailable: "#d32f2f",
  closed: "#616161",
};

function weekLabel(year: number, week: number): string {
  return `S${week}/${year}`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch<DashboardStats>("/dashboard/stats")
      .then(setStats)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <Alert severity="error">{strings.dashboard.loadError}</Alert>;
  if (loading || !stats) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const totalCollected = stats.collections_by_week.reduce((s, w) => s + w.collected, 0);
  const totalWeeks = stats.collections_by_week.length;

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {strings.dashboard.title}
      </Typography>

      {/* KPI cards */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label={strings.dashboard.totalPdrs} value={stats.total_pdrs} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label={strings.dashboard.totalCollected} value={totalCollected} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label={strings.dashboard.totalWeeks} value={totalWeeks} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            label={strings.dashboard.communities}
            value={stats.pdrs_by_community.length}
          />
        </Grid>
      </Grid>

      {/* Collections over time */}
      {stats.collections_by_week.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {strings.dashboard.collectionsOverTime}
            </Typography>
            <LineChart
              height={300}
              xAxis={[{
                data: stats.collections_by_week.map((w) => weekLabel(w.year, w.week)),
                scaleType: "band",
                label: strings.dashboard.weekLabel,
              }]}
              series={[
                {
                  data: stats.collections_by_week.map((w) => w.collected),
                  label: strings.collectionPass.statuses.collected,
                  color: STATUS_COLORS.collected,
                },
                {
                  data: stats.collections_by_week.map((w) => w.empty),
                  label: strings.collectionPass.statuses.empty,
                  color: STATUS_COLORS.empty,
                },
                {
                  data: stats.collections_by_week.map((w) => w.unavailable),
                  label: strings.collectionPass.statuses.unavailable,
                  color: STATUS_COLORS.unavailable,
                },
                {
                  data: stats.collections_by_week.map((w) => w.closed),
                  label: strings.collectionPass.statuses.closed,
                  color: STATUS_COLORS.closed,
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2}>
        {/* PDRs by community */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {strings.dashboard.pdrsByCommunity}
              </Typography>
              <BarChart
                height={300}
                layout="horizontal"
                yAxis={[{
                  data: stats.pdrs_by_community.map((c) => c.community),
                  scaleType: "band",
                }]}
                series={[{
                  data: stats.pdrs_by_community.map((c) => c.count),
                  label: strings.dashboard.totalPdrs,
                  color: "#1976d2",
                }]}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* PDRs by category */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {strings.dashboard.pdrsByCategory}
              </Typography>
              <PieChart
                height={300}
                series={[{
                  data: stats.pdrs_by_category.map((c, i) => ({
                    id: i,
                    value: c.count,
                    label: c.category,
                  })),
                }]}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* PDRs by neighborhood */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {strings.dashboard.pdrsByNeighborhood}
          </Typography>
          <BarChart
            height={Math.max(300, stats.pdrs_by_neighborhood.length * 30)}
            layout="horizontal"
            yAxis={[{
              data: stats.pdrs_by_neighborhood.map((n) => n.neighborhood),
              scaleType: "band",
            }]}
            series={[{
              data: stats.pdrs_by_neighborhood.map((n) => n.count),
              label: strings.dashboard.totalPdrs,
              color: "#1976d2",
            }]}
          />
        </CardContent>
      </Card>

      {/* Latest week status breakdown */}
      {stats.current_status_breakdown.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {strings.dashboard.latestWeekStatus}
            </Typography>
            <PieChart
              height={300}
              series={[{
                data: stats.current_status_breakdown.map((s, i) => ({
                  id: i,
                  value: s.count,
                  label: strings.collectionPass.statuses[s.status as keyof typeof strings.collectionPass.statuses] ?? s.status,
                  color: STATUS_COLORS[s.status] ?? "#bdbdbd",
                })),
              }]}
            />
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

export default function DashboardPage() {
  return (
    <PermissionGuard minimum="read">
      <Dashboard />
    </PermissionGuard>
  );
}
