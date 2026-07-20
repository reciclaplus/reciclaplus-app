"use client";

import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { esES } from "@mui/x-data-grid/locales";
import { PermissionGuard } from "@/components/PermissionGuard";
import { apiFetch } from "@/lib/api";
import { strings } from "@/lib/strings";
import { COLORS } from "@/lib/theme";

const gridLocaleText = esES.components.MuiDataGrid.defaultProps.localeText;

const PLASTIC_TYPES = ["pet", "hdpe", "pp", "trash"] as const;
type PlasticType = (typeof PLASTIC_TYPES)[number];

interface WeightEntry {
  id: string;
  date: string;
  plastic_type: PlasticType;
  weight_lbs: number;
  created_at: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-DO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function WeightsForm() {
  const [date, setDate] = useState(todayISO());
  const [plasticType, setPlasticType] = useState<PlasticType>("pet");
  const [weightLbs, setWeightLbs] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const columns: GridColDef<WeightEntry>[] = useMemo(
    () => [
      {
        field: "date",
        headerName: strings.weights.date,
        width: 140,
        type: "date",
        valueGetter: (_value, row) => new Date(row.date),
        valueFormatter: (_value, row) => formatDate(row.date),
      },
      {
        field: "plastic_type",
        headerName: strings.weights.plasticType,
        width: 160,
        valueGetter: (_value, row) => strings.weights.plasticTypes[row.plastic_type],
      },
      {
        field: "weight_lbs",
        headerName: strings.weights.weightLbs,
        width: 140,
        type: "number",
      },
    ],
    [],
  );

  async function loadEntries() {
    try {
      const data = await apiFetch<WeightEntry[]>("/weights");
      setEntries(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
  }, []);

  const canSubmit = date && plasticType && weightLbs && Number(weightLbs) > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const created = await apiFetch<WeightEntry>("/weights", {
        method: "POST",
        body: JSON.stringify({
          date,
          plastic_type: plasticType,
          weight_lbs: Number(weightLbs),
        }),
      });
      setToast({ ok: true, msg: strings.weights.success });
      setWeightLbs("");
      setEntries((prev) => [created, ...prev]);
    } catch {
      setToast({ ok: false, msg: strings.weights.error });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
        {strings.weights.title}
      </Typography>

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 3,
          alignItems: "flex-start",
        }}
      >
        <Paper sx={{ p: 3, width: { xs: "100%", md: 400 }, flexShrink: 0 }}>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <TextField
                type="date"
                label={strings.weights.date}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <TextField
                select
                label={strings.weights.plasticType}
                value={plasticType}
                onChange={(e) => setPlasticType(e.target.value as PlasticType)}
                required
                fullWidth
              >
                {PLASTIC_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {strings.weights.plasticTypes[t]}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                type="number"
                label={strings.weights.weightLbs}
                value={weightLbs}
                onChange={(e) => setWeightLbs(e.target.value)}
                required
                fullWidth
                slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={!canSubmit}
              >
                {submitting ? strings.weights.submitting : strings.weights.submit}
              </Button>
            </Stack>
          </Box>
        </Paper>

        <Box sx={{ flexGrow: 1, minWidth: 0, width: { xs: "100%", md: "auto" } }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 2 }}>
            {strings.weights.history}
          </Typography>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : loadError ? (
          <Alert severity="error">{strings.weights.loadError}</Alert>
        ) : entries.length === 0 ? (
          <Typography color="text.secondary">{strings.weights.empty}</Typography>
        ) : (
          <DataGrid
            rows={entries}
            columns={columns}
            localeText={gridLocaleText}
            showToolbar
            autoHeight
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
              sorting: { sortModel: [{ field: "date", sort: "desc" }] },
            }}
            sx={{
              bgcolor: "#fff",
              borderRadius: "14px",
              borderColor: COLORS.hairlineSoft,
              "--DataGrid-containerBackground": COLORS.canvas,
              "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 800, fontSize: 12, color: COLORS.body },
            }}
          />
        )}
        </Box>
      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert
            severity={toast.ok ? "success" : "error"}
            onClose={() => setToast(null)}
          >
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

export default function WeightsPage() {
  return (
    <PermissionGuard minimum="write">
      <WeightsForm />
    </PermissionGuard>
  );
}
