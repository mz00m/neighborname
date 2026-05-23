import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { NeighborhoodData } from "@/lib/types";

function getSQL() {
  return neon(process.env.DATABASE_URL!);
}

async function ensureTable() {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS neighborhood (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(null, { status: 404 });
  }
  try {
    await ensureTable();
    const sql = getSQL();
    const rows = await sql`SELECT data FROM neighborhood WHERE id = 'default'`;
    if (rows.length === 0) {
      return NextResponse.json(null, { status: 404 });
    }
    const data = typeof rows[0].data === "string"
      ? JSON.parse(rows[0].data)
      : rows[0].data;
    return NextResponse.json(data);
  } catch (e) {
    console.error("DB read error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true });
  }
  try {
    await ensureTable();
    const sql = getSQL();
    const data = (await req.json()) as NeighborhoodData;
    data.lastUpdated = new Date().toISOString();
    const json = JSON.stringify(data);

    await sql`
      INSERT INTO neighborhood (id, data, updated_at)
      VALUES ('default', ${json}, NOW())
      ON CONFLICT (id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DB write error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
