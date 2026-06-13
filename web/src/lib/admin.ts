import { createClient } from "@/lib/supabase/server";

export interface AdminUser {
  email: string;
}

/**
 * Returns the logged-in admin, or null when the visitor is not authenticated
 * or their email is not in the admins allowlist.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data } = await supabase
    .from("admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  return data ? { email: user.email } : null;
}
