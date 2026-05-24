"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Neighbor } from "@/lib/types";

interface NeighborListProps {
  neighbors: Neighbor[];
  onSelect: (id: string) => void;
}

function matchesSearch(n: Neighbor, q: string): boolean {
  const lower = q.toLowerCase();
  if (n.name?.toLowerCase().includes(lower)) return true;
  if (`${n.property.houseNumber} ${n.property.street}`.toLowerCase().includes(lower)) return true;
  if (n.notes?.toLowerCase().includes(lower)) return true;
  if (n.kids?.toLowerCase().includes(lower)) return true;
  if (n.pets?.toLowerCase().includes(lower)) return true;
  if (n.people?.some((p) =>
    p.name?.toLowerCase().includes(lower) ||
    p.profession?.toLowerCase().includes(lower) ||
    p.email?.toLowerCase().includes(lower) ||
    p.phone?.toLowerCase().includes(lower)
  )) return true;
  return false;
}

export default function NeighborList({ neighbors, onSelect }: NeighborListProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => (query.trim() ? neighbors.filter((n) => matchesSearch(n, query.trim())) : neighbors),
    [neighbors, query]
  );

  const met = filtered.filter((n) => n.met);
  const named = filtered.filter((n) => !n.met && n.name);
  const unknown = filtered.filter((n) => !n.met && !n.name);

  const totalMet = neighbors.filter((n) => n.met).length;

  return (
    <div className="fixed inset-0 z-30 bg-stone-50 overflow-y-auto pt-14 pb-24">
      <div className="px-4 py-4 max-w-lg mx-auto">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xl font-semibold text-stone-900">
            Your Neighbors
          </h2>
          <p className="text-sm text-stone-500">
            {totalMet} of {neighbors.length} met
          </p>
        </div>

        <div className="relative mb-4">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, address, profession..."
            className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-8 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {query.trim() && filtered.length === 0 && (
          <p className="text-center text-sm text-stone-400 py-8">
            No neighbors match &ldquo;{query.trim()}&rdquo;
          </p>
        )}

        {met.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
              People you know
            </p>
            <div className="space-y-2">
              {met.map((n) => (
                <NeighborRow key={n.id} neighbor={n} onSelect={onSelect} />
              ))}
            </div>
          </div>
        )}

        {named.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
              From county records
            </p>
            <div className="space-y-2">
              {named.map((n) => (
                <NeighborRow key={n.id} neighbor={n} onSelect={onSelect} />
              ))}
            </div>
          </div>
        )}

        {unknown.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
              No owner on file
            </p>
            <div className="space-y-2">
              {unknown.map((n) => (
                <NeighborRow key={n.id} neighbor={n} onSelect={onSelect} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NeighborRow({
  neighbor,
  onSelect,
}: {
  neighbor: Neighbor;
  onSelect: (id: string) => void;
}) {
  const { property } = neighbor;

  return (
    <button
      onClick={() => onSelect(neighbor.id)}
      className="w-full text-left bg-white rounded-xl px-4 py-3 border border-stone-200 hover:border-stone-300 transition-colors"
    >
      <div className="flex items-center gap-3">
        {neighbor.photo ? (
          <img
            src={neighbor.photo}
            alt=""
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
              neighbor.met
                ? "bg-emerald-100 text-emerald-700"
                : neighbor.name
                  ? "bg-blue-100 text-blue-700"
                  : "bg-stone-100 text-stone-400"
            }`}
          >
            {neighbor.name ? neighbor.name[0].toUpperCase() : "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-900 truncate">
            {neighbor.name || "Unknown neighbor"}
          </p>
          <p className="text-xs text-stone-500">
            {property.houseNumber} {property.street}
            {neighbor.isOwner === true && " · Owner"}
            {neighbor.isOwner === false && " · Renter"}
          </p>
          {(() => {
            const profs = (neighbor.people || [])
              .map((p) => p.profession?.split(";")[0]?.trim())
              .filter(Boolean);
            return profs.length > 0 ? (
              <p className="text-xs text-stone-400 truncate">
                {profs.join(" · ")}
              </p>
            ) : null;
          })()}
          {(() => {
            const contacts = neighbor.people
              ? neighbor.people.flatMap((p) =>
                  [p.phone, p.email].filter(Boolean)
                )
              : [neighbor.phone, neighbor.email].filter(Boolean);
            return contacts.length > 0 ? (
              <p className="text-xs text-stone-400 truncate">
                {contacts.join(" · ")}
              </p>
            ) : null;
          })()}
        </div>
        {neighbor.notes && (
          <svg
            className="w-4 h-4 text-stone-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
            />
          </svg>
        )}
      </div>
    </button>
  );
}
