import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGameService } from "@/lib/games/registry";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";

type Params = { gameId: string };

export async function GET(_request: Request, context: { params: Promise<Params> }) {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { gameId } = await context.params;
  const service = getGameService(gameId);
  if (!service) {
    return NextResponse.json({ message: "Game not found." }, { status: 404 });
  }

  try {
    const state = await service.getState(session.userId);
    return NextResponse.json(state);
  } catch (error) {
    console.error(`${gameId} state error:`, error);
    return NextResponse.json({ message: "Unable to load game state." }, { status: 500 });
  }
}

