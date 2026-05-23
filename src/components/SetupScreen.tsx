"use client";

import { useState } from "react";
import { NeighborhoodData } from "@/lib/types";

interface SetupScreenProps {
  onComplete: (data: NeighborhoodData) => void;
}

export default function SetupScreen({ onComplete }: SetupScreenProps) {
  const [address, setAddress] = useState("974 Wellesley Rd Pittsburgh PA 15206");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function handleSetup() {
    if (!address.trim()) return;
    setLoading(true);
    setError("");
    setStatus("Looking up your address in county records...");

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Setup failed");
      }

      setStatus("Building your neighborhood map...");
      const data = await res.json();

      if (data.neighborhood.neighbors.length === 0) {
        setError(
          "Found your address but no nearby properties. The county records may use a different street name format."
        );
        setLoading(false);
        return;
      }

      onComplete(data.neighborhood);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-stone-50">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 mb-2">
            Neighborname
          </h1>
          <p className="text-stone-500 text-base leading-relaxed">
            Learn and remember the names of everyone on your street. We pull
            from public county records to map your neighborhood — you add the
            names.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="address"
              className="block text-sm font-medium text-stone-700 mb-1.5"
            >
              Your address
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSetup()}
              placeholder="123 Main St Pittsburgh PA 15206"
              className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent text-base"
              disabled={loading}
            />
            <p className="mt-1.5 text-xs text-stone-400">
              Allegheny County, PA addresses only (for now)
            </p>
          </div>

          <button
            onClick={handleSetup}
            disabled={loading || !address.trim()}
            className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Finding neighbors..." : "Find My Neighbors"}
          </button>

          {loading && status && (
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <div className="h-4 w-4 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
              {status}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <p className="mt-8 text-xs text-stone-400 leading-relaxed">
          Data comes from Allegheny County public property records via WPRDC.
          Owner names are excluded by county ordinance — you add names yourself
          as you meet your neighbors.
        </p>
      </div>
    </div>
  );
}
