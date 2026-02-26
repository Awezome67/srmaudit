"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import fs from "node:fs/promises";
import path from "node:path";

async function requireAssetAccess(assetId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Not authenticated");

  const role = (session.user as any)?.role as "ADMIN" | "AUDITOR" | "AUDITEE" | undefined;
  const userId = String((session.user as any)?.id || "");

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { organization: { include: { auditAssignments: true } } },
  });
  if (!asset) throw new Error("Asset not found");

  if (role === "ADMIN") return { session, asset };

  if (role === "AUDITOR") {
    const ok = asset.organization.auditAssignments.some((a) => a.auditorId === userId);
    if (!ok) throw new Error("Forbidden");
    return { session, asset };
  }

  // AUDITEE belum dipakai untuk upload evidence (biar aman)
  throw new Error("Forbidden");
}

function sanitizeFileName(name: string) {
  // keep simple: remove weird chars
  return name.replace(/[^\w.\-() ]+/g, "_");
}

async function saveToPublicUploads(params: {
  assetId: string;
  controlId: string;
  file: File;
}) {
  const { assetId, controlId, file } = params;

  if (!file || file.size === 0) throw new Error("File is required");

  // limit size 10MB (ubah kalau perlu)
  const MAX = 10 * 1024 * 1024;
  if (file.size > MAX) throw new Error("File terlalu besar (max 10MB)");

  const safeName = sanitizeFileName(file.name || "evidence");
  const ts = Date.now();
  const relDir = `/uploads/${assetId}/${controlId}`;
  const relPath = `${relDir}/${ts}-${safeName}`;

  const absDir = path.join(process.cwd(), "public", "uploads", assetId, controlId);
  const absPath = path.join(process.cwd(), "public", "uploads", assetId, controlId, `${ts}-${safeName}`);

  await fs.mkdir(absDir, { recursive: true });

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absPath, buf);

  return {
    fileName: safeName,
    filePath: relPath, // accessible via public/
    mimeType: file.type || null,
  };
}

export async function uploadEvidence(formData: FormData) {
  const assetId = String(formData.get("assetId") || "");
  const controlId = String(formData.get("controlId") || "");
  const file = formData.get("file") as File | null;

  if (!assetId || !controlId) throw new Error("assetId/controlId required");
  await requireAssetAccess(assetId);

  // validate control belongs to audit context (exists)
  const control = await prisma.control.findUnique({ where: { id: controlId } });
  if (!control) throw new Error("Control not found");

  if (!file) throw new Error("File is required");

  const saved = await saveToPublicUploads({ assetId, controlId, file });

  await prisma.evidence.create({
    data: {
      assetId,
      controlId,
      fileName: saved.fileName,
      filePath: saved.filePath,
      mimeType: saved.mimeType,
    },
  });

  revalidatePath(`/assets/${assetId}/evidence`);
  revalidatePath(`/assets/${assetId}/audit`);
  revalidatePath(`/assets/${assetId}/report`);
}

export async function deleteEvidence(evidenceId: string) {
  const ev = await prisma.evidence.findUnique({ where: { id: evidenceId } });
  if (!ev) return;

  await requireAssetAccess(ev.assetId);

  // delete file from disk (best-effort)
  try {
    const absPath = path.join(process.cwd(), "public", ev.filePath.replace(/^\//, ""));
    await fs.unlink(absPath);
  } catch {
    // ignore if missing
  }

  await prisma.evidence.delete({ where: { id: evidenceId } });

  revalidatePath(`/assets/${ev.assetId}/evidence`);
  revalidatePath(`/assets/${ev.assetId}/audit`);
  revalidatePath(`/assets/${ev.assetId}/report`);
}