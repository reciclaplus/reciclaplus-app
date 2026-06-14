"use client";

import { useEffect, useState } from "react";
import {
  APIProvider,
  InfoWindow,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { strings } from "@/lib/strings";
import type { LatLng } from "@/components/MapPicker";
import type { Pdr } from "@/lib/types";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

/**
 * Imperatively renders clustered markers for the given PDRs and reports the
 * clicked PDR via onSelect. Uses the marker clusterer so dense areas collapse.
 */
function ClusteredMarkers({
  pdrs,
  onSelect,
}: {
  pdrs: Pdr[];
  onSelect: (pdr: Pdr) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const markers = pdrs.map((pdr) => {
      const marker = new google.maps.Marker({
        position: { lat: pdr.lat, lng: pdr.lng },
        title: pdr.name,
      });
      marker.addListener("click", () => onSelect(pdr));
      return marker;
    });
    const clusterer = new MarkerClusterer({ map, markers });
    return () => {
      clusterer.clearMarkers();
      markers.forEach((m) => m.setMap(null));
    };
  }, [map, pdrs, onSelect]);

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

  if (!API_KEY) {
    return <Typography color="error">{strings.newPdr.mapKeyMissing}</Typography>;
  }

  return (
    <Box sx={{ width: "100%", height, borderRadius: 1, overflow: "hidden" }}>
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI={false}
        >
          <ClusteredMarkers pdrs={pdrs} onSelect={setSelected} />
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
  );
}
