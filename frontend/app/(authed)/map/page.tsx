"use client";

import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { PermissionGuard } from "@/components/PermissionGuard";
import { PdrMap } from "@/components/PdrMap";
import type { LatLng } from "@/components/MapPicker";
import { apiFetch } from "@/lib/api";
import { strings } from "@/lib/strings";
import type { Pdr } from "@/lib/types";

interface TownSummary {
  id: string;
  map_center_lat: number;
  map_center_lng: number;
}

const ALL = "__all__";

function MapView() {
  const [center, setCenter] = useState<LatLng | null>(null);
  const [pdrs, setPdrs] = useState<Pdr[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [neighborhood, setNeighborhood] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [focusedPdr, setFocusedPdr] = useState<Pdr | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [towns, pdrList] = await Promise.all([
          apiFetch<TownSummary[]>("/towns"),
          apiFetch<Pdr[]>("/pdrs"),
        ]);
        if (towns.length > 0) {
          setCenter({
            lat: towns[0].map_center_lat,
            lng: towns[0].map_center_lng,
          });
        }
        setPdrs(pdrList);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const neighborhoods = useMemo(
    () => Array.from(new Set(pdrs.map((p) => p.neighborhood))).sort(),
    [pdrs],
  );
  const categories = useMemo(
    () => Array.from(new Set(pdrs.map((p) => p.category))).sort(),
    [pdrs],
  );

  const filtered = useMemo(
    () =>
      pdrs.filter(
        (p) =>
          (neighborhood === ALL || p.neighborhood === neighborhood) &&
          (category === ALL || p.category === category),
      ),
    [pdrs, neighborhood, category],
  );

  useEffect(() => {
    if (focusedPdr && !filtered.some((p) => p.id === focusedPdr.id)) {
      setFocusedPdr(null);
    }
  }, [filtered, focusedPdr]);

  if (error) {
    return <Alert severity="error">{strings.mapPage.loadError}</Alert>;
  }

  if (loading || !center) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {strings.mapPage.title}
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Autocomplete
          size="small"
          options={filtered}
          value={focusedPdr}
          getOptionLabel={(p) => p.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          onChange={(_, value) => setFocusedPdr(value)}
          renderInput={(params) => (
            <TextField {...params} label={strings.mapPage.searchByName} />
          )}
          sx={{ minWidth: 240 }}
        />
        <TextField
          select
          size="small"
          label={strings.mapPage.filterNeighborhood}
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value={ALL}>{strings.mapPage.all}</MenuItem>
          {neighborhoods.map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={strings.mapPage.filterCategory}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value={ALL}>{strings.mapPage.all}</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <PdrMap center={center} pdrs={filtered} focusedPdr={focusedPdr} />
    </Stack>
  );
}

export default function MapPage() {
  return (
    <PermissionGuard minimum="read">
      <MapView />
    </PermissionGuard>
  );
}
