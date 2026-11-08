"use client";

import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { PermissionGuard } from "@/components/PermissionGuard";
import { MapPicker, type LatLng } from "@/components/MapPicker";
import { apiFetch } from "@/lib/api";
import { strings } from "@/lib/strings";
import { useTown } from "@/lib/town-context";

function NewPdrForm() {
  const { detail: town, townPath } = useTown();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState<LatLng | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  // Neighborhoods available for the chosen community.
  const neighborhoods = useMemo(
    () => town.communities.find((c) => c.id === communityId)?.neighborhoods ?? [],
    [town, communityId],
  );

  const canSubmit =
    name.trim() &&
    communityId &&
    neighborhoodId &&
    category &&
    location &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !location) return;
    setSubmitting(true);
    try {
      await apiFetch(townPath("/pdrs"), {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          neighborhood_id: neighborhoodId,
          category,
          lat: location.lat,
          lng: location.lng,
        }),
      });
      setToast({ ok: true, msg: strings.newPdr.success });
      // Reset for the next entry.
      setName("");
      setDescription("");
      setCommunityId("");
      setNeighborhoodId("");
      setCategory("");
      setLocation(null);
    } catch {
      setToast({ ok: false, msg: strings.newPdr.error });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          {strings.newPdr.title}
        </Typography>

        <TextField
          label={strings.newPdr.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          fullWidth
        />

        <TextField
          label={strings.newPdr.description}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          minRows={2}
          fullWidth
        />

        <TextField
          select
          label={strings.newPdr.community}
          value={communityId}
          onChange={(e) => {
            setCommunityId(e.target.value);
            setNeighborhoodId(""); // reset dependent field
          }}
          required
          fullWidth
        >
          {town.communities.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label={strings.newPdr.neighborhood}
          value={neighborhoodId}
          onChange={(e) => setNeighborhoodId(e.target.value)}
          required
          fullWidth
          disabled={!communityId}
        >
          {neighborhoods.map((n) => (
            <MenuItem key={n.id} value={n.id}>
              {n.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label={strings.newPdr.category}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          fullWidth
        >
          {town.categories.map((cat) => (
            <MenuItem key={cat} value={cat}>
              {cat}
            </MenuItem>
          ))}
        </TextField>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {strings.newPdr.location}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {strings.newPdr.locationHint}
          </Typography>
          <MapPicker
            center={{ lat: town.map_center_lat, lng: town.map_center_lng }}
            value={location}
            onChange={setLocation}
          />
          <Typography variant="body2" sx={{ mt: 1 }}>
            {location
              ? `${strings.newPdr.selectedCoords}: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
              : strings.newPdr.noLocation}
          </Typography>
        </Box>

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={!canSubmit}
        >
          {submitting ? strings.newPdr.creating : strings.newPdr.create}
        </Button>
      </Stack>

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

export default function NewPdrPage() {
  return (
    <PermissionGuard minimum="write">
      <NewPdrForm />
    </PermissionGuard>
  );
}
