"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      setStatus("error");
      setMessage(payload.message ?? "Login failed.");
      return;
    }

    setStatus("success");
    setMessage("Login successful. Redirecting to home...");
    setTimeout(() => router.push("/"), 900);
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <p className="section-title text-sm tracking-[0.24em] text-[#ffbe70]">YEP! CASINO</p>
        <h1 className="section-title mt-2 text-3xl font-bold">Welcome Back</h1>
        <p className="mt-2 text-sm text-[#9eb1d4]">Sign in to continue your casino journey.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
              placeholder="Enter password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button
            className="h-12 w-full rounded-xl bg-gradient-to-r from-[#ff3d2e] to-[#ffa52f] font-semibold text-white"
            type="submit"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Signing in..." : "Login"}
          </button>
        </form>

        {message ? (
          <p className={`mt-3 text-sm ${status === "error" ? "text-[#ff8f8f]" : "text-[#71ffbb]"}`}>{message}</p>
        ) : null}

        <div className="mt-5 text-sm text-[#8ca1c8]">
          New here?{" "}
          <Link className="font-semibold text-[#13d8ff]" href="/signup">
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
}
