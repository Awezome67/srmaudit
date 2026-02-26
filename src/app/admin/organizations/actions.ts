"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function requireAdmin(session: any) {
  const role = session?.user && (session.user as any)?.role;
  if (!session?.user) throw new Error("Not authenticated");
  if (role !== "ADMIN") throw new Error("Forbidden");
}

function computeExposure(sector: string, employees: number, systemType: string) {
  const s = (sector || "").toLowerCase();
  const t = (systemType || "").toLowerCase();

  const systemScore =
    t.includes("cloud") ? 3 :
    t.includes("web") ? 2 :
    t.includes("mobile") ? 2 :
    (t.includes("internal") || t.includes("network")) ? 1 :
    1;

  const employeeScore =
    employees >= 1000 ? 3 :
    employees >= 200 ? 2 :
    1;

  const highRiskSectors = [
    "finance", "bank",
    "health", "hospital",
    "education", "university",
    "government"
  ];
  const sectorScore = highRiskSectors.some((k) => s.includes(k)) ? 2 : 1;

  const score = systemScore + employeeScore + sectorScore;

  const exposureLevel =
    score >= 7 ? "HIGH" :
    score >= 5 ? "MEDIUM" :
    "LOW";

  return { exposureLevel, exposureScore: score };
}

export async function createOrganization(formData: FormData) {
  const session = await getServerSession(authOptions);
  requireAdmin(session);

  const name = String(formData.get("name") || "").trim();
  const sector = String(formData.get("sector") || "").trim();
  const employees = Number(formData.get("employees") || 0);
  const systemType = String(formData.get("systemType") || "").trim();

  if (!name || !sector || !systemType) throw new Error("Missing fields");
  if (!Number.isFinite(employees) || employees < 1) {
    throw new Error("Employees must be a positive number");
  }

  const exp = computeExposure(sector, employees, systemType);

  await prisma.organization.create({
    data: {
      name,
      sector,
      employees,
      systemType,
      exposureLevel: exp.exposureLevel,
      exposureScore: exp.exposureScore,
    },
  });

  revalidatePath("/admin/organizations");
}

export async function deleteOrganization(orgId: string) {
  const session = await getServerSession(authOptions);
  requireAdmin(session);

  const assetCount = await prisma.asset.count({ where: { organizationId: orgId } });
  if (assetCount > 0) {
    throw new Error("Organization masih punya asset. Hapus asset dulu.");
  }

  await prisma.auditAssignment.deleteMany({ where: { organizationId: orgId } });
  await prisma.organization.delete({ where: { id: orgId } });

  revalidatePath("/admin/organizations");
}

// Optional: kalau lo mau tombol "recompute exposure" untuk data lama
export async function recomputeExposure(orgId: string) {
  const session = await getServerSession(authOptions);
  requireAdmin(session);

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organization not found");

  const exp = computeExposure(org.sector, org.employees, org.systemType);

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      exposureLevel: exp.exposureLevel,
      exposureScore: exp.exposureScore,
    },
  });

  revalidatePath("/admin/organizations");
}