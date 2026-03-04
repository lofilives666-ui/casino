"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createIdempotencyKey, getCsrfToken } from "@/lib/client-security";

const USER_AGREEMENT_TEXT = `
Welcome to Yep Casino. By creating an account, you agree to use the service responsibly and according to applicable laws.

1. Eligibility
You must be at least 18 years old and legally allowed to use online gaming services in your region.

2. Account Responsibility
You are responsible for maintaining account confidentiality and all activities performed through your account.

3. Fair Play
Users must not attempt to manipulate games, exploit bugs, or use automated tools to gain unfair advantage.

4. Payments and Balances
Deposits and withdrawals may be subject to verification, compliance checks, limits, and processing delays.

5. KYC and Compliance
You agree to provide accurate identity details for verification when requested.

6. Restrictions
Multiple accounts, chargeback abuse, fraud, and prohibited behavior may lead to suspension or account closure.

7. Privacy
Your data is processed according to our privacy and compliance obligations.

8. Risk Disclosure
Gaming outcomes are uncertain. Play responsibly and only with funds you can afford to lose.

9. Changes
We may update this agreement. Continued use after updates means you accept the revised terms.
`;

export default function SignupPage() {
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(true);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [agreementScrollable, setAgreementScrollable] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const canSubmit = useMemo(() => {
    if (method === "phone") return false;
    return agreementAccepted;
  }, [method, agreementAccepted]);

  function onAgreementScroll(event: React.UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 8;
    if (isAtBottom) setAgreementScrollable(true);
  }

  function openAgreement() {
    setAgreementOpen(true);
    setAgreementScrollable(false);
  }

  function acceptAgreement() {
    if (!agreementScrollable) return;
    setAgreementAccepted(true);
    setAgreementOpen(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (method === "phone") {
      setStatus("error");
      setMessage("Phone number signup will be available soon. Please use email.");
      return;
    }
    if (!agreementAccepted) {
      setStatus("error");
      setMessage("Please read and accept the User Agreement to continue.");
      return;
    }

    setStatus("loading");
    setMessage("");
    try {
      const csrf = await getCsrfToken();
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
          "x-idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({
          fullName,
          email,
          password,
          promoCode: promoCode.trim() || undefined,
          marketingAccepted,
        }),
      });

      let payload: { message?: string } = {};
      try {
        payload = (await response.json()) as { message?: string };
      } catch {
        payload = {};
      }
      if (!response.ok) {
        setStatus("error");
        setMessage(payload.message ?? "Signup failed.");
        return;
      }

      setStatus("success");
      setMessage("Account created. Redirecting to login...");
      setTimeout(() => router.push("/login"), 1200);
    } catch {
      setStatus("error");
      setMessage("Unable to create account right now. Please try again.");
    }
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <p className="section-title text-sm tracking-[0.24em] text-[#ffbe70]">YEP! CASINO</p>
        <h1 className="section-title mt-2 text-3xl font-bold">Create Account</h1>
        <p className="mt-2 text-sm text-[#9eb1d4]">Register and claim your welcome bonus.</p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-[#34517f] bg-[#0b1830] p-1">
          <button
            type="button"
            onClick={() => setMethod("email")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${method === "email" ? "bg-[#2d7de0] text-white" : "text-[#9ab3da]"}`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setMethod("phone")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${method === "phone" ? "bg-[#2d7de0] text-white" : "text-[#9ab3da]"}`}
          >
            Phone Number
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm text-[#bfd1ef]" htmlFor="name">
              Full Name
            </label>
            <input
              className="auth-input"
              id="name"
              type="text"
              placeholder="Your full name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </div>

          {method === "email" ? (
            <div>
              <label className="mb-2 block text-sm text-[#bfd1ef]" htmlFor="email">
                Email
              </label>
              <input
                className="auth-input"
                id="email"
                type="email"
                placeholder="player@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm text-[#bfd1ef]" htmlFor="phone">
                Phone Number
              </label>
              <input
                className="auth-input"
                id="phone"
                type="tel"
                placeholder="+1 555 000 0000"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm text-[#bfd1ef]" htmlFor="password">
              Login Password
            </label>
            <div className="relative">
              <input
                className="auth-input pr-11"
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9bb2d9]"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[#3c547f] bg-[#0d1b34]">
            <button
              type="button"
              onClick={() => setPromoOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-[#dce9ff]"
            >
              <span>Enter Referral / Promo Code</span>
              <span>{promoOpen ? "▲" : "▼"}</span>
            </button>
            {promoOpen ? (
              <div className="px-3 pb-3">
                <input
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value)}
                  placeholder="Promo code (optional)"
                  className="h-10 w-full rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-2 rounded-lg border border-[#334f7d] bg-[#0d1a32] p-3">
            <label className="flex items-start gap-2 text-sm text-[#bcd0ef]">
              <input
                type="checkbox"
                className="mt-1"
                checked={agreementAccepted}
                onChange={(event) => {
                  if (!event.target.checked) {
                    setAgreementAccepted(false);
                    return;
                  }
                  openAgreement();
                }}
              />
              <span>
                I agree to the{" "}
                <button
                  type="button"
                  onClick={openAgreement}
                  className="font-semibold text-[#53e6b9]"
                >
                  User Agreement
                </button>{" "}
                and confirm I am at least 18 years old.
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm text-[#bcd0ef]">
              <input
                type="checkbox"
                className="mt-1"
                checked={marketingAccepted}
                onChange={(event) => setMarketingAccepted(event.target.checked)}
              />
              <span>I agree to receive marketing promotions.</span>
            </label>
          </div>

          <button
            className="h-12 w-full rounded-xl bg-gradient-to-r from-[#ff3d2e] to-[#ffa52f] font-semibold text-white"
            type="submit"
            disabled={status === "loading" || !canSubmit}
          >
            {status === "loading" ? "Creating..." : "Sign Up"}
          </button>
        </form>

        {message ? (
          <p className={`mt-3 text-sm ${status === "error" ? "text-[#ff8f8f]" : "text-[#71ffbb]"}`}>{message}</p>
        ) : null}

        <div className="mt-5 text-sm text-[#8ca1c8]">
          Already have an account?{" "}
          <Link className="font-semibold text-[#13d8ff]" href="/login">
            Login
          </Link>
        </div>

        <div className="mt-5">
          <div className="flex items-center gap-3 text-xs text-[#8ca1c8]">
            <span className="h-px flex-1 bg-[#2e446e]" />
            <span>Or Login with</span>
            <span className="h-px flex-1 bg-[#2e446e]" />
          </div>
          <div className="mt-3 grid grid-cols-6 gap-2">
            {["G", "f", "A", "X", "Tg", "WA"].map((item) => (
              <button
                key={item}
                type="button"
                className="h-11 rounded-lg border border-[#3b5688] bg-[#0d1a33] text-sm font-semibold text-[#dce9ff]"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {agreementOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4">
          <div className="w-full max-w-xl rounded-xl border border-[#39598c] bg-[#081225] p-4">
            <h2 className="section-title text-xl text-white">User Agreement</h2>
            <p className="mt-1 text-sm text-[#9bb2d9]">
              Scroll to the end to enable the Accept button.
            </p>
            <div
              data-testid="agreement-scroll-box"
              onScroll={onAgreementScroll}
              className="mt-3 h-72 overflow-y-auto rounded-lg border border-[#3b5688] bg-[#0d1a32] p-3 text-sm leading-6 text-[#bfd2ef]"
            >
              {USER_AGREEMENT_TEXT.split("\n").map((line, index) => (
                <p key={`${line}-${index}`} className="mb-2 whitespace-pre-wrap">
                  {line}
                </p>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAgreementOpen(false)}
                className="rounded-lg border border-[#3d598a] bg-[#102448] px-4 py-2 text-sm font-semibold text-[#dce9ff]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={acceptAgreement}
                disabled={!agreementScrollable}
                className="rounded-lg bg-[#29a669] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
