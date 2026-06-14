"use client";

import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { strings } from "@/lib/strings";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Click-to-place coordinate picker. Centers on the town's map center and
 * reports the selected point back via `onChange`. Reused (read-only variant)
 * by the map page later.
 */
export function MapPicker({
  center,
  value,
  onChange,
  height = 320,
}: {
  center: LatLng;
  value: LatLng | null;
  onChange: (point: LatLng) => void;
  height?: number;
}) {
  if (!API_KEY) {
    return (
      <Typography color="error">{strings.newPdr.mapKeyMissing}</Typography>
    );
  }

  return (
    <Box sx={{ width: "100%", height, borderRadius: 1, overflow: "hidden" }}>
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={value ?? center}
          defaultZoom={14}
          gestureHandling="greedy"
          disableDefaultUI={false}
          onClick={(e) => {
            const pos = e.detail.latLng;
            if (pos) onChange({ lat: pos.lat, lng: pos.lng });
          }}
        >
          {value && <Marker position={value} />}
        </Map>
      </APIProvider>
    </Box>
  );
}
