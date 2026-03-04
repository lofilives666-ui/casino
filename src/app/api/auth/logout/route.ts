import { NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out." }, { status: 200 });
  response.cookies.set({
    name: getSessionCookieName(),
    value: "",
    maxAge: 0,
    path: "/",
  });
  return response;
}
