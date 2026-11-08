"use client";

import { useState } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { plasticTypeLabel } from "@/lib/plastic-types";
import { strings } from "@/lib/strings";
import { useTown } from "@/lib/town-context";
import type { Community } from "@/lib/types";

const t = strings.admin.towns;

/** A list of short values edited as chips; Enter adds the typed value. */
function ChipListField({
  label,
  hint,
  values,
  onChange,
  display = (v) => v,
}: {
  label: string;
  hint: string;
  values: string[];
  onChange: (values: string[]) => void;
  display?: (value: string) => string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (value && !values.includes(value)) onChange([...values, value]);
    setDraft("");
  }

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {label}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
        {values.map((v) => (
          <Chip key={v} label={display(v)} onDelete={() => onChange(values.filter((x) => x !== v))} />
        ))}
      </Box>
      <TextField
        label={hint}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        size="small"
        fullWidth
      />
    </Box>
  );
}

/** Settings, communities and barrios of the selected project (its admins). */
export function TownSettingsTab() {
  const { refresh } = useAuth();
  const { detail, townPath, refreshDetail } = useTown();
  const [name, setName] = useState(detail.name);
  const [lat, setLat] = useState(String(detail.map_center_lat));
  const [lng, setLng] = useState(String(detail.map_center_lng));
  const [zoom, setZoom] = useState(String(detail.map_zoom));
  const [categories, setCategories] = useState(detail.categories);
  const [plasticTypes, setPlasticTypes] = useState(detail.plastic_types);
  const [partnerText, setPartnerText] = useState(detail.report_partner_text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newCommunity, setNewCommunity] = useState("");

  const zoomNumber = Number(zoom);
  const valid =
    name.trim() !== "" &&
    lat !== "" && !Number.isNaN(Number(lat)) &&
    lng !== "" && !Number.isNaN(Number(lng)) &&
    Number.isInteger(zoomNumber) && zoomNumber >= 1 && zoomNumber <= 22;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(townPath(""), {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim(),
          map_center_lat: Number(lat),
          map_center_lng: Number(lng),
          map_zoom: zoomNumber,
          categories,
          plastic_types: plasticTypes,
          report_partner_text: partnerText.trim() || null,
        }),
      });
      // The name also shows in the town switcher, which comes from /auth/me.
      await Promise.all([refreshDetail(), refresh()]);
      setToast(t.saved);
    } catch (err) {
      setError(errorMessage(err, strings.common.genericError));
    } finally {
      setSaving(false);
    }
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await refreshDetail();
    } catch (err) {
      setError(errorMessage(err, strings.common.genericError));
    }
  }

  function addCommunity() {
    const n = newCommunity.trim();
    if (!n) return;
    run(async () => {
      await apiFetch(townPath("/communities"), { method: "POST", body: JSON.stringify({ name: n }) });
      setNewCommunity("");
    });
  }

  return (
    <Stack spacing={3}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h6">{t.editTown}</Typography>
          <TextField label={t.name} value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label={t.centerLat} value={lat} onChange={(e) => setLat(e.target.value)} type="number" fullWidth />
            <TextField label={t.centerLng} value={lng} onChange={(e) => setLng(e.target.value)} type="number" fullWidth />
          </Stack>
          <TextField
            label={t.mapZoom}
            value={zoom}
            onChange={(e) => setZoom(e.target.value)}
            type="number"
            helperText={t.mapZoomHint}
            slotProps={{ htmlInput: { min: 1, max: 22, step: 1 } }}
            sx={{ maxWidth: { sm: 260 } }}
          />
          <ChipListField label={t.categories} hint={t.categoriesHint} values={categories} onChange={setCategories} />
          <ChipListField
            label={t.plasticTypes}
            hint={t.plasticTypesHint}
            values={plasticTypes}
            onChange={setPlasticTypes}
            display={plasticTypeLabel}
          />
          <Typography variant="body2" color="text.secondary">
            {t.listRemovalHint}
          </Typography>
          <TextField
            label={t.partnerText}
            value={partnerText}
            onChange={(e) => setPartnerText(e.target.value)}
            helperText={t.partnerTextHint}
            fullWidth
          />
          <Box>
            <Button variant="contained" onClick={save} disabled={saving || !valid}>
              {saving ? strings.common.saving : strings.common.save}
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {t.communities}
        </Typography>

        {detail.communities.map((community) => (
          <CommunityRow key={community.id} community={community} run={run} />
        ))}

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <TextField
            label={t.newCommunity}
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
            {t.addCommunity}
          </Button>
        </Stack>
      </Paper>

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

/** One community with its barrios. `run` performs a change and reloads the
 * project, showing any error (such as a barrio still in use). */
function CommunityRow({
  community,
  run,
}: {
  community: Community;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [newNeighborhood, setNewNeighborhood] = useState("");

  function rename() {
    const name = window.prompt(t.name, community.name)?.trim();
    if (!name || name === community.name) return;
    run(() => apiFetch(`/communities/${community.id}`, { method: "PUT", body: JSON.stringify({ name }) }));
  }

  function remove() {
    if (!window.confirm(t.deleteCommunityConfirm)) return;
    run(() => apiFetch(`/communities/${community.id}`, { method: "DELETE" }));
  }

  function addNeighborhood() {
    const n = newNeighborhood.trim();
    if (!n) return;
    run(async () => {
      await apiFetch(`/communities/${community.id}/neighborhoods`, {
        method: "POST",
        body: JSON.stringify({ name: n }),
      });
      setNewNeighborhood("");
    });
  }

  function renameNeighborhood(id: string, current: string) {
    const name = window.prompt(t.name, current)?.trim();
    if (!name || name === current) return;
    run(() => apiFetch(`/neighborhoods/${id}`, { method: "PUT", body: JSON.stringify({ name }) }));
  }

  function removeNeighborhood(id: string) {
    if (!window.confirm(t.deleteNeighborhoodConfirm)) return;
    run(() => apiFetch(`/neighborhoods/${id}`, { method: "DELETE" }));
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

          <Typography variant="subtitle2">{t.neighborhoods}</Typography>
          {community.neighborhoods.map((n) => (
            <Stack key={n.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography sx={{ flexGrow: 1 }}>{n.name}</Typography>
              <IconButton size="small" onClick={() => renameNeighborhood(n.id, n.name)} aria-label={strings.common.edit}>
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => removeNeighborhood(n.id)} aria-label={strings.common.delete}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <TextField
              label={t.newNeighborhood}
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
              {t.addNeighborhood}
            </Button>
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
