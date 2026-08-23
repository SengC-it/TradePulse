import { createSupabaseServerClient } from "../supabase/server.ts";

export type DashboardAccess = Readonly<{
  authenticated: boolean;
  authorized: boolean;
  userId: string | null;
}>;

export type DashboardAccessDecision = "LOGIN" | "DENIED" | "AUTHORIZED";

export function dashboardAccessDecision(access: Pick<DashboardAccess, "authenticated" | "authorized">): DashboardAccessDecision {
  if (!access.authenticated) {
    return "LOGIN";
  }
  return access.authorized ? "AUTHORIZED" : "DENIED";
}

export function isSafeLoginNext(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}

export async function getDashboardAccess(): Promise<DashboardAccess> {
  try {
    const client = await createSupabaseServerClient();
    const userResult = await client.auth.getUser();
    const user = userResult.data.user;
    if (userResult.error || !user) {
      return { authenticated: false, authorized: false, userId: null };
    }

    const authorization = await client
      .from("tp_authorized_users")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("enabled", true)
      .maybeSingle();

    return {
      authenticated: true,
      authorized: !authorization.error && Boolean(authorization.data?.user_id),
      userId: user.id,
    };
  } catch {
    return { authenticated: false, authorized: false, userId: null };
  }
}

export async function hasDashboardAccess(): Promise<boolean> {
  return dashboardAccessDecision(await getDashboardAccess()) === "AUTHORIZED";
}
