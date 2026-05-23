"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { NeighborhoodData, Neighbor } from "@/lib/types";
import { loadOrSeedNeighborhood, saveNeighborhood, clearNeighborhood } from "@/lib/storage";
import SetupScreen from "@/components/SetupScreen";
import NeighborSheet from "@/components/NeighborSheet";
import NeighborList from "@/components/NeighborList";
import AddStreetDialog from "@/components/AddStreetDialog";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

export default function Home() {
  const [data, setData] = useState<NeighborhoodData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [showHome, setShowHome] = useState(false);
  const [showAddStreet, setShowAddStreet] = useState(false);
  const [addStreetLoading, setAddStreetLoading] = useState(false);
  const [addStreetError, setAddStreetError] = useState("");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    loadOrSeedNeighborhood().then((d) => {
      setData(d);
      setLoaded(true);
    });
  }, []);

  const handleSetupComplete = useCallback((neighborhood: NeighborhoodData) => {
    saveNeighborhood(neighborhood);
    setData(neighborhood);
  }, []);

  const handleSaveNeighbor = useCallback(
    (id: string, updates: Partial<Neighbor>) => {
      if (!data) return;
      const idx = data.neighbors.findIndex((n) => n.id === id);
      if (idx === -1) return;
      const updated = { ...data };
      updated.neighbors = [...data.neighbors];
      updated.neighbors[idx] = { ...data.neighbors[idx], ...updates };
      saveNeighborhood(updated);
      setData(updated);
    },
    [data]
  );

  const handleAddStreet = useCallback(
    async (streetName: string) => {
      if (!data) return;
      setAddStreetLoading(true);
      setAddStreetError("");

      try {
        const res = await fetch("/api/add-street", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            streetName,
            municode: "111",
            existingParcelIds: data.neighbors.map((n) => n.id),
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to add street");
        }

        const result = await res.json();
        if (result.neighbors.length === 0) {
          setAddStreetError("No new properties found on that street.");
          setAddStreetLoading(false);
          return;
        }

        const updated = { ...data };
        updated.neighbors = [...data.neighbors, ...result.neighbors];
        saveNeighborhood(updated);
        setData(updated);
        setShowAddStreet(false);
      } catch (e) {
        setAddStreetError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setAddStreetLoading(false);
      }
    },
    [data]
  );

  const handleReset = useCallback(() => {
    clearNeighborhood();
    setData(null);
    setSelectedId(null);
    setShowList(false);
    setUserLocation(null);
  }, []);

  const handleLocationUpdate = useCallback((lat: number, lng: number) => {
    setUserLocation([lat, lng]);
  }, []);

  const handleExport = useCallback(() => {
    if (!data) return;
    const headers = ["Name", "Address", "Phone", "Email", "Owner/Renter", "Met", "Notes"];
    const rows = data.neighbors
      .sort((a, b) => {
        const streetCmp = a.property.street.localeCompare(b.property.street);
        if (streetCmp !== 0) return streetCmp;
        return parseInt(a.property.houseNumber) - parseInt(b.property.houseNumber);
      })
      .map((n) => [
        n.name || "",
        `${n.property.houseNumber} ${n.property.street}`,
        n.phone || "",
        n.email || "",
        n.isOwner === true ? "Owner" : n.isOwner === false ? "Renter" : "",
        n.met ? "Yes" : "No",
        n.notes || "",
      ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "neighbors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  if (!loaded) return null;

  if (!data) {
    return <SetupScreen onComplete={handleSetupComplete} />;
  }

  const selectedNeighbor = selectedId
    ? data.neighbors.find((n) => n.id === selectedId) ?? null
    : null;

  const homeNeighbor = showHome
    ? {
        id: data.myParcelId,
        property: {
          parcelId: data.myParcelId,
          houseNumber: data.myAddress.split(" ")[0],
          street: data.myAddress.split(" ").slice(1).join(" "),
          city: "Pittsburgh",
          zip: "",
          fullAddress: data.myAddress,
          lat: data.center[0],
          lng: data.center[1],
        },
        name: "You",
        isOwner: null,
        notes: "",
        tags: [],
        met: true,
        addedAt: data.setupAt,
      }
    : null;

  const metCount = data.neighbors.filter((n) => n.met).length;
  const totalCount = data.neighbors.length;

  function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const nearbyNeighbors = userLocation
    ? data.neighbors
        .map((n) => ({
          ...n,
          distance: distanceMeters(
            userLocation[0],
            userLocation[1],
            n.property.lat,
            n.property.lng
          ),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 4)
    : [];

  return (
    <div className="h-dvh flex flex-col">
      <header className="bg-white/90 backdrop-blur-sm border-b border-stone-200 px-4 py-2.5 flex items-center justify-between z-40 relative">
        <div>
          <h1 className="text-sm font-semibold text-stone-900 tracking-tight">
            Neighborname
          </h1>
          <p className="text-xs text-stone-500">
            {metCount}/{totalCount} neighbors met
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setShowAddStreet(true);
              setShowList(false);
            }}
            className="p-2 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors"
            title="Add a street"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={handleExport}
            className="p-2 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors"
            title="Export CSV"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            onClick={() => setShowList(!showList)}
            className={`p-2 rounded-lg transition-colors ${
              showList
                ? "bg-stone-900 text-white"
                : "text-stone-600 hover:bg-stone-100"
            }`}
            title={showList ? "Show map" : "Show list"}
          >
            {showList ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            )}
          </button>
          <button
            onClick={handleReset}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            title="Reset"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 relative">
        <Map
          center={data.center}
          neighbors={data.neighbors}
          myParcelId={data.myParcelId}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setShowHome(false);
            setShowList(false);
          }}
          onSelectHome={() => {
            setShowHome(true);
            setSelectedId(null);
            setShowList(false);
          }}
          onLocationUpdate={handleLocationUpdate}
        />

        {nearbyNeighbors.length > 0 ? (
          <div className="absolute bottom-4 left-4 right-16 bg-white/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg border border-stone-200 z-10">
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
              Nearest to you
            </p>
            <div className="space-y-2">
              {nearbyNeighbors.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setSelectedId(n.id);
                    setShowHome(false);
                    setShowList(false);
                  }}
                  className="w-full flex items-center gap-2.5 text-left"
                >
                  {n.photo ? (
                    <img src={n.photo} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                      n.met ? "bg-emerald-100 text-emerald-700" : n.name ? "bg-blue-100 text-blue-700" : "bg-stone-100 text-stone-400"
                    }`}>
                      {n.name ? n.name[0].toUpperCase() : "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">
                      {n.name || "Unknown"}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {n.property.houseNumber} {n.property.street} · {Math.round(n.distance)}m
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-stone-200 z-10">
            <div className="flex items-center gap-3 text-xs text-stone-600">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                You
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                Met
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                Named
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-stone-400" />
                Unknown
              </span>
            </div>
          </div>
        )}
      </div>

      {showList && (
        <NeighborList
          neighbors={data.neighbors}
          onSelect={(id) => {
            setSelectedId(id);
            setShowList(false);
            setShowHome(false);
          }}
        />
      )}

      <NeighborSheet
        neighbor={selectedNeighbor}
        onClose={() => setSelectedId(null)}
        onSave={handleSaveNeighbor}
      />

      {showHome && homeNeighbor && (
        <NeighborSheet
          neighbor={homeNeighbor as Neighbor}
          isHome
          onClose={() => setShowHome(false)}
          onSave={() => {}}
        />
      )}

      <AddStreetDialog
        open={showAddStreet}
        onClose={() => {
          setShowAddStreet(false);
          setAddStreetError("");
        }}
        onAdd={handleAddStreet}
        loading={addStreetLoading}
        error={addStreetError}
      />
    </div>
  );
}
