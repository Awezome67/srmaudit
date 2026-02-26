"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 transition"
    >
      Logout
    </button>
  );
}