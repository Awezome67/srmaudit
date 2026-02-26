"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createAssignment(formData: FormData) {
  const organizationId = String(formData.get("organizationId") || "");
  const auditorId = String(formData.get("auditorId") || "");

  if (!organizationId || !auditorId) {
    throw new Error("Organization & auditor wajib dipilih.");
  }

  // biar idempotent (kalau udah ada, ga error)
  await prisma.auditAssignment.upsert({
    where: {
      organizationId_auditorId: { organizationId, auditorId },
    },
    update: {},
    create: { organizationId, auditorId },
  });

  revalidatePath("/admin/assignments");
}

export async function deleteAssignment(id: string) {
  await prisma.auditAssignment.delete({ where: { id } });
  revalidatePath("/admin/assignments");
}