import type { User } from "@clerk/nextjs/server";
import sql from "@/lib/db";

/**
 * Synchronise l'utilisateur Clerk dans la table app_users (Postgres).
 * À appeler à chaque accès au dashboard pour garder email / nom / is_admin à jour.
 */
export async function syncClerkUser(user: User): Promise<void> {
  const email = user.emailAddresses?.[0]?.emailAddress ?? "";
  if (!email) return;

  const isAdmin = user.publicMetadata?.isAdmin === true;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

  const now = new Date().toISOString();

  // 1) Si une ligne existe déjà pour cet email (mais sans clerk_id), la rattacher d'abord.
  await sql`
    UPDATE app_users
    SET
      clerk_id = ${user.id},
      name = ${name},
      is_admin = ${isAdmin},
      updated_at = ${now}
    WHERE email ILIKE ${email}
  `;

  // 2) Upsert par clerk_id pour maintenir la ligne à jour à chaque connexion.
  await sql`
    INSERT INTO app_users ${sql(
      {
        clerk_id: user.id,
        email,
        name,
        is_admin: isAdmin,
        updated_at: now,
      },
      "clerk_id",
      "email",
      "name",
      "is_admin",
      "updated_at"
    )}
    ON CONFLICT (clerk_id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      is_admin = EXCLUDED.is_admin,
      updated_at = EXCLUDED.updated_at
  `;
}
