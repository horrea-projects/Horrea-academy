"use server";

import type { CourseListItem, CourseDetail, ModuleData, MissionData } from "@/lib/content";
import { getCourseBySlug } from "@/lib/content";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Nombre de modules et de missions pour une formation (fichier ou DB). */
export async function getCourseTotals(slug: string): Promise<{ totalModules: number; totalMissions: number }> {
  const fromFile = getCourseBySlug(slug);
  if (fromFile) return { totalModules: fromFile.moduleIds.length, totalMissions: fromFile.missionIds?.length ?? 0 };
  const fromDb = await getCourseBySlugFromDb(slug, { includeUnpublished: true });
  if (!fromDb) return { totalModules: 0, totalMissions: 0 };
  return { totalModules: fromDb.course.moduleIds.length, totalMissions: fromDb.course.missionIds?.length ?? 0 };
}

export type CategoryDetail = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  onboarding_title?: string | null;
  onboarding_content?: string | null;
  onboarding_presentation_embed_url?: string | null;
  onboarding_quiz_sheet_id?: string | null;
  onboarding_quiz_sheet_name?: string | null;
};

export type CategoryListItem = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  parent_id?: string | null;
};

const STATUS_PUBLISHED = "published";

/** Liste des catégories publiées (Supabase) pour le catalogue. Inclut parent_id pour filtrer racines / sous-catégories. */
export async function getCategoriesFromDb(): Promise<CategoryListItem[]> {
  let query = supabaseAdmin.from("categories").select("id, slug, label, icon, parent_id").order("label", { ascending: true });
  let result = await query.eq("status", STATUS_PUBLISHED);
  if (result.error?.code === "42703" || result.error?.message?.includes("parent_id")) {
    result = await supabaseAdmin.from("categories").select("id, slug, label, icon").order("label", { ascending: true });
    if (result.error) return [];
    const withApproved = (result.data ?? []) as Array<{ approved?: boolean } & CategoryListItem>;
    return withApproved.filter((c) => (c as { approved?: boolean }).approved !== false).map((c) => ({ ...c, parent_id: null }));
  }
  if (result.error) return [];
  const rows = (result.data ?? []) as Array<CategoryListItem & { parent_id?: string | null }>;
  return rows.map((c) => ({ ...c, parent_id: c.parent_id ?? null }));
}

/** Catégorie par slug (Supabase). Si includeUnpublished, retourne même brouillon/en attente (prévisualisation admin). */
export async function getCategoryBySlugFromDb(
  slug: string,
  opts?: { includeUnpublished?: boolean }
): Promise<CategoryDetail & { status?: string } | null> {
  const selectCols = "id, slug, label, icon, onboarding_title, onboarding_content, onboarding_presentation_embed_url, onboarding_quiz_sheet_id, onboarding_quiz_sheet_name, status";
  let query = supabaseAdmin.from("categories").select(selectCols).eq("slug", slug);
  if (!opts?.includeUnpublished) {
    const withStatus = await query.eq("status", STATUS_PUBLISHED).maybeSingle();
    if (withStatus.error?.code === "42703") {
      const fallback = await supabaseAdmin.from("categories").select("id, slug, label, icon, onboarding_title, onboarding_content, onboarding_presentation_embed_url, onboarding_quiz_sheet_id, onboarding_quiz_sheet_name").eq("slug", slug).eq("approved", true).maybeSingle();
      if (fallback.error || !fallback.data) return null;
      return { ...(fallback.data as CategoryDetail), status: (fallback.data as { approved?: boolean }).approved ? "published" : "pending" };
    }
    if (withStatus.error || !withStatus.data) return null;
    return withStatus.data as CategoryDetail & { status?: string };
  }
  let result = await query.maybeSingle();
  if (result.error?.code === "42703") {
    result = await supabaseAdmin.from("categories").select("id, slug, label, icon, onboarding_title, onboarding_content, onboarding_presentation_embed_url, onboarding_quiz_sheet_id, onboarding_quiz_sheet_name").eq("slug", slug).maybeSingle();
  }
  if (result.error || !result.data) return null;
  return result.data as CategoryDetail & { status?: string };
}

/**
 * Liste des formations publiées (Supabase) pour le catalogue.
 * Fusionnée côté page avec les formations issues des fichiers (content/).
 * @param opts.categorySlug - filtrer par slug de catégorie
 */
export async function getPublishedCoursesFromDb(opts?: { categorySlug?: string }): Promise<CourseListItem[]> {
  const baseSelect = "id, slug, title, description, duration, added_at, category_id, categories(slug)";
  let query = supabaseAdmin
    .from("courses")
    .select(baseSelect)
    .order("added_at", { ascending: false });
  if (opts?.categorySlug) {
    const { data: cat } = await supabaseAdmin.from("categories").select("id").eq("slug", opts.categorySlug).maybeSingle();
    if (cat) query = query.eq("category_id", (cat as { id: string }).id);
    else return [];
  }
  let result = await query.eq("status", STATUS_PUBLISHED);
  if (result.error?.code === "42703") {
    result = await query.eq("published", true);
  }
  if (result.error?.code === "42703") {
    query = supabaseAdmin.from("courses").select("id, slug, title, description, duration, added_at, category_id, categories(slug)").order("added_at", { ascending: false });
    if (opts?.categorySlug) {
      const { data: cat } = await supabaseAdmin.from("categories").select("id").eq("slug", opts.categorySlug).maybeSingle();
      if (cat) query = query.eq("category_id", (cat as { id: string }).id);
      else return [];
    }
    result = await query.eq("published", true);
  }
  const { data, error } = result;

  if (error) return [];
  let rows = (data ?? []) as Array<{ id: string; slug: string; title: string; description: string; duration: string; added_at: string; category_id: string | null; categories?: { slug: string } | null }>;
  if (rows.length === 0) return [];

  if (rows.some((r) => r.category_id && !r.categories?.slug)) {
    const categoryIds = [...new Set(rows.map((r) => r.category_id).filter(Boolean))] as string[];
    const { data: catRows } = await supabaseAdmin.from("categories").select("id, slug").in("id", categoryIds);
    const slugById = new Map((catRows ?? []).map((c: { id: string; slug: string }) => [c.id, c.slug]));
    rows = rows.map((r) => (r.category_id && !r.categories ? { ...r, categories: { slug: slugById.get(r.category_id) ?? null } } : r));
  }

  const ids = rows.map((c) => c.id);
  const [{ data: moduleRows }, { data: missionRows }] = await Promise.all([
    supabaseAdmin.from("course_modules").select("course_id").in("course_id", ids),
    supabaseAdmin.from("course_missions").select("course_id").in("course_id", ids),
  ]);

  const moduleCountById: Record<string, number> = {};
  for (const row of moduleRows ?? []) {
    const id = (row as { course_id: string }).course_id;
    moduleCountById[id] = (moduleCountById[id] ?? 0) + 1;
  }
  const missionCountById: Record<string, number> = {};
  for (const row of missionRows ?? []) {
    const id = (row as { course_id: string }).course_id;
    missionCountById[id] = (missionCountById[id] ?? 0) + 1;
  }

  return rows.map((c) => ({
    slug: c.slug,
    title: c.title,
    descriptionShort: c.description?.slice(0, 120) + (c.description?.length > 120 ? "…" : "") ?? "",
    duration: c.duration ?? "~0h",
    moduleCount: moduleCountById[c.id] ?? 0,
    missionCount: missionCountById[c.id] ?? 0,
    categoryId: c.categories?.slug ?? undefined,
    addedAt: c.added_at ?? undefined,
  }));
}

/** Détail d'une formation par slug (Supabase). Par défaut uniquement publiées ; si includeUnpublished, toute formation. */
const COURSE_SELECT_COLS =
  "id, slug, title, description, duration, quiz_spreadsheet_id, published, status, created_by, onboarding_title, onboarding_content, onboarding_presentation_embed_url, onboarding_quiz_sheet_name";

export async function getCourseBySlugFromDb(
  slug: string,
  opts?: { includeUnpublished?: boolean }
): Promise<{
  course: CourseDetail;
  courseId: string;
  modules: ModuleData[];
  missions: MissionData[];
  quizSpreadsheetId?: string;
  published?: boolean;
  status?: string;
  created_by?: string | null;
  onboardingTitle?: string | null;
  onboardingContent?: string | null;
  onboardingPresentationEmbedUrl?: string | null;
  onboardingQuizSheetName?: string | null;
} | null> {
  let query = supabaseAdmin
    .from("courses")
    .select(COURSE_SELECT_COLS)
    .eq("slug", slug);
  if (!opts?.includeUnpublished) {
    let result = await query.eq("status", STATUS_PUBLISHED).maybeSingle();
    if (result.error?.code === "42703") {
      result = await query.eq("published", true).maybeSingle();
    }
    if (result.error || !result.data) return null;
    const course = result.data as Record<string, unknown>;
    return await buildCourseDetailResult(course);
  }
  let result = await query.maybeSingle();
  if (result.error?.code === "42703") {
    const fallback = await supabaseAdmin
      .from("courses")
      .select("id, slug, title, description, duration, quiz_spreadsheet_id, published, onboarding_title, onboarding_content, onboarding_presentation_embed_url")
      .eq("slug", slug)
      .maybeSingle();
    if (fallback.error || !fallback.data) return null;
    const course = fallback.data as Record<string, unknown>;
    (course as { status?: string }).status = (course.published as boolean) ? "published" : "draft";
    (course as { created_by?: string | null }).created_by = null;
    return await buildCourseDetailResult(course);
  }
  if (result.error || !result.data) return null;
  return await buildCourseDetailResult(result.data as Record<string, unknown>);
}

async function buildCourseDetailResult(course: Record<string, unknown>): Promise<{
  course: CourseDetail;
  courseId: string;
  modules: ModuleData[];
  missions: MissionData[];
  quizSpreadsheetId?: string;
  published?: boolean;
  status?: string;
  created_by?: string | null;
} | null> {
  const courseId = course.id as string;

  let modulesRows: Record<string, unknown>[] | null = null;
  let modRes = await supabaseAdmin
    .from("course_modules")
    .select("module_slug, title, description, duration, video_embed_url, document_embed_url, presentation_embed_url, quiz_sheet_id, quiz_sheet_name, mission_id_slug, content, position, min_quiz_score")
    .eq("course_id", courseId)
    .order("position", { ascending: true });
  const modSchemaErr = modRes.error?.code === "42703" || modRes.error?.code === "PGRST204" || modRes.error?.message?.includes("schema cache") || modRes.error?.message?.includes("quiz_sheet_name") || modRes.error?.message?.includes("min_quiz_score");
  if (modRes.error && modSchemaErr) {
    modRes = await supabaseAdmin
      .from("course_modules")
      .select("module_slug, title, description, duration, video_embed_url, document_embed_url, presentation_embed_url, quiz_sheet_id, mission_id_slug, content, position")
      .eq("course_id", courseId)
      .order("position", { ascending: true });
  }
  modulesRows = modRes.data ?? null;
  const quizSpreadsheetId = (course.quiz_spreadsheet_id as string | null) ?? undefined;

  const { data: missionsRows } = await supabaseAdmin
    .from("course_missions")
    .select("mission_slug, title, context, objective, instructions, deliverable")
    .eq("course_id", courseId);

  const modules: (ModuleData & { quizSheetName?: string })[] = (modulesRows ?? []).map((m: Record<string, unknown>) => ({
    id: String(m.module_slug),
    title: String(m.title ?? ""),
    description: String(m.description ?? ""),
    duration: String(m.duration ?? ""),
    videoEmbedUrl: String(m.video_embed_url ?? ""),
    documentEmbedUrl: m.document_embed_url ? String(m.document_embed_url) : undefined,
    presentationEmbedUrl: m.presentation_embed_url ? String(m.presentation_embed_url) : undefined,
    quizSheetId: String(m.quiz_sheet_id ?? ""),
    missionId: m.mission_id_slug ? String(m.mission_id_slug) : null,
    content: String(m.content ?? ""),
    ...(m.quiz_sheet_name ? { quizSheetName: String(m.quiz_sheet_name) } : {}),
    ...(m.min_quiz_score != null ? { minQuizScore: Number(m.min_quiz_score) } : {}),
  }));

  const missions: MissionData[] = (missionsRows ?? []).map((m: Record<string, unknown>) => ({
    id: String(m.mission_slug),
    title: String(m.title ?? ""),
    context: String(m.context ?? ""),
    objective: String(m.objective ?? ""),
    instructions: Array.isArray(m.instructions) ? (m.instructions as string[]) : [],
    deliverable: String(m.deliverable ?? ""),
  }));

  const courseDetail: CourseDetail = {
    slug: course.slug as string,
    title: course.title as string,
    description: (course.description as string) ?? "",
    duration: (course.duration as string) ?? "~0h",
    moduleIds: modules.map((m) => m.id),
    missionIds: missions.map((m) => m.id),
  };

  return {
    course: courseDetail,
    courseId,
    modules,
    missions,
    quizSpreadsheetId: quizSpreadsheetId || undefined,
    published: (course.published as boolean) ?? (course.status as string) === STATUS_PUBLISHED,
    status: course.status as string | undefined,
    created_by: course.created_by as string | null | undefined,
    onboardingTitle: (course.onboarding_title as string | null | undefined) ?? null,
    onboardingContent: (course.onboarding_content as string | null | undefined) ?? null,
    onboardingPresentationEmbedUrl: (course.onboarding_presentation_embed_url as string | null | undefined) ?? null,
    onboardingQuizSheetName: (course.onboarding_quiz_sheet_name as string | null | undefined) ?? null,
  };
}
