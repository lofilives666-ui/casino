"use client";

import { useState } from "react";

export default function EmailVerificationPanel({
  isVerified,
}: {
  isVerified: boolean;
}) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string>("");
  const [devCode, setDevCode] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setLoading(true);
    setMessage("");
    setDevCode("");
    try {
      const response = await fetch("/api/auth/send-verification", { method: "POST" });
      const data = (await response.json()) as { message?: string; code?: string };
      if (!response.ok) {
        setMessage(data.message ?? "Unable to send code.");
        return;
      }
      setMessage(data.message ?? "Verification code sent.");
      if (data.code) setDevCode(data.code);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? (response.ok ? "Email verified." : "Unable to verify code."));
      if (response.ok) {
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  if (isVerified) {
    return (
      <div className="rounded-xl border border-[#2f6a4e] bg-[#0f2a22] p-4 text-[#7dffbf]">
        Email verification completed.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#385684] bg-[#0f223f] p-4">
      <p className="text-sm text-[#b9d0e4]">Verify your email to unlock withdrawals and higher limits.</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={sendCode}
          disabled={loading}
          className="rounded-lg border border-[#3b5688] bg-[#17325f] px-3 py-2 text-sm font-semibold text-[#dce9ff]"
        >
          Send Code
        </button>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter 6-digit code"
          className="h-10 w-full rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
        />
        <button
          type="button"
          onClick={verifyCode}
          disabled={loading || code.trim().length < 6}
          className="rounded-lg bg-[#2d7de0] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Verify
        </button>
      </div>
      {message ? <p className="text-sm text-[#ffdca3]">{message}</p> : null}
      {devCode ? <p className="text-xs text-[#8fb1cc]">Dev code: {devCode}</p> : null}
    </div>
  );
}

