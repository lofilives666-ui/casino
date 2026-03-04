"use client";

import { useState } from "react";
import { createIdempotencyKey, getCsrfToken } from "@/lib/client-security";

type PaymentTx = {
  id: string;
  kind: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  provider: string | null;
  providerRef: string | null;
  requestedAt: string;
  processedAt: string | null;
  failureReason: string | null;
  user: {
    fullName: string;
    email: string;
    balance: number;
    kycStatus: string;
    emailVerifiedAt: string | null;
  };
};

export default function PaymentsReviewPanel() {
  const [adminKey, setAdminKey] = useState("");
  const [status, setStatus] = useState("pending");
  const [kind, setKind] = useState("");
  const [transactions, setTransactions] = useState<PaymentTx[]>([]);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function loadQueue() {
    if (!adminKey.trim()) {
      setMessage("Enter admin key.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const query = new URLSearchParams();
      query.set("status", status);
      if (kind) query.set("kind", kind);
      const response = await fetch(`/api/admin/payments?${query.toString()}`, {
        headers: { "x-admin-key": adminKey },
      });
      const data = (await response.json()) as { message?: string; transactions?: PaymentTx[] };
      if (!response.ok) {
        setMessage(data.message ?? "Unable to load payments.");
        setTransactions([]);
        return;
      }
      setTransactions(data.transactions ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: string) {
    setLoading(true);
    setMessage("");
    try {
      const csrf = await getCsrfToken();
      const response = await fetch("/api/admin/payments/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
          "x-csrf-token": csrf,
          "x-idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({ transactionId: id }),
      });
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? (response.ok ? "Approved." : "Failed."));
      if (response.ok) await loadQueue();
    } finally {
      setLoading(false);
    }
  }

  async function reject(id: string) {
    setLoading(true);
    setMessage("");
    try {
      const csrf = await getCsrfToken();
      const response = await fetch("/api/admin/payments/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
          "x-csrf-token": csrf,
          "x-idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({
          transactionId: id,
          reason: reason[id] ?? "",
        }),
      });
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? (response.ok ? "Rejected." : "Failed."));
      if (response.ok) await loadQueue();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel rounded-xl p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_160px_180px_140px]">
          <input
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Admin API key"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-lg border border-[#3b5688] bg-[#0f223f] px-3 text-[#e4f0ff]"
          >
            <option value="pending">pending</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
          </select>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="h-10 rounded-lg border border-[#3b5688] bg-[#0f223f] px-3 text-[#e4f0ff]"
          >
            <option value="">all kinds</option>
            <option value="deposit">deposit</option>
            <option value="withdrawal">withdrawal</option>
            <option value="GAME_ROUND">game_round</option>
          </select>
          <button
            type="button"
            onClick={loadQueue}
            disabled={loading}
            className="rounded-lg bg-[#2d7de0] px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Load
          </button>
        </div>
        {message ? <p className="mt-2 text-sm text-[#ffdca3]">{message}</p> : null}
      </div>

      <div className="space-y-3">
        {transactions.map((tx) => (
          <article key={tx.id} className="panel rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-white">
                  {tx.kind} • ${tx.amount.toFixed(2)} {tx.currency}
                </p>
                <p className="text-sm text-[#8fb1cc]">
                  {tx.user.fullName} ({tx.user.email}) • balance ${tx.user.balance.toFixed(2)}
                </p>
                <p className="text-xs text-[#8ea9d6]">
                  requested: {new Date(tx.requestedAt).toLocaleString()} • method: {tx.method ?? "n/a"}
                </p>
              </div>
              <span className="rounded-full border border-[#4b6697] bg-[#0c1f3e] px-2 py-1 text-xs text-[#d7e6ff]">
                {tx.status}
              </span>
            </div>

            {tx.status === "pending" ? (
              <div className="mt-3">
                <textarea
                  value={reason[tx.id] ?? ""}
                  onChange={(e) => setReason((prev) => ({ ...prev, [tx.id]: e.target.value }))}
                  placeholder="Reject reason (optional)"
                  className="h-16 w-full rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 py-2 text-[#dcecff] outline-none"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => approve(tx.id)}
                    disabled={loading}
                    className="rounded-lg bg-[#1f7a1f] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => reject(tx.id)}
                    disabled={loading}
                    className="rounded-lg bg-[#8a2d2d] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#8ea9d6]">
                {tx.processedAt ? `processed: ${new Date(tx.processedAt).toLocaleString()}` : ""}
                {tx.failureReason ? ` • reason: ${tx.failureReason}` : ""}
              </p>
            )}
          </article>
        ))}

        {!loading && transactions.length === 0 ? (
          <div className="panel rounded-xl p-4 text-sm text-[#8ea9d6]">No transactions for selected filter.</div>
        ) : null}
      </div>
    </div>
  );
}
