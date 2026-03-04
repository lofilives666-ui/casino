import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  const [openTickets, waitingOnPlayer, pendingKyc, pendingPayments] = await Promise.all([
    prisma.supportTicket.count({ where: { status: { in: ["open", "in_progress", "reopened", "waiting_on_admin"] } } }),
    prisma.supportTicket.count({ where: { status: "waiting_on_player" } }),
    prisma.kycSubmission.count({ where: { status: "pending_review" } }),
    prisma.walletTransaction.count({ where: { status: "pending" } }),
  ]);

  return (
    <div className="casino-bg min-h-screen p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="section-title text-2xl text-white">Agents</h1>
              <p className="text-sm text-[#8fb1cc]">First-line operations and support handling view</p>
            </div>
            <div className="flex gap-2">
              <Link href="/admin" className="pill px-3 py-1.5 text-sm text-[#dce9ff]">
                Dashboard
              </Link>
              <Link href="/admin/tickets" className="rounded-full bg-[#2d7de0] px-4 py-1.5 text-sm font-semibold text-white">
                Ticket Queue
              </Link>
            </div>
          </div>
        </div>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="panel rounded-xl p-4">
            <p className="text-xs text-[#8ea9d6]">Open Tickets</p>
            <p className="mt-1 text-3xl font-bold text-[#9fe8ff]">{openTickets}</p>
          </div>
          <div className="panel rounded-xl p-4">
            <p className="text-xs text-[#8ea9d6]">Waiting On Player</p>
            <p className="mt-1 text-3xl font-bold text-[#ffd29c]">{waitingOnPlayer}</p>
          </div>
          <div className="panel rounded-xl p-4">
            <p className="text-xs text-[#8ea9d6]">Pending KYC</p>
            <p className="mt-1 text-3xl font-bold text-[#c7b5ff]">{pendingKyc}</p>
          </div>
          <div className="panel rounded-xl p-4">
            <p className="text-xs text-[#8ea9d6]">Pending Payments</p>
            <p className="mt-1 text-3xl font-bold text-[#9cffcf]">{pendingPayments}</p>
          </div>
        </section>

        <section className="panel rounded-xl p-4 text-sm text-[#c4d7ef]">
          <h2 className="section-title text-xl text-white">Agent Role Scope</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Handle player tickets and issue triage.</li>
            <li>Request missing player information and follow-up.</li>
            <li>Perform first-pass KYC document checks before escalation.</li>
            <li>Escalate suspicious payment/KYC cases to Sub-admin or Compliance.</li>
            <li>Cannot perform high-risk finance overrides without higher approval.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
