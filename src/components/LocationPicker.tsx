"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";

const PIN =
  '<span style="display:block;width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#c9a227;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>';

// Click the map (or type coordinates) to set where the ad space is. Submits as `lat` and `lng`.
export function LocationPicker({
  lat,
  lng,
  fallback,
  labels,
}: {
  lat?: number | null;
  lng?: number | null;
  fallback: [number, number];
  labels: { hint: string; lat: string; lng: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const placeRef = useRef<((p: [number, number]) => void) | null>(null);
  const [pos, setPos] = useState<[number, number] | null>(lat != null && lng != null ? [lat, lng] : null);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !ref.current) return;
      const start = pos ?? fallback;
      const map = L.map(ref.current).setView(start, pos ? 14 : 8);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const icon = L.divIcon({ className: "", html: PIN, iconSize: [24, 24], iconAnchor: [12, 24] });
      const place = (p: [number, number]) => {
        if (markerRef.current) markerRef.current.setLatLng(p);
        else markerRef.current = L.marker(p, { icon }).addTo(map);
      };
      if (pos) place(pos);
      map.on("click", (e) => {
        const p: [number, number] = [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))];
        place(p);
        setPos(p);
      });
      mapRef.current = map;
      placeRef.current = place;
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typed = (i: 0 | 1, v: string) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    const next: [number, number] = i === 0 ? [n, pos?.[1] ?? fallback[1]] : [pos?.[0] ?? fallback[0], n];
    setPos(next);
    placeRef.current?.(next);
    mapRef.current?.panTo(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-navy-500">{labels.hint}</p>
      <div ref={ref} className="z-0 h-72 w-full overflow-hidden rounded-xl border border-navy-100" />
      <div className="grid grid-cols-2 gap-3 text-xs text-navy-500">
        <label>
          {labels.lat}
          <input
            name="lat"
            type="number"
            step="any"
            required
            value={pos?.[0] ?? ""}
            onChange={(e) => typed(0, e.target.value)}
            className="mt-1 w-full rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-900"
          />
        </label>
        <label>
          {labels.lng}
          <input
            name="lng"
            type="number"
            step="any"
            required
            value={pos?.[1] ?? ""}
            onChange={(e) => typed(1, e.target.value)}
            className="mt-1 w-full rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-900"
          />
        </label>
      </div>
    </div>
  );
}
