"use client";

import { useMemo, useState } from "react";
import { createIdempotencyKey, getCsrfToken } from "@/lib/client-security";

type Submission = {
  id: string;
  status: string;
  legalName: string;
  dob: string;
  country: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  docType: string | null;
  idNumber: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  addressProofUrl: string | null;
  reviewNotes: string | null;
  submittedAt: string | null;
  createdAt: string;
  user: {
    fullName: string;
    email: string;
    kycStatus: string;
  };
};

export default function KycReviewPanel() {
  const [adminKey, setAdminKey] = useState("");
  const [status, setStatus] = useState("pending_review");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const hasKey = useMemo(() => adminKey.trim().length > 0, [adminKey]);

  async function loadList() {
    if (!hasKey) {
      setMessage("Enter admin key first.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/kyc/review?status=${status}`, {
        headers: { "x-admin-key": adminKey },
      });
      const data = (await response.json()) as { message?: string; submissions?: Submission[] };
      if (!response.ok) {
        setMessage(data.message ?? "Unable to load submissions.");
        setSubmissions([]);
        return;
      }
      setSubmissions(data.submissions ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function review(submissionId: string, decision: "verified" | "rejected") {
    if (!hasKey) {
      setMessage("Enter admin key first.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const csrf = await getCsrfToken();
      const response = await fetch("/api/kyc/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
          "x-csrf-token": csrf,
          "x-idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({
          submissionId,
          decision,
          notes: notes[submissionId] ?? "",
        }),
      });
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? (response.ok ? "Updated." : "Failed."));
      if (response.ok) {
        await loadList();
      }
    } finally {
      setLoading(false);
    }
  }

  async function openPrivateFile(fileRef: string) {
    if (!hasKey) {
      setMessage("Enter admin key first.");
      return;
    }
    if (!fileRef) return;

    const response = await fetch(`/api/admin/kyc/file?ref=${encodeURIComponent(fileRef)}`, {
      headers: { "x-admin-key": adminKey },
    });
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? "Unable to open file.");
      return;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  return (
    <div className="space-y-4">
      <div className="panel rounded-xl p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_200px_140px]">
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
            <option value="pending_review">pending_review</option>
            <option value="verified">verified</option>
            <option value="rejected">rejected</option>
            <option value="basic_submitted">basic_submitted</option>
          </select>
          <button
            type="button"
            onClick={loadList}
            disabled={loading}
            className="rounded-lg bg-[#2d7de0] px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Load
          </button>
        </div>
        {message ? <p className="mt-2 text-sm text-[#ffdca3]">{message}</p> : null}
      </div>

      <div className="space-y-3">
        {submissions.map((item) => (
          <article key={item.id} className="panel rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-white">{item.legalName}</p>
                <p className="text-sm text-[#8fb1cc]">
                  {item.user.email} - {item.country}
                </p>
                <p className="text-xs text-[#8ea9d6]">
                  Submitted: {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "Not submitted"}
                </p>
              </div>
              <span className="rounded-full border border-[#4b6697] bg-[#0c1f3e] px-2 py-1 text-xs text-[#d7e6ff]">
                {item.status}
              </span>
            </div>

            <div className="mt-3 grid gap-2 text-sm text-[#c6d8ef] md:grid-cols-2">
              <p>DOB: {new Date(item.dob).toLocaleDateString()}</p>
              <p>Address: {item.addressLine1}, {item.city}, {item.postalCode}</p>
              <p>Doc Type: {item.docType ?? "-"}</p>
              <p>ID Number: {item.idNumber ?? "-"}</p>

              <div className="flex items-center gap-2">
                <p>ID Front:</p>
                {item.idFrontUrl ? (
                  <button
                    type="button"
                    onClick={() => openPrivateFile(item.idFrontUrl as string)}
                    className="rounded-md border border-[#3f5a8f] bg-[#102448] px-2 py-0.5 text-xs text-[#d7e6ff]"
                  >
                    Open
                  </button>
                ) : (
                  <span>-</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <p>ID Back:</p>
                {item.idBackUrl ? (
                  <button
                    type="button"
                    onClick={() => openPrivateFile(item.idBackUrl as string)}
                    className="rounded-md border border-[#3f5a8f] bg-[#102448] px-2 py-0.5 text-xs text-[#d7e6ff]"
                  >
                    Open
                  </button>
                ) : (
                  <span>-</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <p>Selfie:</p>
                {item.selfieUrl ? (
                  <button
                    type="button"
                    onClick={() => openPrivateFile(item.selfieUrl as string)}
                    className="rounded-md border border-[#3f5a8f] bg-[#102448] px-2 py-0.5 text-xs text-[#d7e6ff]"
                  >
                    Open
                  </button>
                ) : (
                  <span>-</span>
                )}
              </div>

              <div className="flex items-center gap-2 md:col-span-2">
                <p>Address Proof:</p>
                {item.addressProofUrl ? (
                  <button
                    type="button"
                    onClick={() => openPrivateFile(item.addressProofUrl as string)}
                    className="rounded-md border border-[#3f5a8f] bg-[#102448] px-2 py-0.5 text-xs text-[#d7e6ff]"
                  >
                    Open
                  </button>
                ) : (
                  <span>-</span>
                )}
              </div>
            </div>

            <textarea
              value={notes[item.id] ?? ""}
              onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
              placeholder="Review notes"
              className="mt-3 h-20 w-full rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 py-2 text-[#dcecff] outline-none"
            />

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => review(item.id, "verified")}
                disabled={loading}
                className="rounded-lg bg-[#1f7a1f] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => review(item.id, "rejected")}
                disabled={loading}
                className="rounded-lg bg-[#8a2d2d] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </article>
        ))}

        {!loading && submissions.length === 0 ? (
          <div className="panel rounded-xl p-4 text-sm text-[#8ea9d6]">No submissions found for selected status.</div>
        ) : null}
      </div>
    </div>
  );
}
