"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

export type MapPin = { id: string; lat: number; lng: number; title: string; subtitle?: string; href?: string };

const pinHtml = (active = false) =>
  `<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${
    active ? "#0b1a36" : "#c9a227"
  };border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Read-only map of ad spaces. Leaflet needs the browser, so it loads inside useEffect.
export function SpacesMap({
  pins,
  center,
  zoom = 7,
  className = "h-96",
}: {
  pins: MapPin[];
  center: [number, number];
  zoom?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(pins.map((p) => [p.id, p.lat, p.lng]));

  useEffect(() => {
    let map: LeafletMap | undefined;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false }).setView(center, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const icon = L.divIcon({ className: "", html: pinHtml(pins.length === 1), iconSize: [22, 22], iconAnchor: [11, 22] });
      const markers = pins.map((p) => {
        const m = L.marker([p.lat, p.lng], { icon }).addTo(map!);
        const title = escapeHtml(p.title);
        const sub = p.subtitle ? `<br><span style="color:#64748b">${escapeHtml(p.subtitle)}</span>` : "";
        m.bindPopup(p.href ? `<a href="${p.href}" style="font-weight:600">${title}</a>${sub}` : `<b>${title}</b>${sub}`);
        return m;
      });
      if (markers.length > 1) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2), { maxZoom: 13 });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, center[0], center[1], zoom]);

  return <div ref={ref} className={`z-0 w-full overflow-hidden rounded-2xl border border-navy-100 ${className}`} />;
}
