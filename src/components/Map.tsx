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
  onLocationUpdate?: (lat: number, lng: number) => void;
}

function markerColor(n: Neighbor): string {
  if (n.met && n.name) return "#059669"; // emerald-600
  if (n.name) return "#2563eb"; // blue-600
  return "#a8a29e"; // stone-400
}

function createMarkerIcon(color: string, isSelected: boolean, houseNumber: string) {
  const h = isSelected ? 22 : 18;
  const fontSize = isSelected ? 10 : 8;
  const pad = isSelected ? 6 : 4;
  const border = isSelected ? "2px solid #1c1917" : "1.5px solid white";
  const shadow = isSelected ? "0 0 0 1px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.25)";
  const minW = h;
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    iconAnchor: [0, h / 2],
    html: `<div style="display:inline-flex;align-items:center;justify-content:center;height:${h}px;min-width:${minW}px;padding:0 ${pad}px;border-radius:${h}px;background:${color};border:${border};box-shadow:${shadow};color:white;font-size:${fontSize}px;font-weight:600;font-family:system-ui,sans-serif;white-space:nowrap;transform:translateX(-50%);transition:all 0.15s ease">${houseNumber}</div>`,
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
  onLocationUpdate,
}: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const locationMarkerRef = useRef<L.CircleMarker | null>(null);
  const locationCircleRef = useRef<L.Circle | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const handleSelect = useCallback(onSelect, [onSelect]);
  const handleSelectHome = useCallback(onSelectHome, [onSelectHome]);

  const startTracking = useCallback((autoZoom = true) => {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) return;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const latlng: L.LatLngExpression = [lat, lng];

        if (!locationMarkerRef.current) {
          locationMarkerRef.current = L.circleMarker(latlng, {
            radius: 8,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            color: "white",
            weight: 3,
          }).addTo(map);
          locationCircleRef.current = L.circle(latlng, {
            radius: accuracy,
            fillColor: "#3b82f6",
            fillOpacity: 0.1,
            color: "#3b82f6",
            weight: 1,
            opacity: 0.3,
          }).addTo(map);
          if (autoZoom) map.setView(latlng, 18);
        } else {
          locationMarkerRef.current.setLatLng(latlng);
          locationCircleRef.current?.setLatLng(latlng);
          locationCircleRef.current?.setRadius(accuracy);
        }

        onLocationUpdate?.(lat, lng);
      },
      undefined,
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }, [onLocationUpdate]);

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
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, [center, handleSelect, handleSelectHome]);

  // Auto-start location tracking without zooming away from neighborhood
  useEffect(() => {
    if (mapRef.current) startTracking(false);
  }, [startTracking]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existing = new Set(Object.keys(markersRef.current));
    existing.delete("__home__");

    for (const n of neighbors) {
      if (n.id === myParcelId) continue;

      const color = markerColor(n);
      const isSelected = n.id === selectedId;
      const icon = createMarkerIcon(color, isSelected, n.property.houseNumber);

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

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <button
        onClick={() => startTracking(true)}
        className="absolute bottom-4 right-4 z-10 w-10 h-10 bg-white rounded-full shadow-md border border-stone-200 flex items-center justify-center hover:bg-stone-50 transition-colors"
        title="Show my location"
      >
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  );
}
