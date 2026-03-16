import type { User } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Synchronise l'utilisateur Clerk dans la table app_users (Supabase).
 * À appeler à chaque accès au dashboard pour garder email / nom / is_admin à jour.
 */
export async function syncClerkUserToSupabase(user: User): Promise<void> {
  const email = user.emailAddresses?.[0]?.emailAddress ?? "";
  if (!email) return;

  const isAdmin = user.publicMetadata?.isAdmin === true;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

  await supabaseAdmin.from("app_users").upsert(
    {
      clerk_id: user.id,
      email,
      name,
      is_admin: isAdmin,
      updated_at: new Date().toISOString()
    },
    { onConflict: "clerk_id" }
  );
}
