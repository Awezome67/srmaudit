"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/* =========================
   ROLE GUARD
========================= */
async function requireRole(roles: Array<"ADMIN" | "AUDITOR">) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;

  if (!session || !roles.includes(role)) {
    throw new Error("Forbidden");
  }

  return session;
}

/* =========================
   CREATE ASSET
========================= */
export async function createAsset(formData: FormData) {
  await requireRole(["ADMIN"]); // 🔥 Hanya ADMIN boleh create

  const organizationId = String(formData.get("organizationId") || "").trim();

  const name = String(formData.get("name") || "").trim();
  const owner = String(formData.get("owner") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const type = String(formData.get("type") || "").trim();
  const cia = String(formData.get("cia") || "Medium").trim();

  if (!organizationId) throw new Error("Organization is required");
  if (!name) throw new Error("Asset name is required");

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!org) throw new Error("Organization not found");

  await prisma.asset.create({
    data: {
      organizationId: org.id,
      name,
      owner,
      location,
      type,
      cia,
    },
  });

  revalidatePath("/assets");
}

/* =========================
   DELETE ASSET
========================= */
export async function deleteAsset(id: string) {
  await requireRole(["ADMIN"]); // 🔥 Only admin delete

  await prisma.$transaction([
    prisma.assetVulnerability.deleteMany({ where: { assetId: id } }),
    prisma.auditResult.deleteMany({ where: { assetId: id } }),
    prisma.finding.deleteMany({ where: { assetId: id } }),
    prisma.evidence.deleteMany({ where: { assetId: id } }),
    prisma.asset.delete({ where: { id } }),
  ]);

  revalidatePath("/assets");
}