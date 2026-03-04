"use client";

import { useState } from "react";
import { createIdempotencyKey, getCsrfToken } from "@/lib/client-security";

type Ticket = {
  id: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
  messages: Array<{
    id: string;
    authorRole: string;
    isInternal: boolean;
    message: string;
    createdAt: string;
  }>;
};

export default function SupportTicketsPanel() {
  const [category, setCategory] = useState("technical");
  const [priority, setPriority] = useState("medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [reply, setReply] = useState<Record<string, string>>({});
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadTickets() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/support/tickets");
      const data = (await response.json()) as { message?: string; tickets?: Ticket[] };
      if (!response.ok) {
        setMessage(data.message ?? "Unable to load tickets.");
        return;
      }
      setTickets(data.tickets ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function createTicket() {
    setLoading(true);
    setMessage("");
    try {
      const csrf = await getCsrfToken();
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
          "x-idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({
          category,
          priority,
          subject,
          description,
        }),
      });
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? (response.ok ? "Ticket created." : "Unable to create ticket."));
      if (response.ok) {
        setSubject("");
        setDescription("");
        await loadTickets();
      }
    } finally {
      setLoading(false);
    }
  }

  async function sendReply(ticketId: string) {
    const content = (reply[ticketId] ?? "").trim();
    if (!content) {
      setMessage("Reply cannot be empty.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const csrf = await getCsrfToken();
      const response = await fetch(`/api/support/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
          "x-idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({ message: content }),
      });
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? (response.ok ? "Reply sent." : "Unable to send reply."));
      if (response.ok) {
        setReply((prev) => ({ ...prev, [ticketId]: "" }));
        await loadTickets();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel rounded-xl p-4">
        <h2 className="section-title mb-3 text-xl">Create Ticket</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-lg border border-[#3b5688] bg-[#0f223f] px-3 text-[#e4f0ff]">
            <option value="payment">payment</option>
            <option value="withdrawal">withdrawal</option>
            <option value="kyc">kyc</option>
            <option value="account">account</option>
            <option value="bonus">bonus</option>
            <option value="technical">technical</option>
            <option value="other">other</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-10 rounded-lg border border-[#3b5688] bg-[#0f223f] px-3 text-[#e4f0ff]">
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="urgent">urgent</option>
          </select>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="h-10 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 text-[#dcecff] outline-none md:col-span-2"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in detail"
            className="h-28 rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 py-2 text-[#dcecff] outline-none md:col-span-2"
          />
          <div className="flex gap-2 md:col-span-2">
            <button type="button" onClick={createTicket} disabled={loading} className="rounded-lg bg-[#2d7de0] px-4 py-2 font-semibold text-white disabled:opacity-50">
              Submit Ticket
            </button>
            <button type="button" onClick={loadTickets} disabled={loading} className="rounded-lg border border-[#3f5d8f] bg-[#102448] px-4 py-2 font-semibold text-[#dce9ff]">
              Refresh
            </button>
          </div>
        </div>
        {message ? <p className="mt-2 text-sm text-[#ffdca3]">{message}</p> : null}
      </div>

      <div className="space-y-3">
        {tickets.map((ticket) => (
          <article key={ticket.id} className="panel rounded-xl p-4">
            <p className="text-lg font-semibold text-white">{ticket.subject}</p>
            <p className="text-sm text-[#8fb1cc]">
              {ticket.category} | {ticket.priority} | {ticket.status}
            </p>
            <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
              {ticket.messages
                .filter((entry) => !entry.isInternal)
                .map((entry) => (
                  <div key={entry.id} className="rounded-md border border-[#3f546f] bg-[#121f36] p-2 text-sm">
                    <p className="text-xs text-[#9cb5dc]">
                      {entry.authorRole} | {new Date(entry.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-[#dbe8fe]">{entry.message}</p>
                  </div>
                ))}
            </div>

            {ticket.status !== "closed" ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={reply[ticket.id] ?? ""}
                  onChange={(e) => setReply((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                  placeholder="Reply on this ticket"
                  className="h-20 w-full rounded-lg border border-[#3b5688] bg-[#0b152a] px-3 py-2 text-[#dcecff] outline-none"
                />
                <button
                  type="button"
                  onClick={() => sendReply(ticket.id)}
                  disabled={loading}
                  className="rounded-lg bg-[#2d7de0] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Send Reply
                </button>
              </div>
            ) : null}
          </article>
        ))}

        {!loading && tickets.length === 0 ? (
          <div className="panel rounded-xl p-4 text-sm text-[#8ea9d6]">No tickets yet. Submit one above.</div>
        ) : null}
      </div>
    </div>
  );
}
