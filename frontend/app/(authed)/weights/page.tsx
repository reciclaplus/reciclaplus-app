"use client";

import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  DataGrid,
  GridActionsCellItem,
  type GridColDef,
  type GridRowId,
} from "@mui/x-data-grid";
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

function todayISOFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayISO(): string {
  return todayISOFromDate(new Date());
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
  const [deleteTarget, setDeleteTarget] = useState<GridRowId | null>(null);

  const columns: GridColDef<WeightEntry>[] = useMemo(
    () => [
      {
        field: "date",
        headerName: strings.weights.date,
        width: 140,
        type: "date",
        editable: true,
        valueGetter: (_value, row) => new Date(row.date),
        valueSetter: (value: Date, row) => ({ ...row, date: todayISOFromDate(value) }),
        valueFormatter: (_value, row) => formatDate(row.date),
      },
      {
        field: "plastic_type",
        headerName: strings.weights.plasticType,
        width: 160,
        type: "singleSelect",
        editable: true,
        valueOptions: PLASTIC_TYPES.map((t) => ({ value: t, label: strings.weights.plasticTypes[t] })),
      },
      {
        field: "weight_lbs",
        headerName: strings.weights.weightLbs,
        width: 140,
        type: "number",
        editable: true,
      },
      {
        field: "actions",
        type: "actions",
        headerName: strings.weights.actions,
        width: 80,
        getActions: (params) => [
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon fontSize="small" />}
            label={strings.common.delete}
            onClick={() => setDeleteTarget(params.id)}
          />,
        ],
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

  async function processRowUpdate(newRow: WeightEntry, oldRow: WeightEntry): Promise<WeightEntry> {
    try {
      const updated = await apiFetch<WeightEntry>(`/weights/${newRow.id}`, {
        method: "PUT",
        body: JSON.stringify({
          date: newRow.date,
          plastic_type: newRow.plastic_type,
          weight_lbs: Number(newRow.weight_lbs),
        }),
      });
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      return updated;
    } catch {
      setToast({ ok: false, msg: strings.weights.updateError });
      return oldRow;
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/weights/${deleteTarget}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget));
    } catch {
      setToast({ ok: false, msg: strings.weights.deleteError });
    } finally {
      setDeleteTarget(null);
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
        <Box sx={{ flex: { xs: "1 1 auto", md: "2 1 0%" }, minWidth: 0, width: { xs: "100%", md: "auto" } }}>
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
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={() => setToast({ ok: false, msg: strings.weights.updateError })}
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

        <Box sx={{ flex: { xs: "1 1 auto", md: "1 1 0%" }, minWidth: { md: 320 }, maxWidth: { md: 400 }, width: { xs: "100%", md: "auto" } }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 2 }}>
            {strings.weights.newEntry}
          </Typography>
          <Paper sx={{ p: 3 }}>
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

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{strings.weights.deleteConfirm}</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{strings.common.cancel}</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            {strings.common.delete}
          </Button>
        </DialogActions>
      </Dialog>
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
