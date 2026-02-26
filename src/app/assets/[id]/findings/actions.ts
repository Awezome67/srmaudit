"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function riskFromAuditStatus(status: "NON_COMPLIANT" | "PARTIAL") {
  return status === "NON_COMPLIANT" ? "High" : "Medium";
}

function severityFromAuditStatus(status: "NON_COMPLIANT" | "PARTIAL") {
  return status === "NON_COMPLIANT" ? "High" : "Medium";
}

function recommendationTemplate(controlName: string, framework: string) {
  return `Implement and verify control (${framework}): ${controlName}. Collect evidence (policy, screenshot, configuration) and re-audit.`;
}

export async function generateFindings(assetId: string) {
  // ambil audit yang bermasalah
  const audits = await prisma.auditResult.findMany({
    where: {
      assetId,
      status: { in: ["NON_COMPLIANT", "PARTIAL"] },
    },
    include: { control: true },
  });

  if (audits.length === 0) {
    revalidatePath(`/assets/${assetId}/findings`);
    return;
  }

  // Upsert finding per (assetId, controlId)
  await prisma.$transaction(
    audits.map((a) => {
      const issue = `${a.control.framework}: ${a.control.name} is ${a.status}`;

      const risk = riskFromAuditStatus(a.status as any);
      const severity = severityFromAuditStatus(a.status as any);

      const recommendation =
        a.notes?.trim()
          ? `Based on audit notes: ${a.notes}`
          : recommendationTemplate(a.control.name, a.control.framework);

      return prisma.finding.upsert({
        where: {
          // pakai unique key yang sudah kamu punya:
          // @@unique([assetId, controlId, issue])
          assetId_controlId_issue: {
            assetId,
            controlId: a.controlId,
            issue,
          },
        },
        update: {
          // kalau sudah ada, refresh rekomendasi/risk/severity (biar nyambung dengan audit terbaru)
          risk,
          severity,
          recommendation,
          // jangan paksa status jadi OPEN kalau user sudah CLOSE
          updatedAt: new Date(),
        },
        create: {
          assetId,
          controlId: a.controlId,
          issue,
          risk,
          severity,
          recommendation,
          status: "OPEN",
          riskTreatment: "MITIGATE",
        },
      });
    })
  );

  revalidatePath(`/assets/${assetId}/findings`);
}

export async function deleteFinding(findingId: string, assetId: string) {
  await prisma.finding.delete({ where: { id: findingId } });
  revalidatePath(`/assets/${assetId}/findings`);
}

export async function updateFinding(
  findingId: string,
  assetId: string,
  formData: FormData
) {
  const owner = String(formData.get("owner") || "").trim() || null;
  const rootCause = String(formData.get("rootCause") || "").trim() || null;
  const evidenceRef = String(formData.get("evidenceRef") || "").trim() || null;

  const riskTreatment = String(formData.get("riskTreatment") || "MITIGATE") as
    | "MITIGATE"
    | "ACCEPT"
    | "TRANSFER"
    | "AVOID";

  const status = String(formData.get("status") || "OPEN") as "OPEN" | "CLOSED";

  const dueDateRaw = String(formData.get("dueDate") || "").trim();
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;

  await prisma.finding.update({
    where: { id: findingId },
    data: {
      owner,
      rootCause,
      evidenceRef,
      riskTreatment,
      status,
      dueDate,
    },
  });

  revalidatePath(`/assets/${assetId}/findings`);
}