"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RouteIcon from "@mui/icons-material/Route";
import { PermissionGuard } from "@/components/PermissionGuard";
import { apiFetch } from "@/lib/api";
import { strings } from "@/lib/strings";
import { type Status, STATUSES, STATUS_COLORS } from "@/lib/collection-status";
import { type IsoWeek, shiftWeek, formatWeekLabel } from "@/lib/week";

interface PassRow {
  pdr_id: string;
  internal_id: number;
  name: string;
  community: string;
  neighborhood: string;
  category: string;
  status: Status | null;
}

function StatusPicker({
  value,
  onChange,
}: {
  value: Status | "";
  onChange: (s: Status | "") => void;
}) {
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
      {STATUSES.map((s) => {
        const active = value === s;
        const color = STATUS_COLORS[s];
        return (
          <Box
            key={s}
            onClick={() => onChange(active ? "" : s)}
            sx={{
              cursor: "pointer",
              px: { xs: 0.8, sm: 1.5 },
              py: 0.5,
              fontSize: { xs: "0.65rem", sm: "0.75rem" },
              lineHeight: 1.2,
              borderRadius: 1,
              border: "1px solid",
              borderColor: active ? color : "divider",
              bgcolor: active ? color : "transparent",
              color: active ? "#fff" : "text.secondary",
              fontWeight: active ? 700 : 400,
              textAlign: "center",
              whiteSpace: "nowrap",
              userSelect: "none",
              "&:hover": { borderColor: color, bgcolor: active ? color : `${color}18` },
            }}
          >
            {strings.collectionPass.statuses[s]}
          </Box>
        );
      })}
    </Box>
  );
}

function CollectionPass() {
  const [week, setWeek] = useState<IsoWeek | null>(null);
  const [currentWeek, setCurrentWeek] = useState<IsoWeek | null>(null);
  const [rows, setRows] = useState<PassRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Status | "">>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [filterCommunity, setFilterCommunity] = useState("");
  const [filterNeighborhood, setFilterNeighborhood] = useState("");

  const communities = [...new Set(rows.map((r) => r.community))].sort();
  const neighborhoods = [
    ...new Set(
      rows
        .filter((r) => !filterCommunity || r.community === filterCommunity)
        .map((r) => r.neighborhood),
    ),
  ].sort();

  const visibleRows = filterNeighborhood
    ? rows.filter((r) => r.neighborhood === filterNeighborhood)
    : [];

  const loadWeek = useCallback(async (w: IsoWeek) => {
    setLoading(true);
    setError(false);
    try {
      const data = await apiFetch<PassRow[]>(`/collections/${w.year}/${w.week}`);
      setRows(data);
      setStatuses(Object.fromEntries(data.map((r) => [r.pdr_id, r.status ?? ""])));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const w = await apiFetch<IsoWeek>("/collections/current");
        setWeek(w);
        setCurrentWeek(w);
        await loadWeek(w);
      } catch {
        setError(true);
        setLoading(false);
      }
    }
    init();
  }, [loadWeek]);

  function goToWeek(delta: number) {
    if (!week) return;
    const next = shiftWeek(week, delta);
    setWeek(next);
    loadWeek(next);
  }

  async function handleSave() {
    if (!week) return;
    const entries = Object.entries(statuses)
      .filter(([, s]) => s !== "")
      .map(([pdr_id, status]) => ({ pdr_id, status }));
    setSaving(true);
    try {
      const updated = await apiFetch<PassRow[]>(
        `/collections/${week.year}/${week.week}`,
        { method: "POST", body: JSON.stringify({ entries }) },
      );
      setRows(updated);
      setStatuses(Object.fromEntries(updated.map((r) => [r.pdr_id, r.status ?? ""])));
      setToast({ ok: true, msg: strings.collectionPass.success });
    } catch {
      setToast({ ok: false, msg: strings.collectionPass.error });
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return <Alert severity="error">{strings.collectionPass.loadError}</Alert>;
  }

  if (loading || !week) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {strings.collectionPass.title}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <IconButton size="small" onClick={() => goToWeek(-1)}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="subtitle1" color="text.secondary">
          {formatWeekLabel(week)}
        </Typography>
        <IconButton size="small" onClick={() => goToWeek(1)}>
          <ChevronRightIcon />
        </IconButton>
        {currentWeek && (week.year !== currentWeek.year || week.week !== currentWeek.week) && (
          <Button
            size="small"
            onClick={() => { setWeek(currentWeek); loadWeek(currentWeek); }}
          >
            {strings.collectionPass.today}
          </Button>
        )}
      </Box>

      <Button
        component={Link}
        href="/collection-pass/route"
        variant="contained"
        startIcon={<RouteIcon />}
        sx={{ alignSelf: "flex-start" }}
      >
        {strings.collectionRoute.start}
      </Button>

      {rows.length > 0 && (
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField
            select
            size="small"
            label={strings.collectionPass.filterCommunity}
            value={filterCommunity}
            onChange={(e) => {
              setFilterCommunity(e.target.value);
              setFilterNeighborhood("");
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">{strings.collectionPass.all}</MenuItem>
            {communities.map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={strings.collectionPass.filterNeighborhood}
            value={filterNeighborhood}
            onChange={(e) => setFilterNeighborhood(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">{strings.collectionPass.all}</MenuItem>
            {neighborhoods.map((n) => (
              <MenuItem key={n} value={n}>{n}</MenuItem>
            ))}
          </TextField>
        </Box>
      )}

      {visibleRows.length === 0 ? (
        <Alert severity="info">
          {filterNeighborhood
            ? strings.collectionPass.empty
            : strings.collectionPass.selectNeighborhoodHint}
        </Alert>
      ) : (
        <Paper variant="outlined">
          {visibleRows.map((row, i) => (
            <Box key={row.pdr_id}>
              {i > 0 && <Divider />}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 1,
                }}
              >
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 500, fontSize: "0.875rem" }}>
                    {row.name}
                  </Typography>
                </Box>
                <StatusPicker
                  value={statuses[row.pdr_id] ?? ""}
                  onChange={(s) =>
                    setStatuses((prev) => ({ ...prev, [row.pdr_id]: s }))
                  }
                />
              </Box>
            </Box>
          ))}
        </Paper>
      )}

      {visibleRows.length > 0 && (
        <Box>
          <Button
            variant="contained"
            size="large"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? strings.collectionPass.saving : strings.collectionPass.save}
          </Button>
        </Box>
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert severity={toast.ok ? "success" : "error"} onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Stack>
  );
}

export default function CollectionPassPage() {
  return (
    <PermissionGuard minimum="write">
      <CollectionPass />
    </PermissionGuard>
  );
}
