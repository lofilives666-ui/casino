import { NextResponse } from "next/server";
import { getGameService } from "@/lib/games/registry";

export const runtime = "nodejs";

type Params = { gameId: string };

export async function GET(request: Request, context: { params: Promise<Params> }) {
  const { gameId } = await context.params;
  const service = getGameService(gameId);
  if (!service) {
    return NextResponse.json({ message: "Game not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const rows = Number.parseInt(url.searchParams.get("rows") ?? "10", 10);
  const risk = url.searchParams.get("risk");

  const config = service.getConfig({ rows, risk });
  return NextResponse.json(config);
}

