"use client";

import { Neighbor } from "@/lib/types";

interface NeighborListProps {
  neighbors: Neighbor[];
  onSelect: (id: string) => void;
}

export default function NeighborList({ neighbors, onSelect }: NeighborListProps) {
  const met = neighbors.filter((n) => n.met);
  const named = neighbors.filter((n) => !n.met && n.name);
  const unknown = neighbors.filter((n) => !n.met && !n.name);

  return (
    <div className="fixed inset-0 z-30 bg-stone-50 overflow-y-auto pt-14 pb-24">
      <div className="px-4 py-4 max-w-lg mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-semibold text-stone-900">
            Your Neighbors
          </h2>
          <p className="text-sm text-stone-500">
            {met.length} of {neighbors.length} met
          </p>
        </div>

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
          {(neighbor.phone || neighbor.email) && (
            <p className="text-xs text-stone-400 truncate">
              {neighbor.phone}{neighbor.phone && neighbor.email && " · "}{neighbor.email}
            </p>
          )}
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
