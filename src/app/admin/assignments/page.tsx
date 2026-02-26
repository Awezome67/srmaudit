import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createAssignment, deleteAssignment } from "./actions";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function AdminAssignmentsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;

  if (!session?.user) {
    return (
      <div className="text-sm text-gray-600">
        Not authenticated. <Link className="underline text-blue-600" href="/login">Login</Link>
      </div>
    );
  }

  if (role !== "ADMIN") {
    return (
      <div className="text-sm text-gray-600">
        Forbidden. Admin only. <Link className="underline text-blue-600" href="/assets">Back</Link>
      </div>
    );
  }

  const [organizations, auditors, assignments] = await Promise.all([
    prisma.organization.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      where: { role: "AUDITOR" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.auditAssignment.findMany({
      include: {
        organization: true,
        auditor: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Admin • Assignments</h1>
        <div className="flex gap-3">
          <Link className="text-sm underline text-blue-600" href="/admin/users">
            Manage Users
          </Link>
          <Link className="text-sm underline text-blue-600" href="/assets">
            Back to Assets
          </Link>
        </div>
      </div>

      {/* Create assignment */}
      <form action={createAssignment} className="bg-white shadow-md rounded-xl p-6 space-y-4">
        <div className="text-lg font-semibold">Assign Auditor to Organization</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Organization</label>
            <select
              name="organizationId"
              className="w-full border border-gray-300 rounded-lg p-2 mt-1"
              required
              defaultValue=""
            >
              <option value="" disabled>
                -- Select organization --
              </option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} • {o.sector}
                </option>
              ))}
            </select>
            {organizations.length === 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Belum ada organization. (Assets biasanya auto-buat “Demo Organization”)
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Auditor</label>
            <select
              name="auditorId"
              className="w-full border border-gray-300 rounded-lg p-2 mt-1"
              required
              defaultValue=""
            >
              <option value="" disabled>
                -- Select auditor --
              </option>
              {auditors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            {auditors.length === 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Belum ada user role AUDITOR. Buat dulu di <b>/admin/users</b>.
              </div>
            )}
          </div>
        </div>

        <button className="bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800 transition font-medium">
          Create Assignment
        </button>
      </form>

      {/* List assignments */}
      <div className="bg-white shadow-md rounded-xl overflow-hidden">
        <div className="grid grid-cols-6 gap-2 font-semibold bg-gray-50 p-4 text-sm">
          <div className="col-span-2">Organization</div>
          <div className="col-span-2">Auditor</div>
          <div>Date</div>
          <div>Action</div>
        </div>

        {assignments.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No assignments yet.</div>
        ) : (
          assignments.map((a) => (
            <div
              key={a.id}
              className="grid grid-cols-6 gap-2 p-4 border-t text-sm items-center hover:bg-gray-50 transition"
            >
              <div className="col-span-2">
                <div className="font-medium">{a.organization.name}</div>
                <div className="text-xs text-gray-500">{a.organization.sector}</div>
              </div>

              <div className="col-span-2">
                <div className="font-medium">{a.auditor.name}</div>
                <div className="text-xs text-gray-500">{a.auditor.email}</div>
              </div>

              <div className="text-xs text-gray-600">
                {new Date(a.createdAt).toLocaleString()}
              </div>

              <div>
                <form
                  action={async () => {
                    "use server";
                    await deleteAssignment(a.id);
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
        Next (modul 1): filter akses data auditor berdasarkan assignment (auditor hanya lihat org yg di-assign).
      </div>
    </div>
  );
}