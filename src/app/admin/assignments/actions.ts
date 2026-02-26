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

export async function createAssignment(formData: FormData) {
  const session = await getServerSession(authOptions);
  requireAdmin(session);

  const organizationId = String(formData.get("organizationId") || "");
  const auditorId = String(formData.get("auditorId") || "");

  if (!organizationId || !auditorId) {
    throw new Error("Organization & auditor wajib dipilih.");
  }

  // pastikan auditorId beneran user role AUDITOR
  const auditor = await prisma.user.findUnique({
    where: { id: auditorId },
    select: { id: true, role: true },
  });
  if (!auditor) throw new Error("Auditor tidak ditemukan");
  if (auditor.role !== "AUDITOR") throw new Error("User bukan AUDITOR");

  // pastikan org ada
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!org) throw new Error("Organization tidak ditemukan");

  await prisma.auditAssignment.upsert({
    where: { organizationId_auditorId: { organizationId, auditorId } },
    update: {},
    create: { organizationId, auditorId },
  });

  revalidatePath("/admin/assignments");
}

export async function deleteAssignment(id: string) {
  const session = await getServerSession(authOptions);
  requireAdmin(session);

  await prisma.auditAssignment.delete({ where: { id } });
  revalidatePath("/admin/assignments");
}