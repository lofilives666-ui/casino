"use client";

import { useState } from "react";
import { createIdempotencyKey, getCsrfToken } from "@/lib/client-security";

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  balance: number;
  kycStatus: string;
  emailVerifiedAt: string | null;
  twoFactorEnabled: boolean;
  createdAt: string;
  _count: {
    walletTransactions: number;
    kycSubmissions: number;
    supportTickets: number;
  };
};

export default function AdminUsersPanel() {
  const [adminKey, setAdminKey] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadUsers() {
    if (!adminKey.trim()) {
      setMessage("Enter admin key.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`, {
        headers: { "x-admin-key": adminKey },
      });
      const data = (await response.json()) as { message?: string; users?: UserRow[] };
      if (!response.ok) {
        setMessage(data.message ?? "Unable to load users.");
        return;
      }
      setRows(data.users ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function toggle2fa(user: UserRow) {
    setLoading(true);
    setMessage("");
    try {
      const csrf = await getCsrfToken();
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
          "x-csrf-token": csrf,
          "x-idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({
          userId: user.id,
          setTwoFactorEnabled: !user.twoFactorEnabled,
        }),
      });
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? (response.ok ? "Updated." : "Unable to update."));
      if (response.ok) {
        await loadUsers();
      }
    } finally {
      setLoading(false);
    }
  }

  async function markKyc(user: UserRow, next: "verified" | "rejected" | "unverified") {
    setLoading(true);
    setMessage("");
    try {
      const csrf = await getCsrfToken();
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
          "x-csrf-token": csrf,
          "x-idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({
          userId: user.id,
          kycStatus: next,
        }),
      });
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? (response.ok ? "Updated." : "Unable to update."));
      if (response.ok) {
        await loadUsers();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel rounded-xl p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px]">
          <input
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Admin API key"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name/email"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
          />
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="rounded-lg bg-[#2d7de0] px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Load Users
          </button>
        </div>
        {message ? <p className="mt-2 text-sm text-[#ffdca3]">{message}</p> : null}
      </div>

      <div className="space-y-3">
        {rows.map((user) => (
          <article key={user.id} className="panel rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-white">{user.fullName}</p>
                <p className="text-sm text-[#8fb1cc]">{user.email}</p>
                <p className="text-xs text-[#91abd5]">
                  balance ${user.balance.toFixed(2)} | kyc {user.kycStatus} | 2FA{" "}
                  {user.twoFactorEnabled ? "enabled" : "disabled"}
                </p>
              </div>
              <p className="text-xs text-[#8ea9d6]">tickets {user._count.supportTickets}</p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggle2fa(user)}
                disabled={loading}
                className="rounded-lg border border-[#3f5d8f] bg-[#102448] px-3 py-1.5 text-xs font-semibold text-[#dce9ff]"
              >
                Toggle 2FA
              </button>
              <button
                type="button"
                onClick={() => markKyc(user, "verified")}
                disabled={loading}
                className="rounded-lg bg-[#1f7a1f] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Mark KYC Verified
              </button>
              <button
                type="button"
                onClick={() => markKyc(user, "rejected")}
                disabled={loading}
                className="rounded-lg bg-[#8a2d2d] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Mark KYC Rejected
              </button>
              <button
                type="button"
                onClick={() => markKyc(user, "unverified")}
                disabled={loading}
                className="rounded-lg border border-[#3f5d8f] bg-[#102448] px-3 py-1.5 text-xs font-semibold text-[#dce9ff]"
              >
                Reset KYC
              </button>
            </div>
          </article>
        ))}

        {!loading && rows.length === 0 ? (
          <div className="panel rounded-xl p-4 text-sm text-[#8ea9d6]">No users found.</div>
        ) : null}
      </div>
    </div>
  );
}
