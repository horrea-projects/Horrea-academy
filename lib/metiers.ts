"use server";

import { currentUser } from "@clerk/nextjs/server";
import sql, { dbResult, dbMaybeSingle } from "@/lib/db";

export type Metier = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MetierWithFormations = Metier & {
  course_slugs: string[];
};

export type UserMetier = {
  id: string;
  clerk_id: string;
  metier_id: string;
  assigned_at: string;
  assigned_by: string | null;
  metier?: Metier;
};

type MetierRow = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

function toIso(value: Date | string | null | undefined): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function mapMetier(row: MetierRow): Metier {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

/** Liste de tous les métiers. */
export async function getMetiers(): Promise<Metier[]> {
  const { data, error } = await dbResult(() =>
    sql<MetierRow[]>`
      SELECT id, slug, label, description, created_at, updated_at
      FROM metiers
      ORDER BY label ASC
    `
  );

  if (error) {
    console.error("getMetiers", error);
    return [];
  }
  return (data ?? []).map(mapMetier);
}

/** Liste de tous les métiers avec leurs formations requises (pour admin). */
export async function getMetiersWithFormations(): Promise<MetierWithFormations[]> {
  const metiers = await getMetiers();
  if (metiers.length === 0) return [];

  const metierIds = metiers.map((m) => m.id);
  const { data: formations } =
    metierIds.length === 0
      ? { data: [] as { metier_id: string; course_slug: string }[] }
      : await dbResult(() =>
          sql<{ metier_id: string; course_slug: string }[]>`
            SELECT metier_id, course_slug
            FROM metier_formations
            WHERE metier_id = ANY(${metierIds})
          `
        );

  const byMetier = new Map<string, string[]>();
  for (const m of metiers) byMetier.set(m.id, []);
  for (const r of formations ?? []) {
    const arr = byMetier.get(r.metier_id);
    if (arr) arr.push(r.course_slug);
  }
  return metiers.map((m) => ({
    ...m,
    course_slugs: (byMetier.get(m.id) ?? []).sort(),
  }));
}

/** Un métier par id avec la liste des formations requises (pour admin). */
export async function getMetierById(id: string): Promise<MetierWithFormations | null> {
  const { data: metierRow, error: metierError } = await dbMaybeSingle(() =>
    sql<MetierRow[]>`
      SELECT id, slug, label, description, created_at, updated_at
      FROM metiers
      WHERE id = ${id}
    `
  );
  if (metierError || !metierRow) return null;

  const { data: formations } = await dbResult(() =>
    sql<{ course_slug: string }[]>`
      SELECT course_slug
      FROM metier_formations
      WHERE metier_id = ${id}
      ORDER BY course_slug
    `
  );
  const course_slugs = (formations ?? []).map((r) => r.course_slug);
  return { ...mapMetier(metierRow), course_slugs };
}

/** Un métier par slug avec la liste des formations requises (course_slug). */
export async function getMetierBySlug(slug: string): Promise<MetierWithFormations | null> {
  const { data: metierRow, error: metierError } = await dbMaybeSingle(() =>
    sql<MetierRow[]>`
      SELECT id, slug, label, description, created_at, updated_at
      FROM metiers
      WHERE slug = ${slug}
    `
  );

  if (metierError || !metierRow) return null;

  const { data: formations, error: formationsError } = await dbResult(() =>
    sql<{ course_slug: string }[]>`
      SELECT course_slug
      FROM metier_formations
      WHERE metier_id = ${metierRow.id}
      ORDER BY course_slug
    `
  );

  const course_slugs = formationsError ? [] : (formations ?? []).map((r) => r.course_slug);
  return {
    ...mapMetier(metierRow),
    course_slugs,
  };
}

/** Métiers assignés à un utilisateur (par clerk_id). */
export async function getUserMetiers(clerkId: string | null): Promise<UserMetier[]> {
  if (!clerkId) return [];

  const { data, error } = await dbResult(() =>
    sql<
      {
        id: string;
        clerk_id: string;
        metier_id: string;
        assigned_at: Date | string;
        assigned_by: string | null;
        metiers: Metier | null;
      }[]
    >`
      SELECT um.id, um.clerk_id, um.metier_id, um.assigned_at, um.assigned_by,
        CASE WHEN m.id IS NULL THEN NULL ELSE json_build_object(
          'id', m.id,
          'slug', m.slug,
          'label', m.label,
          'description', m.description
        ) END AS metiers
      FROM user_metiers um
      LEFT JOIN metiers m ON m.id = um.metier_id
      WHERE um.clerk_id = ${clerkId}
      ORDER BY um.assigned_at DESC
    `
  );

  if (error) {
    console.error("getUserMetiers", error);
    return [];
  }

  const rows = data ?? [];
  return rows.map((r) => ({
    id: r.id,
    clerk_id: r.clerk_id,
    metier_id: r.metier_id,
    assigned_at: toIso(r.assigned_at) ?? new Date().toISOString(),
    assigned_by: r.assigned_by,
    metier: Array.isArray(r.metiers) ? r.metiers[0] ?? undefined : r.metiers ?? undefined,
  }));
}

/** Ensemble des course_slug requis pour tous les métiers assignés à l'utilisateur (pour l'arbre "à débloquer"). */
export async function getRequiredCourseSlugsForUser(clerkId: string | null): Promise<Set<string>> {
  if (!clerkId) return new Set();

  const { data: userMetiers, error: umError } = await dbResult(() =>
    sql<{ metier_id: string }[]>`
      SELECT metier_id
      FROM user_metiers
      WHERE clerk_id = ${clerkId}
    `
  );

  if (umError || !userMetiers?.length) return new Set();

  const metierIds = userMetiers.map((r) => r.metier_id);
  if (metierIds.length === 0) return new Set();

  const { data: formations, error: fError } = await dbResult(() =>
    sql<{ course_slug: string }[]>`
      SELECT course_slug
      FROM metier_formations
      WHERE metier_id = ANY(${metierIds})
    `
  );

  if (fError) return new Set();
  return new Set((formations ?? []).map((r) => r.course_slug));
}

/** Assigner un métier à un utilisateur (self-assign ou admin). */
export async function assignMetierToUser(
  clerkId: string,
  metierId: string,
  assignedBy?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const assignedAt = new Date().toISOString();
  const { error } = await dbResult(() =>
    sql`
      INSERT INTO user_metiers ${sql(
        {
          clerk_id: clerkId,
          metier_id: metierId,
          assigned_by: assignedBy ?? null,
          assigned_at: assignedAt,
        },
        "clerk_id",
        "metier_id",
        "assigned_by",
        "assigned_at"
      )}
      ON CONFLICT (clerk_id, metier_id) DO UPDATE SET
        assigned_by = EXCLUDED.assigned_by,
        assigned_at = EXCLUDED.assigned_at
    `
  );
  if (error) {
    console.error("assignMetierToUser", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Retirer un métier assigné à un utilisateur. */
export async function unassignMetierFromUser(clerkId: string, metierId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await dbResult(() =>
    sql`
      DELETE FROM user_metiers
      WHERE clerk_id = ${clerkId}
        AND metier_id = ${metierId}
    `
  );
  if (error) {
    console.error("unassignMetierFromUser", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Assigner ou retirer un métier pour l'utilisateur connecté (self-assign). */
export async function setUserMetierAssignment(metierId: string, assign: boolean): Promise<{ ok: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Non connecté" };
  return assign ? assignMetierToUser(user.id, metierId) : unassignMetierFromUser(user.id, metierId);
}
