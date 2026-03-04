import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getThunderPlinkoHistory } from "@/lib/games/thunder-plinko";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const history = await getThunderPlinkoHistory(session.userId);
    return NextResponse.json(history);
  } catch (error) {
    console.error("Plinko history error:", error);
    return NextResponse.json({ message: "Unable to load history." }, { status: 500 });
  }
}

