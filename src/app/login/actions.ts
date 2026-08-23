"use server";

import { redirect } from "next/navigation";

import { isSafeLoginNext } from "@/lib/dashboard/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function loginNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : null;
  return isSafeLoginNext(next) ? next! : "/dashboard";
}

export async function signIn(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = loginNext(formData.get("next"));

  if (!email || !password) {
    redirect(`/login?error=invalid_credentials&next=${encodeURIComponent(next)}`);
  }

  const client = await createSupabaseServerClient();
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) {
    redirect(`/login?error=invalid_credentials&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

export async function signOut(): Promise<void> {
  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  redirect("/login");
}
