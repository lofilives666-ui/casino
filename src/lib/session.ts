import crypto from "crypto";

type SessionPayload = {
  userId: string;
  fullName: string;
  email: string;
  exp: number;
};

const SESSION_COOKIE = "casino_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  return process.env.SESSION_SECRET ?? "dev-only-session-secret-change-me";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(input: string) {
  return crypto.createHmac("sha256", getSecret()).update(input).digest("base64url");
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">) {
  const tokenPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  const expected = sign(encoded);
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getSessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}
