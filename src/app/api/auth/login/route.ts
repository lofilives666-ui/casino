import { NextResponse } from "next/server";
import { normalizeEmail, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSessionToken, getSessionCookieName, getSessionTtlSeconds } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIdentifier } from "@/lib/request-client";

export const runtime = "nodejs";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const limiter = checkRateLimit({
      key: `auth:login:${getClientIdentifier(request)}`,
      limit: 12,
      windowMs: 10 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return NextResponse.json(
        { message: `Too many login attempts. Retry in ${limiter.retryAfterSec}s.` },
        { status: 429 },
      );
    }

    const body = (await request.json()) as LoginBody;
    const email = normalizeEmail(body.email ?? "");
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        fullName: true,
        email: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const response = NextResponse.json(
      {
        message: "Login successful.",
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
        },
      },
      { status: 200 },
    );

    response.cookies.set({
      name: getSessionCookieName(),
      value: createSessionToken({
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
      }),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getSessionTtlSeconds(),
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    const message =
      process.env.NODE_ENV === "production"
        ? "Unable to login."
        : `Unable to login. ${error instanceof Error ? error.message : "Unknown error."}`;
    return NextResponse.json({ message }, { status: 500 });
  }
}
