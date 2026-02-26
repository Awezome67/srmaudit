import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createOrganization, deleteOrganization } from "./actions";

function computeExposureLevel(sector: string, employees: number, systemType: string) {
  const s = (sector || "").toLowerCase();
  const t = (systemType || "").toLowerCase();

  const systemScore =
    t.includes("cloud") ? 3 :
    t.includes("web") ? 2 :
    t.includes("mobile") ? 2 :
    (t.includes("internal") || t.includes("network")) ? 1 :
    1;

  const employeeScore =
    employees >= 1000 ? 3 :
    employees >= 200 ? 2 :
    1;

  const highRiskSectors = ["finance", "bank", "health", "hospital", "education", "university", "government"];
  const sectorScore = highRiskSectors.some((k) => s.includes(k)) ? 2 : 1;

  const score = systemScore + employeeScore + sectorScore;

  const exposure =
    score >= 7 ? "HIGH" :
    score >= 5 ? "MEDIUM" :
    "LOW";

  return { exposure, score, breakdown: { systemScore, employeeScore, sectorScore } };
}

export default async function AdminOrganizationsPage() {
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

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { assets: true, auditAssignments: true } } },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Admin • Organizations</h1>
        <div className="flex gap-3">
          <Link className="text-sm underline text-blue-600" href="/admin/assignments">Assignments</Link>
          <Link className="text-sm underline text-blue-600" href="/admin/users">Users</Link>
          <Link className="text-sm underline text-blue-600" href="/assets">Back to Assets</Link>
        </div>
      </div>

      <form action={createOrganization} className="bg-white shadow-md rounded-xl p-6 space-y-4 max-w-2xl">
        <div className="text-lg font-semibold">Create Organization</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Organization Name</label>
            <input name="name" className="w-full border rounded-lg p-2 mt-1" placeholder="e.g., University ABC" required />
          </div>

          <div>
            <label className="text-sm font-medium">Business Sector</label>
            <input name="sector" className="w-full border rounded-lg p-2 mt-1" placeholder="e.g., Education" required />
          </div>

          <div>
            <label className="text-sm font-medium">Number of Employees</label>
            <input name="employees" type="number" min={1} className="w-full border rounded-lg p-2 mt-1" placeholder="e.g., 250" required />
          </div>

          <div>
            <label className="text-sm font-medium">System Type</label>
            <select name="systemType" className="w-full border rounded-lg p-2 mt-1" required defaultValue="">
              <option value="" disabled>-- Select --</option>
              <option value="Web">Web</option>
              <option value="Mobile">Mobile</option>
              <option value="Internal Network">Internal Network</option>
              <option value="Cloud">Cloud</option>
            </select>
          </div>
        </div>

        <button className="bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800 transition font-medium">
          Create Organization
        </button>

        <div className="text-xs text-gray-500">
          Exposure level dihitung otomatis dari sector + employees + system type (rule-based).
        </div>
      </form>

      <div className="bg-white shadow-md rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 gap-2 font-semibold bg-gray-50 p-4 text-sm">
          <div className="col-span-2">Organization</div>
          <div>Sector</div>
          <div>Employees</div>
          <div>System</div>
          <div>Exposure</div>
          <div>Action</div>
        </div>

        {organizations.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No organizations yet.</div>
        ) : (
          organizations.map((o) => {
            const exp = computeExposureLevel(o.sector, o.employees, o.systemType);
            return (
              <div key={o.id} className="grid grid-cols-7 gap-2 p-4 border-t text-sm items-center hover:bg-gray-50 transition">
                <div className="col-span-2">
                  <div className="font-medium">{o.name}</div>
                  <div className="text-xs text-gray-500">
                    {o._count.assets} assets • {o._count.auditAssignments} assignments
                  </div>
                </div>

                <div>{o.sector}</div>
                <div>{o.employees}</div>
                <div>{o.systemType}</div>

                <div className="font-semibold">
                  {exp.exposure} <span className="text-xs text-gray-500">(score {exp.score})</span>
                </div>

                <div>
                  <form
                    action={async () => {
                      "use server";
                      await deleteOrganization(o.id);
                    }}
                  >
                    <button className="text-red-600 hover:text-red-800 hover:underline transition font-medium">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="text-xs text-gray-500">
        Next: create asset wajib pilih organization (sudah diubah). Ini memenuhi Module 2 requirement (org profile + exposure level).
      </div>
    </div>
  );
}