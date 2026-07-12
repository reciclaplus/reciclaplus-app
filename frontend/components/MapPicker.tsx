"use client";

import { useEffect, useRef, useState } from "react";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import { strings } from "@/lib/strings";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

// Plain SVG data URL — avoids touching the `google.maps` namespace before
// the Maps script has finished loading.
const CURRENT_LOCATION_ICON =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">' +
      '<circle cx="10" cy="10" r="7" fill="#4285F4" stroke="#ffffff" stroke-width="3"/>' +
      "</svg>",
  );

export interface LatLng {
  lat: number;
  lng: number;
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
  const mapRef = useRef<google.maps.Map | null>(null);
  const [currentPos, setCurrentPos] = useState<LatLng | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) =>
        setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  if (!API_KEY) {
    return (
      <Typography color="error">{strings.newPdr.mapKeyMissing}</Typography>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        height,
        borderRadius: 1,
        overflow: "hidden",
        position: "relative",
      }}
    >
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
          <MapRefCapture mapRef={mapRef} />
          {value && <Marker position={value} />}
          {currentPos && (
            <Marker position={currentPos} icon={CURRENT_LOCATION_ICON} />
          )}
        </Map>
      </APIProvider>
      {currentPos && (
        <IconButton
          size="small"
          onClick={() => mapRef.current?.panTo(currentPos)}
          sx={{
            position: "absolute",
            bottom: 8,
            right: 8,
            bgcolor: "background.paper",
            boxShadow: 2,
            "&:hover": { bgcolor: "background.paper" },
          }}
        >
          <MyLocationIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
}
