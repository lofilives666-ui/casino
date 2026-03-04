import Link from "next/link";
import AdminTicketsPanel from "@/components/admin/AdminTicketsPanel";

export const runtime = "nodejs";

export default function AdminTicketsPage() {
  return (
    <div className="casino-bg min-h-screen p-4">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="section-title text-2xl text-white">Admin Tickets</h1>
              <p className="text-sm text-[#8fb1cc]">Support queue, replies, assignment, and status workflow</p>
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

        <AdminTicketsPanel />
      </div>
    </div>
  );
}
