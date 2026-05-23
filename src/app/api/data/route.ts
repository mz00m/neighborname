import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { NeighborhoodData } from "@/lib/types";

const KV_KEY = "neighborhood";

function getRedis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function GET() {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return NextResponse.json(null, { status: 404 });
  }
  try {
    const redis = getRedis();
    const data = await redis.get<NeighborhoodData>(KV_KEY);
    if (!data) {
      return NextResponse.json(null, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("Redis read error:", e);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return NextResponse.json({ ok: true });
  }
  try {
    const redis = getRedis();
    const data = (await req.json()) as NeighborhoodData;
    data.lastUpdated = new Date().toISOString();
    await redis.set(KV_KEY, data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Redis write error:", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
