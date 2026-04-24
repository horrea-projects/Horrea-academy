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

  const now = new Date().toISOString();

  // 1) Si une ligne existe déjà pour cet email (mais sans clerk_id), la rattacher d'abord.
  await supabaseAdmin
    .from("app_users")
    .update({
      clerk_id: user.id,
      name,
      is_admin: isAdmin,
      updated_at: now,
    })
    .ilike("email", email);

  // 2) Upsert par clerk_id pour maintenir la ligne à jour à chaque connexion.
  await supabaseAdmin.from("app_users").upsert(
    {
      clerk_id: user.id,
      email,
      name,
      is_admin: isAdmin,
      updated_at: now,
    },
    { onConflict: "clerk_id" }
  );
}
