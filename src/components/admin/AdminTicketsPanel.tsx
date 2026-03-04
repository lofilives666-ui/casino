"use client";

import { useMemo, useState } from "react";
import { createIdempotencyKey, getCsrfToken } from "@/lib/client-security";

type TicketListItem = {
  id: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  assigneeAdminId: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    kycStatus: string;
    emailVerifiedAt: string | null;
  };
  _count: { messages: number };
};

type TicketDetail = {
  id: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  assigneeAdminId: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    kycStatus: string;
    emailVerifiedAt: string | null;
    balance: number;
  };
  messages: Array<{
    id: string;
    authorUserId: string | null;
    authorRole: string;
    isInternal: boolean;
    message: string;
    createdAt: string;
    author: { fullName: string; email: string } | null;
  }>;
};

const STATUS_OPTIONS = [
  "",
  "open",
  "in_progress",
  "waiting_on_player",
  "waiting_on_admin",
  "escalated",
  "resolved",
  "closed",
  "reopened",
];

export default function AdminTicketsPanel() {
  const [adminKey, setAdminKey] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [statusInput, setStatusInput] = useState("in_progress");
  const [assigneeInput, setAssigneeInput] = useState("");
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState({ openCount: 0, inProgressCount: 0, resolvedCount: 0, totalCount: 0 });

  const hasKey = useMemo(() => adminKey.trim().length > 0, [adminKey]);

  async function loadQueue() {
    if (!hasKey) {
      setMessage("Enter admin key.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (category) params.set("category", category);
      if (q) params.set("q", q);

      const response = await fetch(`/api/admin/tickets?${params.toString()}`, {
        headers: { "x-admin-key": adminKey },
      });
      const data = (await response.json()) as {
        message?: string;
        tickets?: TicketListItem[];
        metrics?: typeof metrics;
      };
      if (!response.ok) {
        setMessage(data.message ?? "Unable to load tickets.");
        return;
      }
      setTickets(data.tickets ?? []);
      setMetrics(data.metrics ?? { openCount: 0, inProgressCount: 0, resolvedCount: 0, totalCount: 0 });
      if (selectedId) {
        await loadDetails(selectedId, false);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails(ticketId: string, withLoading = true) {
    if (!hasKey) {
      setMessage("Enter admin key.");
      return;
    }
    if (withLoading) setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/tickets/${ticketId}`, {
        headers: { "x-admin-key": adminKey },
      });
      const data = (await response.json()) as { message?: string; ticket?: TicketDetail };
      if (!response.ok) {
        setMessage(data.message ?? "Unable to load ticket.");
        return;
      }
      setSelectedId(ticketId);
      setSelected(data.ticket ?? null);
      setStatusInput(data.ticket?.status ?? "in_progress");
      setAssigneeInput(data.ticket?.assigneeAdminId ?? "");
    } finally {
      if (withLoading) setLoading(false);
    }
  }

  async function updateStatus() {
    if (!selectedId) return;
    setLoading(true);
    setMessage("");
    try {
      const csrf = await getCsrfToken();
      const response = await fetch(`/api/admin/tickets/${selectedId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
          "x-csrf-token": csrf,
          "x-idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({
          status: statusInput,
          assigneeAdminId: assigneeInput || null,
        }),
      });
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? (response.ok ? "Updated." : "Unable to update ticket."));
      if (response.ok) {
        await loadQueue();
        await loadDetails(selectedId, false);
      }
    } finally {
      setLoading(false);
    }
  }

  async function postReply() {
    if (!selectedId) return;
    if (!reply.trim()) {
      setMessage("Reply is required.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const csrf = await getCsrfToken();
      const response = await fetch(`/api/admin/tickets/${selectedId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
          "x-csrf-token": csrf,
          "x-idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({
          message: reply,
          isInternal: internalNote,
        }),
      });
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? (response.ok ? "Reply posted." : "Unable to post reply."));
      if (response.ok) {
        setReply("");
        setInternalNote(false);
        await loadQueue();
        await loadDetails(selectedId, false);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <section className="space-y-4">
        <div className="panel rounded-xl p-4">
          <div className="grid gap-2">
            <input
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Admin API key"
              className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by subject/email/name"
              className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
            />
            <div className="grid grid-cols-3 gap-2">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-[#3b5688] bg-[#0f223f] px-2 text-[#e4f0ff]">
                <option value="">status</option>
                {STATUS_OPTIONS.filter(Boolean).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-10 rounded-lg border border-[#3b5688] bg-[#0f223f] px-2 text-[#e4f0ff]">
                <option value="">priority</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="urgent">urgent</option>
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-lg border border-[#3b5688] bg-[#0f223f] px-2 text-[#e4f0ff]">
                <option value="">category</option>
                <option value="payment">payment</option>
                <option value="withdrawal">withdrawal</option>
                <option value="kyc">kyc</option>
                <option value="account">account</option>
                <option value="bonus">bonus</option>
                <option value="technical">technical</option>
                <option value="other">other</option>
              </select>
            </div>
            <button
              type="button"
              onClick={loadQueue}
              disabled={loading}
              className="rounded-lg bg-[#2d7de0] px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              Load Queue
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#a9c0e6]">
            <div className="rounded-md border border-[#3b5688] bg-[#0f223f] p-2">open: {metrics.openCount}</div>
            <div className="rounded-md border border-[#3b5688] bg-[#0f223f] p-2">in progress: {metrics.inProgressCount}</div>
            <div className="rounded-md border border-[#3b5688] bg-[#0f223f] p-2">resolved: {metrics.resolvedCount}</div>
            <div className="rounded-md border border-[#3b5688] bg-[#0f223f] p-2">visible: {metrics.totalCount}</div>
          </div>
          {message ? <p className="mt-2 text-sm text-[#ffdca3]">{message}</p> : null}
        </div>

        <div className="space-y-2">
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => loadDetails(ticket.id)}
              className={`panel w-full rounded-xl p-3 text-left ${selectedId === ticket.id ? "border-[#5d79aa]" : ""}`}
            >
              <p className="text-sm font-semibold text-white">{ticket.subject}</p>
              <p className="text-xs text-[#90abd6]">
                {ticket.user.email} | {ticket.category} | {ticket.priority} | {ticket.status}
              </p>
              <p className="text-xs text-[#7f9bc6]">messages: {ticket._count.messages}</p>
            </button>
          ))}
          {!loading && tickets.length === 0 ? (
            <div className="panel rounded-xl p-3 text-sm text-[#8ea9d6]">No tickets for selected filter.</div>
          ) : null}
        </div>
      </section>

      <section className="panel rounded-xl p-4">
        {!selected ? (
          <p className="text-sm text-[#8ea9d6]">Select a ticket from the queue to view and resolve.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-white">{selected.subject}</h2>
              <p className="text-sm text-[#9cb4d8]">
                {selected.user.fullName} ({selected.user.email}) | {selected.category} | {selected.priority} |{" "}
                {selected.status}
              </p>
              <p className="mt-2 text-sm text-[#d0def3]">{selected.description}</p>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <select value={statusInput} onChange={(e) => setStatusInput(e.target.value)} className="h-10 rounded-lg border border-[#3b5688] bg-[#0f223f] px-3 text-[#e4f0ff]">
                {STATUS_OPTIONS.filter(Boolean).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                value={assigneeInput}
                onChange={(e) => setAssigneeInput(e.target.value)}
                placeholder="Assignee admin userId (optional)"
                className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none"
              />
              <button
                type="button"
                onClick={updateStatus}
                disabled={loading}
                className="rounded-lg bg-[#2d7de0] px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                Update Ticket
              </button>
            </div>

            <div className="space-y-2 rounded-lg border border-[#324d79] bg-[#0e1d39] p-3">
              <h3 className="text-sm font-semibold text-[#dce9ff]">Conversation</h3>
              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {selected.messages.map((entry) => (
                  <div key={entry.id} className={`rounded-md border p-2 text-sm ${entry.authorRole === "admin" ? "border-[#4a5f84] bg-[#13284a]" : "border-[#3f546f] bg-[#121f36]"}`}>
                    <p className="text-xs text-[#9cb5dc]">
                      {entry.authorRole}
                      {entry.isInternal ? " (internal)" : ""} | {new Date(entry.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-[#dbe8fe]">{entry.message}</p>
                  </div>
                ))}
                {selected.messages.length === 0 ? (
                  <p className="text-sm text-[#8ea9d6]">No messages yet.</p>
                ) : null}
              </div>

              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply"
                className="h-24 w-full rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 py-2 text-[#dcecff] outline-none"
              />
              <label className="flex items-center gap-2 text-xs text-[#a7bee2]">
                <input
                  type="checkbox"
                  checked={internalNote}
                  onChange={(e) => setInternalNote(e.target.checked)}
                />
                Internal note (not visible to player)
              </label>
              <button
                type="button"
                onClick={postReply}
                disabled={loading}
                className="rounded-lg bg-[#29a669] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Send Reply
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
