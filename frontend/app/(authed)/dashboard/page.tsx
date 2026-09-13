"use client";

import { useEffect, useMemo, useState } from "react";
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
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import { esES } from "@mui/x-data-grid/locales";
import { PermissionGuard } from "@/components/PermissionGuard";
import { apiFetch } from "@/lib/api";
import {
  monthLabel,
  monthTitleLabel,
  NEIGHBORHOOD_COLORS,
  PLASTIC_TYPE_COLORS,
  weekLabel,
  type DashboardStats,
  type WeekCollections,
  type WeekNeighborhoodCollections,
} from "@/lib/dashboard";
import { downloadMonthlyReport } from "@/lib/report";
import { strings } from "@/lib/strings";
import { COLORS } from "@/lib/theme";
import type { Pdr } from "@/lib/types";
import { formatMondayDate, isoWeekOf, shiftWeek, shortMondayDate, type IsoWeek } from "@/lib/week";

const gridLocaleText = esES.components.MuiDataGrid.defaultProps.localeText;

const COMMUNITY_GREENS = ["#0d4e31", "#12633f", "#2e7d52", "#5a9c77", "#8fbca0", "#bcd5c6"];

type WeekRange = "all" | "1w" | "1m" | "3m" | "6m" | "1y";

type AddedWithin = 7 | 30 | 90;

const latestPdrColumns: GridColDef<Pdr>[] = [
  {
    field: "name",
    headerName: strings.list.colName,
    flex: 1.4,
    minWidth: 180,
  },
  {
    field: "category",
    headerName: strings.list.colCategory,
    width: 140,
    renderCell: (params: GridRenderCellParams<Pdr>) => (
      <Chip
        label={params.row.category}
        size="small"
        variant="outlined"
        sx={{ fontWeight: 700, borderColor: COLORS.hairlineSoft, color: COLORS.body }}
      />
    ),
  },
  {
    field: "neighborhood",
    headerName: strings.list.colNeighborhood,
    width: 160,
  },
  {
    field: "created_at",
    headerName: strings.list.colCreatedAt,
    width: 150,
    type: "date",
    valueGetter: (_value, row) => new Date(row.created_at),
    renderCell: (params: GridRenderCellParams<Pdr>) => (
      <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: COLORS.body }}>
          {new Date(params.row.created_at).toLocaleDateString("es-ES")}
        </Typography>
      </Box>
    ),
  },
];

const RANGE_MONTHS: Partial<Record<WeekRange, number>> = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 };

function monthsAgo(d: Date, months: number): Date {
  const total = d.getUTCMonth() - months;
  const year = d.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d.getUTCDate(), daysInMonth);
  return new Date(Date.UTC(year, month, day));
}

function rangeStartDate(range: WeekRange): Date | null {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (range === "1w") {
    todayUtc.setUTCDate(todayUtc.getUTCDate() - 7);
    return todayUtc;
  }
  const months = RANGE_MONTHS[range];
  return months ? monthsAgo(todayUtc, months) : null;
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
  const [chartWeekNeighborhoods, setChartWeekNeighborhoods] = useState<WeekNeighborhoodCollections[] | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [rangeFilter, setRangeFilter] = useState<WeekRange>("1y");
  const [neighborhoodFilter, setNeighborhoodFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [pdrs, setPdrs] = useState<Pdr[]>([]);
  const [addedWithin, setAddedWithin] = useState<AddedWithin>(30);

  const [currentMonthKey] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reportMonth, setReportMonth] = useState(currentMonthKey);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportError, setReportError] = useState(false);

  const reportMonthOptions = useMemo(() => {
    const [anchorYear, anchorMonth] = currentMonthKey.split("-").map(Number);
    const options: { value: string; label: string }[] = [];
    const cursor = new Date(Date.UTC(anchorYear, anchorMonth - 1, 1));
    for (let i = 0; i < 12; i++) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth() + 1;
      options.push({ value: `${year}-${String(month).padStart(2, "0")}`, label: monthTitleLabel(year, month) });
      cursor.setUTCMonth(cursor.getUTCMonth() - 1);
    }
    return options;
  }, [currentMonthKey]);

  const handleDownloadReport = () => {
    if (!stats) return;
    setReportError(false);
    setReportGenerating(true);
    try {
      const [yearStr, monthStr] = reportMonth.split("-");
      downloadMonthlyReport(stats, pdrs, Number(yearStr), Number(monthStr));
    } catch {
      setReportError(true);
    } finally {
      setReportGenerating(false);
    }
  };

  useEffect(() => {
    apiFetch<DashboardStats>("/dashboard/stats")
      .then(setStats)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiFetch<Pdr[]>("/pdrs")
      .then(setPdrs)
      .catch(() => setError(true));
  }, []);

  const latestPdrs = useMemo(() => {
    const cutoff = Date.now() - addedWithin * 24 * 60 * 60 * 1000;
    return pdrs.filter((p) => new Date(p.created_at).getTime() >= cutoff);
  }, [pdrs, addedWithin]);

  useEffect(() => {
    setChartLoading(true);
    apiFetch<DashboardStats>(`/dashboard/stats${buildChartQuery(rangeFilter, neighborhoodFilter, categoryFilter)}`)
      .then((data) => {
        setChartWeeks(data.collections_by_week);
        setChartWeekNeighborhoods(data.collections_by_week_by_neighborhood);
      })
      .catch(() => setError(true))
      .finally(() => setChartLoading(false));
  }, [rangeFilter, neighborhoodFilter, categoryFilter]);

  const filledChartWeeks = useMemo(() => {
    if (!chartWeeks) return null;
    const byKey = new Map(chartWeeks.map((w) => [`${w.year}-${w.week}`, w]));
    const startDate = rangeStartDate(rangeFilter);
    const startWeek: IsoWeek | null = startDate
      ? isoWeekOf(startDate)
      : chartWeeks.length > 0
        ? { year: chartWeeks[0].year, week: chartWeeks[0].week }
        : null;
    if (!startWeek) return chartWeeks;
    const endWeek = isoWeekOf(new Date());
    const weeks: WeekCollections[] = [];
    let cursor = startWeek;
    for (let i = 0; i < 600; i++) {
      const key = `${cursor.year}-${cursor.week}`;
      weeks.push(byKey.get(key) ?? { year: cursor.year, week: cursor.week, collected: 0, empty: 0, unavailable: 0, closed: 0, total: 0 });
      if (cursor.year === endWeek.year && cursor.week === endWeek.week) break;
      cursor = shiftWeek(cursor, 1);
    }
    return weeks;
  }, [chartWeeks, rangeFilter]);

  const neighborhoodSeries = useMemo(() => {
    if (!filledChartWeeks || !chartWeekNeighborhoods) return [];
    const weekKeys = filledChartWeeks.map((w) => `${w.year}-${w.week}`);
    const neighborhoods = Array.from(new Set(chartWeekNeighborhoods.map((n) => n.neighborhood))).sort((a, b) => {
      const totalA = chartWeekNeighborhoods.filter((n) => n.neighborhood === a).reduce((s, n) => s + n.collected, 0);
      const totalB = chartWeekNeighborhoods.filter((n) => n.neighborhood === b).reduce((s, n) => s + n.collected, 0);
      return totalB - totalA;
    });
    return neighborhoods.map((neighborhood, i) => ({
      neighborhood,
      color: NEIGHBORHOOD_COLORS[i % NEIGHBORHOOD_COLORS.length],
      data: weekKeys.map((key) => {
        const match = chartWeekNeighborhoods.find(
          (n) => n.neighborhood === neighborhood && `${n.year}-${n.week}` === key
        );
        return match?.collected ?? 0;
      }),
    }));
  }, [filledChartWeeks, chartWeekNeighborhoods]);

  const monthKeys = useMemo(() => {
    const keys = Array.from(new Set(stats?.weight_by_month.map((m) => `${m.year}-${m.month}`) ?? []));
    return keys.sort((a, b) => {
      const [ay, am] = a.split("-").map(Number);
      const [by, bm] = b.split("-").map(Number);
      return ay - by || am - bm;
    });
  }, [stats]);

  const weightByTypeSeries = useMemo(() => {
    if (!stats) return [];
    const types = Array.from(new Set(stats.weight_by_month.map((m) => m.plastic_type)));
    return types.map((plastic_type) => ({
      plastic_type,
      color: PLASTIC_TYPE_COLORS[plastic_type] ?? "#999",
      data: monthKeys.map((key) => {
        const match = stats.weight_by_month.find(
          (m) => m.plastic_type === plastic_type && `${m.year}-${m.month}` === key
        );
        return match?.weight_lbs ?? 0;
      }),
    }));
  }, [stats, monthKeys]);

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
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 160, bgcolor: "#fff" }}>
            <InputLabel id="report-month-label">{strings.dashboard.reportMonthLabel}</InputLabel>
            <Select
              labelId="report-month-label"
              label={strings.dashboard.reportMonthLabel}
              value={reportMonth}
              onChange={(e: SelectChangeEvent) => setReportMonth(e.target.value)}
            >
              {reportMonthOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Chip
            label={reportGenerating ? strings.dashboard.generatingReport : strings.dashboard.downloadReportLabel}
            onClick={handleDownloadReport}
            disabled={reportGenerating}
            sx={{ bgcolor: "#fff", border: `1px solid ${COLORS.hairlineSoft}`, fontWeight: 700, color: COLORS.body, cursor: "pointer" }}
          />
        </Stack>
      </Stack>
      {reportError && <Alert severity="error">{strings.dashboard.reportError}</Alert>}

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

      {/* Latest PDRs table */}
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, mb: 2 }}
          >
            <Typography sx={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)", color: COLORS.ink }}>
              {strings.dashboard.latestPdrs}
            </Typography>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="added-within-label">{strings.dashboard.filterAddedWithin}</InputLabel>
              <Select
                labelId="added-within-label"
                label={strings.dashboard.filterAddedWithin}
                value={String(addedWithin)}
                onChange={(e: SelectChangeEvent) => setAddedWithin(Number(e.target.value) as AddedWithin)}
              >
                <MenuItem value="7">{strings.dashboard.last7Days}</MenuItem>
                <MenuItem value="30">{strings.dashboard.last30Days}</MenuItem>
                <MenuItem value="90">{strings.dashboard.last90Days}</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          {latestPdrs.length > 0 ? (
            <DataGrid
              rows={latestPdrs}
              columns={latestPdrColumns}
              localeText={gridLocaleText}
              autoHeight
              disableRowSelectionOnClick
              pageSizeOptions={[5, 10, 25]}
              initialState={{
                pagination: { paginationModel: { pageSize: 5 } },
                sorting: { sortModel: [{ field: "created_at", sort: "desc" }] },
              }}
              sx={{
                bgcolor: "#fff",
                borderRadius: "14px",
                borderColor: COLORS.hairlineSoft,
                "--DataGrid-containerBackground": COLORS.canvas,
                "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 800, fontSize: 12, color: COLORS.body },
              }}
            />
          ) : (
            <Typography sx={{ color: COLORS.muted, fontSize: 13.5 }}>
              {strings.dashboard.latestPdrsEmpty}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Weekly bar chart */}
      <Card>
        <CardContent>
          <Typography sx={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)", color: COLORS.ink, mb: 1 }}>
            {strings.dashboard.collectionsOverTime}
          </Typography>
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
                <MenuItem value="1w">{strings.dashboard.range1w}</MenuItem>
                <MenuItem value="1m">{strings.dashboard.range1m}</MenuItem>
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
          {chartLoading || !filledChartWeeks ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : filledChartWeeks.length > 0 ? (
            <BarChart
              height={300}
              xAxis={[{
                data: filledChartWeeks.map((w) => weekLabel(w.year, w.week)),
                scaleType: "band",
                label: strings.dashboard.weekLabel,
                valueFormatter: (value, context) => {
                  const week = filledChartWeeks.find((w) => weekLabel(w.year, w.week) === value);
                  if (!week) return value;
                  return context.location === "tooltip" ? formatMondayDate(week) : shortMondayDate(week);
                },
              }]}
              yAxis={[{ label: strings.dashboard.totalCollected }]}
              series={neighborhoodSeries.map((s, i) => ({
                data: s.data,
                label: s.neighborhood,
                stack: "total",
                color: s.color,
                ...(i === neighborhoodSeries.length - 1
                  ? {
                      barLabelPlacement: "outside" as const,
                      barLabel: (item: { dataIndex: number }) => {
                        const total = neighborhoodSeries.reduce((sum, n) => sum + (n.data[item.dataIndex] ?? 0), 0);
                        return total > 0 ? String(total) : undefined;
                      },
                    }
                  : {}),
              }))}
              borderRadius={6}
              margin={{ top: 24 }}
            />
          ) : (
            <Typography sx={{ color: COLORS.muted, fontSize: 13.5 }}>—</Typography>
          )}
        </CardContent>
      </Card>

      {/* Monthly weight chart */}
      <Card>
        <CardContent>
          <Typography sx={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)", color: COLORS.ink, mb: 2 }}>
            {strings.dashboard.weightByMonth}
          </Typography>
          {monthKeys.length > 0 ? (
            <BarChart
              height={300}
              xAxis={[{
                data: monthKeys.map((key) => {
                  const [y, m] = key.split("-").map(Number);
                  return monthLabel(y, m);
                }),
                scaleType: "band",
                label: strings.dashboard.monthLabel,
              }]}
              yAxis={[{ label: strings.dashboard.weightLbs }]}
              series={weightByTypeSeries.map((s) => ({
                data: s.data,
                label: strings.weights.plasticTypes[s.plastic_type as keyof typeof strings.weights.plasticTypes] ?? s.plastic_type,
                stack: "total",
                color: s.color,
              }))}
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
                      color: COLORS.status[s.status as keyof typeof COLORS.status]?.dot ?? "#bdbdbd",
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
