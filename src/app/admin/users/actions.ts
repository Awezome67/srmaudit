"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function requireAdmin(session: any) {
  const role = session?.user && (session.user as any)?.role;
  if (!session?.user) throw new Error("Not authenticated");
  if (role !== "ADMIN") throw new Error("Forbidden");
}

const ALLOWED_ROLES = new Set(["ADMIN", "AUDITOR", "AUDITEE"]);

export async function createUser(formData: FormData) {
  const session = await getServerSession(authOptions);
  requireAdmin(session);

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "AUDITOR").toUpperCase();

  if (!name || !email || !password) throw new Error("Missing fields");
  if (!ALLOWED_ROLES.has(role)) throw new Error("Invalid role");
  if (password.length < 6) throw new Error("Password minimal 6 karakter");

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new Error("Email already exists");

  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { name, email, password: hashed, role: role as any },
  });

  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string) {
  const session = await getServerSession(authOptions);
  requireAdmin(session);

  const myId = (session.user as any)?.id;
  if (myId && userId === myId) throw new Error("Tidak bisa delete akun sendiri.");

  await prisma.$transaction([
    prisma.auditAssignment.deleteMany({ where: { auditorId: userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  revalidatePath("/admin/users");
}