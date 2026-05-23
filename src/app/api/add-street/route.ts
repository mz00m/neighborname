import { NextResponse } from "next/server";
import {
  getStreetProperties,
  getParcelCentroids,
  geocodeBatch,
  assessmentToProperty,
} from "@/lib/wprdc";
import { scrapeOwnerNames } from "@/lib/scraper";
import { Neighbor } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const { streetName, municode, existingParcelIds, center } = await req.json();
    if (!streetName) {
      return NextResponse.json({ error: "Street name is required" }, { status: 400 });
    }

    const normalized = streetName.toUpperCase().trim();
    const code = municode || "111";

    let assessments = await getStreetProperties(normalized, code);

    if (assessments.length === 0) {
      const variations: Record<string, string> = {
        " RD": " ROAD", " ROAD": " RD",
        " ST": " STREET", " STREET": " ST",
        " AVE": " AVENUE", " AVENUE": " AVE",
        " DR": " DRIVE", " DRIVE": " DR",
        " CT": " COURT", " COURT": " CT",
        " LN": " LANE", " LANE": " LN",
      };
      for (const [from, to] of Object.entries(variations)) {
        if (normalized.endsWith(from)) {
          const alt = normalized.replace(new RegExp(from + "$"), to);
          assessments = await getStreetProperties(alt, code);
          if (assessments.length > 0) break;
        }
      }
    }

    if (assessments.length === 0) {
      assessments = await getStreetProperties(normalized);
    }

    if (assessments.length === 0) {
      return NextResponse.json(
        { error: `No properties found for "${streetName}" in this municipality` },
        { status: 404 }
      );
    }

    const existing = new Set(existingParcelIds || []);
    const seen = new Map<string, typeof assessments[0]>();
    for (const a of assessments) {
      if (existing.has(a.PARID)) continue;
      const key = `${a.PROPERTYHOUSENUM}-${a.PROPERTYADDRESS}`;
      const prev = seen.get(key);
      if (!prev || (a.FINISHEDLIVINGAREA ?? 0) > (prev.FINISHEDLIVINGAREA ?? 0)) {
        seen.set(key, a);
      }
    }
    const newAssessments = Array.from(seen.values());

    const parcelIds = newAssessments.map((a) => a.PARID);
    const coordsMap = await getParcelCentroids(parcelIds);

    const missing = newAssessments.filter((a) => !coordsMap.has(a.PARID));
    if (missing.length > 0 && missing.length <= 200) {
      const batchAddresses = missing.map((a) => ({
        parcelId: a.PARID,
        address: `${a.PROPERTYHOUSENUM} ${a.PROPERTYADDRESS} ${a.PROPERTYCITY || "Pittsburgh"} PA ${a.PROPERTYZIP || "15206"}`,
      }));
      const extraCoords = await geocodeBatch(batchAddresses);
      for (const [k, v] of extraCoords) {
        coordsMap.set(k, v);
      }
    }

    // Filter to properties within ~800m of the user's neighborhood center
    let nearbyAssessments = newAssessments;
    if (center && center.length === 2) {
      const [cLat, cLng] = center;
      nearbyAssessments = newAssessments.filter((a) => {
        const coords = coordsMap.get(a.PARID);
        if (!coords) return false;
        const dLat = ((coords[0] - cLat) * Math.PI) / 180;
        const dLng = ((coords[1] - cLng) * Math.PI) / 180;
        const sin2 =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((cLat * Math.PI) / 180) *
            Math.cos((coords[0] * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const meters = 6371000 * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
        return meters <= 800;
      });
    }

    const nearbyParcelIds = nearbyAssessments.map((a) => a.PARID);
    const ownerNames = await scrapeOwnerNames(nearbyParcelIds);

    const neighbors: Neighbor[] = nearbyAssessments
      .filter((a) => coordsMap.has(a.PARID))
      .map((a) => {
        const coords = coordsMap.get(a.PARID)!;
        const ownerName = ownerNames.get(a.PARID) ?? "";
        return {
          id: a.PARID,
          property: assessmentToProperty(a, coords[0], coords[1]),
          name: ownerName,
          isOwner: ownerName ? true : null,
          notes: "",
          tags: [],
          met: false,
          addedAt: new Date().toISOString(),
        };
      });

    return NextResponse.json({
      neighbors,
      meta: {
        street: normalized,
        totalFound: assessments.length,
        newAdded: neighbors.length,
        skippedExisting: assessments.length - newAssessments.length,
      },
    });
  } catch (e) {
    console.error("Add street error:", e);
    return NextResponse.json(
      { error: "Failed to look up street" },
      { status: 500 }
    );
  }
}
