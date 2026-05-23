import { NextResponse } from "next/server";
import {
  geocodeAddress,
  lookupParcelMunicode,
  getStreetProperties,
  getParcelCentroids,
  geocodeBatch,
  assessmentToProperty,
} from "@/lib/wprdc";
import { Neighbor, NeighborhoodData } from "@/lib/types";
import { scrapeOwnerNames } from "@/lib/scraper";

function extractStreetName(address: string): string {
  const cleaned = address.toUpperCase().replace(/,/g, "");
  const match = cleaned.match(/^\d+\s+(.+?)(?:\s+(?:PITTSBURGH|PGH|PA|1\d{4}))/);
  if (match?.[1]) return match[1].trim();

  const parts = cleaned.split(/\s+/);
  const numIdx = parts.findIndex((p) => /^\d+$/.test(p));
  if (numIdx >= 0 && numIdx < parts.length - 1) {
    const rest = parts.slice(numIdx + 1);
    const cutoff = rest.findIndex((p) =>
      /^(PITTSBURGH|PGH|PA|APT|UNIT|#|\d{5})$/i.test(p)
    );
    return (cutoff > 0 ? rest.slice(0, cutoff) : rest).join(" ");
  }

  return parts.slice(1).join(" ");
}

export async function POST(req: Request) {
  try {
    const { address } = await req.json();
    if (!address) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    const geo = await geocodeAddress(address);
    if (!geo) {
      return NextResponse.json(
        { error: "Could not find that address in Allegheny County records" },
        { status: 404 }
      );
    }

    const municode = await lookupParcelMunicode(geo.parcelId);
    const streetName = extractStreetName(address);

    let assessments = await getStreetProperties(streetName, municode ?? undefined);

    if (assessments.length === 0) {
      const variations: Record<string, string> = {
        " RD": " ROAD",
        " ROAD": " RD",
        " ST": " STREET",
        " STREET": " ST",
        " AVE": " AVENUE",
        " AVENUE": " AVE",
        " DR": " DRIVE",
        " DRIVE": " DR",
        " CT": " COURT",
        " COURT": " CT",
        " LN": " LANE",
        " LANE": " LN",
      };
      for (const [from, to] of Object.entries(variations)) {
        if (streetName.endsWith(from)) {
          const alt = streetName.replace(new RegExp(from + "$"), to);
          assessments = await getStreetProperties(alt, municode ?? undefined);
          if (assessments.length > 0) break;
        }
      }
    }

    if (assessments.length === 0) {
      assessments = await getStreetProperties(streetName);
    }

    const seen = new Map<string, typeof assessments[0]>();
    for (const a of assessments) {
      const key = `${a.PROPERTYHOUSENUM}-${a.PROPERTYADDRESS}`;
      const existing = seen.get(key);
      if (!existing || (a.FINISHEDLIVINGAREA ?? 0) > (existing.FINISHEDLIVINGAREA ?? 0)) {
        seen.set(key, a);
      }
    }
    assessments = Array.from(seen.values());

    const parcelIds = assessments.map((a) => a.PARID);
    const coordsMap = await getParcelCentroids(parcelIds);

    const missing = assessments.filter((a) => !coordsMap.has(a.PARID));
    if (missing.length > 0 && missing.length <= 60) {
      const batchAddresses = missing.map((a) => ({
        parcelId: a.PARID,
        address: `${a.PROPERTYHOUSENUM} ${a.PROPERTYADDRESS} ${a.PROPERTYCITY || "Pittsburgh"} PA ${a.PROPERTYZIP || "15206"}`,
      }));
      const extraCoords = await geocodeBatch(batchAddresses);
      for (const [k, v] of extraCoords) {
        coordsMap.set(k, v);
      }
    }

    const ownerNames = await scrapeOwnerNames(parcelIds);

    const neighbors: Neighbor[] = assessments
      .filter((a) => a.PARID !== geo.parcelId)
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

    const myAssessment = assessments.find((a) => a.PARID === geo.parcelId);
    const myProperty = myAssessment
      ? assessmentToProperty(myAssessment, geo.lat, geo.lng)
      : null;

    const result: NeighborhoodData = {
      myAddress: address,
      myParcelId: geo.parcelId,
      center: [geo.lat, geo.lng],
      neighbors,
      setupAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({
      neighborhood: result,
      myProperty,
      meta: {
        street: streetName,
        neighborhood: geo.neighborhood,
        municipality: geo.municipality,
        municode,
        totalProperties: assessments.length,
        geocoded: coordsMap.size,
      },
    });
  } catch (e) {
    console.error("Setup error:", e);
    return NextResponse.json(
      { error: "Failed to look up property records" },
      { status: 500 }
    );
  }
}
