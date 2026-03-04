import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminApiAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ ticketId: string }>;
  },
) {
  if (!isAdminApiAuthorized(request.headers)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { ticketId } = await context.params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      category: true,
      subject: true,
      description: true,
      priority: true,
      status: true,
      assigneeAdminId: true,
      linkedEntityType: true,
      linkedEntityId: true,
      firstResponseAt: true,
      resolvedAt: true,
      closedAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          kycStatus: true,
          emailVerifiedAt: true,
          balance: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          authorUserId: true,
          authorRole: true,
          isInternal: true,
          message: true,
          createdAt: true,
          author: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ message: "Ticket not found." }, { status: 404 });
  }

  return NextResponse.json({
    ticket: {
      ...ticket,
      user: {
        ...ticket.user,
        balance: Number(ticket.user.balance),
      },
    },
  });
}
