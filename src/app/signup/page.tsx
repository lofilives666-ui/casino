"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createIdempotencyKey, getCsrfToken } from "@/lib/client-security";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        body: JSON.stringify({ fullName, email, password }),
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
          <div>
            <label className="mb-2 block text-sm text-[#bfd1ef]" htmlFor="password">
              Password
            </label>
            <input
              className="auth-input"
              id="password"
              type="password"
              placeholder="Create password"
              value={password}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button
            className="h-12 w-full rounded-xl bg-gradient-to-r from-[#ff3d2e] to-[#ffa52f] font-semibold text-white"
            type="submit"
            disabled={status === "loading"}
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
      </section>
    </main>
  );
}
