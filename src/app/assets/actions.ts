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

  const name = String(formData.get("name") || "");
  const owner = String(formData.get("owner") || "");
  const location = String(formData.get("location") || "");
  const type = String(formData.get("type") || "");
  const cia = String(formData.get("cia") || "Medium");

  if (!name.trim()) throw new Error("Asset name is required");

  let org = await prisma.organization.findFirst();

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Demo Organization",
        sector: "Education",
        employees: 200,
        systemType: "Web",
      },
    });
  }

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