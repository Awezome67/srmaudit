import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createUser, deleteUser } from "./actions";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;

  if (!session?.user) return <div className="text-sm text-gray-500">Not authenticated</div>;
  if (role !== "ADMIN") return <div className="text-sm text-gray-500">Forbidden</div>;

  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin • Users</h1>

      <form action={createUser} className="bg-white shadow rounded-xl p-4 space-y-3 max-w-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input name="name" placeholder="Name" className="border p-2 rounded" required />
          <input name="email" placeholder="Email" className="border p-2 rounded" required />
          <input name="password" placeholder="Password" type="password" className="border p-2 rounded" required />
          <select name="role" className="border p-2 rounded">
            <option value="ADMIN">ADMIN</option>
            <option value="AUDITOR">AUDITOR</option>
            <option value="AUDITEE">AUDITEE</option>
          </select>
        </div>
        <button className="bg-black text-white px-4 py-2 rounded">Create User</button>
      </form>

      <div className="bg-white shadow rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 bg-gray-50 p-3 text-sm font-semibold">
          <div>Name</div><div>Email</div><div>Role</div><div>Created</div><div>Action</div>
        </div>

        {users.map((u) => (
          <div key={u.id} className="grid grid-cols-5 p-3 border-t text-sm">
            <div>{u.name}</div>
            <div>{u.email}</div>
            <div>{u.role}</div>
            <div>{new Date(u.createdAt).toLocaleDateString()}</div>
            <div>
              <form
                action={async () => {
                  "use server";
                  await deleteUser(u.id);
                }}
              >
                <button className="text-red-600 underline">Delete</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}