import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminApiAuthorized } from "@/lib/admin-auth";
import { verifyCsrf } from "@/lib/csrf";
import {
  beginIdempotentRequest,
  commitIdempotentResponse,
  getIdempotencyKey,
  releaseIdempotentLock,
} from "@/lib/idempotency";

export const runtime = "nodejs";

type UpdatePayload = {
  userId?: string;
  kycStatus?: string;
  setTwoFactorEnabled?: boolean;
};

export async function GET(request: Request) {
  if (!isAdminApiAuthorized(request.headers)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      fullName: true,
      email: true,
      balance: true,
      kycStatus: true,
      emailVerifiedAt: true,
      twoFactorEnabled: true,
      createdAt: true,
      _count: {
        select: {
          walletTransactions: true,
          kycSubmissions: true,
          supportTickets: true,
        },
      },
    },
  });

  return NextResponse.json({
    users: users.map((item) => ({
      ...item,
      balance: Number(item.balance),
    })),
  });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifyCsrf(request, cookieStore)) {
    return NextResponse.json({ message: "CSRF validation failed." }, { status: 403 });
  }
  if (!isAdminApiAuthorized(request.headers)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const idempotency = await beginIdempotentRequest({
    scope: "admin:users:update",
    key: getIdempotencyKey(request),
  });
  if (!idempotency.ok && idempotency.reason === "INVALID_KEY") {
    return NextResponse.json({ message: "A valid x-idempotency-key header is required." }, { status: 400 });
  }
  if (!idempotency.ok && idempotency.response) {
    return NextResponse.json(idempotency.response.body, {
      status: idempotency.response.status,
      headers: { "x-idempotent-replayed": "1" },
    });
  }
  if (!idempotency.ok && idempotency.reason === "IN_PROGRESS") {
    return NextResponse.json({ message: "Request already in progress for this idempotency key." }, { status: 409 });
  }
  const finalize = async (body: unknown, status = 200) => {
    await commitIdempotentResponse({ token: idempotency, status, body });
    return NextResponse.json(body, { status });
  };

  try {
    const body = (await request.json()) as UpdatePayload;
    const userId = body.userId?.trim() ?? "";
    if (!userId) {
      return await finalize({ message: "userId is required." }, 400);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.kycStatus ? { kycStatus: body.kycStatus.trim() } : {}),
        ...(typeof body.setTwoFactorEnabled === "boolean" ? { twoFactorEnabled: body.setTwoFactorEnabled } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        kycStatus: true,
        twoFactorEnabled: true,
      },
    });

    return await finalize({ message: "User updated.", user: updated });
  } catch (error) {
    console.error("Admin user update error:", error);
    await releaseIdempotentLock(idempotency);
    return NextResponse.json({ message: "Unable to update user." }, { status: 500 });
  }
}
