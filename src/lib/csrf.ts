import crypto from "node:crypto";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

const CSRF_COOKIE = "casino_csrf";

function createToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function getCsrfCookieName() {
  return CSRF_COOKIE;
}

export function getOrCreateCsrfToken(cookieStore: CookieReader) {
  const existing = cookieStore.get(CSRF_COOKIE)?.value;
  if (existing && existing.length >= 16) {
    return { token: existing, isNew: false };
  }
  return { token: createToken(), isNew: true };
}

export function verifyCsrf(request: Request, cookieStore: CookieReader) {
  const header = request.headers.get("x-csrf-token") ?? "";
  const cookie = cookieStore.get(CSRF_COOKIE)?.value ?? "";
  if (!header || !cookie) return false;
  return safeEqual(header, cookie);
}
