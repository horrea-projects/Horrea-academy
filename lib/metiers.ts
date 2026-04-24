"use server";

import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

/** Liste de tous les métiers. */
export async function getMetiers(): Promise<Metier[]> {
  const { data, error } = await supabaseAdmin
    .from("metiers")
    .select("id, slug, label, description, created_at, updated_at")
    .order("label", { ascending: true });

  if (error) {
    console.error("getMetiers", error);
    return [];
  }
  return (data ?? []) as Metier[];
}

/** Liste de tous les métiers avec leurs formations requises (pour admin). */
export async function getMetiersWithFormations(): Promise<MetierWithFormations[]> {
  const metiers = await getMetiers();
  if (metiers.length === 0) return [];
  const { data: formations } = await supabaseAdmin
    .from("metier_formations")
    .select("metier_id, course_slug")
    .in("metier_id", metiers.map((m) => m.id));
  const byMetier = new Map<string, string[]>();
  for (const m of metiers) byMetier.set(m.id, []);
  for (const r of formations ?? []) {
    const row = r as { metier_id: string; course_slug: string };
    const arr = byMetier.get(row.metier_id);
    if (arr) arr.push(row.course_slug);
  }
  return metiers.map((m) => ({
    ...m,
    course_slugs: (byMetier.get(m.id) ?? []).sort(),
  }));
}

/** Un métier par id avec la liste des formations requises (pour admin). */
export async function getMetierById(id: string): Promise<MetierWithFormations | null> {
  const { data: metierRow, error: metierError } = await supabaseAdmin
    .from("metiers")
    .select("id, slug, label, description, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (metierError || !metierRow) return null;
  const { data: formations } = await supabaseAdmin
    .from("metier_formations")
    .select("course_slug")
    .eq("metier_id", id)
    .order("course_slug");
  const course_slugs = (formations ?? []).map((r) => (r as { course_slug: string }).course_slug);
  return { ...(metierRow as Metier), course_slugs };
}

/** Un métier par slug avec la liste des formations requises (course_slug). */
export async function getMetierBySlug(slug: string): Promise<MetierWithFormations | null> {
  const { data: metierRow, error: metierError } = await supabaseAdmin
    .from("metiers")
    .select("id, slug, label, description, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (metierError || !metierRow) return null;

  const { data: formations, error: formationsError } = await supabaseAdmin
    .from("metier_formations")
    .select("course_slug")
    .eq("metier_id", (metierRow as { id: string }).id)
    .order("course_slug");

  const course_slugs = formationsError ? [] : (formations ?? []).map((r) => (r as { course_slug: string }).course_slug);
  return {
    ...(metierRow as Metier),
    course_slugs,
  };
}

/** Métiers assignés à un utilisateur (par clerk_id). */
export async function getUserMetiers(clerkId: string | null): Promise<UserMetier[]> {
  if (!clerkId) return [];

  const { data, error } = await supabaseAdmin
    .from("user_metiers")
    .select(`
      id,
      clerk_id,
      metier_id,
      assigned_at,
      assigned_by,
      metiers (id, slug, label, description)
    `)
    .eq("clerk_id", clerkId)
    .order("assigned_at", { ascending: false });

  if (error) {
    console.error("getUserMetiers", error);
    return [];
  }

  const rows = ((data ?? []) as unknown) as Array<{
    id: string;
    clerk_id: string;
    metier_id: string;
    assigned_at: string;
    assigned_by: string | null;
    metiers: Metier | Metier[] | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    clerk_id: r.clerk_id,
    metier_id: r.metier_id,
    assigned_at: r.assigned_at,
    assigned_by: r.assigned_by,
    metier: Array.isArray(r.metiers) ? r.metiers[0] ?? undefined : r.metiers ?? undefined,
  }));
}

/** Ensemble des course_slug requis pour tous les métiers assignés à l'utilisateur (pour l'arbre "à débloquer"). */
export async function getRequiredCourseSlugsForUser(clerkId: string | null): Promise<Set<string>> {
  if (!clerkId) return new Set();

  const { data: userMetiers, error: umError } = await supabaseAdmin
    .from("user_metiers")
    .select("metier_id")
    .eq("clerk_id", clerkId);

  if (umError || !userMetiers?.length) return new Set();

  const metierIds = (userMetiers as { metier_id: string }[]).map((r) => r.metier_id);
  const { data: formations, error: fError } = await supabaseAdmin
    .from("metier_formations")
    .select("course_slug")
    .in("metier_id", metierIds);

  if (fError) return new Set();
  return new Set((formations ?? []).map((r) => (r as { course_slug: string }).course_slug));
}

/** Assigner un métier à un utilisateur (self-assign ou admin). */
export async function assignMetierToUser(
  clerkId: string,
  metierId: string,
  assignedBy?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin.from("user_metiers").upsert(
    {
      clerk_id: clerkId,
      metier_id: metierId,
      assigned_by: assignedBy ?? null,
      assigned_at: new Date().toISOString(),
    },
    { onConflict: "clerk_id,metier_id" }
  );
  if (error) {
    console.error("assignMetierToUser", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Retirer un métier assigné à un utilisateur. */
export async function unassignMetierFromUser(clerkId: string, metierId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("user_metiers")
    .delete()
    .eq("clerk_id", clerkId)
    .eq("metier_id", metierId);
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
