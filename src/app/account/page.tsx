import Link from "next/link";
import EmailVerificationPanel from "@/components/account/EmailVerificationPanel";
import { getCurrentUserRecord, requireSessionUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export default async function AccountPage() {
  const session = await requireSessionUser();
  const user = await getCurrentUserRecord();
  if (!user) return null;
  const kyc = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { kycStatus: true },
  });

  const isVerified = Boolean(user.emailVerifiedAt);

  return (
    <div className="casino-bg min-h-screen p-4">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="section-title text-2xl text-white">Account</h1>
              <p className="text-sm text-[#8fb1cc]">Profile and security settings</p>
            </div>
            <div className="flex gap-2">
              <Link href="/" className="pill px-3 py-1.5 text-sm text-[#dce9ff]">
                Lobby
              </Link>
              <Link href="/support" className="pill px-3 py-1.5 text-sm text-[#dce9ff]">
                Support
              </Link>
              <Link href="/wallet" className="rounded-full bg-[#2d7de0] px-4 py-1.5 text-sm font-semibold text-white">
                Wallet
              </Link>
            </div>
          </div>
        </div>

        <div className="panel rounded-xl p-4">
          <h2 className="section-title mb-3 text-xl">Profile</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-[#385684] bg-[#0f223f] p-3">
              <p className="text-xs uppercase tracking-[0.1em] text-[#8ea9d6]">Full Name</p>
              <p className="text-lg text-white">{user.fullName}</p>
            </div>
            <div className="rounded-lg border border-[#385684] bg-[#0f223f] p-3">
              <p className="text-xs uppercase tracking-[0.1em] text-[#8ea9d6]">Email</p>
              <p className="text-lg text-white">{user.email}</p>
            </div>
            <div className="rounded-lg border border-[#385684] bg-[#0f223f] p-3">
              <p className="text-xs uppercase tracking-[0.1em] text-[#8ea9d6]">Balance</p>
              <p className="text-lg font-bold text-[#7dffbf]">${Number(user.balance).toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-[#385684] bg-[#0f223f] p-3">
              <p className="text-xs uppercase tracking-[0.1em] text-[#8ea9d6]">2FA</p>
              <p className="text-lg text-white">{user.twoFactorEnabled ? "Enabled" : "Disabled"}</p>
            </div>
            <div className="rounded-lg border border-[#385684] bg-[#0f223f] p-3 md:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.1em] text-[#8ea9d6]">KYC Status</p>
                  <p className="text-lg text-white">{(kyc?.kycStatus ?? "unverified").replaceAll("_", " ")}</p>
                </div>
                <Link href="/kyc" className="rounded-lg bg-[#2d7de0] px-3 py-1.5 text-sm font-semibold text-white">
                  Open KYC
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="panel rounded-xl p-4">
          <h2 className="section-title mb-3 text-xl">Email Verification</h2>
          <EmailVerificationPanel isVerified={isVerified} />
        </div>
      </div>
    </div>
  );
}
