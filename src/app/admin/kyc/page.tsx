import Link from "next/link";
import KycReviewPanel from "@/components/admin/KycReviewPanel";

export const runtime = "nodejs";

export default function AdminKycPage() {
  return (
    <div className="casino-bg min-h-screen p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="section-title text-2xl text-white">Admin KYC Review</h1>
              <p className="text-sm text-[#8fb1cc]">Internal panel for verify/reject decisions</p>
            </div>
            <div className="flex gap-2">
              <Link href="/" className="pill px-3 py-1.5 text-sm text-[#dce9ff]">
                Lobby
              </Link>
              <Link href="/kyc" className="rounded-full bg-[#2d7de0] px-4 py-1.5 text-sm font-semibold text-white">
                User KYC
              </Link>
            </div>
          </div>
        </div>

        <KycReviewPanel />
      </div>
    </div>
  );
}

