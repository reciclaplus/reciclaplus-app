"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { PermissionGuard } from "@/components/PermissionGuard";
import { apiFetch } from "@/lib/api";
import { strings } from "@/lib/strings";
import { COLORS } from "@/lib/theme";

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
  collected: COLORS.status.collected.dot,
  empty: COLORS.status.empty.dot,
  unavailable: COLORS.status.unavailable.dot,
  closed: COLORS.status.closed.dot,
};

const COMMUNITY_GREENS = ["#0d4e31", "#12633f", "#2e7d52", "#5a9c77", "#8fbca0", "#bcd5c6"];

type WeekRange = "all" | "3m" | "6m" | "1y";

function weekLabel(year: number, week: number): string {
  return `S${week}'${String(year).slice(-2)}`;
}

function buildChartQuery(range: WeekRange, neighborhood: string, category: string): string {
  const params = new URLSearchParams();
  if (range !== "all") params.set("range", range);
  if (neighborhood) params.set("neighborhood", neighborhood);
  if (category) params.set("category", category);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function KpiTile({
  label,
  value,
  emphasized,
}: {
  label: string;
  value: string | number;
  emphasized?: boolean;
}) {
  if (emphasized) {
    return (
      <Card
        sx={{
          position: "relative",
          overflow: "hidden",
          height: "100%",
          border: "none",
          background: `linear-gradient(135deg, ${COLORS.emeraldStart}, ${COLORS.emeraldEnd})`,
          color: "#fff",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 110,
            height: 110,
            borderRadius: "50%",
            bgcolor: "rgba(190,242,100,.18)",
          }}
        />
        <CardContent sx={{ position: "relative" }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: COLORS.lime }}>{label}</Typography>
          <Typography sx={{ fontSize: 38, fontWeight: 800, fontFamily: "var(--font-display)", mt: 0.5 }}>
            {value}
          </Typography>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card sx={{ height: "100%", border: `1px solid ${COLORS.hairlineAlt}` }}>
      <CardContent>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: COLORS.mutedAlt }}>{label}</Typography>
        <Typography sx={{ fontSize: 38, fontWeight: 800, fontFamily: "var(--font-display)", color: COLORS.ink, mt: 0.5 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [chartWeeks, setChartWeeks] = useState<WeekCollections[] | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [rangeFilter, setRangeFilter] = useState<WeekRange>("1y");
  const [neighborhoodFilter, setNeighborhoodFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    apiFetch<DashboardStats>("/dashboard/stats")
      .then(setStats)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setChartLoading(true);
    apiFetch<DashboardStats>(`/dashboard/stats${buildChartQuery(rangeFilter, neighborhoodFilter, categoryFilter)}`)
      .then((data) => setChartWeeks(data.collections_by_week))
      .catch(() => setError(true))
      .finally(() => setChartLoading(false));
  }, [rangeFilter, neighborhoodFilter, categoryFilter]);

  if (error) return <Alert severity="error">{strings.dashboard.loadError}</Alert>;
  if (loading || !stats) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const totalCollected = stats.collections_by_week.reduce((s, w) => s + w.collected, 0);
  const totalAttempts = stats.collections_by_week.reduce((s, w) => s + w.total, 0);
  const collectionRate = totalAttempts > 0 ? Math.round((totalCollected / totalAttempts) * 100) : 0;

  const communitySorted = [...stats.pdrs_by_community].sort((a, b) => b.count - a.count);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
      >
        <Typography sx={{ fontSize: 30, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: "-0.02em", color: COLORS.ink }}>
          {strings.dashboard.title}
        </Typography>
        <Chip
          label={strings.dashboard.rangeLabel}
          sx={{ bgcolor: "#fff", border: `1px solid ${COLORS.hairlineSoft}`, fontWeight: 700, color: COLORS.body }}
        />
      </Stack>

      {/* KPI tiles */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiTile label={strings.dashboard.totalPdrs} value={stats.total_pdrs} emphasized />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiTile label={strings.dashboard.totalCollected} value={totalCollected} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiTile label={strings.dashboard.collectionRate} value={`${collectionRate}%`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiTile label={strings.dashboard.communities} value={stats.pdrs_by_community.length} />
        </Grid>
      </Grid>

      {/* Weekly bar chart */}
      <Card>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)", color: COLORS.ink }}>
              {strings.dashboard.collectionsOverTime}
            </Typography>
            <Chip
              icon={<TrendingUpIcon sx={{ fontSize: 16, color: `${COLORS.status.collected.text} !important` }} />}
              label="+12% vs. mes pasado"
              size="small"
              sx={{ bgcolor: COLORS.status.collected.bg, color: COLORS.status.collected.text, fontWeight: 700 }}
            />
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5, mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="chart-range-label">{strings.dashboard.filterRange}</InputLabel>
              <Select
                labelId="chart-range-label"
                label={strings.dashboard.filterRange}
                value={rangeFilter}
                onChange={(e: SelectChangeEvent) => setRangeFilter(e.target.value as WeekRange)}
              >
                <MenuItem value="all">{strings.dashboard.all}</MenuItem>
                <MenuItem value="3m">{strings.dashboard.range3m}</MenuItem>
                <MenuItem value="6m">{strings.dashboard.range6m}</MenuItem>
                <MenuItem value="1y">{strings.dashboard.range1y}</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="chart-neighborhood-label">{strings.dashboard.filterNeighborhood}</InputLabel>
              <Select
                labelId="chart-neighborhood-label"
                label={strings.dashboard.filterNeighborhood}
                value={neighborhoodFilter}
                onChange={(e: SelectChangeEvent) => setNeighborhoodFilter(e.target.value)}
              >
                <MenuItem value="">{strings.dashboard.all}</MenuItem>
                {stats.pdrs_by_neighborhood.map((n) => (
                  <MenuItem key={n.neighborhood} value={n.neighborhood}>
                    {n.neighborhood}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="chart-category-label">{strings.dashboard.filterCategory}</InputLabel>
              <Select
                labelId="chart-category-label"
                label={strings.dashboard.filterCategory}
                value={categoryFilter}
                onChange={(e: SelectChangeEvent) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="">{strings.dashboard.all}</MenuItem>
                {stats.pdrs_by_category.map((c) => (
                  <MenuItem key={c.category} value={c.category}>
                    {c.category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          {chartLoading || !chartWeeks ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : chartWeeks.length > 0 ? (
            <BarChart
              height={300}
              xAxis={[{
                data: chartWeeks.map((w) => weekLabel(w.year, w.week)),
                scaleType: "band",
                label: strings.dashboard.weekLabel,
              }]}
              series={[{
                data: chartWeeks.map((w) => w.collected),
                label: strings.collectionPass.statuses.collected,
                color: COLORS.status.collected.dot,
              }]}
              borderRadius={6}
            />
          ) : (
            <Typography sx={{ color: COLORS.muted, fontSize: 13.5 }}>—</Typography>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {/* PDRs by community */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography sx={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)", color: COLORS.ink, mb: 1.5 }}>
                {strings.dashboard.pdrsByCommunity}
              </Typography>
              <BarChart
                height={Math.max(260, communitySorted.length * 42)}
                layout="horizontal"
                yAxis={[{
                  data: communitySorted.map((c) => c.community),
                  scaleType: "band",
                }]}
                series={[{
                  data: communitySorted.map((c) => c.count),
                  label: strings.dashboard.totalPdrs,
                }]}
                colors={communitySorted.map((_, i) => COMMUNITY_GREENS[i % COMMUNITY_GREENS.length])}
                borderRadius={6}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Status donut */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography sx={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)", color: COLORS.ink, mb: 1.5 }}>
                {strings.dashboard.latestWeekStatus}
              </Typography>
              {stats.current_status_breakdown.length > 0 ? (
                <PieChart
                  height={280}
                  series={[{
                    innerRadius: 60,
                    outerRadius: 100,
                    paddingAngle: 2,
                    cornerRadius: 4,
                    data: stats.current_status_breakdown.map((s, i) => ({
                      id: i,
                      value: s.count,
                      label: strings.collectionPass.statuses[s.status as keyof typeof strings.collectionPass.statuses] ?? s.status,
                      color: STATUS_COLORS[s.status] ?? "#bdbdbd",
                    })),
                  }]}
                />
              ) : (
                <Typography sx={{ color: COLORS.muted, fontSize: 13.5 }}>—</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* PDRs by neighborhood */}
      <Card>
        <CardContent>
          <Typography sx={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)", color: COLORS.ink, mb: 1.5 }}>
            {strings.dashboard.pdrsByNeighborhood}
          </Typography>
          <BarChart
            height={Math.max(300, stats.pdrs_by_neighborhood.length * 32)}
            layout="horizontal"
            yAxis={[{
              data: stats.pdrs_by_neighborhood.map((n) => n.neighborhood),
              scaleType: "band",
            }]}
            series={[{
              data: stats.pdrs_by_neighborhood.map((n) => n.count),
              label: strings.dashboard.totalPdrs,
              color: COLORS.emeraldEnd,
            }]}
            borderRadius={6}
          />
        </CardContent>
      </Card>

      {/* PDRs by category */}
      <Card>
        <CardContent>
          <Typography sx={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)", color: COLORS.ink, mb: 1.5 }}>
            {strings.dashboard.pdrsByCategory}
          </Typography>
          <PieChart
            height={280}
            series={[{
              innerRadius: 0,
              data: stats.pdrs_by_category.map((c, i) => ({
                id: i,
                value: c.count,
                label: c.category,
                color: COMMUNITY_GREENS[i % COMMUNITY_GREENS.length],
              })),
            }]}
          />
        </CardContent>
      </Card>
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
