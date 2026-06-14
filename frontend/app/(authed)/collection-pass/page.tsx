"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { PermissionGuard } from "@/components/PermissionGuard";
import { apiFetch } from "@/lib/api";
import { strings } from "@/lib/strings";

type Status = "collected" | "empty" | "unavailable" | "closed";
const STATUSES: Status[] = ["collected", "empty", "unavailable", "closed"];

interface PassRow {
  pdr_id: string;
  internal_id: number;
  name: string;
  community: string;
  neighborhood: string;
  category: string;
  status: Status | null;
}

interface IsoWeek {
  year: number;
  week: number;
}

function CollectionPass() {
  const [week, setWeek] = useState<IsoWeek | null>(null);
  const [rows, setRows] = useState<PassRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Status | "">>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const w = await apiFetch<IsoWeek>("/collections/current");
        setWeek(w);
        const data = await apiFetch<PassRow[]>(
          `/collections/${w.year}/${w.week}`,
        );
        setRows(data);
        setStatuses(
          Object.fromEntries(data.map((r) => [r.pdr_id, r.status ?? ""])),
        );
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
      setStatuses(
        Object.fromEntries(updated.map((r) => [r.pdr_id, r.status ?? ""])),
      );
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
      <Typography variant="subtitle1" color="text.secondary">
        {strings.collectionPass.week} {week.week} {strings.collectionPass.of}{" "}
        {week.year}
      </Typography>

      {rows.length === 0 ? (
        <Alert severity="info">{strings.collectionPass.empty}</Alert>
      ) : (
        <Paper variant="outlined">
          {rows.map((row, i) => (
            <Box key={row.pdr_id}>
              {i > 0 && <Divider />}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" },
                  alignItems: { sm: "center" },
                  gap: 1.5,
                  p: 2,
                }}
              >
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography noWrap>{row.name}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {row.community} — {row.neighborhood} · {row.category}
                  </Typography>
                </Box>
                <TextField
                  select
                  size="small"
                  label={strings.collectionPass.statusLabel}
                  value={statuses[row.pdr_id] ?? ""}
                  onChange={(e) =>
                    setStatuses((prev) => ({
                      ...prev,
                      [row.pdr_id]: e.target.value as Status | "",
                    }))
                  }
                  sx={{ minWidth: { xs: "100%", sm: 200 } }}
                >
                  <MenuItem value="">
                    <em>{strings.collectionPass.notSet}</em>
                  </MenuItem>
                  {STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {strings.collectionPass.statuses[s]}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>
          ))}
        </Paper>
      )}

      {rows.length > 0 && (
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
          <Alert
            severity={toast.ok ? "success" : "error"}
            onClose={() => setToast(null)}
          >
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
