import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCsrfCookieName, getOrCreateCsrfToken } from "@/lib/csrf";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const { token, isNew } = getOrCreateCsrfToken(cookieStore);
  const response = NextResponse.json({ token });

  if (isNew) {
    response.cookies.set(getCsrfCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}

