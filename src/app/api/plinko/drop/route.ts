import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { playThunderPlinko, type PlinkoDropPayload } from "@/lib/games/thunder-plinko";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as PlinkoDropPayload;
    const outcome = await playThunderPlinko(session.userId, payload);
    return NextResponse.json(outcome);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_BET") {
      return NextResponse.json({ message: "Invalid bet amount." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ message: "Insufficient balance." }, { status: 400 });
    }

    console.error("Plinko drop error:", error);
    const message =
      process.env.NODE_ENV === "production"
        ? "Unable to process drop."
        : `Unable to process drop. ${error instanceof Error ? error.message : "Unknown error."}`;
    return NextResponse.json({ message }, { status: 500 });
  }
}

