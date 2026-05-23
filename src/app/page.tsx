"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { NeighborhoodData, Neighbor } from "@/lib/types";
import { loadNeighborhood, saveNeighborhood, clearNeighborhood } from "@/lib/storage";
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

  useEffect(() => {
    setData(loadNeighborhood());
    setLoaded(true);
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
  }, []);

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
        />

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
