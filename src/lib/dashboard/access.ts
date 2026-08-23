import { createSupabaseServerClient } from "../supabase/server.ts";

export async function hasDashboardAccess(): Promise<boolean> {
  try {
    const client = await createSupabaseServerClient();
    const userResult = await client.auth.getUser();
    const user = userResult.data.user;
    if (userResult.error || !user) {
      return false;
    }

    const authorization = await client
      .from("tp_authorized_users")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("enabled", true)
      .maybeSingle();

    return !authorization.error && Boolean(authorization.data?.user_id);
  } catch {
    return false;
  }
}
