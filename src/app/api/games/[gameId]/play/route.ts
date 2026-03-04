import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGameService } from "@/lib/games/registry";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type Params = { gameId: string };

export async function POST(request: Request, context: { params: Promise<Params> }) {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const limiter = checkRateLimit({
    key: `games:play:${session.userId}`,
    limit: 240,
    windowMs: 60 * 1000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { message: `Rate limit reached. Retry in ${limiter.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  const { gameId } = await context.params;
  const service = getGameService(gameId);
  if (!service) {
    return NextResponse.json({ message: "Game not found." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await service.play(session.userId, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_BET") {
      return NextResponse.json({ message: "Invalid bet amount." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ message: "Insufficient balance." }, { status: 400 });
    }

    console.error(`${gameId} play error:`, error);
    const message =
      process.env.NODE_ENV === "production"
        ? "Unable to process play."
        : `Unable to process play. ${error instanceof Error ? error.message : "Unknown error."}`;
    return NextResponse.json({ message }, { status: 500 });
  }
}
