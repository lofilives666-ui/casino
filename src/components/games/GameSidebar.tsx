import Link from "next/link";
import Image from "next/image";

type GameNavItem = {
  label: string;
  href: string;
  active?: boolean;
};

const gameNav: GameNavItem[] = [
  { label: "Thunder Plinko", href: "/games/thunder-plinko", active: true },
  { label: "Midas Plinko", href: "#" },
  { label: "Rocket Crash", href: "#" },
  { label: "Lucky Mines", href: "#" },
];

export default function GameSidebar() {
  return (
    <aside className="sticky top-2 hidden self-start xl:block">
      <div className="relative h-14 w-full">
        <Image src="/images/logo-latest.png" alt="Casino logo" fill className="object-contain object-center" unoptimized />
      </div>

      <div className="panel mt-3 max-h-[calc(100vh-110px)] overflow-y-auto p-3">
        <div className="mb-2 rounded-xl bg-gradient-to-r from-[#ff4a2f] to-[#ffbb45] p-3 font-semibold text-[#1a0906]">
          Promotions
        </div>

        <nav className="space-y-1 text-sm text-[#b9c8e8]">
          {[
            "Home",
            "Popular",
            "Slots",
            "Live casino",
            "Top Games",
            "Insta games",
            "Tournaments",
            "Roulette",
          ].map((item) => (
            <div
              key={item}
              className={`rounded-lg px-3 py-1.5 ${
                item === "Insta games"
                  ? "border border-[#3c547f] bg-[#0e1a33] text-white"
                  : "border border-transparent hover:border-[#3c547f] hover:bg-[#0e1a33]"
              }`}
            >
              {item}
            </div>
          ))}
        </nav>

        <div className="mt-3 border-t border-[#2d446d] pt-3">
          <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[#8ba7d7]">Instant Games</p>
          {gameNav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`block rounded-lg px-3 py-2 ${
                item.active
                  ? "border border-[#3c547f] bg-[#0e1a33] text-white"
                  : "border border-transparent text-[#9fb3d8] hover:border-[#3c547f] hover:bg-[#0e1a33]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <Link
          href="/"
          className="mt-4 block rounded-lg border border-[#4b6697] bg-[#0c1f3e] px-3 py-2 text-center font-semibold text-[#d7e6ff] hover:bg-[#122951]"
        >
          Back To Lobby
        </Link>
      </div>
    </aside>
  );
}
