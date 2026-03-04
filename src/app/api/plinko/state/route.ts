import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getThunderPlinkoState } from "@/lib/games/thunder-plinko";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const state = await getThunderPlinkoState(session.userId);
    return NextResponse.json(state);
  } catch (error) {
    console.error("Plinko state error:", error);
    return NextResponse.json({ message: "Unable to load game state." }, { status: 500 });
  }
}

