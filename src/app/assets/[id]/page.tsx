import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { toggleVulnerability } from "./actions";

function cellColor(score: number) {
  if (score <= 5) return "bg-green-100 text-green-800";
  if (score <= 10) return "bg-yellow-100 text-yellow-800";
  if (score <= 15) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

export default async function AssetDetailPage({
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

  const vulnerabilities = await prisma.vulnerability.findMany({
    orderBy: { category: "asc" },
  });

  if (!asset)
    return <div className="text-sm text-gray-500">Asset not found</div>;

  const selected = new Set(asset.selections.map((s) => s.vulnerabilityId));

  return (
    <div className="space-y-8">
      <Link
        href="/assets"
        className="text-blue-600 hover:text-blue-800 underline transition text-sm"
      >
        ← Back
      </Link>

      {/* ===== HEADER + AUDIT LINK ===== */}
      <div className="bg-white shadow-md rounded-xl p-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{asset.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {asset.type} • CIA:{" "}
            <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
              {asset.cia}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
  <Link
    href={`/assets/${asset.id}/audit`}
    className="inline-block text-sm bg-black text-white px-3 py-2 rounded hover:bg-gray-800 transition"
  >
    Audit Checklist
  </Link>

  <Link
    href={`/assets/${asset.id}/findings`}
    className="inline-block text-sm border border-gray-200 px-3 py-2 rounded hover:bg-gray-50 transition"
  >
    Findings
  </Link>

  <Link
  href={`/assets/${asset.id}/soa`}
  className="inline-block text-sm border border-gray-200 px-3 py-2 rounded hover:bg-gray-50"
>
  Open SoA
</Link>


  <Link
    href={`/assets/${asset.id}/report`}
    className="inline-block text-sm border border-gray-200 px-3 py-2 rounded hover:bg-gray-50 transition"
  >
    Report
  </Link>
</div>
      </div>

      {/* ===== AVAILABLE VULNERABILITIES + ADD/REMOVE ===== */}
      <div className="bg-white shadow-md rounded-xl p-6">
        <h2 className="text-lg font-semibold">Available Vulnerabilities</h2>
        <p className="text-sm text-gray-500 mt-1">
          Select vulnerabilities to calculate risk and generate audit checklist.
        </p>

        <div className="space-y-2 mt-4">
          {vulnerabilities.map((v) => (
            <form
              key={v.id}
              action={async () => {
                "use server";
                await toggleVulnerability(asset.id, v.id);
              }}
              className="flex items-center justify-between border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition"
            >
              <div>
                <div className="font-medium">{v.name}</div>
                <div className="text-xs text-gray-500">{v.category}</div>
              </div>

              <button
                className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                  selected.has(v.id)
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-black text-white hover:bg-gray-800"
                }`}
              >
                {selected.has(v.id) ? "Remove" : "Add"}
              </button>
            </form>
          ))}
        </div>
      </div>

      {/* ===== STEP A: SELECTED VULNERABILITIES TABLE ===== */}
      <div className="bg-white shadow-md rounded-xl p-6">
        <h2 className="text-lg font-semibold">Selected Vulnerabilities</h2>

        {asset.selections.length === 0 ? (
          <div className="text-sm text-gray-500 mt-2">
            No vulnerabilities selected yet.
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-3 text-left">Vulnerability</th>
                  <th className="p-3 text-left">Likelihood</th>
                  <th className="p-3 text-left">Impact</th>
                  <th className="p-3 text-left">Risk Score</th>
                  <th className="p-3 text-left">Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {asset.selections.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t hover:bg-gray-50 transition"
                  >
                    <td className="p-3">{s.vulnerability.name}</td>
                    <td className="p-3">{s.likelihood}</td>
                    <td className="p-3">{s.impact}</td>
                    <td className="p-3 font-semibold">{s.riskScore}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          s.riskLevel === "Critical"
                            ? "bg-red-100 text-red-700"
                            : s.riskLevel === "High"
                            ? "bg-orange-100 text-orange-700"
                            : s.riskLevel === "Medium"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {s.riskLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== STEP B: RISK MATRIX (5x5) ===== */}
      <div className="bg-white shadow-md rounded-xl p-6">
        <h2 className="text-lg font-semibold">Risk Matrix</h2>
        <p className="text-sm text-gray-500 mt-1">
          Likelihood × Impact (1–5). Highlighted cells match selected items.
        </p>

        <div className="overflow-x-auto mt-4">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="p-2 border bg-gray-100 text-gray-700">L \\ I</th>
                {[1, 2, 3, 4, 5].map((i) => (
                  <th
                    key={i}
                    className="p-2 border bg-gray-100 text-gray-700 text-center"
                  >
                    Impact {i}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {[5, 4, 3, 2, 1].map((l) => (
                <tr key={l}>
                  <td className="p-2 border bg-gray-50 font-semibold text-gray-700">
                    Likelihood {l}
                  </td>

                  {[1, 2, 3, 4, 5].map((i) => {
                    const score = l * i;

                    const hit = asset.selections.some(
                      (s) => s.likelihood === l && s.impact === i
                    );

                    return (
                      <td
                        key={`${l}-${i}`}
                        className={`p-2 border text-center ${cellColor(score)} ${
                          hit ? "ring-2 ring-black font-bold" : ""
                        }`}
                        title={`Score ${score}`}
                      >
                        {score}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {asset.selections.length === 0 && (
          <div className="text-xs text-gray-400 mt-3">
            Select a vulnerability first to see highlights.
          </div>
        )}
      </div>
    </div>
  );
}