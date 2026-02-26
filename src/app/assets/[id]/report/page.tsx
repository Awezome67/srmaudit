import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PrintButton from "./PrintButton";

function finalOpinion(strict: number) {
  if (strict >= 80) return { label: "Secure", color: "text-green-600" };
  if (strict >= 50) return { label: "Acceptable Risk", color: "text-yellow-600" };
  return { label: "Needs Immediate Action", color: "text-red-600" };
}

function badge(status: string) {
  const base = "inline-block px-2 py-1 rounded text-xs font-semibold";
  if (status === "COMPLIANT") return `${base} bg-green-100 text-green-700`;
  if (status === "PARTIAL") return `${base} bg-yellow-100 text-yellow-700`;
  if (status === "NON_COMPLIANT") return `${base} bg-red-100 text-red-700`;
  return `${base} bg-gray-100 text-gray-700`; // NOT_APPLICABLE
}

function statusBadge(status?: string | null) {
  const base = "inline-block px-2 py-1 rounded text-xs font-semibold";
  if (status === "OPEN") return `${base} bg-red-50 text-red-700`;
  if (status === "CLOSED") return `${base} bg-green-50 text-green-700`;
  return `${base} bg-gray-100 text-gray-700`;
}

function severityBadge(sev?: string | null) {
  const base = "inline-block px-2 py-1 rounded text-xs font-semibold";
  if (!sev) return `${base} bg-gray-100 text-gray-700`;
  if (sev === "Critical") return `${base} bg-red-100 text-red-700`;
  if (sev === "High") return `${base} bg-orange-100 text-orange-700`;
  if (sev === "Medium") return `${base} bg-yellow-100 text-yellow-700`;
  return `${base} bg-green-100 text-green-700`; // Low
}

function treatmentBadge(t?: string | null) {
  const base = "inline-block px-2 py-1 rounded text-xs font-semibold";
  if (!t) return `${base} bg-gray-100 text-gray-700`;
  if (t === "AVOID") return `${base} bg-red-100 text-red-700`;
  if (t === "TRANSFER") return `${base} bg-blue-100 text-blue-700`;
  if (t === "ACCEPT") return `${base} bg-gray-200 text-gray-800`;
  return `${base} bg-green-100 text-green-700`; // MITIGATE
}

function fmtDate(d?: Date | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString();
}

function isOverdue(status?: string | null, due?: Date | null) {
  if (status !== "OPEN") return false;
  if (!due) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dd = new Date(due);
  dd.setHours(0, 0, 0, 0);
  return dd < today;
}

export default async function ReportPage({
  params,
}: {
  params: { id: string };
}) {
  const asset = await prisma.asset.findFirst({
    where: { id: params.id },
    include: {
      selections: { include: { vulnerability: true } },
    },
  });

  if (!asset) return <div className="text-sm text-gray-500">Asset not found</div>;

  const audits = await prisma.auditResult.findMany({
    where: { assetId: asset.id },
    include: { control: true },
    orderBy: { createdAt: "desc" },
  });

  // include control biar bisa tampil control name/framework di report
  const findings = await prisma.finding.findMany({
    where: { assetId: asset.id },
    include: { control: true },
    orderBy: { createdAt: "desc" },
  });

  const evidenceCount = await prisma.evidence.count({
    where: { assetId: asset.id },
  });

  const evidences = await prisma.evidence.findMany({
    where: { assetId: asset.id },
    orderBy: { uploadedAt: "desc" },
  });

  // ===== Compliance calc =====
  const compliant = audits.filter((a) => a.status === "COMPLIANT").length;
  const partial = audits.filter((a) => a.status === "PARTIAL").length;
  const non = audits.filter((a) => a.status === "NON_COMPLIANT").length;
  const na = audits.filter((a) => a.status === "NOT_APPLICABLE").length;

  const applicable = audits.length - na;

  const strict = applicable === 0 ? 0 : Math.round((compliant / applicable) * 100);
  const weighted =
    applicable === 0
      ? 0
      : Math.round(((compliant + partial * 0.5) / applicable) * 100);

  const opinion = finalOpinion(strict);

  // ===== Top Risks =====
  const topRisks = [...asset.selections]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 3);

  // ===== Findings stats =====
  const openFindings = findings.filter((f) => f.status === "OPEN").length;
  const closedFindings = findings.filter((f) => f.status === "CLOSED").length;
  const overdueFindings = findings.filter((f) => isOverdue(f.status, f.dueDate)).length;

  const generatedAt = new Date().toLocaleString();

  return (
    <div className="space-y-8 print:p-8">
      <div className="flex justify-between items-center print:hidden">
        <Link href={`/assets/${asset.id}`} className="text-blue-600 underline text-sm">
          ← Back
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white shadow-md rounded-xl p-8 space-y-10 print:shadow-none">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Security Audit Report</h1>
          <div className="text-sm text-gray-600">
            Framework: <b>ISO/IEC 27001</b> • Generated: <b>{generatedAt}</b>
          </div>
        </div>

        {/* Asset Info */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Asset Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Name:</span> <b>{asset.name}</b>
            </div>
            <div>
              <span className="text-gray-500">Type:</span> <b>{asset.type}</b>
            </div>
            <div>
              <span className="text-gray-500">CIA Level:</span> <b>{asset.cia}</b>
            </div>
            <div>
              <span className="text-gray-500">Evidence Files:</span> <b>{evidenceCount}</b>
            </div>
          </div>
        </div>

        {/* Risk Assessment */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Risk Assessment</h2>

          {asset.selections.length === 0 ? (
            <p className="text-sm text-gray-500">No vulnerabilities selected.</p>
          ) : (
            <>
              <div className="text-sm text-gray-600 mb-2">
                Total Selected Vulnerabilities: <b>{asset.selections.length}</b>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-sm font-semibold mb-2">Top Risks</div>
                <ul className="list-disc ml-6 text-sm space-y-1">
                  {topRisks.map((s) => (
                    <li key={s.id}>
                      <b>{s.vulnerability.name}</b> — L{s.likelihood} × I{s.impact} ={" "}
                      <b>{s.riskScore}</b> ({s.riskLevel})
                    </li>
                  ))}
                </ul>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-2 text-left border">Vulnerability</th>
                      <th className="p-2 text-left border">L</th>
                      <th className="p-2 text-left border">I</th>
                      <th className="p-2 text-left border">Score</th>
                      <th className="p-2 text-left border">Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asset.selections.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="p-2 border">{s.vulnerability.name}</td>
                        <td className="p-2 border">{s.likelihood}</td>
                        <td className="p-2 border">{s.impact}</td>
                        <td className="p-2 border font-semibold">{s.riskScore}</td>
                        <td className="p-2 border">{s.riskLevel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Compliance */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Compliance Summary</h2>

          {audits.length === 0 ? (
            <p className="text-sm text-gray-500">No audit checklist generated.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-xs text-gray-500">Strict (PDF)</div>
                  <div className="text-2xl font-bold">{strict}%</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-xs text-gray-500">Weighted (Partial=0.5)</div>
                  <div className="text-2xl font-bold">{weighted}%</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-sm">
                  <div className="flex justify-between">
                    <span>Compliant</span> <b>{compliant}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Partial</span> <b>{partial}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Non-Compliant</span> <b>{non}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Not Applicable</span> <b>{na}</b>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t">
                    <span>Applicable Total</span> <b>{applicable}</b>
                  </div>
                </div>
              </div>

              {/* Snapshot controls (first 12) */}
              <div className="text-sm font-semibold">Checklist Snapshot</div>
              <div className="space-y-2">
                {audits.slice(0, 12).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-4 text-sm"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{a.control.name}</div>
                      <div className="text-xs text-gray-500">{a.control.framework}</div>
                    </div>
                    <span className={badge(a.status)}>{a.status}</span>
                  </div>
                ))}
                {audits.length > 12 && (
                  <div className="text-xs text-gray-500">
                    Showing 12 of {audits.length} controls.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Findings - DETAIL TABLE */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Findings</h2>

          {findings.length === 0 ? (
            <p className="text-sm text-gray-500">No findings generated.</p>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-700">
                Total: <b>{findings.length}</b> • Open: <b>{openFindings}</b> • Closed:{" "}
                <b>{closedFindings}</b> • Overdue:{" "}
                <b className={overdueFindings > 0 ? "text-red-600" : ""}>{overdueFindings}</b>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-2 text-left border">Issue</th>
                      <th className="p-2 text-left border">Control</th>
                      <th className="p-2 text-left border">Severity</th>
                      <th className="p-2 text-left border">Status</th>
                      <th className="p-2 text-left border">PIC</th>
                      <th className="p-2 text-left border">Due</th>
                      <th className="p-2 text-left border">Treatment</th>
                      <th className="p-2 text-left border">Evidence Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {findings.map((f) => {
                      const overdue = isOverdue(f.status, f.dueDate);
                      return (
                        <tr key={f.id} className={`border-t ${overdue ? "bg-red-50" : ""}`}>
                          <td className="p-2 border align-top">
                            <div className="font-medium">{f.issue}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              Risk: <b>{f.risk}</b>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Recommendation: {f.recommendation}
                            </div>
                            {f.rootCause && (
                              <div className="text-xs text-gray-500 mt-1">
                                Root cause: {f.rootCause}
                              </div>
                            )}
                          </td>

                          <td className="p-2 border align-top">
                            <div className="font-medium">{f.control?.name || "-"}</div>
                            <div className="text-xs text-gray-500">{f.control?.framework || "-"}</div>
                          </td>

                          <td className="p-2 border align-top">
                            <span className={severityBadge(f.severity)}>{f.severity || "-"}</span>
                          </td>

                          <td className="p-2 border align-top">
                            <div className="space-y-2">
                              <span className={statusBadge(f.status)}>{f.status || "-"}</span>
                              {overdue && (
                                <div className="text-xs font-semibold text-red-700">
                                  OVERDUE
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="p-2 border align-top">{f.owner || "-"}</td>
                          <td className="p-2 border align-top">{fmtDate(f.dueDate)}</td>

                          <td className="p-2 border align-top">
                            <span className={treatmentBadge(f.riskTreatment)}>
                              {f.riskTreatment || "-"}
                            </span>
                          </td>

                          <td className="p-2 border align-top">{f.evidenceRef || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Evidence (DETAIL TABLE) */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Evidence</h2>

          {evidences.length === 0 ? (
            <p className="text-sm text-gray-500">No evidence uploaded.</p>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-700">
                Total Evidence Files: <b>{evidences.length}</b>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-2 text-left border">File</th>
                      <th className="p-2 text-left border">Type</th>
                      <th className="p-2 text-left border">Uploaded</th>
                      <th className="p-2 text-left border">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidences.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="p-2 border">{e.fileName}</td>
                        <td className="p-2 border">{e.mimeType || "-"}</td>
                        <td className="p-2 border">
                          {new Date(e.uploadedAt).toLocaleString()}
                        </td>
                        <td className="p-2 border">
                          <a
                            href={e.filePath}
                            target="_blank"
                            className="text-blue-600 underline break-all"
                          >
                            {e.filePath}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-gray-500">
                Note: Evidence links remain visible when exporting to PDF.
              </div>
            </div>
          )}
        </div>

        {/* Final Opinion */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Final Opinion</h2>
          <p className={`text-xl font-bold ${opinion.color}`}>{opinion.label}</p>
          <p className="text-sm text-gray-600 mt-1">
            Recommendation: Prioritize closing <b>Non-Compliant</b> controls and addressing top
            critical risks.
          </p>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t text-xs text-gray-500">
          © 2026 SRM Audit System • ISO/IEC 27001 • Generated by SRMAudit Web App
        </div>
      </div>
    </div>
  );
}