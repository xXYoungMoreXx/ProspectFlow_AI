"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  city: string;
  state: string;
  radiusKm: number;
}

// Brasília as default when city is not yet geocoded
const BRAZIL_CENTER: [number, number] = [-15.78, -47.93];

function zoomForRadius(km: number): number {
  return Math.max(7, Math.min(13, 13 - Math.floor(Math.log2(km))));
}

function MapController({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

export function ProspectingMap({ city, state, radiusKm }: Props) {
  const [coords, setCoords] = useState<[number, number]>(BRAZIL_CENTER);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (city.trim().length < 2) {
        setCoords(BRAZIL_CENTER);
        return;
      }

      try {
        const params = new URLSearchParams({
          city: city.trim(),
          country: "Brazil",
          format: "json",
          limit: "1",
        });
        if (state.length === 2) params.set("state", state);

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${params.toString()}`,
          {
            headers: {
              "Accept-Language": "pt-BR,pt;q=0.9",
              "User-Agent": "Hefesto/1.0",
            },
          },
        );
        if (!res.ok) return;
        const data = (await res.json()) as Array<{ lat: string; lon: string }>;
        if (data[0]) {
          setCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        }
      } catch {
        // Nominatim unreachable — keep current coords
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [city, state]);

  const zoom = zoomForRadius(radiusKm);

  return (
    <div className="rounded-lg overflow-hidden border border-border h-[240px] w-full">
      <MapContainer
        center={coords}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Circle
          center={coords}
          radius={radiusKm * 1000}
          pathOptions={{
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.12,
            weight: 2,
          }}
        />
        <MapController center={coords} zoom={zoom} />
      </MapContainer>
    </div>
  );
}
