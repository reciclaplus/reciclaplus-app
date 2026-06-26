/// <reference types="@types/google.maps" />
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  InfoWindow,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  MarkerClusterer,
  type Cluster,
  type ClusterStats,
  type Marker,
  type Renderer,
} from "@googlemaps/markerclusterer";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { strings } from "@/lib/strings";
import type { LatLng } from "@/components/MapPicker";
import type { Pdr } from "@/lib/types";
import { buildBarrioColorMap, getBarrioColor } from "@/lib/barrio-colors";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

function createColoredPin(color: string): HTMLElement {
  const div = document.createElement("div");
  div.style.width = "24px";
  div.style.height = "24px";
  div.style.borderRadius = "50% 50% 50% 0";
  div.style.background = color;
  div.style.transform = "rotate(-45deg)";
  div.style.border = "2px solid white";
  div.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
  div.style.cursor = "pointer";
  return div;
}

function createClusterRenderer(color: string, barrioName: string): Renderer {
  return {
    render(cluster: Cluster, _stats: ClusterStats, map: google.maps.Map) {
      const count = cluster.count;
      const position = cluster.position;
      const size = Math.min(24 + count * 2, 56);

      const svg = `
        <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
          <circle cx="30" cy="30" r="28" fill="${color}" opacity="0.85"
                  stroke="white" stroke-width="3"/>
          <text x="30" y="33" text-anchor="middle" fill="white"
                font-size="16" font-weight="bold" font-family="sans-serif">
            ${count}
          </text>
        </svg>`;

      const div = document.createElement("div");
      div.innerHTML = svg;
      div.style.width = `${size}px`;
      div.style.height = `${size}px`;
      div.style.cursor = "pointer";
      div.title = `${barrioName} (${count})`;

      return new google.maps.marker.AdvancedMarkerElement({
        position,
        content: div,
        zIndex: count,
      });
    },
  };
}

function BarrioClusteredMarkers({
  pdrs,
  barrioColorMap,
  onSelect,
}: {
  pdrs: Pdr[];
  barrioColorMap: globalThis.Map<string, string>;
  onSelect: (pdr: Pdr) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const grouped = new globalThis.Map<string, Pdr[]>();
    for (const pdr of pdrs) {
      const list = grouped.get(pdr.neighborhood) ?? [];
      list.push(pdr);
      grouped.set(pdr.neighborhood, list);
    }

    const allMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
    const clusterers: MarkerClusterer[] = [];

    for (const [barrio, barrioPdrs] of grouped) {
      const color = getBarrioColor(barrioColorMap, barrio);
      const markers = barrioPdrs.map((pdr) => {
        const marker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat: pdr.lat, lng: pdr.lng },
          title: `${pdr.name} (${barrio})`,
          content: createColoredPin(color),
        });
        marker.addEventListener("gmp-click", () => onSelect(pdr));
        return marker;
      });

      allMarkers.push(...markers);

      const clusterer = new MarkerClusterer({
        map,
        markers,
        renderer: createClusterRenderer(color, barrio),
      });
      clusterers.push(clusterer);
    }

    return () => {
      clusterers.forEach((c) => c.clearMarkers());
      allMarkers.forEach((m) => (m.map = null));
    };
  }, [map, pdrs, barrioColorMap, onSelect]);

  return null;
}

export function PdrMap({
  center,
  pdrs,
  height = 540,
}: {
  center: LatLng;
  pdrs: Pdr[];
  height?: number;
}) {
  const [selected, setSelected] = useState<Pdr | null>(null);

  const barrioColorMap = useMemo(
    () => buildBarrioColorMap(pdrs.map((p) => p.neighborhood)),
    [pdrs],
  );

  const legend = useMemo(
    () => Array.from(barrioColorMap.entries()),
    [barrioColorMap],
  );

  if (!API_KEY) {
    return <Typography color="error">{strings.newPdr.mapKeyMissing}</Typography>;
  }

  return (
    <Stack spacing={1}>
      <Box sx={{ width: "100%", height, borderRadius: 1, overflow: "hidden" }}>
        <APIProvider apiKey={API_KEY} libraries={["marker"]}>
          <Map
            defaultCenter={center}
            defaultZoom={13}
            gestureHandling="greedy"
            disableDefaultUI={false}
            mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"}
          >
            <BarrioClusteredMarkers
              pdrs={pdrs}
              barrioColorMap={barrioColorMap}
              onSelect={setSelected}
            />
            {selected && (
              <InfoWindow
                position={{ lat: selected.lat, lng: selected.lng }}
                onCloseClick={() => setSelected(null)}
              >
                <Stack spacing={0.5} sx={{ minWidth: 180 }}>
                  <Typography variant="subtitle2">{selected.name}</Typography>
                  <Typography variant="body2">
                    {strings.list.colCategory}: {selected.category}
                  </Typography>
                  <Typography variant="body2">
                    {selected.community} — {selected.neighborhood}
                  </Typography>
                  {selected.description && (
                    <Typography variant="body2" color="text.secondary">
                      {selected.description}
                    </Typography>
                  )}
                </Stack>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      </Box>

      {legend.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ flexWrap: "wrap", gap: 0.5 }}
        >
          {legend.map(([name, color]) => (
            <Chip
              key={name}
              label={name}
              size="small"
              sx={{
                backgroundColor: color,
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
