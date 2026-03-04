import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminApiAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminApiAuthorized(request.headers)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "").trim();
  const priority = (url.searchParams.get("priority") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim();

  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { subject: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { user: { email: { contains: q, mode: "insensitive" } } },
              { user: { fullName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      category: true,
      subject: true,
      priority: true,
      status: true,
      assigneeAdminId: true,
      firstResponseAt: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          kycStatus: true,
          emailVerifiedAt: true,
        },
      },
      _count: {
        select: { messages: true },
      },
    },
  });

  const [openCount, inProgressCount, resolvedCount] = await Promise.all([
    prisma.supportTicket.count({ where: { status: { in: ["open", "waiting_on_admin", "reopened"] } } }),
    prisma.supportTicket.count({ where: { status: { in: ["in_progress", "escalated", "waiting_on_player"] } } }),
    prisma.supportTicket.count({ where: { status: { in: ["resolved", "closed"] } } }),
  ]);

  return NextResponse.json({
    metrics: {
      openCount,
      inProgressCount,
      resolvedCount,
      totalCount: tickets.length,
    },
    tickets,
  });
}
