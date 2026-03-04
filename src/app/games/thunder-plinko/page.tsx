import ThunderPlinko from "@/components/games/ThunderPlinko";
import GameSidebar from "@/components/games/GameSidebar";

export default function ThunderPlinkoPage() {
  return (
    <main className="casino-bg min-h-screen px-3 py-4">
      <div className="w-full">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[230px_1fr]">
          <GameSidebar />
          <ThunderPlinko />
        </div>
      </div>
    </main>
  );
}
