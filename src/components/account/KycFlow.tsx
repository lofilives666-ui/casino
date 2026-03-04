"use client";

import { useEffect, useMemo, useState } from "react";

type KycStatusResponse = {
  status: string;
  submission: {
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
  } | null;
};

export default function KycFlow() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("unverified");
  const [submissionId, setSubmissionId] = useState<string>("");

  const [legalName, setLegalName] = useState("");
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [docType, setDocType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idFrontUrl, setIdFrontUrl] = useState("");
  const [idBackUrl, setIdBackUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");
  const [addressProofUrl, setAddressProofUrl] = useState("");
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [addressProofFile, setAddressProofFile] = useState<File | null>(null);

  const canSubmitBasic = useMemo(
    () => Boolean(legalName && dob && country && addressLine1 && city && postalCode),
    [legalName, dob, country, addressLine1, city, postalCode],
  );
  const canSubmitDocs = useMemo(() => Boolean(submissionId), [submissionId]);
  const canFinalSubmit = useMemo(
    () => Boolean(submissionId && docType && idFrontUrl && selfieUrl && addressProofUrl),
    [submissionId, docType, idFrontUrl, selfieUrl, addressProofUrl],
  );

  async function loadStatus() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/kyc/status");
      const data = (await response.json()) as KycStatusResponse;
      if (!response.ok) {
        setMessage("Unable to load KYC status.");
        return;
      }
      setStatus(data.status);
      if (data.submission) {
        setSubmissionId(data.submission.id);
        setLegalName(data.submission.legalName ?? "");
        setDob(data.submission.dob ? data.submission.dob.slice(0, 10) : "");
        setCountry(data.submission.country ?? "");
        setAddressLine1(data.submission.addressLine1 ?? "");
        setCity(data.submission.city ?? "");
        setPostalCode(data.submission.postalCode ?? "");
        setDocType(data.submission.docType ?? "");
        setIdNumber(data.submission.idNumber ?? "");
        setIdFrontUrl(data.submission.idFrontUrl ?? "");
        setIdBackUrl(data.submission.idBackUrl ?? "");
        setSelfieUrl(data.submission.selfieUrl ?? "");
        setAddressProofUrl(data.submission.addressProofUrl ?? "");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function submitBasic() {
    setMessage("");
    const response = await fetch("/api/kyc/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legalName,
        dob,
        country,
        addressLine1,
        city,
        postalCode,
      }),
    });
    const data = (await response.json()) as { message?: string; submissionId?: string };
    setMessage(data.message ?? (response.ok ? "Basic details saved." : "Unable to save."));
    if (response.ok && data.submissionId) {
      setSubmissionId(data.submissionId);
      setStatus("basic_submitted");
    }
  }

  async function submitDocs() {
    setMessage("");
    const response = await fetch("/api/kyc/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId,
        docType,
        idNumber,
        idFrontUrl,
        idBackUrl,
        selfieUrl,
        addressProofUrl,
      }),
    });
    const data = (await response.json()) as { message?: string };
    setMessage(data.message ?? (response.ok ? "Documents saved." : "Unable to save docs."));
  }

  async function uploadFile(kind: "id_front" | "id_back" | "selfie" | "address_proof", file: File | null) {
    if (!file) {
      setMessage("Please choose a file first.");
      return;
    }
    setMessage("");
    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("file", file);

    const response = await fetch("/api/kyc/file-upload", {
      method: "POST",
      body: formData,
    });
    const data = (await response.json()) as { message?: string; fileRef?: string };
    if (!response.ok) {
      setMessage(data.message ?? "Unable to upload file.");
      return;
    }

    if (kind === "id_front") setIdFrontUrl(data.fileRef ?? "");
    if (kind === "id_back") setIdBackUrl(data.fileRef ?? "");
    if (kind === "selfie") setSelfieUrl(data.fileRef ?? "");
    if (kind === "address_proof") setAddressProofUrl(data.fileRef ?? "");
    setMessage(data.message ?? "File uploaded.");
  }

  async function finalSubmit() {
    setMessage("");
    const response = await fetch("/api/kyc/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    });
    const data = (await response.json()) as { message?: string };
    setMessage(data.message ?? (response.ok ? "Submitted for review." : "Unable to submit."));
    if (response.ok) {
      setStatus("pending_review");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#385684] bg-[#0f223f] p-4">
        <p className="text-xs uppercase tracking-[0.1em] text-[#8ea9d6]">Current KYC Status</p>
        <p className="mt-1 text-lg font-semibold text-white">{status.replaceAll("_", " ")}</p>
      </div>

      <div className="panel rounded-xl p-4">
        <h3 className="section-title mb-3 text-lg">1. Basic Details</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Legal full name"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
          />
          <input
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            type="date"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
          />
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
          />
          <input
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder="Address line 1"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
          />
          <input
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder="Postal code"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
          />
        </div>
        <button
          type="button"
          onClick={submitBasic}
          disabled={!canSubmitBasic || loading}
          className="mt-3 rounded-lg bg-[#2d7de0] px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          Save Basic KYC
        </button>
      </div>

      <div className="panel rounded-xl p-4">
        <h3 className="section-title mb-3 text-lg">2. Document Metadata</h3>
        <p className="mb-3 text-sm text-[#8fb1cc]">
          Use secure uploaded file URLs here. This is metadata wiring for now.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            placeholder="Doc type (passport / id card)"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
          />
          <input
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="ID number"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
          />
          <input
            value={idFrontUrl}
            readOnly
            placeholder="ID front ref"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#10203d] px-3 text-[#dcecff] outline-none"
          />
          <input
            value={idBackUrl}
            readOnly
            placeholder="ID back ref (optional)"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#10203d] px-3 text-[#dcecff] outline-none"
          />
          <input
            value={selfieUrl}
            readOnly
            placeholder="Selfie ref"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#10203d] px-3 text-[#dcecff] outline-none"
          />
          <input
            value={addressProofUrl}
            readOnly
            placeholder="Address proof ref"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#10203d] px-3 text-[#dcecff] outline-none"
          />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-[#3b5688] bg-[#0b152a] p-2">
            <label className="mb-1 block text-xs text-[#8ea9d6]">ID Front (jpg/png/pdf)</label>
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setIdFrontFile(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => uploadFile("id_front", idFrontFile)} className="mt-2 rounded bg-[#17325f] px-2 py-1 text-xs text-white">
              Upload
            </button>
          </div>
          <div className="rounded-lg border border-[#3b5688] bg-[#0b152a] p-2">
            <label className="mb-1 block text-xs text-[#8ea9d6]">ID Back (optional)</label>
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setIdBackFile(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => uploadFile("id_back", idBackFile)} className="mt-2 rounded bg-[#17325f] px-2 py-1 text-xs text-white">
              Upload
            </button>
          </div>
          <div className="rounded-lg border border-[#3b5688] bg-[#0b152a] p-2">
            <label className="mb-1 block text-xs text-[#8ea9d6]">Selfie</label>
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => uploadFile("selfie", selfieFile)} className="mt-2 rounded bg-[#17325f] px-2 py-1 text-xs text-white">
              Upload
            </button>
          </div>
          <div className="rounded-lg border border-[#3b5688] bg-[#0b152a] p-2">
            <label className="mb-1 block text-xs text-[#8ea9d6]">Address Proof</label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => setAddressProofFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => uploadFile("address_proof", addressProofFile)}
              className="mt-2 rounded bg-[#17325f] px-2 py-1 text-xs text-white"
            >
              Upload
            </button>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={submitDocs}
            disabled={!canSubmitDocs || loading}
            className="rounded-lg border border-[#3b5688] bg-[#17325f] px-4 py-2 font-semibold text-[#dce9ff] disabled:opacity-50"
          >
            Save Docs
          </button>
          <button
            type="button"
            onClick={finalSubmit}
            disabled={!canFinalSubmit || loading}
            className="rounded-lg bg-[#2d7de0] px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Submit For Review
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-[#ffdca3]">{message}</p> : null}
    </div>
  );
}
