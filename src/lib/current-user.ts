import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";

export async function getSessionUserOrNull() {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) return null;
  return session;
}

export async function requireSessionUser() {
  const session = await getSessionUserOrNull();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function getCurrentUserRecord() {
  const session = await getSessionUserOrNull();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      balance: true,
      emailVerifiedAt: true,
      twoFactorEnabled: true,
      createdAt: true,
    },
  });
  return user;
}

