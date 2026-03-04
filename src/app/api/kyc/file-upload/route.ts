import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_KINDS = new Set(["id_front", "id_back", "selfie", "address_proof"]);

function extensionForType(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "application/pdf") return "pdf";
  return "bin";
}

export async function POST(request: Request) {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const limiter = checkRateLimit({
    key: `kyc:file-upload:${session.userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { message: `Too many upload attempts. Retry in ${limiter.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const kind = String(formData.get("kind") ?? "");
  const file = formData.get("file");

  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ message: "Invalid file kind." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ message: "Unsupported file type." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ message: "File size must be between 1B and 8MB." }, { status: 400 });
  }

  const ext = extensionForType(file.type);
  const filename = `${kind}-${randomUUID()}.${ext}`;
  const relative = path.join("kyc", session.userId, filename);
  const target = path.join(process.cwd(), "storage", relative);

  await mkdir(path.dirname(target), { recursive: true });
  const arrayBuffer = await file.arrayBuffer();
  await writeFile(target, Buffer.from(arrayBuffer));

  return NextResponse.json({
    message: "File uploaded.",
    fileRef: `private:///${relative.replaceAll("\\", "/")}`,
    kind,
    contentType: file.type,
    size: file.size,
  });
}

