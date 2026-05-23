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

export function saveNeighborhood(data: NeighborhoodData): void {
  data.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
