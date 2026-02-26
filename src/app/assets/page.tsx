import { prisma } from "@/lib/prisma";
import { createAsset, deleteAsset } from "./actions";
import Link from "next/link";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export default async function AssetsPage() {
  const session = await getServerSession(authOptions);

  // guard: wajib login
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

  const role = (session.user as any).role as "ADMIN" | "AUDITOR" | "AUDITEE" | undefined;
  const userId = String((session.user as any).id || "");

  const whereCondition: Prisma.AssetWhereInput = {};

  // ✅ AUDITOR: hanya boleh lihat asset dari org yang dia di-assign
  // (nama relasinya di schema: Organization.auditAssignments)
  if (role === "AUDITOR") {
    whereCondition.organization = {
      auditAssignments: {
        some: { auditorId: userId },
      },
    };
  }

  // kalau AUDITEE mau dibatasi juga nanti bisa ditambah rule di sini

  const assets = await prisma.asset.findMany({
    where: whereCondition,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Assets</h1>

      {/* 🔥 Form hanya ADMIN */}
      {role === "ADMIN" && (
        <form
          action={createAsset}
          className="bg-white shadow-md rounded-xl p-6 space-y-6"
        >
          {/* (paste form kamu di sini, ga gue ubah) */}
          {/* ... */}
          <button className="bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800 transition font-medium">
            Add Asset
          </button>
        </form>
      )}

      {/* List assets */}
      <div className="bg-white shadow-md rounded-xl overflow-hidden">
        <div className="grid grid-cols-6 gap-2 font-semibold bg-gray-50 p-4 text-sm">
          <div className="col-span-2">Name</div>
          <div>Type</div>
          <div>CIA</div>
          <div className="col-span-2">Actions</div>
        </div>

        {assets.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No assets yet.</div>
        ) : (
          assets.map((a) => (
            <div
              key={a.id}
              className="grid grid-cols-6 gap-2 p-4 border-t text-sm items-center hover:bg-gray-50 transition"
            >
              <div className="col-span-2">
                <Link
                  href={`/assets/${a.id}`}
                  className="font-medium text-blue-600 hover:text-blue-800 underline transition"
                >
                  {a.name}
                </Link>
              </div>

              <div>{a.type}</div>

              <div>
                <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                  {a.cia}
                </span>
              </div>

              <div className="col-span-2">
                {/* 🔥 Delete hanya ADMIN */}
                {role === "ADMIN" ? (
                  <form
                    action={async () => {
                      "use server";
                      await deleteAsset(a.id);
                    }}
                  >
                    <button className="text-red-600 hover:text-red-800 hover:underline transition font-medium">
                      Delete
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-gray-400">No access</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}