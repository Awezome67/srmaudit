"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/* =========================
   ROLE + ASSIGNMENT CHECK
========================= */
async function requireAccessToAsset(assetId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  if (!session) throw new Error("Unauthorized");

  if (role === "ADMIN") return;

  if (role === "AUDITOR") {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { organizationId: true },
    });

    if (!asset) throw new Error("Asset not found");

    const assigned = await prisma.auditAssignment.findFirst({
      where: {
        organizationId: asset.organizationId,
        auditorId: userId,
      },
    });

    if (!assigned) {
      throw new Error("Forbidden: Not assigned to this organization");
    }

    return;
  }

  throw new Error("Forbidden");
}

/* =========================
   RISK LEVEL
========================= */
function riskLevel(score: number) {
  if (score <= 5) return "Low";
  if (score <= 10) return "Medium";
  if (score <= 15) return "High";
  return "Critical";
}

/* =========================
   TOGGLE VULNERABILITY
========================= */
export async function toggleVulnerability(
  assetId: string,
  vulnerabilityId: string
) {
  await requireAccessToAsset(assetId);

  const existing = await prisma.assetVulnerability.findUnique({
    where: { assetId_vulnerabilityId: { assetId, vulnerabilityId } },
  });

  const vuln = await prisma.vulnerability.findUnique({
    where: { id: vulnerabilityId },
  });
  if (!vuln) return;

  const controls = await prisma.control.findMany({
    where: { mappedVulnName: vuln.name },
    select: { id: true },
  });

  const controlIds = controls.map((c) => c.id);

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.assetVulnerability.delete({
        where: { assetId_vulnerabilityId: { assetId, vulnerabilityId } },
      });

      if (controlIds.length > 0) {
        await tx.auditResult.deleteMany({
          where: {
            assetId,
            controlId: { in: controlIds },
          },
        });
      }
    });
  } else {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return;

    let likelihood = vuln.defaultLike;
    let impact = vuln.defaultImp;

    if (asset.cia === "High") impact = Math.min(5, impact + 1);

    const score = likelihood * impact;

    await prisma.$transaction(async (tx) => {
      await tx.assetVulnerability.create({
        data: {
          assetId,
          vulnerabilityId,
          likelihood,
          impact,
          riskScore: score,
          riskLevel: riskLevel(score),
        },
      });

      for (const controlId of controlIds) {
        await tx.auditResult.upsert({
          where: { assetId_controlId: { assetId, controlId } },
          update: {},
          create: {
            assetId,
            controlId,
            status: "NON_COMPLIANT",
            notes: `Auto-generated from vulnerability: ${vuln.name}`,
          },
        });
      }
    });
  }

  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/assets/${assetId}/audit`);
  revalidatePath(`/assets/${assetId}/report`);
}

/* =========================
   UPDATE AUDIT STATUS
========================= */
export async function updateAuditStatus(
  auditId: string,
  status:
    | "COMPLIANT"
    | "PARTIAL"
    | "NON_COMPLIANT"
    | "NOT_APPLICABLE",
  notes: string,
  justification?: string
) {
  const audit = await prisma.auditResult.findUnique({
    where: { id: auditId },
    select: { assetId: true },
  });

  if (!audit) throw new Error("Audit not found");

  await requireAccessToAsset(audit.assetId);

  if (status === "NOT_APPLICABLE" && !justification?.trim()) {
    throw new Error(
      "Justification is required when control is marked Not Applicable."
    );
  }

  await prisma.auditResult.update({
    where: { id: auditId },
    data: {
      status,
      notes,
      justification:
        status === "NOT_APPLICABLE" ? justification : null,
    },
  });

  revalidatePath(`/assets/${audit.assetId}`);
  revalidatePath(`/assets/${audit.assetId}/audit`);
  revalidatePath(`/assets/${audit.assetId}/report`);
}