"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/server/auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/overview");

  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (result?.error || result?.ok === false) {
      return { error: "INVALID_CREDENTIALS" as const };
    }
    return { ok: true as const, callbackUrl: callbackUrl || "/overview" };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "INVALID_CREDENTIALS" as const };
    }
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
