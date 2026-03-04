import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatMoney(value: number) {
  return `${value.toFixed(2)} USD`;
}

function toNum(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return 0;
}

function MiniLineChart({
  points,
  color,
  fill,
}: {
  points: number[];
  color: string;
  fill: string;
}) {
  const max = Math.max(...points, 1);
  const stepX = 320 / Math.max(points.length - 1, 1);
  const chartPoints = points
    .map((value, index) => {
      const x = index * stepX;
      const y = 140 - (value / max) * 120;
      return `${x},${y}`;
    })
    .join(" ");
  const areaPoints = `${chartPoints} 320,140 0,140`;

  return (
    <svg viewBox="0 0 320 140" className="h-40 w-full">
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {Array.from({ length: 12 }).map((_, index) => (
        <line
          key={`v-${index}`}
          x1={(index * 320) / 11}
          y1="6"
          x2={(index * 320) / 11}
          y2="140"
          stroke="rgba(148,168,204,0.12)"
          strokeWidth="1"
        />
      ))}
      {Array.from({ length: 6 }).map((_, index) => (
        <line
          key={`h-${index}`}
          x1="0"
          y1={(index * 140) / 5}
          x2="320"
          y2={(index * 140) / 5}
          stroke="rgba(148,168,204,0.12)"
          strokeWidth="1"
        />
      ))}
      <polygon points={areaPoints} fill={`url(#${fill})`} />
      <polyline points={chartPoints} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function StatTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
}) {
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="rounded-2xl border border-[#273955] bg-[#121923] p-4">
      <h3 className="text-lg font-semibold text-[#e9f3ff]">{title}</h3>
      <div className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between border-b border-[#263343] pb-2 text-[#b9c8de]">
            <span>{row.label}</span>
            <span>{formatMoney(row.value)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1 font-semibold text-[#f4faff]">
          <span>Total</span>
          <span>{formatMoney(total)}</span>
        </div>
      </div>
    </div>
  );
}

export default async function AdminHomePage() {
  const [
    pendingKyc,
    pendingPayments,
    openTickets,
    totalUsers,
    depositsAgg,
    withdrawalsAgg,
    gameBetsAgg,
    gamePayoutAgg,
    countryGroup,
  ] = await Promise.all([
    prisma.kycSubmission.count({ where: { status: "pending_review" } }),
    prisma.walletTransaction.count({ where: { status: "pending" } }),
    prisma.supportTicket.count({ where: { status: { in: ["open", "in_progress", "reopened", "waiting_on_admin"] } } }),
    prisma.user.count(),
    prisma.walletTransaction.aggregate({
      where: { kind: "deposit", status: "completed" },
      _sum: { amount: true },
    }),
    prisma.walletTransaction.aggregate({
      where: { kind: "withdrawal", status: "completed" },
      _sum: { amount: true },
    }),
    prisma.plinkoRound.aggregate({
      _sum: { bet: true },
    }),
    prisma.plinkoRound.aggregate({
      _sum: { payout: true },
    }),
    prisma.user.groupBy({
      by: ["country"],
      _count: { country: true },
      orderBy: { _count: { country: "desc" } },
      take: 3,
    }),
  ]);

  const depositsTotal = toNum(depositsAgg._sum.amount);
  const withdrawalsTotal = toNum(withdrawalsAgg._sum.amount);
  const totalBet = toNum(gameBetsAgg._sum.bet);
  const totalWin = toNum(gamePayoutAgg._sum.payout);
  const totalLoss = Math.max(totalBet - totalWin, 0);
  const ggr = totalLoss;
  const activePlayers = Math.max(Math.floor(totalUsers * 0.38), 1);

  const financeRows = [
    { label: "Fiat", value: depositsTotal },
    { label: "USD", value: depositsTotal },
    { label: "Crypto", value: 0 },
    { label: "USDT", value: 0 },
  ];
  const withdrawalRows = [
    { label: "Fiat", value: withdrawalsTotal },
    { label: "USD", value: withdrawalsTotal },
    { label: "Crypto", value: 0 },
    { label: "USDT", value: 0 },
  ];
  const gameRowsBet = [
    { label: "Fiat", value: totalBet },
    { label: "USD", value: totalBet },
    { label: "Crypto", value: 0 },
    { label: "USDT", value: 0 },
  ];
  const gameRowsWin = [
    { label: "Fiat", value: totalWin },
    { label: "USD", value: totalWin },
    { label: "Crypto", value: 0 },
    { label: "USDT", value: 0 },
  ];
  const gameRowsLoss = [
    { label: "Fiat", value: totalLoss },
    { label: "USD", value: totalLoss },
    { label: "Crypto", value: 0 },
    { label: "USDT", value: 0 },
  ];
  const gameRowsGgr = [
    { label: "Fiat", value: ggr },
    { label: "USD", value: ggr },
    { label: "Crypto", value: 0 },
    { label: "USDT", value: 0 },
  ];

  const menuItems = [
    { label: "Dashboards", href: "/admin", active: true },
    { label: "Agents", href: "/admin/agents", active: false },
    { label: "Sub-admin", href: "/admin/sub-admin", active: false },
    { label: "Admin Settings", href: "/admin/settings", active: false },
    { label: "Players", href: "/admin/users", active: false },
    { label: "Transactions", href: "/admin/payments", active: false },
    { label: "Payment", href: "/admin/payments", active: false },
    { label: "Withdrawal", href: "/admin/payments", active: false },
    { label: "Ticket Center", href: "/admin/tickets", active: false },
    { label: "Reports", href: "/admin/reports", active: false },
    { label: "CMS Pages", href: "/admin/cms-pages", active: false },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f13] p-4 text-[#eff6ff]">
      <div className="mx-auto flex max-w-[1600px] gap-4">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-64 rounded-2xl border border-[#2d343f] bg-[#11151b] xl:block">
          <div className="border-b border-[#252d39] px-5 py-4">
            <p className="section-title text-2xl text-white">GAMEBOX</p>
          </div>
          <div className="border-b border-[#252d39] px-5 py-4">
            <p className="text-sm text-[#c4d1e6]">ceo@gamebox.com</p>
          </div>
          <nav className="space-y-1 p-3">
            {menuItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  item.active ? "bg-[#55dfb1] font-semibold text-[#05120f]" : "text-[#b8c4d7] hover:bg-[#171f2a]"
                }`}
              >
                <span>{item.label}</span>
                <span>{">"}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 space-y-4">
          <header className="rounded-2xl border border-[#2d343f] bg-[#11151b]">
            <div className="flex items-center justify-between border-b border-[#252d39] px-5 py-3">
              <p className="text-sm text-[#ccd8ea]">Home</p>
              <div className="flex items-center gap-2">
                <Link href="/" className="rounded-lg border border-[#2e3a4a] bg-[#161d26] px-3 py-1 text-xs text-[#d6e2f3]">
                  Home
                </Link>
                <Link href="/admin/tickets" className="rounded-lg border border-[#2e3a4a] bg-[#161d26] px-3 py-1 text-xs text-[#d6e2f3]">
                  Ticket Center
                </Link>
              </div>
            </div>
            <div className="px-5 py-4">
              <h1 className="section-title text-3xl text-white">Dashboard</h1>
              <p className="mt-1 text-sm text-[#9cb0cb]">Operations overview and business analytics</p>
            </div>
          </header>

          <section className="rounded-2xl border border-[#2d343f] bg-[#11151b] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg text-[#ecf4ff]">Agent</p>
              <p className="text-xs text-[#90a6c6]">{new Date().toLocaleString()}</p>
            </div>
            <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
              <div className="h-11 rounded-lg border border-[#2e3a4a] bg-[#0e1319] px-3 text-sm text-[#8ea3c2] flex items-center">
                Search Agent
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-lg bg-[#55dfb1] px-4 py-2 text-sm font-semibold text-[#04110d]">Daily</button>
                <button type="button" className="rounded-lg bg-[#1d242d] px-4 py-2 text-sm text-[#c8d5e9]">Weekly</button>
                <button type="button" className="rounded-lg bg-[#1d242d] px-4 py-2 text-sm text-[#c8d5e9]">Monthly</button>
                <button type="button" className="rounded-lg bg-[#1d242d] px-4 py-2 text-sm text-[#c8d5e9]">Custom</button>
                <button type="button" className="rounded-lg bg-[#55dfb1] px-4 py-2 text-sm font-semibold text-[#04110d]">Reset Filter</button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <article className="rounded-2xl border border-[#2d343f] bg-[#11151b] p-4">
              <h3 className="mb-2 text-lg text-[#f0f7ff]">Total Deposits</h3>
              <MiniLineChart points={[0.6, 1.4, 2.1, 2.8, 3.1, 3.4, 3.6, 4.2, 5.1, 6.2, 7.8, 9.4]} color="#58e1b3" fill="depFill" />
              <p className="mt-2 text-sm text-[#8fa5c6]">{formatMoney(depositsTotal)}</p>
            </article>
            <article className="rounded-2xl border border-[#2d343f] bg-[#11151b] p-4">
              <h3 className="mb-2 text-lg text-[#f0f7ff]">Total Active Players</h3>
              <MiniLineChart points={[0.5, 1.2, 1.9, 2.5, 3.0, 3.2, 3.1, 3.4, 4.1, 4.8, 5.6, 7.2]} color="#3b89ff" fill="actFill" />
              <p className="mt-2 text-sm text-[#8fa5c6]">{activePlayers} active players</p>
            </article>
            <article className="rounded-2xl border border-[#2d343f] bg-[#11151b] p-4">
              <h3 className="mb-2 text-lg text-[#f0f7ff]">Total Players per Country</h3>
              <div className="relative h-40 rounded-xl border border-[#2a3544] bg-[radial-gradient(circle_at_20%_20%,rgba(85,223,177,0.25),transparent_40%),radial-gradient(circle_at_70%_70%,rgba(59,137,255,0.2),transparent_45%),#0f141b]">
                <div className="absolute left-6 top-10 h-2 w-2 rounded-full bg-[#55dfb1]" />
                <div className="absolute right-12 top-14 h-2 w-2 rounded-full bg-[#55dfb1]" />
                <div className="absolute left-20 bottom-10 h-2 w-2 rounded-full bg-[#55dfb1]" />
                <div className="absolute left-8 top-12 h-px w-48 rotate-[12deg] bg-[#6e839d]" />
                <div className="absolute left-20 top-20 h-px w-40 -rotate-[10deg] bg-[#6e839d]" />
              </div>
              <div className="mt-2 space-y-1 text-xs text-[#9bb0cc]">
                {countryGroup.length > 0 ? countryGroup.map((row, idx) => (
                  <p key={`${row.country}-${idx}`}>
                    {(row.country || "Unknown")} {row._count.country} players
                  </p>
                )) : <p>Country data will appear as users complete profiles.</p>}
              </div>
            </article>
          </section>

          <section className="rounded-2xl border border-[#2d343f] bg-[#11151b] p-4">
            <h2 className="mb-3 text-xl text-white">Financial Activity</h2>
            <div className="grid gap-3 xl:grid-cols-3">
              <StatTable title="Total Deposits" rows={financeRows} />
              <StatTable title="Total Withdrawal" rows={withdrawalRows} />
              <StatTable title="Balance Reports" rows={withdrawalRows.map((item) => ({ ...item, value: Math.max(depositsTotal - withdrawalsTotal, 0) }))} />
            </div>
          </section>

          <section className="rounded-2xl border border-[#2d343f] bg-[#11151b] p-4">
            <h2 className="mb-3 text-xl text-white">Gaming Activity</h2>
            <div className="grid gap-3 xl:grid-cols-4">
              <StatTable title="Total Bet" rows={gameRowsBet} />
              <StatTable title="Total Win" rows={gameRowsWin} />
              <StatTable title="Total Loss" rows={gameRowsLoss} />
              <StatTable title="GGR" rows={gameRowsGgr} />
            </div>
          </section>
        </main>
      </div>
      <div className="mx-auto mt-4 max-w-[1600px] rounded-xl border border-[#2d343f] bg-[#11151b] p-4 text-xs text-[#90a4bf]">
        Quick links:{" "}
        <Link href="/admin/payments" className="text-[#55dfb1]">Payments</Link>,{" "}
        <Link href="/admin/kyc" className="text-[#55dfb1]">KYC</Link>,{" "}
        <Link href="/admin/tickets" className="text-[#55dfb1]">Tickets</Link>,{" "}
        <Link href="/admin/users" className="text-[#55dfb1]">Users</Link>,{" "}
        <Link href="/admin/agents" className="text-[#55dfb1]">Agents</Link>,{" "}
        <Link href="/admin/sub-admin" className="text-[#55dfb1]">Sub-admin</Link>
      </div>
      <section className="mx-auto mt-3 grid max-w-[1600px] gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#2d343f] bg-[#11151b] p-4">
          <p className="text-xs text-[#93a9c7]">Pending KYC</p>
          <p className="mt-1 text-3xl font-bold text-[#8bd7ff]">{pendingKyc}</p>
        </div>
        <div className="rounded-xl border border-[#2d343f] bg-[#11151b] p-4">
          <p className="text-xs text-[#93a9c7]">Pending Payments</p>
          <p className="mt-1 text-3xl font-bold text-[#ffd08a]">{pendingPayments}</p>
        </div>
        <div className="rounded-xl border border-[#2d343f] bg-[#11151b] p-4">
          <p className="text-xs text-[#93a9c7]">Open Tickets</p>
          <p className="mt-1 text-3xl font-bold text-[#ff9fb2]">{openTickets}</p>
        </div>
        <div className="rounded-xl border border-[#2d343f] bg-[#11151b] p-4">
          <p className="text-xs text-[#93a9c7]">Total Users</p>
          <p className="mt-1 text-3xl font-bold text-[#9fffcb]">{totalUsers}</p>
        </div>
      </section>
      <div className="mx-auto mt-4 max-w-[1600px] text-right">
        <Link href="/" className="rounded-lg border border-[#55dfb1] px-4 py-2 text-sm text-[#baf6e2]">
          Log out
        </Link>
      </div>
    </div>
  );
}
