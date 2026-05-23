import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { NeighborhoodData } from "@/lib/types";

function getSQL() {
  return neon(process.env.DATABASE_URL!);
}

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(null, { status: 404 });
  }
  try {
    const sql = getSQL();
    const rows = await sql`SELECT data FROM neighborhood WHERE id = 'default'`;
    if (rows.length === 0) {
      return NextResponse.json(null, { status: 404 });
    }
    return NextResponse.json(rows[0].data);
  } catch (e) {
    console.error("DB read error:", e);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true });
  }
  try {
    const sql = getSQL();
    const data = (await req.json()) as NeighborhoodData;
    data.lastUpdated = new Date().toISOString();
    const json = JSON.stringify(data);

    await sql`
      CREATE TABLE IF NOT EXISTS neighborhood (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      INSERT INTO neighborhood (id, data, updated_at)
      VALUES ('default', ${json}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
        SET data = ${json}::jsonb, updated_at = NOW()
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DB write error:", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
