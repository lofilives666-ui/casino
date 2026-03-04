import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";
import HeaderAdSlider from "@/components/HeaderAdSlider";
import LogoutButton from "@/components/auth/LogoutButton";

const topGames = [
  "Aero Joker",
  "Wolf Blaze",
  "Neon Fruit",
  "Olympian Gold",
  "Sugar Rush 1000",
  "Inferno Seven",
];

const slots = [
  "Barrel Bonanza",
  "Blaze Buddies",
  "Chicken Man",
  "Chocolate Rocket",
  "Clumsy Cowboys",
  "Command Tridents",
  "Inferno Sun",
];

const instantGames = [
  "Thunder Plinko",
  "Midas Golden Plinko",
  "Plinko+",
  "Lucky Tiger",
  "Prospector Spin",
];

const providers = ["Pragmatic", "Evolution", "PG Soft", "Hacksaw", "TaDa", "Nolimit"];

type MenuIcon = "home" | "popular" | "slots" | "live" | "top" | "instant" | "tournament" | "roulette";

function SidebarIcon({ type }: { type: MenuIcon }) {
  const base = "h-4 w-4 text-[#86a4d6]";
  switch (type) {
    case "home":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5.5 9.5V20h13V9.5" />
        </svg>
      );
    case "popular":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z" />
        </svg>
      );
    case "slots":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="5" width="16" height="14" rx="2.5" />
          <path d="M8 10h2m4 0h2M8 14h2m4 0h2" />
        </svg>
      );
    case "live":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3" />
          <path d="M5 8a10 10 0 000 8M19 8a10 10 0 010 8" />
        </svg>
      );
    case "top":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 4h10v3a5 5 0 01-10 0V4z" />
          <path d="M9 14h6M10 18h4" />
        </svg>
      );
    case "instant":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M13 3L4 14h6l-1 7 9-11h-6l1-7z" />
        </svg>
      );
    case "tournament":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M8 4h8v4a4 4 0 11-8 0V4z" />
          <path d="M6 5H4a2 2 0 002 2M18 5h2a2 2 0 01-2 2" />
          <path d="M12 12v7M9 19h6" />
        </svg>
      );
    case "roulette":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2" />
          <path d="M12 4v6m0 4v6m8-8h-6M10 12H4" />
        </svg>
      );
  }
}

export default async function Home() {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(getSessionCookieName())?.value);
  const demoBalance = 1284.75;
  const menuItems: { label: string; icon: MenuIcon }[] = [
    { label: "Home", icon: "home" },
    { label: "Popular", icon: "popular" },
    { label: "Slots", icon: "slots" },
    { label: "Live casino", icon: "live" },
    { label: "Top Games", icon: "top" },
    { label: "Insta games", icon: "instant" },
    { label: "Tournaments", icon: "tournament" },
    { label: "Roulette", icon: "roulette" },
  ];

  return (
    <div className="casino-bg w-full px-0 py-0">
      <div className="panel card-glow min-h-screen w-full rounded-none border-x-0 border-y-0 p-3 md:p-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[230px_1fr_280px]">
          <header className="mobile-top mb-0 rounded-xl border border-[#2b3f64] bg-[#080f1d]/95 px-3 py-2.5 backdrop-blur md:px-4 md:py-3 xl:col-start-2 xl:col-end-4 xl:grid xl:grid-cols-[1fr_280px] xl:items-stretch xl:gap-3">
            <div className="hidden min-w-0 md:block md:h-full">
              <HeaderAdSlider />
            </div>
            {session ? (
              <div className="flex items-center justify-end">
                <div className="h-full w-full rounded-xl border border-[#35507a] bg-[linear-gradient(135deg,#0a1730_0%,#0d1f41_45%,#10284d_100%)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full border border-[#43639a] bg-[#10223f] text-sm font-bold text-[#dfe9ff]">
                        {session.fullName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="leading-tight">
                        <p className="text-sm font-semibold text-[#e7efff]">{session.fullName}</p>
                        <p className="text-xs text-[#8eaad8]">VIP Silver</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-[#2d8b67] bg-[#0f2c2a] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#78ffca]">
                      Online
                    </span>
                  </div>

                  <div className="mt-2 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-[#87a3d2]">Balance</p>
                      <p className="text-base font-bold text-[#7dffbf]">${demoBalance.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href="/wallet"
                        className="rounded-lg border border-[#3b5688] bg-[#11274a] px-2.5 py-1 text-xs font-semibold text-[#dce9ff] hover:bg-[#17325f]"
                      >
                        Wallet
                      </Link>
                      <button
                        type="button"
                        className="rounded-lg bg-gradient-to-r from-[#ff5b2f] to-[#ffb037] px-2.5 py-1 text-xs font-semibold text-white"
                      >
                        Deposit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2 text-sm">
                <Link className="pill px-3 py-1 text-xs text-[#e2ecff] md:px-4 md:py-1.5 md:text-sm" href="/login">
                  Login
                </Link>
                <Link
                  className="rounded-full bg-gradient-to-r from-[#ff3d2e] to-[#ffa52f] px-3 py-1 text-xs font-semibold text-white md:px-4 md:py-1.5 md:text-sm"
                  href="/signup"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </header>

          <aside className="sticky top-2 z-30 hidden h-[88px] self-stretch xl:col-start-1 xl:row-start-1 xl:flex xl:items-center">
            <div className="relative h-full w-full px-2">
              <Image
                src="/images/logo-latest.png"
                alt="Casino logo"
                fill
                className="object-contain object-center translate-y-2"
                unoptimized
                priority
              />
            </div>
          </aside>

          <aside className="panel sticky top-[102px] z-20 hidden max-h-[calc(100vh-110px)] self-start overflow-y-auto p-3 xl:col-start-1 xl:row-start-2 xl:block">
            <div className="mb-2 rounded-xl bg-gradient-to-r from-[#ff4a2f] to-[#ffbb45] p-3 font-semibold text-[#1a0906]">
              Promotions
            </div>
            <nav className="space-y-1 text-sm text-[#b9c8e8]">
              {menuItems.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${
                    item.label === "Home"
                      ? "border border-[#3c547f] bg-[#0e1a33] text-white"
                      : "border border-transparent hover:border-[#3c547f] hover:bg-[#0e1a33]"
                  }`}
                >
                  <SidebarIcon type={item.icon} />
                  <span>{item.label}</span>
                </div>
              ))}
              {session ? (
                <div className="pt-2">
                  <Link
                    href="/account"
                    className="mb-2 flex w-full items-center justify-center rounded-lg border border-[#4b6697] bg-[#0c1f3e] px-3 py-2 font-semibold text-[#d7e6ff] hover:bg-[#122951]"
                  >
                    Account
                  </Link>
                  <Link
                    href="/wallet"
                    className="mb-2 flex w-full items-center justify-center rounded-lg border border-[#4b6697] bg-[#0c1f3e] px-3 py-2 font-semibold text-[#d7e6ff] hover:bg-[#122951]"
                  >
                    Wallet
                  </Link>
                  <LogoutButton />
                </div>
              ) : null}
            </nav>
          </aside>

          <main className="space-y-4 pb-14 md:pb-0 xl:col-start-2">
            <section className="panel overflow-visible p-4">
              <div className="relative overflow-visible rounded-2xl p-4 md:p-6">
                <div className="absolute inset-0 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_30%,#6d1f15_0%,#2b1325_45%,#0f1224_100%)]">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-center bg-cover opacity-50"
                    style={{ backgroundImage: "url('/images/hero-casino-bg.jpg')" }}
                  />
                  <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(7,10,20,0.35),rgba(7,10,20,0.15))]" />
                </div>

                <div className="relative z-10">
                  <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[#ffbd6b]">Why Players Choose Us</p>
                  <h1 className="section-title max-w-xl text-2xl font-bold leading-tight text-white md:text-4xl">
                    Build Fast Casino Experiences With Bold Visual Identity
                  </h1>
                  <div className="mt-5 flex flex-wrap gap-2 text-sm">
                    <span className="pill px-3 py-1">7,500+ Daily Players</span>
                    <span className="pill px-3 py-1">100+ Games</span>
                    <span className="pill px-3 py-1">100+ Providers</span>
                  </div>
                </div>

                <div className="pointer-events-none absolute right-0 bottom-0 z-20 hidden h-[120%] w-[38%] xl:block">
                  <Image
                    src="/images/character.png"
                    alt="Casino character"
                    fill
                    className="object-contain object-right-bottom"
                    priority
                  />
                </div>
                </div>
            </section>

            <section className="panel p-4">
              <h2 className="section-title mb-3 text-xl">Top Games</h2>
              <div className="mobile-row grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {topGames.map((game, index) => (
                  <article
                    key={game}
                    className="game-tile bg-gradient-to-br from-[#082543] via-[#132a5f] to-[#341a62]"
                    style={{ backgroundImage: `linear-gradient(130deg, hsl(${205 + index * 18} 80% 20%), hsl(${290 + index * 10} 75% 24%))` }}
                  >
                    <span className="text-xs text-[#b2cbff]">Top</span>
                    <strong className="leading-5">{game}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel p-4">
              <h2 className="section-title mb-3 text-xl">Slots</h2>
              <div className="mobile-row grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                {slots.map((game, index) => (
                  <article
                    key={game}
                    className="game-tile bg-gradient-to-br from-[#3d110f] via-[#5c1c0e] to-[#8b2f0f]"
                    style={{ backgroundImage: `linear-gradient(140deg, hsl(${20 + index * 12} 80% 22%), hsl(${42 + index * 10} 92% 35%))` }}
                  >
                    <span className="text-xs text-[#ffd7a8]">Slots</span>
                    <strong className="leading-5">{game}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel p-4">
              <h2 className="section-title mb-3 text-xl">Insta Games</h2>
              <div className="mobile-row grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {instantGames.map((game, index) => (
                  <Link
                    key={game}
                    href={game === "Thunder Plinko" ? "/games/thunder-plinko" : "#"}
                    className="game-tile bg-gradient-to-br from-[#10233f] via-[#08395f] to-[#026f6f]"
                    style={{ backgroundImage: `linear-gradient(140deg, hsl(${190 + index * 8} 78% 18%), hsl(${165 + index * 11} 83% 34%))` }}
                    target={game === "Thunder Plinko" ? "_blank" : undefined}
                    rel={game === "Thunder Plinko" ? "noopener noreferrer" : undefined}
                  >
                    <span className="text-xs text-[#aefeff]">Instant</span>
                    <strong className="leading-5">{game}</strong>
                  </Link>
                ))}
              </div>
            </section>

            <section className="panel p-4">
              <h2 className="section-title mb-3 text-xl">Providers</h2>
              <div className="mobile-row grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                {providers.map((provider) => (
                  <div key={provider} className="rounded-xl border border-[#344e79] bg-[#0b152a] px-3 py-2 text-center text-sm text-[#d5e3ff]">
                    {provider}
                  </div>
                ))}
              </div>
            </section>
          </main>

          <aside className="panel hidden p-3 xl:col-start-3 xl:block">
            <h3 className="section-title mb-3 text-lg">Live Feed</h3>
            <div className="space-y-3 text-sm">
              {[
                "Krish won $285 on Gates of Olympus",
                "Flores joined tournament lobby",
                "Milo activated Welcome Bonus",
                "Nyaan hit x24 in Plinko",
                "Cooper claimed cashback reward",
              ].map((event) => (
                <div key={event} className="rounded-lg border border-[#2f446c] bg-[#0c162b] p-3 text-[#c4d4f5]">
                  {event}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-[#2e4c67] bg-[#0a1c2c] p-3 text-xs text-[#9fc5e3]">
              Real-time chat and activity cards can be wired to websockets later.
            </div>
          </aside>
        </div>

        <nav className="mobile-bottom mt-3 grid grid-cols-4 gap-2 rounded-xl border border-[#2b3f64] bg-[#081021] p-2 text-center text-xs text-[#b8c9ea] xl:hidden">
          <span className="rounded-lg bg-[#10203f] py-2 text-white">Home</span>
          <span className="rounded-lg py-2">Slots</span>
          <span className="rounded-lg py-2">Live</span>
          <span className="rounded-lg py-2">Profile</span>
        </nav>
      </div>
    </div>
  );
}
