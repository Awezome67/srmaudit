import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PrintButton from "../report/PrintButton";

function badge(status: string) {
  const base = "inline-block px-2 py-1 rounded text-xs font-semibold";
  if (status === "COMPLIANT") return `${base} bg-green-100 text-green-700`;
  if (status === "PARTIAL") return `${base} bg-yellow-100 text-yellow-700`;
  if (status === "NON_COMPLIANT") return `${base} bg-red-100 text-red-700`;
  return `${base} bg-gray-100 text-gray-700`; // NOT_APPLICABLE
}

export default async function SoaPage({ params }: { params: { id: string } }) {
  const asset = await prisma.asset.findFirst({ where: { id: params.id } });
  if (!asset) return <div className="text-sm text-gray-500">Asset not found</div>;

  // Ambil audit results + control
  const audits = await prisma.auditResult.findMany({
    where: { assetId: asset.id },
    include: { control: true },
    orderBy: [{ createdAt: "desc" }],
  });

  // Dedup per controlId (ambil yang terbaru)
  const latestByControl = new Map<string, (typeof audits)[number]>();
  for (const a of audits) {
    if (!latestByControl.has(a.controlId)) latestByControl.set(a.controlId, a);
  }
  const rows = Array.from(latestByControl.values()).sort((a, b) =>
    a.control.name.localeCompare(b.control.name)
  );

  // Evidence count per control (untuk asset ini)
  const evidenceCounts = await prisma.evidence.groupBy({
    by: ["controlId"],
    where: { assetId: asset.id },
    _count: { _all: true },
  });
  const evMap = new Map<string, number>();
  for (const e of evidenceCounts) evMap.set(e.controlId, e._count._all);

  const generatedAt = new Date().toLocaleString();

  const applicable = rows.filter((r) => r.status !== "NOT_APPLICABLE").length;
  const compliant = rows.filter((r) => r.status === "COMPLIANT").length;
  const partial = rows.filter((r) => r.status === "PARTIAL").length;
  const strict = applicable === 0 ? 0 : Math.round((compliant / applicable) * 100);
  const weighted =
    applicable === 0 ? 0 : Math.round(((compliant + partial * 0.5) / applicable) * 100);

  return (
    <div className="space-y-8 print:p-8">
      <div className="flex justify-between items-center print:hidden">
        <Link href={`/assets/${asset.id}`} className="text-blue-600 underline text-sm">
          ← Back
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white shadow-md rounded-xl p-8 space-y-6 print:shadow-none">
        <div>
          <h1 className="text-3xl font-bold">Statement of Applicability (SoA)</h1>
          <div className="text-sm text-gray-600 mt-1">
            Framework: <b>ISO/IEC 27001</b> • Asset: <b>{asset.name}</b> • Generated:{" "}
            <b>{generatedAt}</b>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-500">Strict</div>
            <div className="text-2xl font-bold">{strict}%</div>
            <div className="text-xs text-gray-500 mt-1">Exclude Not Applicable</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-500">Weighted</div>
            <div className="text-2xl font-bold">{weighted}%</div>
            <div className="text-xs text-gray-500 mt-1">Partial = 0.5</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <div className="flex justify-between">
              <span>Controls (Total)</span> <b>{rows.length}</b>
            </div>
            <div className="flex justify-between">
              <span>Applicable</span> <b>{applicable}</b>
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="text-sm text-gray-500">
            No audit checklist generated yet. Generate checklist from Asset → Audit first.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-2 text-left border">Control</th>
                  <th className="p-2 text-left border">Framework</th>
                  <th className="p-2 text-left border">Status</th>
                  <th className="p-2 text-left border">Notes</th>
                  <th className="p-2 text-left border">Evidence Count</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 border font-medium">{r.control.name}</td>
                    <td className="p-2 border">{r.control.framework}</td>
                    <td className="p-2 border">
                      <span className={badge(r.status)}>{r.status}</span>
                    </td>
                    <td className="p-2 border text-xs text-gray-700">
                      {r.notes || "-"}
                    </td>
                    <td className="p-2 border text-center">{evMap.get(r.controlId) || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pt-6 border-t text-xs text-gray-500">
          © 2026 SRM Audit System • ISO/IEC 27001 • SoA generated by SRMAudit Web App
        </div>
      </div>
    </div>
  );
}