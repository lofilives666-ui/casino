import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashPassword, normalizeEmail } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIdentifier } from "@/lib/request-client";
import { verifyCsrf } from "@/lib/csrf";

export const runtime = "nodejs";

type SignupBody = {
  fullName?: string;
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    if (!verifyCsrf(request, cookieStore)) {
      return NextResponse.json({ message: "CSRF validation failed." }, { status: 403 });
    }

    const limiter = checkRateLimit({
      key: `auth:signup:${getClientIdentifier(request)}`,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return NextResponse.json(
        { message: `Too many signup attempts. Retry in ${limiter.retryAfterSec}s.` },
        { status: 429 },
      );
    }

    const body = (await request.json()) as SignupBody;
    const fullName = body.fullName?.trim() ?? "";
    const email = normalizeEmail(body.email ?? "");
    const password = body.password ?? "";

    if (!fullName || !email || !password) {
      return NextResponse.json({ message: "All fields are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ message: "Email is already registered." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName,
          email,
          passwordHash,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          balance: true,
          createdAt: true,
        },
      });

      await tx.walletLedger.create({
        data: {
          userId: created.id,
          type: "CREDIT",
          amount: created.balance,
          reason: "WELCOME_BALANCE",
        },
      });

      return created;
    });

    return NextResponse.json({ message: "Account created successfully.", user }, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
    const message =
      process.env.NODE_ENV === "production"
        ? "Unable to create account."
        : `Unable to create account. ${error instanceof Error ? error.message : "Unknown error."}`;
    return NextResponse.json({ message }, { status: 500 });
  }
}
