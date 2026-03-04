"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createIdempotencyKey, getCsrfToken } from "@/lib/client-security";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      const csrf = await getCsrfToken();
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "x-csrf-token": csrf,
          "x-idempotency-key": createIdempotencyKey(),
        },
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="flex w-full items-center justify-center rounded-lg border border-[#4b6697] bg-[#0c1f3e] px-3 py-2 font-semibold text-[#ffcf8d] hover:bg-[#122951] disabled:opacity-60"
    >
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}
