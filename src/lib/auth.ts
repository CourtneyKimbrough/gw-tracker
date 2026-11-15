import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export async function getAuthenticatedUser(
  supabase: SupabaseClient<Database>,
): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
