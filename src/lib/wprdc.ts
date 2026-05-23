import { GeocodeResult, WPRDCAssessment, Property } from "./types";

const ASSESSMENTS_RESOURCE = "65855e14-549e-4992-b5be-d629afc676fa";
const CENTROIDS_RESOURCE = "3fab7152-3f11-4788-8372-4c33f86ea813";

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const url = `https://tools.wprdc.org/geo/geocode/?addr=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const json = await res.json();
  const data = json?.data;
  if (!data?.parcel_id || data?.status !== "OK") return null;

  const coords = data.geom?.coordinates;
  if (!coords || coords.length < 2) return null;

  return {
    parcelId: data.parcel_id,
    lat: coords[1],
    lng: coords[0],
    neighborhood: data.regions?.pittsburgh_neighborhood?.name,
    municipality: data.regions?.allegheny_county_municipality?.name,
    municode: data.regions?.allegheny_county_municipality?.id,
  };
}

export async function lookupParcelMunicode(parcelId: string): Promise<string | null> {
  const sql = `SELECT "MUNICODE" FROM "${ASSESSMENTS_RESOURCE}" WHERE "PARID" = '${parcelId}' LIMIT 1`;
  const url = `https://data.wprdc.org/api/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.result?.records?.[0]?.MUNICODE ?? null;
}

export async function getStreetProperties(
  streetName: string,
  municode?: string
): Promise<WPRDCAssessment[]> {
  let sql: string;
  if (municode) {
    sql = `SELECT * FROM "${ASSESSMENTS_RESOURCE}" WHERE "PROPERTYADDRESS" = '${streetName}' AND "MUNICODE" = '${municode}'`;
  } else {
    sql = `SELECT * FROM "${ASSESSMENTS_RESOURCE}" WHERE "PROPERTYADDRESS" = '${streetName}' LIMIT 200`;
  }
  const url = `https://data.wprdc.org/api/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const records = (data?.result?.records ?? []) as WPRDCAssessment[];
  records.sort((a, b) => parseInt(a.PROPERTYHOUSENUM) - parseInt(b.PROPERTYHOUSENUM));
  return records;
}

export async function getParcelCentroids(
  parcelIds: string[]
): Promise<Map<string, [number, number]>> {
  const coords = new Map<string, [number, number]>();
  if (parcelIds.length === 0) return coords;

  const batchSize = 50;
  for (let i = 0; i < parcelIds.length; i += batchSize) {
    const batch = parcelIds.slice(i, i + batchSize);
    const inClause = batch.map((id) => `'${id}'`).join(",");
    const sql = `SELECT "PIN", "LATITUDE", "LONGITUDE" FROM "${CENTROIDS_RESOURCE}" WHERE "PIN" IN (${inClause})`;
    const url = `https://data.wprdc.org/api/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`;

    try {
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const records = data?.result?.records ?? [];

      for (const r of records) {
        const lat = parseFloat(r.LATITUDE);
        const lng = parseFloat(r.LONGITUDE);
        if (!isNaN(lat) && !isNaN(lng)) {
          coords.set(r.PIN, [lat, lng]);
        }
      }
    } catch {
      // continue to next batch
    }
  }

  return coords;
}

async function geocodeSingle(address: string): Promise<[number, number] | null> {
  try {
    const result = await geocodeAddress(address);
    if (result?.lat && result?.lng) return [result.lat, result.lng];
  } catch {
    // Individual geocode failed
  }
  return null;
}

export async function geocodeBatch(
  addresses: { parcelId: string; address: string }[]
): Promise<Map<string, [number, number]>> {
  const coords = new Map<string, [number, number]>();

  const batchSize = 5;
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async ({ parcelId, address }) => {
        const result = await geocodeSingle(address);
        if (result) coords.set(parcelId, result);
      })
    );
    if (i + batchSize < addresses.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return coords;
}

export function assessmentToProperty(
  a: WPRDCAssessment,
  lat: number,
  lng: number
): Property {
  return {
    parcelId: a.PARID,
    houseNumber: a.PROPERTYHOUSENUM?.trim(),
    street: a.PROPERTYADDRESS?.trim(),
    city: a.PROPERTYCITY?.trim() || "Pittsburgh",
    zip: a.PROPERTYZIP?.trim() || "",
    fullAddress: `${a.PROPERTYHOUSENUM?.trim()} ${a.PROPERTYADDRESS?.trim()}`,
    lat,
    lng,
    yearBuilt: a.YEARBLT ?? undefined,
    style: a.STYLEDESC?.trim() ?? undefined,
    bedrooms: a.BEDROOMS ?? undefined,
    bathrooms: (a.FULLBATHS ?? 0) + (a.HALFBATHS ?? 0) * 0.5 || undefined,
    stories: a.STORIES?.trim() ?? undefined,
    livingArea: a.FINISHEDLIVINGAREA ?? undefined,
    lotArea: a.LOTAREA ?? undefined,
    lastSalePrice: a.SALEPRICE ?? undefined,
    lastSaleDate: a.SALEDATE?.trim() ?? undefined,
    propertyClass: a.CLASSDESC?.trim() ?? undefined,
    condition: a.CONDITIONDESC?.trim() ?? undefined,
  };
}
