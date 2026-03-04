"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createIdempotencyKey, getCsrfToken } from "@/lib/client-security";

type Limits = {
  minDeposit: number;
  maxDeposit: number;
  minWithdraw: number;
  maxWithdraw: number;
  dailyWithdrawLimit: number;
  gates: {
    emailVerified: boolean;
    kycVerified: boolean;
    canWithdraw: boolean;
  };
};

export default function PaymentActions() {
  const router = useRouter();
  const [depositAmount, setDepositAmount] = useState("100");
  const [withdrawAmount, setWithdrawAmount] = useState("100");
  const [method, setMethod] = useState("bank_transfer");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState("");

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/payments/limits");
      if (!response.ok) return;
      const data = (await response.json()) as Limits;
      setLimits(data);
    })();
  }, []);

  async function requestDeposit() {
    setLoading(true);
    setMessage("");
    setCheckoutUrl("");
    try {
      const csrf = await getCsrfToken();
      const response = await fetch("/api/payments/deposit/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
          "x-idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({
          amount: Number(depositAmount),
          method,
        }),
      });
      const data = (await response.json()) as { message?: string; checkout?: { url?: string } };
      setMessage(data.message ?? (response.ok ? "Deposit request submitted." : "Unable to request deposit."));
      setCheckoutUrl(data.checkout?.url ?? "");
      if (response.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function requestWithdraw() {
    setLoading(true);
    setMessage("");
    setCheckoutUrl("");
    try {
      const csrf = await getCsrfToken();
      const response = await fetch("/api/payments/withdraw/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
          "x-idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({
          amount: Number(withdrawAmount),
          method,
        }),
      });
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? (response.ok ? "Withdrawal request submitted." : "Unable to request withdrawal."));
      if (response.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel rounded-xl p-4 lg:col-span-2">
      <h2 className="section-title mb-3 text-xl">Payments</h2>

      {limits ? (
        <div className="mb-3 rounded-lg border border-[#385684] bg-[#0f223f] p-3 text-sm text-[#b9d0e4]">
          <p>
            Deposit: ${limits.minDeposit} - ${limits.maxDeposit} | Withdraw: ${limits.minWithdraw} - ${limits.maxWithdraw}
          </p>
          <p>Daily withdraw limit: ${limits.dailyWithdrawLimit}</p>
          <p>Email verified: {limits.gates.emailVerified ? "Yes" : "No"} | KYC verified: {limits.gates.kycVerified ? "Yes" : "No"}</p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[#385684] bg-[#0f223f] p-3">
          <p className="mb-2 font-semibold text-white">Deposit Request</p>
          <input
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            type="number"
            min={0}
            className="mb-2 h-10 w-full rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
          />
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="mb-2 h-10 w-full rounded-lg border border-[#3b5688] bg-[#0f223f] px-3 text-[#e4f0ff]"
          >
            <option value="bank_transfer">Bank Transfer</option>
            <option value="card">Card</option>
            <option value="crypto">Crypto</option>
          </select>
          <button
            type="button"
            onClick={requestDeposit}
            disabled={loading}
            className="rounded-lg bg-[#2d7de0] px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Request Deposit
          </button>
        </div>

        <div className="rounded-lg border border-[#385684] bg-[#0f223f] p-3">
          <p className="mb-2 font-semibold text-white">Withdraw Request</p>
          <input
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            type="number"
            min={0}
            className="mb-2 h-10 w-full rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
          />
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="mb-2 h-10 w-full rounded-lg border border-[#3b5688] bg-[#0f223f] px-3 text-[#e4f0ff]"
          >
            <option value="bank_transfer">Bank Transfer</option>
            <option value="card">Card</option>
            <option value="crypto">Crypto</option>
          </select>
          <button
            type="button"
            onClick={requestWithdraw}
            disabled={loading || !limits?.gates.canWithdraw}
            className="rounded-lg bg-[#2d7de0] px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Request Withdraw
          </button>
        </div>
      </div>

      {message ? <p className="mt-3 text-sm text-[#ffdca3]">{message}</p> : null}
      {checkoutUrl ? (
        <div className="mt-2">
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex rounded-lg bg-[#1f7a1f] px-3 py-2 text-sm font-semibold text-white"
          >
            Open Deposit Checkout
          </a>
        </div>
      ) : null}
    </section>
  );
}
