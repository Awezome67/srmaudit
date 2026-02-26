import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { deleteFinding, generateFindings, updateFinding } from "./actions";

function riskBadge(risk: string) {
  const base = "px-2 py-1 rounded text-xs font-semibold";
  if (risk === "High") return `${base} bg-orange-100 text-orange-700`;
  if (risk === "Medium") return `${base} bg-yellow-100 text-yellow-700`;
  return `${base} bg-green-100 text-green-700`;
}

function statusBadge(status: "OPEN" | "CLOSED") {
  const base = "px-2 py-1 rounded text-xs font-semibold";
  if (status === "OPEN") return `${base} bg-red-50 text-red-700`;
  return `${base} bg-green-50 text-green-700`;
}

export default async function FindingsPage({
  params,
}: {
  params: { id: string };
}) {
  const asset = await prisma.asset.findFirst({ where: { id: params.id } });
  if (!asset)
    return <div className="text-sm text-gray-500">Asset not found</div>;

  // ✅ select eksplisit biar TS gak merah (status, riskTreatment, dueDate, dll)
  const findings = await prisma.finding.findMany({
    where: { assetId: asset.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      issue: true,
      risk: true,
      severity: true,
      recommendation: true,

      status: true,
      riskTreatment: true,
      owner: true,
      dueDate: true,
      rootCause: true,
      evidenceRef: true,
    },
  });

  return (
    <div className="space-y-8">
      <Link
        href={`/assets/${asset.id}`}
        className="text-blue-600 hover:text-blue-800 underline transition text-sm"
      >
        ← Back to Asset
      </Link>

      <div className="bg-white shadow-md rounded-xl p-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Findings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Asset: <span className="font-medium">{asset.name}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Generated from audit checklist results (NON_COMPLIANT / PARTIAL)
          </p>
        </div>

        <form
          action={async () => {
            "use server";
            await generateFindings(asset.id);
          }}
        >
          <button className="text-sm bg-black text-white px-4 py-2 rounded-xl">
            Generate Findings
          </button>
        </form>
      </div>

      {findings.length === 0 ? (
        <div className="bg-white shadow-md rounded-xl p-6 text-sm text-gray-500">
          Belum ada findings. Klik <b>Generate Findings</b>.
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-xl overflow-hidden">
          <div className="grid grid-cols-6 bg-gray-100 p-4 text-sm font-semibold text-gray-700">
            <div className="col-span-2">Issue</div>
            <div>Risk</div>
            <div className="col-span-2">Details</div>
            <div>Action</div>
          </div>

          {findings.map((f) => (
            <div
              key={f.id}
              className="grid grid-cols-6 p-4 border-t text-sm items-start hover:bg-gray-50 transition gap-4"
            >
              {/* Issue */}
              <div className="col-span-2">
                <div className="font-medium">{f.issue}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(f.createdAt).toLocaleString()}
                </div>

                <div className="mt-2 text-xs text-gray-600">
                  Severity: <b>{f.severity}</b>
                </div>
              </div>

              {/* Risk + Status */}
              <div className="space-y-2">
                <span className={riskBadge(f.risk)}>{f.risk}</span>
                <div>
                  <span className={statusBadge(f.status)}>{f.status}</span>
                </div>
              </div>

              {/* Editable Details */}
              <div className="col-span-2 text-xs text-gray-600 space-y-2">
                <div>
                  <div className="font-semibold text-xs text-gray-700">
                    Recommendation
                  </div>
                  <div className="mt-1">{f.recommendation}</div>
                </div>

                <form
                  action={async (formData) => {
                    "use server";
                    await updateFinding(f.id, asset.id, formData);
                  }}
                  className="space-y-2 pt-2 border-t"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      name="owner"
                      defaultValue={f.owner ?? ""}
                      placeholder="PIC / Owner"
                      className="border rounded p-2 text-xs w-full"
                    />

                    <input
                      name="dueDate"
                      type="date"
                      defaultValue={
                        f.dueDate
                          ? new Date(f.dueDate).toISOString().slice(0, 10)
                          : ""
                      }
                      className="border rounded p-2 text-xs w-full"
                    />
                  </div>

                  <select
                    name="riskTreatment"
                    defaultValue={f.riskTreatment}
                    className="border rounded p-2 text-xs w-full"
                  >
                    <option value="MITIGATE">Mitigate</option>
                    <option value="ACCEPT">Accept</option>
                    <option value="TRANSFER">Transfer</option>
                    <option value="AVOID">Avoid</option>
                  </select>

                  <select
                    name="status"
                    defaultValue={f.status}
                    className="border rounded p-2 text-xs w-full"
                  >
                    <option value="OPEN">Open</option>
                    <option value="CLOSED">Closed</option>
                  </select>

                  <textarea
                    name="rootCause"
                    defaultValue={f.rootCause ?? ""}
                    placeholder="Root cause..."
                    className="border rounded p-2 text-xs w-full"
                    rows={2}
                  />

                  <input
                    name="evidenceRef"
                    defaultValue={f.evidenceRef ?? ""}
                    placeholder="Evidence ref (link/file name)"
                    className="border rounded p-2 text-xs w-full"
                  />

                  <button className="text-xs bg-black text-white px-3 py-2 rounded">
                    Save
                  </button>
                </form>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <form
                  action={async () => {
                    "use server";
                    await deleteFinding(f.id, asset.id);
                  }}
                >
                  <button className="text-xs text-red-600 underline">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}