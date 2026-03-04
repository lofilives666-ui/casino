import { NextResponse } from "next/server";
import { getThunderPlinkoConfig } from "@/lib/games/thunder-plinko";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rows = Number.parseInt(url.searchParams.get("rows") ?? "10", 10);
  const risk = url.searchParams.get("risk");
  const config = getThunderPlinkoConfig({ rows, risk });
  return NextResponse.json(config);
}

