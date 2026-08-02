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
import NearMeIcon from "@mui/icons-material/NearMe";
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
import { nearestWithinRadius, formatDistance } from "@/lib/geo";
import { COLORS } from "@/lib/theme";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

/** A pending PDR closer than this suggests itself to the operator. */
const NEARBY_ENTER_RADIUS_M = 200;
/** ...and stays suggested until it drifts past this, so GPS jitter at the
 *  boundary doesn't make the banner blink. */
const NEARBY_EXIT_RADIUS_M = 250;

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

type NearbyPick = { stop: RouteStop; distanceM: number } | null;

/** Nearest unmarked stop worth suggesting at `at`, carrying `prev` for hysteresis. */
function pickNearby(
  at: { lat: number; lng: number },
  candidates: RouteStop[],
  prev: NearbyPick,
): NearbyPick {
  const found = nearestWithinRadius(candidates, at, {
    enterRadiusM: NEARBY_ENTER_RADIUS_M,
    exitRadiusM: NEARBY_EXIT_RADIUS_M,
    previousId: prev?.stop.pdr_id ?? null,
    idOf: (s) => s.pdr_id,
  });
  return found ? { stop: found.item, distanceM: found.distanceM } : null;
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

function MapController({ stop }: { stop: { pdr_id: string; lat: number; lng: number } | null }) {
  const map = useMap();
  // Re-center only when the selected PDR actually changes (by id), not on every
  // render — `stop` is a fresh object each time its owner re-renders (e.g. on
  // every GPS fix), and depending on it directly would fight the operator's own
  // panning/zooming by snapping back to the PDR mid-gesture.
  useEffect(() => {
    if (map && stop) map.panTo({ lat: stop.lat, lng: stop.lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, stop?.pdr_id]);
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

  // Nearest unmarked PDR to the operator, recomputed on every position fix.
  const [nearby, setNearby] = useState<{ stop: RouteStop; distanceM: number } | null>(null);

  // Candidates for the nearby suggestion: unmarked stops in the selected
  // barrio only. Neighboring barrios can be geographically close on the map
  // but are collected on separate visits, so a PDR outside the active barrio
  // is not a valid "closest" suggestion even when it is physically nearer.
  // Marked stops are excluded; suggesting a point already dealt with is noise.
  //
  // Declared above the geo effect so the ref is always populated before that
  // effect (re)subscribes — effects in a commit run in declaration order.
  const pendingStops = useMemo(
    () =>
      allStops.filter(
        (s) => s.neighborhood === selectedBarrio && (statuses[s.pdr_id] ?? null) === null,
      ),
    [allStops, selectedBarrio, statuses],
  );

  // Read from the geolocation callbacks so marking a stop doesn't tear down and
  // resubscribe the GPS watch on every tap.
  const pendingStopsRef = useRef<RouteStop[]>([]);
  useEffect(() => {
    pendingStopsRef.current = pendingStops;
  }, [pendingStops]);

  // Geo
  useEffect(() => {
    if (!navigator.geolocation) { setGeoError(true); return; }
    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLivePos(next);
        // A fix after an earlier failure means location works now, so drop the
        // "activa la ubicación" notice instead of leaving it up for the session.
        setGeoError(false);
        setNearby((prev) => pickNearby(next, pendingStopsRef.current, prev));
      },
      () => setGeoError(true),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(wid);
  }, []);

  // Re-evaluate the suggestion whenever the candidate set changes — route data
  // arriving, or a stop being marked.
  //
  // This is load-bearing, not an optimisation. `watchPosition` only reports
  // again once the device has actually moved, and the watch is subscribed
  // before the API responds. A stationary operator therefore gets exactly one
  // fix, measured against an empty (or now-outdated) candidate list, and no
  // later fix ever arrives to correct it — the suggestion could never appear,
  // or update after a stop is marked, at all.
  //
  // Reusing `livePos` (rather than requesting a fresh `getCurrentPosition`
  // fix here) is deliberate: a real device's GPS can be slow or unreliable to
  // query again immediately while a `watchPosition` is already active, which
  // otherwise left the suggestion stuck until the effects were torn down and
  // resubscribed by navigating away and back. The operator hasn't moved
  // meaningfully in the time it takes to mark a stop, so the last known fix
  // is accurate enough to re-run the comparison against the new candidates.
  //
  // The update is deferred a microtask via `queueMicrotask` (effectively
  // immediate) rather than calling `setNearby` straight from the effect body,
  // per the project's `react-hooks/set-state-in-effect` lint rule.
  useEffect(() => {
    if (pendingStops.length === 0 || !livePos) return;
    queueMicrotask(() => setNearby((prev) => pickNearby(livePos, pendingStops, prev)));
  }, [pendingStops, livePos]);

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

  // Auto-select first pending stop when barrio changes. A stop explicitly
  // requested via the nearby banner wins, since selecting it may itself be what
  // switched the barrio and recomputed `stops`.
  const desiredIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (desiredIdRef.current && stops.some((s) => s.pdr_id === desiredIdRef.current)) {
      setCurrentId(desiredIdRef.current);
      desiredIdRef.current = null;
      return;
    }
    const firstPending = stops.find((s) => s.status === null);
    setCurrentId(firstPending?.pdr_id ?? stops[stops.length - 1]?.pdr_id ?? null);
  }, [stops]);

  const currentStop = stops.find((s) => s.pdr_id === currentId) ?? null;
  const currentIdx = stops.findIndex((s) => s.pdr_id === currentId);

  // ── Nearby PDR suggestion ──────────────────────────────────────────
  // `nearby` only refreshes on a position fix, so re-check freshness here:
  // hide it once it becomes the point being worked on, or once it is marked
  // (otherwise a just-marked stop would linger until the next GPS tick).
  const nearbySuggestion =
    nearby &&
    nearby.stop.pdr_id !== currentId &&
    (statuses[nearby.stop.pdr_id] ?? null) === null
      ? nearby
      : null;

  function goToNearby() {
    if (!nearbySuggestion) return;
    const { stop } = nearbySuggestion;
    if (stop.neighborhood !== selectedBarrio) {
      // Switching barrio recomputes `stops`, which would otherwise make the
      // auto-select effect override this pick with the barrio's first pending.
      desiredIdRef.current = stop.pdr_id;
      setSelectedBarrio(stop.neighborhood);
    }
    setCurrentId(stop.pdr_id);
  }

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
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
              <MapController stop={currentStop} />
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

        {/* Nearby PDR suggestion — never steals the current selection, only offers */}
        {nearbySuggestion && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 1.5,
              px: 1.5,
              py: 1,
              borderRadius: 2,
              bgcolor: COLORS.limeSoft,
              border: "1px solid",
              borderColor: COLORS.hairlineSoft,
            }}
          >
            <NearMeIcon fontSize="small" sx={{ color: COLORS.emeraldStart }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ display: "block", color: COLORS.emeraldStart, fontWeight: 600 }}>
                {strings.collectionRoute.nearbyLabel} · {formatDistance(nearbySuggestion.distanceM)}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
                {nearbySuggestion.stop.name}
              </Typography>
              {nearbySuggestion.stop.neighborhood !== selectedBarrio && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {nearbySuggestion.stop.neighborhood}
                </Typography>
              )}
            </Box>
            <Button size="small" variant="contained" onClick={goToNearby}>
              {strings.collectionRoute.nearbyGo}
            </Button>
          </Box>
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
