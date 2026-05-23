import { NeighborhoodData, Neighbor } from "./types";

const STORAGE_KEY = "neighborname_data";

export function loadNeighborhood(): NeighborhoodData | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NeighborhoodData;
  } catch {
    return null;
  }
}

export async function loadOrSeedNeighborhood(): Promise<NeighborhoodData | null> {
  // 1. Try server first (source of truth)
  try {
    const res = await fetch("/api/data");
    if (res.ok) {
      const data = (await res.json()) as NeighborhoodData;
      if (data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch {
    // Server unavailable — fall through to local
  }

  // 2. Fall back to localStorage (offline support)
  const existing = loadNeighborhood();
  if (existing) return existing;

  // 3. Last resort: seed.json for first-time setup
  try {
    const res = await fetch("/seed.json");
    if (!res.ok) return null;
    const data = (await res.json()) as NeighborhoodData;
    saveNeighborhood(data);
    return data;
  } catch {
    return null;
  }
}

export function saveNeighborhood(data: NeighborhoodData): void {
  data.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  // Async sync to server — fire and forget
  fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).catch(() => {
    // Offline — localStorage has the data, server will get it next save
  });
}

export function updateNeighbor(
  parcelId: string,
  updates: Partial<Pick<Neighbor, "name" | "isOwner" | "notes" | "tags" | "met">>
): NeighborhoodData | null {
  const data = loadNeighborhood();
  if (!data) return null;

  const idx = data.neighbors.findIndex((n) => n.id === parcelId);
  if (idx === -1) return data;

  data.neighbors[idx] = { ...data.neighbors[idx], ...updates };
  saveNeighborhood(data);
  return data;
}

export function clearNeighborhood(): void {
  localStorage.removeItem(STORAGE_KEY);
}
