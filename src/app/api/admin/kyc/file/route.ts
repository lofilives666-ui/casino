import path from "node:path";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { isAdminApiAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";

const STORAGE_ROOT = path.resolve(process.cwd(), "storage", "kyc");

function detectContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

function resolvePrivateRef(fileRef: string) {
  if (!fileRef.startsWith("private:///kyc/")) {
    return null;
  }
  const relative = fileRef.replace("private:///", "");
  const target = path.resolve(process.cwd(), "storage", relative);
  if (!target.startsWith(STORAGE_ROOT)) {
    return null;
  }
  return target;
}

export async function GET(request: Request) {
  if (!isAdminApiAuthorized(request.headers)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const url = new URL(request.url);
  const fileRef = url.searchParams.get("ref") ?? "";
  const filePath = resolvePrivateRef(fileRef);
  if (!filePath) {
    return NextResponse.json({ message: "Invalid file reference." }, { status: 400 });
  }

  try {
    const bytes = await readFile(filePath);
    const contentType = detectContentType(filePath);
    const filename = path.basename(filePath);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }
}

