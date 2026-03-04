import Link from "next/link";
import { requireSessionUser } from "@/lib/current-user";
import SupportTicketsPanel from "@/components/account/SupportTicketsPanel";

export const runtime = "nodejs";

export default async function SupportPage() {
  await requireSessionUser();

  return (
    <div className="casino-bg min-h-screen p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="section-title text-2xl text-white">Support Tickets</h1>
              <p className="text-sm text-[#8fb1cc]">Create and track your support requests</p>
            </div>
            <div className="flex gap-2">
              <Link href="/account" className="pill px-3 py-1.5 text-sm text-[#dce9ff]">
                Account
              </Link>
              <Link href="/" className="rounded-full bg-[#2d7de0] px-4 py-1.5 text-sm font-semibold text-white">
                Lobby
              </Link>
            </div>
          </div>
        </div>

        <SupportTicketsPanel />
      </div>
    </div>
  );
}
