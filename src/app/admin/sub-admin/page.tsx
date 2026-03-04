import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminSubAdminPage() {
  const [pendingKyc, pendingPayments, openTickets, highPriorityTickets] = await Promise.all([
    prisma.kycSubmission.count({ where: { status: "pending_review" } }),
    prisma.walletTransaction.count({ where: { status: "pending" } }),
    prisma.supportTicket.count({ where: { status: { in: ["open", "in_progress", "reopened", "waiting_on_admin"] } } }),
    prisma.supportTicket.count({ where: { priority: { in: ["high", "urgent"] }, status: { notIn: ["resolved", "closed"] } } }),
  ]);

  return (
    <div className="casino-bg min-h-screen p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="section-title text-2xl text-white">Sub-admin</h1>
              <p className="text-sm text-[#8fb1cc]">Supervision and approval layer for operations teams</p>
            </div>
            <div className="flex gap-2">
              <Link href="/admin" className="pill px-3 py-1.5 text-sm text-[#dce9ff]">
                Dashboard
              </Link>
              <Link href="/admin/payments" className="rounded-full bg-[#2d7de0] px-4 py-1.5 text-sm font-semibold text-white">
                Payments
              </Link>
            </div>
          </div>
        </div>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="panel rounded-xl p-4">
            <p className="text-xs text-[#8ea9d6]">Pending KYC</p>
            <p className="mt-1 text-3xl font-bold text-[#8bd7ff]">{pendingKyc}</p>
          </div>
          <div className="panel rounded-xl p-4">
            <p className="text-xs text-[#8ea9d6]">Pending Payments</p>
            <p className="mt-1 text-3xl font-bold text-[#ffd08a]">{pendingPayments}</p>
          </div>
          <div className="panel rounded-xl p-4">
            <p className="text-xs text-[#8ea9d6]">Open Tickets</p>
            <p className="mt-1 text-3xl font-bold text-[#ff9fb2]">{openTickets}</p>
          </div>
          <div className="panel rounded-xl p-4">
            <p className="text-xs text-[#8ea9d6]">High Priority Cases</p>
            <p className="mt-1 text-3xl font-bold text-[#9fffcb]">{highPriorityTickets}</p>
          </div>
        </section>

        <section className="panel rounded-xl p-4 text-sm text-[#c4d7ef]">
          <h2 className="section-title text-xl text-white">Sub-admin Role Scope</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Approve or reject sensitive payment/KYC escalations.</li>
            <li>Review agent performance and queue SLA compliance.</li>
            <li>Manage incident escalation and cross-team coordination.</li>
            <li>Override/close exceptional support cases with full audit trail.</li>
            <li>Escalate policy/security incidents to super-admin owners.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
