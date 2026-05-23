import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { NeighborhoodData } from "@/lib/types";

const KV_KEY = "neighborhood";

export async function GET() {
  try {
    const data = await kv.get<NeighborhoodData>(KV_KEY);
    if (!data) {
      return NextResponse.json(null, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("KV read error:", e);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = (await req.json()) as NeighborhoodData;
    data.lastUpdated = new Date().toISOString();
    await kv.set(KV_KEY, data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("KV write error:", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
