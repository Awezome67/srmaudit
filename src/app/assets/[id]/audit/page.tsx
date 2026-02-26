import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { updateAuditStatus } from "../actions";
import { uploadEvidence } from "./evidenceActions";

export default async function AuditPage({
  params,
}: {
  params: { id: string };
}) {
  const asset = await prisma.asset.findFirst({
    where: { id: params.id },
  });

  if (!asset)
    return <div className="text-sm text-gray-500">Asset not found</div>;

  const audit = await prisma.auditResult.findMany({
    where: { assetId: asset.id },
    include: {
      control: {
        include: {
          evidences: {
            where: { assetId: asset.id },
            orderBy: { uploadedAt: "desc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  /* =========================
     COMPLIANCE CALCULATION
  ========================= */
  const compliant = audit.filter((a) => a.status === "COMPLIANT").length;
  const partial = audit.filter((a) => a.status === "PARTIAL").length;
  const non = audit.filter((a) => a.status === "NON_COMPLIANT").length;
  const na = audit.filter((a) => a.status === "NOT_APPLICABLE").length;

  const applicable = audit.length - na;

  // Strict (PDF-style): Compliant / Applicable
  const strictCompliance =
    applicable === 0 ? 0 : Math.round((compliant / applicable) * 100);

  // Weighted (bonus): Partial counts as 0.5
  const weightedCompliance =
    applicable === 0
      ? 0
      : Math.round(((compliant + partial * 0.5) / applicable) * 100);

  return (
    <div className="space-y-8">
      <Link
        href={`/assets/${asset.id}`}
        className="text-blue-600 hover:text-blue-800 underline transition text-sm"
      >
        ← Back to Asset
      </Link>

      {/* Header */}
      <div className="bg-white shadow-md rounded-xl p-6">
        <h1 className="text-2xl font-bold">Audit Checklist</h1>
        <p className="text-sm text-gray-500 mt-1">
          Asset: <span className="font-medium">{asset.name}</span>
        </p>
      </div>

      {/* Compliance */}
      <div className="bg-white shadow-md rounded-xl p-6 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Compliance Score</h2>
          <p className="text-xs text-gray-500 mt-1">
            Applicable controls exclude <b>Not Applicable</b>.
          </p>
        </div>

        <div className="flex items-end gap-6 flex-wrap">
          <div>
            <div className="text-xs text-gray-500">Strict (PDF)</div>
            <div className="text-3xl font-bold">{strictCompliance}%</div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Weighted (Partial = 0.5)</div>
            <div className="text-xl font-semibold">{weightedCompliance}%</div>
          </div>

          <div className="text-xs text-gray-600 space-y-1">
            <div>
              <b>Compliant:</b> {compliant}
            </div>
            <div>
              <b>Partial:</b> {partial}
            </div>
            <div>
              <b>Non-Compliant:</b> {non}
            </div>
            <div>
              <b>Not Applicable:</b> {na}
            </div>
            <div>
              <b>Applicable Total:</b> {applicable}
            </div>
          </div>
        </div>
      </div>

      {audit.length === 0 ? (
        <div className="bg-white shadow-md rounded-xl p-6 text-sm text-gray-500">
          No audit checklist generated yet.
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-xl overflow-hidden">
          {/* Header Row */}
          <div className="grid grid-cols-4 bg-gray-100 p-4 text-sm font-semibold text-gray-700">
            <div>Control</div>
            <div>Status</div>
            <div>Notes</div>
            <div>Evidence</div>
          </div>

          {audit.map((a) => (
            <div
              key={a.id}
              className="grid grid-cols-4 p-4 border-t text-sm items-start hover:bg-gray-50 transition gap-4"
            >
              {/* Control Info */}
              <div>
                <div className="font-medium">{a.control.name}</div>
                <div className="text-xs text-gray-500">{a.control.framework}</div>
              </div>

              {/* Status */}
              <form
                action={async (formData) => {
                  "use server";
                  await updateAuditStatus(
                    a.id,
                    formData.get("status") as any,
                    String(formData.get("notes") || "")
                  );
                }}
                className="space-y-2"
              >

<textarea
  name="justification"
  defaultValue=""
  placeholder="Justification (required if Not Applicable)"
  className="border rounded p-1 text-xs w-full"
/>

                <select
                  name="status"
                  defaultValue={a.status}
                  className="border rounded p-1 text-xs w-full"
                >
                  <option value="COMPLIANT">Compliant</option>
                  <option value="PARTIAL">Partially Compliant</option>
                  <option value="NON_COMPLIANT">Non-Compliant</option>
                  <option value="NOT_APPLICABLE">Not Applicable</option>
                </select>

                <textarea
                  name="notes"
                  defaultValue={a.notes || ""}
                  placeholder="Audit notes..."
                  className="border rounded p-1 text-xs w-full"
                />

                <button className="text-xs bg-black text-white px-2 py-1 rounded">
                  Save
                </button>
              </form>

              {/* Notes display */}
              <div className="text-xs text-gray-500">Current: {a.status}</div>

              {/* Evidence Section */}
              <div className="space-y-2">
                {/* Upload Form */}
                <form
                  action={async (formData) => {
                    "use server";
                    await uploadEvidence(asset.id, a.controlId, formData);
                  }}
                  className="space-y-2"
                >
                  <input
                    type="file"
                    name="file"
                    accept=".png,.jpg,.jpeg,.pdf,.docx"
                    className="text-xs"
                    required
                  />
                  <button className="text-xs bg-black text-white px-2 py-1 rounded">
                    Upload
                  </button>
                </form>

                {/* Evidence List */}
                {a.control.evidences.length === 0 ? (
                  <div className="text-xs text-gray-400">No evidence uploaded.</div>
                ) : (
                  <div className="space-y-1">
                    {a.control.evidences.map((e) => (
                      <a
                        key={e.id}
                        href={e.filePath}
                        target="_blank"
                        className="block text-xs text-blue-600 underline"
                      >
                        {e.fileName}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}