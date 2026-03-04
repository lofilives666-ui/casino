import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export default async function AdminHomePage() {
  const [pendingKyc, pendingPayments, openTickets, totalUsers] = await Promise.all([
    prisma.kycSubmission.count({ where: { status: "pending_review" } }),
    prisma.walletTransaction.count({ where: { status: "pending" } }),
    prisma.supportTicket.count({ where: { status: { in: ["open", "in_progress", "reopened", "waiting_on_admin"] } } }),
    prisma.user.count(),
  ]);

  const cards = [
    { label: "Pending KYC", value: pendingKyc, href: "/admin/kyc", accent: "text-[#8bd7ff]" },
    { label: "Pending Payments", value: pendingPayments, href: "/admin/payments", accent: "text-[#ffd08a]" },
    { label: "Open Tickets", value: openTickets, href: "/admin/tickets", accent: "text-[#ff9fb2]" },
    { label: "Total Users", value: totalUsers, href: "/admin/users", accent: "text-[#9fffcb]" },
  ];

  return (
    <div className="casino-bg min-h-screen p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="section-title text-2xl text-white">Admin Dashboard</h1>
              <p className="text-sm text-[#8fb1cc]">Operations, support, risk, and finance controls</p>
            </div>
            <div className="flex gap-2">
              <Link href="/" className="pill px-3 py-1.5 text-sm text-[#dce9ff]">
                Lobby
              </Link>
              <Link href="/admin/tickets" className="rounded-full bg-[#2d7de0] px-4 py-1.5 text-sm font-semibold text-white">
                Tickets
              </Link>
            </div>
          </div>
        </div>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.label} href={card.href} className="panel rounded-xl p-4 hover:border-[#4b6697]">
              <p className="text-xs uppercase tracking-[0.1em] text-[#8ea9d6]">{card.label}</p>
              <p className={`mt-2 text-3xl font-bold ${card.accent}`}>{card.value}</p>
            </Link>
          ))}
        </section>

        <section className="panel rounded-xl p-4">
          <h2 className="section-title text-xl text-white">Admin Modules</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Link href="/admin/payments" className="rounded-lg border border-[#3c547f] bg-[#0e1a33] p-3 text-[#dce9ff]">
              Payments Management
            </Link>
            <Link href="/admin/kyc" className="rounded-lg border border-[#3c547f] bg-[#0e1a33] p-3 text-[#dce9ff]">
              KYC Review
            </Link>
            <Link href="/admin/tickets" className="rounded-lg border border-[#3c547f] bg-[#0e1a33] p-3 text-[#dce9ff]">
              Ticket Management
            </Link>
            <Link href="/admin/users" className="rounded-lg border border-[#3c547f] bg-[#0e1a33] p-3 text-[#dce9ff]">
              User Management (MVP)
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
