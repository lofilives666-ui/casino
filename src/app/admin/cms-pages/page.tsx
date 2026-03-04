import Link from "next/link";

export const runtime = "nodejs";

export default function AdminCmsPagesPage() {
  return (
    <div className="casino-bg min-h-screen p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="section-title text-2xl text-white">CMS Pages</h1>
              <p className="text-sm text-[#8fb1cc]">Manage static content and legal pages (MVP placeholder)</p>
            </div>
            <Link href="/admin" className="rounded-full bg-[#2d7de0] px-4 py-1.5 text-sm font-semibold text-white">
              Dashboard
            </Link>
          </div>
        </div>
        <div className="panel rounded-xl p-4 text-sm text-[#bcd1ef]">
          Planned: manage user agreement, terms, help content, and promo banners from admin CMS.
        </div>
      </div>
    </div>
  );
}
