"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Neighbor } from "@/lib/types";

interface MapProps {
  center: [number, number];
  neighbors: Neighbor[];
  myParcelId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSelectHome: () => void;
}

function markerColor(n: Neighbor): string {
  if (n.met && n.name) return "#059669"; // emerald-600
  if (n.name) return "#2563eb"; // blue-600
  return "#a8a29e"; // stone-400
}

function createMarkerIcon(color: string, size: number, isSelected: boolean) {
  const border = isSelected ? "3px solid #1c1917" : "2px solid white";
  const shadow = isSelected ? "0 0 0 2px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.3)";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${border};box-shadow:${shadow};transition:all 0.15s ease"></div>`,
  });
}

function createHomeIcon(isSelected: boolean) {
  const size = isSelected ? 40 : 34;
  const border = isSelected ? "3px solid #1c1917" : "2px solid white";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#d97706;border:${border};box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;transition:all 0.15s ease">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"/>
      </svg>
    </div>`,
  });
}

export default function Map({
  center,
  neighbors,
  myParcelId,
  selectedId,
  onSelect,
  onSelectHome,
}: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(onSelect, [onSelect]);
  const handleSelectHome = useCallback(onSelectHome, [onSelectHome]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);
    L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

    const homeMarker = L.marker(center, {
      icon: createHomeIcon(false),
      zIndexOffset: 1000,
    }).addTo(map);

    homeMarker.on("click", () => handleSelectHome());
    markersRef.current["__home__"] = homeMarker;

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, [center, handleSelect, handleSelectHome]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existing = new Set(Object.keys(markersRef.current));
    existing.delete("__home__");

    for (const n of neighbors) {
      if (n.id === myParcelId) continue;

      const color = markerColor(n);
      const isSelected = n.id === selectedId;
      const size = isSelected ? 28 : 20;
      const icon = createMarkerIcon(color, size, isSelected);

      if (markersRef.current[n.id]) {
        const marker = markersRef.current[n.id];
        marker.setIcon(icon);
        marker.setZIndexOffset(isSelected ? 500 : 0);
        marker.unbindTooltip();
        if (n.name) {
          marker.bindTooltip(n.name, {
            permanent: false,
            direction: "top",
            offset: [0, -12],
            className: "neighbor-tooltip",
          });
        }
        existing.delete(n.id);
      } else {
        const marker = L.marker([n.property.lat, n.property.lng], {
          icon,
          zIndexOffset: isSelected ? 500 : 0,
        }).addTo(map);

        if (n.name) {
          marker.bindTooltip(n.name, {
            permanent: false,
            direction: "top",
            offset: [0, -12],
            className: "neighbor-tooltip",
          });
        }

        marker.on("click", () => handleSelect(n.id));
        markersRef.current[n.id] = marker;
      }
    }

    for (const id of existing) {
      markersRef.current[id]?.remove();
      delete markersRef.current[id];
    }

    if (markersRef.current["__home__"]) {
      markersRef.current["__home__"].setIcon(
        createHomeIcon(selectedId === "__home__")
      );
    }
  }, [neighbors, selectedId, myParcelId, handleSelect]);

  return <div ref={containerRef} className="w-full h-full" />;
}
