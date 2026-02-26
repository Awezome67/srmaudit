import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadEvidence, deleteEvidence } from "./actions";

export const dynamic = "force-dynamic";

export default async function EvidencePage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // ✅ unwrap params (support Next 15/16 behavior)
  const resolved = typeof (params as any)?.then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string });
  const assetId = String(resolved?.id || "").trim();

  if (!assetId) {
    return (
      <div className="text-sm text-gray-600 space-y-2">
        <div className="font-medium text-red-600">Invalid asset id</div>
        <div>
          Route param <code className="bg-gray-100 px-1 rounded">[id]</code> tidak terbaca.
        </div>
        <div className="text-xs text-gray-500">
          Pastikan path folder: <code className="bg-gray-100 px-1 rounded">src/app/assets/[id]/evidence/page.tsx</code>
        </div>
        <Link className="underline text-blue-600" href="/assets">
          Back to Assets
        </Link>
      </div>
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div className="text-sm text-gray-600">
        Not authenticated.{" "}
        <Link className="underline text-blue-600" href="/login">
          Login
        </Link>
      </div>
    );
  }

  const role = (session.user as any)?.role as "ADMIN" | "AUDITOR" | "AUDITEE" | undefined;
  const userId = String((session.user as any)?.id || "");

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { organization: { include: { auditAssignments: true } } },
  });

  if (!asset) {
    return (
      <div className="text-sm text-gray-600 space-y-2">
        <div className="font-medium text-red-600">Asset not found</div>
        <div>
          Asset id: <code className="bg-gray-100 px-1 rounded">{assetId}</code>
        </div>
        <Link className="underline text-blue-600" href="/assets">
          Back to Assets
        </Link>
      </div>
    );
  }

  // access check: ADMIN ok, AUDITOR must be assigned
  if (role !== "ADMIN") {
    const ok =
      role === "AUDITOR" &&
      asset.organization.auditAssignments.some((a) => a.auditorId === userId);

    if (!ok) return <div className="text-sm text-gray-600">Forbidden.</div>;
  }

  const auditResults = await prisma.auditResult.findMany({
    where: { assetId },
    include: { control: true },
    orderBy: { createdAt: "asc" },
  });

  const evidences = await prisma.evidence.findMany({
    where: { assetId },
    include: { control: true },
    orderBy: { uploadedAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evidence Upload</h1>
          <div className="text-sm text-gray-500 mt-1">
            Asset: <span className="font-medium">{asset.name}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Link className="text-sm underline text-blue-600" href={`/assets/${assetId}`}>
            Back
          </Link>
          <Link className="text-sm underline text-blue-600" href={`/assets/${assetId}/audit`}>
            Audit
          </Link>
          <Link className="text-sm underline text-blue-600" href={`/assets/${assetId}/report`}>
            Report
          </Link>
        </div>
      </div>

      <form
  action={uploadEvidence}
  className="bg-white shadow-md rounded-xl p-6 space-y-4 max-w-3xl"
>
        <div className="text-lg font-semibold">Upload Evidence</div>

        <input type="hidden" name="assetId" value={assetId} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Control</label>
            <select
              name="controlId"
              className="w-full border border-gray-300 rounded-lg p-2 mt-1"
              required
              defaultValue=""
              disabled={auditResults.length === 0}
            >
              <option value="" disabled>
                -- Select control --
              </option>
              {auditResults.map((ar) => (
                <option key={ar.id} value={ar.controlId}>
                  {ar.control.name}
                </option>
              ))}
            </select>
            {auditResults.length === 0 && (
              <div className="text-xs text-gray-500 mt-2">
                Belum ada audit checklist untuk asset ini. Pilih vulnerability dulu supaya control ke-generate.
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">File</label>
            <input
              type="file"
              name="file"
              className="w-full border border-gray-300 rounded-lg p-2 mt-1"
              required
            />
            <div className="text-xs text-gray-500 mt-1">Max 10MB (ubah di actions.ts)</div>
          </div>
        </div>

        <button
          className="bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800 transition font-medium disabled:opacity-50"
          disabled={auditResults.length === 0}
        >
          Upload
        </button>
      </form>

      <div className="bg-white shadow-md rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 gap-2 font-semibold bg-gray-50 p-4 text-sm">
          <div className="col-span-2">Control</div>
          <div className="col-span-2">File</div>
          <div>Type</div>
          <div>Date</div>
          <div>Action</div>
        </div>

        {evidences.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No evidence uploaded yet.</div>
        ) : (
          evidences.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-7 gap-2 p-4 border-t text-sm items-center hover:bg-gray-50 transition"
            >
              <div className="col-span-2">
                <div className="font-medium">{e.control.name}</div>
                <div className="text-xs text-gray-500">{e.control.framework}</div>
              </div>

              <div className="col-span-2">
                <a
                  href={e.filePath}
                  target="_blank"
                  className="text-blue-600 hover:text-blue-800 underline"
                  rel="noreferrer"
                >
                  {e.fileName}
                </a>
              </div>

              <div className="text-xs text-gray-600">{e.mimeType || "-"}</div>

              <div className="text-xs text-gray-600">{new Date(e.uploadedAt).toLocaleString()}</div>

              <div>
                <form
                  action={async () => {
                    "use server";
                    await deleteEvidence(e.id);
                  }}
                >
                  <button className="text-red-600 hover:text-red-800 hover:underline transition font-medium">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="text-xs text-gray-500">
        Files tersimpan di <code className="bg-gray-100 px-1 rounded">public/uploads</code> dan path-nya disimpan di table Evidence.
      </div>
    </div>
  );
}