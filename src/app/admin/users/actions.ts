"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export async function createUser(formData: FormData) {
  const name = String(formData.get("name") || "");
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "AUDITOR");

  if (!name || !email || !password) throw new Error("Missing fields");

  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: role as any,
    },
  });

  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string) {
  await prisma.$transaction([
    prisma.auditAssignment.deleteMany({ where: { auditorId: userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  revalidatePath("/admin/users");
}