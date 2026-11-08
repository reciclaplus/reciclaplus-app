"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { strings } from "@/lib/strings";
import { useTown } from "@/lib/town-context";
import type { TownSummary } from "@/lib/types";

const p = strings.admin.projects;

/**
 * Superadmin view of every project, archived ones included: create, archive,
 * restore, and delete (only possible for a project with no data).
 */
export function ProjectsTab() {
  const { refresh } = useAuth();
  const [towns, setTowns] = useState<TownSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    return apiFetch<TownSummary[]>("/towns?include_archived=true")
      .then((list) => {
        setTowns(list);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function act(town: TownSummary, action: "archive" | "restore" | "delete") {
    const confirmText = action === "archive" ? p.archiveConfirm : action === "delete" ? p.deleteConfirm : null;
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    setNotice(null);
    setBusyId(town.id);
    try {
      if (action === "delete") {
        await apiFetch(`/towns/${town.id}`, { method: "DELETE" });
      } else {
        await apiFetch(`/towns/${town.id}/${action}`, { method: "POST" });
      }
      await reload();
      // The switcher lists the user's towns from /auth/me. Archiving the town
      // being viewed takes the user back to the picker.
      await refresh();
    } catch (err) {
      setError(errorMessage(err, strings.common.genericError));
    } finally {
      setBusyId(null);
    }
  }

  if (loadError) {
    return <Alert severity="error">{p.loadError}</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
        <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
          {p.intro}
        </Typography>
        <Button variant="contained" onClick={() => setAddOpen(true)}>
          {p.add}
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{strings.admin.towns.name}</TableCell>
                <TableCell>{strings.list.colStatus}</TableCell>
                <TableCell align="right">{strings.admin.users.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {towns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>{p.empty}</TableCell>
                </TableRow>
              )}
              {towns.map((town) => {
                const archived = town.archived_at !== null;
                const busy = busyId === town.id;
                return (
                  <TableRow key={town.id}>
                    <TableCell>{town.name}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={archived ? p.archived : p.active}
                        color={archived ? "default" : "success"}
                        variant={archived ? "outlined" : "filled"}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Button size="small" disabled={busy} onClick={() => act(town, archived ? "restore" : "archive")}>
                        {archived ? p.restore : p.archive}
                      </Button>
                      <Button size="small" color="error" disabled={busy} onClick={() => act(town, "delete")}>
                        {strings.common.delete}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="body2" color="text.secondary">
        {p.deleteHint}
      </Typography>

      {addOpen && (
        <AddProjectDialog
          onClose={() => setAddOpen(false)}
          onSaved={async () => {
            setAddOpen(false);
            setNotice(p.created);
            await reload();
            await refresh();
          }}
        />
      )}
    </Stack>
  );
}

function AddProjectDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  // Start from the current project's map center, usually the closest guess.
  const { detail } = useTown();
  const [name, setName] = useState("");
  const [lat, setLat] = useState(String(detail.map_center_lat));
  const [lng, setLng] = useState(String(detail.map_center_lng));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim() !== "" && lat !== "" && lng !== "" && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/towns", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          map_center_lat: Number(lat),
          map_center_lng: Number(lng),
          categories: [],
        }),
      });
      await onSaved();
    } catch (err) {
      setError(errorMessage(err, strings.common.genericError));
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{p.add}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label={strings.admin.towns.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label={strings.admin.towns.centerLat}
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            type="number"
            fullWidth
          />
          <TextField
            label={strings.admin.towns.centerLng}
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            type="number"
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{strings.common.cancel}</Button>
        <Button variant="contained" onClick={save} disabled={!valid || saving}>
          {saving ? strings.common.saving : strings.common.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
