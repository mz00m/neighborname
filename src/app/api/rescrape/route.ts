import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { NeighborhoodData } from "@/lib/types";
import { scrapeOwnerNames } from "@/lib/scraper";

function getSQL() {
  return neon(process.env.DATABASE_URL!);
}

export async function POST() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "No database configured" }, { status: 500 });
  }

  try {
    const sql = getSQL();
    const rows = await sql`SELECT data FROM neighborhood WHERE id = 'default'`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "No neighborhood data found" }, { status: 404 });
    }

    const data: NeighborhoodData =
      typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;

    const parcelIds = data.neighbors.map((n) => n.id);
    console.log(`Rescraping ${parcelIds.length} parcels...`);

    const ownerNames = await scrapeOwnerNames(parcelIds);
    let updated = 0;

    for (const neighbor of data.neighbors) {
      const newName = ownerNames.get(neighbor.id);
      if (newName && newName !== neighbor.name) {
        neighbor.name = newName;
        // Clear stale people array so derivePeople re-parses from updated name
        neighbor.people = undefined;
        updated++;
      }
    }

    data.lastUpdated = new Date().toISOString();
    const json = JSON.stringify(data);

    await sql`
      INSERT INTO neighborhood (id, data, updated_at)
      VALUES ('default', ${json}, NOW())
      ON CONFLICT (id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = NOW()
    `;

    return NextResponse.json({
      total: parcelIds.length,
      scraped: ownerNames.size,
      updated,
    });
  } catch (e) {
    console.error("Rescrape error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
