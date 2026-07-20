"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";

import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MapIcon from "@mui/icons-material/Map";
import MapOffIcon from "@mui/icons-material/LayersClear";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import {
  APIProvider,
  Map as GoogleMap,
  useMap,
} from "@vis.gl/react-google-maps";
import { PermissionGuard } from "@/components/PermissionGuard";
import { apiFetch } from "@/lib/api";
import { strings } from "@/lib/strings";
import { type Status, STATUS_COLORS } from "@/lib/collection-status";
import { type IsoWeek, formatWeekLabel } from "@/lib/week";
import type { Pdr } from "@/lib/types";
import { enqueueMark, getOutbox, clearAllOutbox, cacheWeek, getCachedWeek } from "@/lib/route/outbox";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

interface PassRow {
  pdr_id: string;
  internal_id: number;
  name: string;
  community: string;
  neighborhood: string;
  category: string;
  route_order: number | null;
  status: Status | null;
}

interface RouteStop extends PassRow {
  lat: number;
  lng: number;
}

function sortKey(s: RouteStop): number {
  return s.route_order ?? s.internal_id;
}

// ── Map with markers + live dot ──────────────────────────────────────

function createPinElement(color: string, label: string, size: number): HTMLElement {
  const div = document.createElement("div");
  div.style.width = `${size}px`;
  div.style.height = `${size}px`;
  div.style.borderRadius = "50%";
  div.style.backgroundColor = color;
  div.style.border = "2px solid #fff";
  div.style.display = "flex";
  div.style.alignItems = "center";
  div.style.justifyContent = "center";
  div.style.color = "#fff";
  div.style.fontSize = "12px";
  div.style.fontWeight = "bold";
  div.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
  div.textContent = label;
  return div;
}

function RouteMarkers({
  stops,
  currentId,
  onSelect,
  livePos,
}: {
  stops: RouteStop[];
  currentId: string | null;
  onSelect: (id: string) => void;
  livePos: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const dotRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  useEffect(() => {
    if (!map) return;

    markersRef.current.forEach((m) => (m.map = null));

    const ordered = [...stops].sort((a, b) => sortKey(a) - sortKey(b));

    const markers = ordered.map((stop, i) => {
      const done = stop.status !== null;
      const isCurrent = stop.pdr_id === currentId;
      const color = done ? STATUS_COLORS[stop.status!] : isCurrent ? "#2e7d32" : "#757575";
      const label = done ? (stop.status === "collected" ? "✓" : stop.status === "empty" ? "–" : "✕") : String(i + 1);

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: stop.lat, lng: stop.lng },
        map,
        content: createPinElement(color, label, isCurrent ? 32 : 24),
        zIndex: isCurrent ? 100 : done ? 1 : 50,
      });
      marker.addListener("click", () => onSelect(stop.pdr_id));
      return marker;
    });

    markersRef.current = markers;

    return () => {
      markers.forEach((m) => (m.map = null));
    };
  }, [map, stops, currentId, onSelect]);

  useEffect(() => {
    if (!map) return;
    return () => {
      if (dotRef.current) dotRef.current.map = null;
      dotRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (!map || !livePos) return;
    if (!dotRef.current) {
      const dot = document.createElement("div");
      dot.style.width = "16px";
      dot.style.height = "16px";
      dot.style.borderRadius = "50%";
      dot.style.backgroundColor = "#4285F4";
      dot.style.border = "2px solid #fff";
      dot.style.boxShadow = "0 0 6px rgba(66,133,244,0.6)";
      dotRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        content: dot,
        zIndex: 200,
      });
    }
    dotRef.current.position = livePos;
  }, [map, livePos]);

  return null;
}

function MapController({ center }: { center: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (map && center) map.panTo(center);
  }, [map, center]);
  return null;
}

function MapRefCapture({
  mapRef,
}: {
  mapRef: React.MutableRefObject<google.maps.Map | null>;
}) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

// ── Main component ───────────────────────────────────────────────────

function CollectionRoute() {
  const router = useRouter();

  const [week, setWeek] = useState<IsoWeek | null>(null);
  const [allStops, setAllStops] = useState<RouteStop[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Status | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const [selectedBarrio, setSelectedBarrio] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);

  const [livePos, setLivePos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Geo
  useEffect(() => {
    if (!navigator.geolocation) { setGeoError(true); return; }
    const wid = navigator.geolocation.watchPosition(
      (pos) => setLivePos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError(true),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(wid);
  }, []);

  // Load data: try API first, fall back to IndexedDB cache if offline
  useEffect(() => {
    async function init() {
      try {
        const [w, pdrs] = await Promise.all([
          apiFetch<IsoWeek>("/collections/current"),
          apiFetch<Pdr[]>("/pdrs"),
        ]);
        setWeek(w);
        const passRows = await apiFetch<PassRow[]>(`/collections/${w.year}/${w.week}`);
        const pdrMap = new Map(pdrs.map((p) => [p.id, p]));
        const merged: RouteStop[] = passRows
          .filter((r) => pdrMap.has(r.pdr_id))
          .map((r) => {
            const pdr = pdrMap.get(r.pdr_id)!;
            return { ...r, lat: pdr.lat, lng: pdr.lng };
          });

        await cacheWeek(w.year, w.week, merged);

        // Apply any pending outbox marks on top of server data
        const outbox = await getOutbox();
        const outboxMap = new Map(outbox.map((m) => [m.pdr_id, m.status]));

        setAllStops(merged);
        setStatuses(Object.fromEntries(merged.map((r) => [r.pdr_id, outboxMap.get(r.pdr_id) ?? r.status])));
        setPendingCount(outbox.length);
        if (merged.length > 0) {
          setSelectedBarrio(merged[0].neighborhood);
        }
      } catch {
        // Offline fallback: load from IndexedDB cache + outbox
        try {
          const outbox = await getOutbox();
          if (outbox.length > 0) {
            const { year, week } = outbox[0];
            setWeek({ year, week });
            const cached = await getCachedWeek(year, week) as RouteStop[] | null;
            if (cached) {
              const outboxMap = new Map(outbox.map((m) => [m.pdr_id, m.status]));
              setAllStops(cached);
              setStatuses(Object.fromEntries(cached.map((r) => [r.pdr_id, outboxMap.get(r.pdr_id) ?? r.status])));
              setPendingCount(outbox.length);
              if (cached.length > 0) setSelectedBarrio(cached[0].neighborhood);
            } else {
              setError(true);
            }
          } else {
            setError(true);
          }
        } catch {
          setError(true);
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Derived state
  const barrios = useMemo(() => {
    const seen = new Set<string>();
    return allStops
      .sort((a, b) => sortKey(a) - sortKey(b))
      .reduce<string[]>((acc, s) => {
        if (!seen.has(s.neighborhood)) { seen.add(s.neighborhood); acc.push(s.neighborhood); }
        return acc;
      }, []);
  }, [allStops]);

  const stops = useMemo(() =>
    allStops
      .filter((s) => s.neighborhood === selectedBarrio)
      .sort((a, b) => sortKey(a) - sortKey(b))
      .map((s) => ({ ...s, status: statuses[s.pdr_id] ?? null })),
    [allStops, selectedBarrio, statuses],
  );

  const markedCount = stops.filter((s) => s.status !== null).length;
  const collectedCount = stops.filter((s) => s.status === "collected").length;

  // Auto-select first pending stop when barrio changes
  useEffect(() => {
    const firstPending = stops.find((s) => s.status === null);
    setCurrentId(firstPending?.pdr_id ?? stops[stops.length - 1]?.pdr_id ?? null);
  }, [stops]);

  const currentStop = stops.find((s) => s.pdr_id === currentId) ?? null;
  const currentIdx = stops.findIndex((s) => s.pdr_id === currentId);

  // Mark a stop — persist to IndexedDB outbox immediately
  function markStop(pdr_id: string, status: Status) {
    if (!week) return;
    const now = new Date().toISOString();
    setStatuses((prev) => ({ ...prev, [pdr_id]: status }));
    enqueueMark({ pdr_id, status, collected_at: now, year: week.year, week: week.week })
      .then(() => setPendingCount((c) => c + 1));

    // Auto-advance to next pending
    const stopsAfter = stops.slice(currentIdx + 1);
    const next = stopsAfter.find((s) => s.pdr_id !== pdr_id && statuses[s.pdr_id] === null);
    if (next) setCurrentId(next.pdr_id);
  }

  // Sync: flush IndexedDB outbox to server
  const flush = useCallback(async () => {
    if (!week) return;
    const outbox = await getOutbox();
    if (outbox.length === 0) return;
    setSyncing(true);
    try {
      const entries = outbox.map((p) => ({
        pdr_id: p.pdr_id,
        status: p.status,
        collected_at: p.collected_at,
      }));
      await apiFetch(`/collections/${week.year}/${week.week}`, {
        method: "POST",
        body: JSON.stringify({ entries }),
      });
      await clearAllOutbox();
      setPendingCount(0);
    } catch {
      // keep in outbox, will retry
    } finally {
      setSyncing(false);
    }
  }, [week]);

  // Auto-flush on a timer + on reconnect
  useEffect(() => {
    if (pendingCount === 0) return;
    const timer = setTimeout(flush, 2000);
    return () => clearTimeout(timer);
  }, [pendingCount, flush]);

  useEffect(() => {
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);

  // Next barrio
  function goNextBarrio() {
    const idx = barrios.indexOf(selectedBarrio);
    if (idx < barrios.length - 1) setSelectedBarrio(barrios[idx + 1]);
  }

  const mapCenter = useMemo(() => {
    if (stops.length === 0) return { lat: 18.45, lng: -71.07 };
    const lat = stops.reduce((s, p) => s + p.lat, 0) / stops.length;
    const lng = stops.reduce((s, p) => s + p.lng, 0) / stops.length;
    return { lat, lng };
  }, [stops]);

  const allDone = stops.length > 0 && markedCount === stops.length;
  const hasNextBarrio = barrios.indexOf(selectedBarrio) < barrios.length - 1;

  if (error) return <Alert severity="error">{strings.collectionRoute.loadError}</Alert>;
  if (loading || !week) return <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100dvh", mx: { xs: -3, sm: 0 }, mt: { xs: -3, sm: 0 } }}>
      {/* Route header — visually distinct from the main app bar */}
      <Box sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.75,
        bgcolor: "#f5f5f5",
        color: "#212121",
      }}>
        <IconButton size="small" sx={{ color: "#424242" }} onClick={() => router.push("/collection-pass")}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {strings.collectionRoute.title}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.6, fontSize: "0.65rem" }}>
            {formatWeekLabel(week)}
          </Typography>
        </Box>
        <IconButton size="small" sx={{ color: "#424242" }} onClick={() => setShowMap((v) => !v)}>
          {showMap ? <MapOffIcon fontSize="small" /> : <MapIcon fontSize="small" />}
        </IconButton>
        <Chip
          size="small"
          label={
            syncing
              ? strings.collectionRoute.syncing
              : pendingCount > 0
                ? `${pendingCount} ${strings.collectionRoute.unsynced}`
                : strings.collectionRoute.online
          }
          sx={{
            bgcolor: syncing ? "#ff9800" : pendingCount > 0 ? "#9e9e9e" : "#43a047",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.65rem",
            height: 22,
          }}
        />
      </Box>

      {/* Map */}
      {showMap && <Box sx={{ flex: 1, minHeight: 200, position: "relative" }}>
        {API_KEY ? (
          <APIProvider apiKey={API_KEY} libraries={["marker"]}>
            <GoogleMap
              defaultCenter={mapCenter}
              defaultZoom={19}
              gestureHandling="greedy"
              disableDefaultUI
              mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"}
              style={{ width: "100%", height: "100%" }}
            >
              <RouteMarkers
                stops={stops}
                currentId={currentId}
                onSelect={setCurrentId}
                livePos={livePos}
              />
              <MapController center={currentStop ? { lat: currentStop.lat, lng: currentStop.lng } : null} />
              <MapRefCapture mapRef={mapRef} />
            </GoogleMap>
          </APIProvider>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <Typography color="error">{strings.newPdr.mapKeyMissing}</Typography>
          </Box>
        )}
        {/* Recenter button */}
        {livePos && (
          <IconButton
            onClick={() => mapRef.current?.panTo(livePos)}
            sx={{
              position: "absolute",
              bottom: 16,
              right: 16,
              bgcolor: "background.paper",
              boxShadow: 2,
              "&:hover": { bgcolor: "background.paper" },
            }}
          >
            <MyLocationIcon />
          </IconButton>
        )}
      </Box>}

      {/* Bottom panel */}
      <Paper
        elevation={showMap ? 8 : 0}
        sx={{
          borderTopLeftRadius: showMap ? 16 : 0,
          borderTopRightRadius: showMap ? 16 : 0,
          p: 2,
          pb: 3,
          flex: showMap ? undefined : 1,
          maxHeight: showMap ? "45vh" : undefined,
          overflow: "auto",
        }}
      >
        {/* Barrio selector + progress */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
          {barrios.length > 1 && (
            <select
              value={selectedBarrio}
              onChange={(e) => setSelectedBarrio(e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              {barrios.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
          {barrios.length === 1 && (
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{selectedBarrio}</Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ ml: "auto" }}>
            {collectedCount} {strings.collectionRoute.collectedCount} · {markedCount}/{stops.length} {strings.collectionRoute.progress}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={stops.length > 0 ? (markedCount / stops.length) * 100 : 0}
          sx={{ mb: 2, borderRadius: 1, height: 6 }}
        />

        {geoError && (
          <Alert severity="info" sx={{ mb: 1, py: 0 }}>
            {strings.collectionRoute.locationDenied}
          </Alert>
        )}

        {allDone ? (
          <Box sx={{ textAlign: "center", py: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              ¡{selectedBarrio} {strings.collectionRoute.barrioComplete}!
            </Typography>
            {hasNextBarrio && (
              <Button variant="contained" onClick={goNextBarrio}>
                {strings.collectionRoute.nextBarrio} · {barrios[barrios.indexOf(selectedBarrio) + 1]}
              </Button>
            )}
            {!hasNextBarrio && (
              <Typography variant="body2" color="text.secondary">
                {strings.collectionRoute.allComplete}
              </Typography>
            )}
          </Box>
        ) : currentStop ? (
          <Box>
            {/* Current stop info */}
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                {strings.collectionRoute.nextPoint} #{currentIdx + 1}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {currentStop.name}
              </Typography>
              <Chip label={currentStop.category} size="small" sx={{ mt: 0.5 }} />
            </Box>

            {/* Status buttons */}
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={() => markStop(currentStop.pdr_id, "collected")}
              sx={{
                bgcolor: STATUS_COLORS.collected,
                "&:hover": { bgcolor: "#1b5e20" },
                mb: 1,
                py: 1.5,
                fontSize: "1rem",
                fontWeight: 700,
              }}
            >
              {strings.collectionRoute.markCollected}
            </Button>
            <Box sx={{ display: "flex", gap: 1 }}>
              {(["empty", "unavailable", "closed"] as Status[]).map((s) => (
                <Button
                  key={s}
                  variant="outlined"
                  fullWidth
                  onClick={() => markStop(currentStop.pdr_id, s)}
                  sx={{
                    borderColor: STATUS_COLORS[s],
                    color: STATUS_COLORS[s],
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    py: 1,
                  }}
                >
                  {strings.collectionRoute[`mark${s.charAt(0).toUpperCase() + s.slice(1)}` as keyof typeof strings.collectionRoute]}
                </Button>
              ))}
            </Box>

            {/* Stop list */}
            <Box sx={{ mt: 2, maxHeight: showMap ? 150 : undefined, overflow: "auto" }}>
              {stops.map((stop, i) => (
                <Box
                  key={stop.pdr_id}
                  onClick={() => setCurrentId(stop.pdr_id)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    py: 0.5,
                    px: 1,
                    borderRadius: 1,
                    cursor: "pointer",
                    bgcolor: stop.pdr_id === currentId ? "action.selected" : "transparent",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, width: 24, textAlign: "center" }}>
                    {i + 1}
                  </Typography>
                  <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                    {stop.name}
                  </Typography>
                  {stop.status && (
                    <Chip
                      label={strings.collectionPass.statuses[stop.status]}
                      size="small"
                      sx={{
                        bgcolor: STATUS_COLORS[stop.status],
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.65rem",
                        height: 20,
                      }}
                    />
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Typography color="text.secondary">{strings.collectionRoute.noStops}</Typography>
        )}
      </Paper>
    </Box>
  );
}

export default function CollectionRoutePage() {
  return (
    <PermissionGuard minimum="write">
      <CollectionRoute />
    </PermissionGuard>
  );
}
