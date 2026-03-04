import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/session";
import { verifyCsrf } from "@/lib/csrf";
import {
  beginIdempotentRequest,
  commitIdempotentResponse,
  getIdempotencyKey,
  releaseIdempotentLock,
} from "@/lib/idempotency";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifyCsrf(request, cookieStore)) {
    return NextResponse.json({ message: "CSRF validation failed." }, { status: 403 });
  }

  const idempotency = await beginIdempotentRequest({
    scope: "auth:logout",
    key: getIdempotencyKey(request),
  });
  if (!idempotency.ok && idempotency.reason === "INVALID_KEY") {
    return NextResponse.json({ message: "A valid x-idempotency-key header is required." }, { status: 400 });
  }
  if (!idempotency.ok && idempotency.response) {
    const response = NextResponse.json(idempotency.response.body, {
      status: idempotency.response.status,
      headers: { "x-idempotent-replayed": "1" },
    });
    response.cookies.set({
      name: getSessionCookieName(),
      value: "",
      maxAge: 0,
      path: "/",
    });
    return response;
  }
  if (!idempotency.ok && idempotency.reason === "IN_PROGRESS") {
    return NextResponse.json({ message: "Request already in progress for this idempotency key." }, { status: 409 });
  }

  try {
    const body = { message: "Logged out." };
    await commitIdempotentResponse({ token: idempotency, status: 200, body });
    const response = NextResponse.json(body, { status: 200 });
    response.cookies.set({
      name: getSessionCookieName(),
      value: "",
      maxAge: 0,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    await releaseIdempotentLock(idempotency);
    return NextResponse.json({ message: "Unable to logout." }, { status: 500 });
  }
}
