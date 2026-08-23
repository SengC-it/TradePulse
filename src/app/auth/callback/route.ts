import { NextRequest, NextResponse } from "next/server";

import { isSafeLoginNext } from "@/lib/dashboard/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = isSafeLoginNext(requestedNext) ? requestedNext! : "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=callback", request.url));
  }

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback", request.url));
  }
  return NextResponse.redirect(new URL(next, request.url));
}
