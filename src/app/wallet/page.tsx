import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/current-user";
import PaymentActions from "@/components/wallet/PaymentActions";

export const runtime = "nodejs";

export default async function WalletPage() {
  const session = await requireSessionUser();

  const [user, ledger, transactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { fullName: true, balance: true, emailVerifiedAt: true, kycStatus: true },
    }),
    prisma.walletLedger.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.walletTransaction.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  if (!user) return null;

  return (
    <div className="casino-bg min-h-screen p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="section-title text-2xl text-white">Wallet</h1>
              <p className="text-sm text-[#8fb1cc]">{user.fullName}</p>
            </div>
            <div className="flex gap-2">
              <Link href="/" className="pill px-3 py-1.5 text-sm text-[#dce9ff]">
                Lobby
              </Link>
              <Link href="/account" className="rounded-full bg-[#2d7de0] px-4 py-1.5 text-sm font-semibold text-white">
                Account
              </Link>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-[#385684] bg-[#0f223f] p-3">
            <p className="text-xs uppercase tracking-[0.1em] text-[#8ea9d6]">Available Balance</p>
            <p className="text-2xl font-bold text-[#7dffbf]">${Number(user.balance).toFixed(2)}</p>
            <p className="text-sm text-[#8fb1cc]">Email Verified: {user.emailVerifiedAt ? "Yes" : "No"}</p>
            <p className="text-sm text-[#8fb1cc]">KYC: {user.kycStatus.replaceAll("_", " ")}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PaymentActions />

          <section className="panel rounded-xl p-4 lg:col-span-2">
            <h2 className="section-title mb-2 text-xl">Withdraw Access</h2>
            {user.kycStatus === "verified" ? (
              <div className="rounded-lg border border-[#2f6a4e] bg-[#0f2a22] p-3 text-[#7dffbf]">
                Withdrawals are enabled for your account.
              </div>
            ) : (
              <div className="rounded-lg border border-[#6b4b3a] bg-[#2a1a12] p-3 text-[#ffd5b2]">
                Withdrawals are locked until KYC is verified.
                <Link href="/kyc" className="ml-2 inline-block rounded bg-[#2d7de0] px-2 py-0.5 text-white">
                  Complete KYC
                </Link>
              </div>
            )}
          </section>

          <section className="panel rounded-xl p-4">
            <h2 className="section-title mb-3 text-xl">Ledger</h2>
            <div className="space-y-2">
              {ledger.map((item) => (
                <div key={item.id} className="rounded-lg border border-[#385684] bg-[#0f223f] p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white">{item.reason}</p>
                    <p className={item.type === "CREDIT" ? "text-[#7dffbf]" : "text-[#ffb2a6]"}>
                      {item.type === "CREDIT" ? "+" : "-"}${Number(item.amount).toFixed(2)}
                    </p>
                  </div>
                  <p className="text-xs text-[#8ea9d6]">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {ledger.length === 0 ? <p className="text-sm text-[#8ea9d6]">No ledger entries yet.</p> : null}
            </div>
          </section>

          <section className="panel rounded-xl p-4">
            <h2 className="section-title mb-3 text-xl">Transactions</h2>
            <div className="space-y-2">
              {transactions.map((item) => (
                <div key={item.id} className="rounded-lg border border-[#385684] bg-[#0f223f] p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white">{item.kind}</p>
                    <p className="text-[#dce9ff]">${Number(item.amount).toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-[#8ea9d6]">
                    {item.status} • {new Date(item.createdAt).toLocaleString()} {item.method ? `• ${item.method}` : ""}
                  </p>
                  {item.failureReason ? <p className="text-xs text-[#ffb3a6]">Reason: {item.failureReason}</p> : null}
                </div>
              ))}
              {transactions.length === 0 ? <p className="text-sm text-[#8ea9d6]">No transactions yet.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
