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
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { apiFetch } from "@/lib/api";
import { strings } from "@/lib/strings";
import type { Community, TownDetail, TownSummary } from "@/lib/types";

export function TownConfigTab() {
  const [towns, setTowns] = useState<TownSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [town, setTown] = useState<TownDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [addTownOpen, setAddTownOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadTowns = useCallback(async () => {
    try {
      const list = await apiFetch<TownSummary[]>("/towns");
      setTowns(list);
      setSelectedId((prev) => prev || (list[0]?.id ?? ""));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTown = useCallback(async (id: string) => {
    if (!id) {
      setTown(null);
      return;
    }
    const detail = await apiFetch<TownDetail>(`/towns/${id}`);
    setTown(detail);
  }, []);

  useEffect(() => {
    loadTowns();
  }, [loadTowns]);

  useEffect(() => {
    loadTown(selectedId);
  }, [selectedId, loadTown]);

  if (error) {
    return <Alert severity="error">{strings.admin.towns.loadError}</Alert>;
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
        {towns.length > 0 ? (
          <TextField
            select
            label={strings.admin.towns.selectTown}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            sx={{ minWidth: 220 }}
            size="small"
          >
            {towns.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Alert severity="info" sx={{ flexGrow: 1 }}>
            {strings.admin.towns.empty}
          </Alert>
        )}
        <Button variant="outlined" onClick={() => setAddTownOpen(true)} startIcon={<AddIcon />}>
          {strings.admin.towns.addTown}
        </Button>
      </Stack>

      {town && (
        <TownEditor
          town={town}
          onChanged={async () => {
            await loadTowns();
            await loadTown(selectedId);
          }}
          onDeleted={async () => {
            setSelectedId("");
            setTown(null);
            await loadTowns();
          }}
          onToast={setToast}
        />
      )}

      {addTownOpen && (
        <AddTownDialog
          onClose={() => setAddTownOpen(false)}
          onSaved={async (newId) => {
            setAddTownOpen(false);
            await loadTowns();
            setSelectedId(newId);
          }}
        />
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setToast(null)}>
          {toast}
        </Alert>
      </Snackbar>
    </Stack>
  );
}

function TownEditor({
  town,
  onChanged,
  onDeleted,
  onToast,
}: {
  town: TownDetail;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [name, setName] = useState(town.name);
  const [lat, setLat] = useState(String(town.map_center_lat));
  const [lng, setLng] = useState(String(town.map_center_lng));
  const [categories, setCategories] = useState<string[]>(town.categories);
  const [newCategory, setNewCategory] = useState("");
  const [savingTown, setSavingTown] = useState(false);
  const [newCommunity, setNewCommunity] = useState("");

  // Re-sync when the selected town changes.
  useEffect(() => {
    setName(town.name);
    setLat(String(town.map_center_lat));
    setLng(String(town.map_center_lng));
    setCategories(town.categories);
  }, [town]);

  async function saveTown() {
    setSavingTown(true);
    try {
      await apiFetch(`/towns/${town.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim(),
          map_center_lat: Number(lat),
          map_center_lng: Number(lng),
          categories,
        }),
      });
      onToast(strings.admin.towns.saved);
      await onChanged();
    } finally {
      setSavingTown(false);
    }
  }

  function addCategory() {
    const c = newCategory.trim();
    if (c && !categories.includes(c)) setCategories([...categories, c]);
    setNewCategory("");
  }

  async function deleteTown() {
    if (!window.confirm(strings.admin.towns.deleteTownConfirm)) return;
    await apiFetch(`/towns/${town.id}`, { method: "DELETE" });
    await onDeleted();
  }

  async function addCommunity() {
    const n = newCommunity.trim();
    if (!n) return;
    await apiFetch(`/towns/${town.id}/communities`, {
      method: "POST",
      body: JSON.stringify({ name: n }),
    });
    setNewCommunity("");
    await onChanged();
  }

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h6">{strings.admin.towns.editTown}</Typography>
          <TextField
            label={strings.admin.towns.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
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

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {strings.admin.towns.categories}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
              {categories.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  onDelete={() => setCategories(categories.filter((x) => x !== c))}
                />
              ))}
            </Box>
            <TextField
              label={strings.admin.towns.categoriesHint}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCategory();
                }
              }}
              size="small"
            />
          </Box>

          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={saveTown} disabled={savingTown}>
              {strings.common.save}
            </Button>
            <Button color="error" onClick={deleteTown} startIcon={<DeleteIcon />}>
              {strings.common.delete}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {strings.admin.towns.communities}
        </Typography>

        {town.communities.map((community) => (
          <CommunityRow key={community.id} community={community} onChanged={onChanged} />
        ))}

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <TextField
            label={strings.admin.towns.newCommunity}
            value={newCommunity}
            onChange={(e) => setNewCommunity(e.target.value)}
            size="small"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCommunity();
              }
            }}
          />
          <Button onClick={addCommunity} startIcon={<AddIcon />}>
            {strings.admin.towns.addCommunity}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}

function CommunityRow({
  community,
  onChanged,
}: {
  community: Community;
  onChanged: () => Promise<void>;
}) {
  const [newNeighborhood, setNewNeighborhood] = useState("");

  async function rename() {
    const name = window.prompt(strings.admin.towns.name, community.name)?.trim();
    if (!name || name === community.name) return;
    await apiFetch(`/communities/${community.id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    await onChanged();
  }

  async function remove() {
    if (!window.confirm(strings.admin.towns.deleteCommunityConfirm)) return;
    await apiFetch(`/communities/${community.id}`, { method: "DELETE" });
    await onChanged();
  }

  async function addNeighborhood() {
    const n = newNeighborhood.trim();
    if (!n) return;
    await apiFetch(`/communities/${community.id}/neighborhoods`, {
      method: "POST",
      body: JSON.stringify({ name: n }),
    });
    setNewNeighborhood("");
    await onChanged();
  }

  async function renameNeighborhood(id: string, current: string) {
    const name = window.prompt(strings.admin.towns.name, current)?.trim();
    if (!name || name === current) return;
    await apiFetch(`/neighborhoods/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    await onChanged();
  }

  async function removeNeighborhood(id: string) {
    if (!window.confirm(strings.admin.towns.deleteNeighborhoodConfirm)) return;
    await apiFetch(`/neighborhoods/${id}`, { method: "DELETE" });
    await onChanged();
  }

  return (
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ flexGrow: 1 }}>{community.name}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<EditIcon />} onClick={rename}>
              {strings.common.edit}
            </Button>
            <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={remove}>
              {strings.common.delete}
            </Button>
          </Stack>

          <Typography variant="subtitle2">{strings.admin.towns.neighborhoods}</Typography>
          {community.neighborhoods.map((n) => (
            <Stack key={n.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography sx={{ flexGrow: 1 }}>{n.name}</Typography>
              <IconButton size="small" onClick={() => renameNeighborhood(n.id, n.name)}>
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => removeNeighborhood(n.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <TextField
              label={strings.admin.towns.newNeighborhood}
              value={newNeighborhood}
              onChange={(e) => setNewNeighborhood(e.target.value)}
              size="small"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNeighborhood();
                }
              }}
            />
            <Button size="small" onClick={addNeighborhood} startIcon={<AddIcon />}>
              {strings.admin.towns.addNeighborhood}
            </Button>
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function AddTownDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (newId: string) => void;
}) {
  const [name, setName] = useState("");
  const [lat, setLat] = useState("18.7419");
  const [lng, setLng] = useState("-70.9530");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const created = await apiFetch<TownDetail>("/towns", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          map_center_lat: Number(lat),
          map_center_lng: Number(lng),
          categories: [],
        }),
      });
      onSaved(created.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{strings.admin.towns.addTown}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
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
        <Button variant="contained" onClick={save} disabled={!name.trim() || saving}>
          {strings.common.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
