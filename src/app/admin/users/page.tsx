import Link from "next/link";
import AdminUsersPanel from "@/components/admin/AdminUsersPanel";

export const runtime = "nodejs";

export default function AdminUsersPage() {
  return (
    <div className="casino-bg min-h-screen p-4">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="section-title text-2xl text-white">Admin Users</h1>
              <p className="text-sm text-[#8fb1cc]">Search, inspect, and update user security/compliance state</p>
            </div>
            <div className="flex gap-2">
              <Link href="/admin" className="pill px-3 py-1.5 text-sm text-[#dce9ff]">
                Dashboard
              </Link>
              <Link href="/admin/tickets" className="rounded-full bg-[#2d7de0] px-4 py-1.5 text-sm font-semibold text-white">
                Tickets
              </Link>
            </div>
          </div>
        </div>

        <AdminUsersPanel />
      </div>
    </div>
  );
}
