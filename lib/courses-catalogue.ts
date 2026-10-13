"use server";

import type { CourseListItem, CourseDetail, ModuleData, MissionData } from "@/lib/content";
import { getCourseBySlug } from "@/lib/content";
import sql, { dbResult, dbMaybeSingle, isUndefinedColumnError } from "@/lib/db";

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

type CategoryRow = CategoryListItem & { parent_id?: string | null; approved?: boolean };
type CategoryDetailRow = CategoryDetail & { status?: string; approved?: boolean };

/** Liste des catégories publiées (Postgres) pour le catalogue. Inclut parent_id pour filtrer racines / sous-catégories. */
export async function getCategoriesFromDb(): Promise<CategoryListItem[]> {
  let result = await dbResult(async () =>
    await sql<CategoryRow[]>`
      SELECT id, slug, label, icon, parent_id
      FROM categories
      WHERE status = ${STATUS_PUBLISHED}
      ORDER BY label ASC
    `
  );

  // Missing parent_id only: keep the published filter, drop parent_id.
  if (
    result.error &&
    (isUndefinedColumnError(result.error) || result.error.message?.includes("parent_id")) &&
    result.error.message?.includes("parent_id")
  ) {
    result = await dbResult(async () =>
      await sql<CategoryRow[]>`
        SELECT id, slug, label, icon
        FROM categories
        WHERE status = ${STATUS_PUBLISHED}
        ORDER BY label ASC
      `
    );
    if (!result.error) {
      return ((result.data ?? []) as CategoryListItem[]).map((c) => ({ ...c, parent_id: null }));
    }
  }

  // Missing status (or still failing): fall back to approved = true.
  if (isUndefinedColumnError(result.error)) {
    result = await dbResult(async () =>
      await sql<CategoryRow[]>`
        SELECT id, slug, label, icon
        FROM categories
        WHERE approved = true
        ORDER BY label ASC
      `
    );
    if (isUndefinedColumnError(result.error)) {
      result = await dbResult(async () =>
        await sql<CategoryRow[]>`
          SELECT id, slug, label, icon
          FROM categories
          ORDER BY label ASC
        `
      );
    }
    if (result.error) return [];
    return ((result.data ?? []) as CategoryListItem[]).map((c) => ({ ...c, parent_id: null }));
  }

  if (result.error) return [];
  const rows = (result.data ?? []) as Array<CategoryListItem & { parent_id?: string | null }>;
  return rows.map((c) => ({ ...c, parent_id: c.parent_id ?? null }));
}

/** Catégorie par slug (Postgres). Si includeUnpublished, retourne même brouillon/en attente (prévisualisation admin). */
export async function getCategoryBySlugFromDb(
  slug: string,
  opts?: { includeUnpublished?: boolean }
): Promise<CategoryDetail & { status?: string } | null> {
  if (!opts?.includeUnpublished) {
    const withStatus = await dbMaybeSingle(async () =>
      await sql<CategoryDetailRow[]>`
        SELECT id, slug, label, icon, onboarding_title, onboarding_content,
          onboarding_presentation_embed_url, onboarding_quiz_sheet_id,
          onboarding_quiz_sheet_name, status
        FROM categories
        WHERE slug = ${slug} AND status = ${STATUS_PUBLISHED}
        LIMIT 2
      `
    );
    if (isUndefinedColumnError(withStatus.error)) {
      const fallback = await dbMaybeSingle(async () =>
        await sql<CategoryDetailRow[]>`
          SELECT id, slug, label, icon, onboarding_title, onboarding_content,
            onboarding_presentation_embed_url, onboarding_quiz_sheet_id,
            onboarding_quiz_sheet_name
          FROM categories
          WHERE slug = ${slug} AND approved = true
          LIMIT 2
        `
      );
      if (fallback.error || !fallback.data) return null;
      return {
        ...(fallback.data as CategoryDetail),
        status: (fallback.data as { approved?: boolean }).approved ? "published" : "pending",
      };
    }
    if (withStatus.error || !withStatus.data) return null;
    return withStatus.data as CategoryDetail & { status?: string };
  }

  let result = await dbMaybeSingle(async () =>
    await sql<CategoryDetailRow[]>`
      SELECT id, slug, label, icon, onboarding_title, onboarding_content,
        onboarding_presentation_embed_url, onboarding_quiz_sheet_id,
        onboarding_quiz_sheet_name, status
      FROM categories
      WHERE slug = ${slug}
      LIMIT 2
    `
  );
  if (isUndefinedColumnError(result.error)) {
    result = await dbMaybeSingle(async () =>
      await sql<CategoryDetailRow[]>`
        SELECT id, slug, label, icon, onboarding_title, onboarding_content,
          onboarding_presentation_embed_url, onboarding_quiz_sheet_id,
          onboarding_quiz_sheet_name
        FROM categories
        WHERE slug = ${slug}
        LIMIT 2
      `
    );
  }
  if (result.error || !result.data) return null;
  return result.data as CategoryDetail & { status?: string };
}

type CourseListRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  duration: string;
  added_at: string;
  category_id: string | null;
  categories?: { slug: string } | Array<{ slug: string }> | null;
};

/**
 * Liste des formations publiées (Postgres) pour le catalogue.
 * Fusionnée côté page avec les formations issues des fichiers (content/).
 * @param opts.categorySlug - filtrer par slug de catégorie
 */
export async function getPublishedCoursesFromDb(opts?: { categorySlug?: string }): Promise<CourseListItem[]> {
  let categoryId: string | null = null;
  if (opts?.categorySlug) {
    const { data: cat } = await dbMaybeSingle(async () =>
      await sql<{ id: string }[]>`
        SELECT id FROM categories WHERE slug = ${opts.categorySlug!} LIMIT 2
      `
    );
    if (cat) categoryId = cat.id;
    else return [];
  }

  let result = await dbResult(async () => {
    if (categoryId) {
      return await sql<CourseListRow[]>`
        SELECT c.id, c.slug, c.title, c.description, c.duration, c.added_at, c.category_id,
          CASE WHEN cat.id IS NULL THEN NULL ELSE json_build_object('slug', cat.slug) END AS categories
        FROM courses c
        LEFT JOIN categories cat ON cat.id = c.category_id
        WHERE c.status = ${STATUS_PUBLISHED} AND c.category_id = ${categoryId}
        ORDER BY c.added_at DESC
      `;
    }
    return await sql<CourseListRow[]>`
      SELECT c.id, c.slug, c.title, c.description, c.duration, c.added_at, c.category_id,
        CASE WHEN cat.id IS NULL THEN NULL ELSE json_build_object('slug', cat.slug) END AS categories
      FROM courses c
      LEFT JOIN categories cat ON cat.id = c.category_id
      WHERE c.status = ${STATUS_PUBLISHED}
      ORDER BY c.added_at DESC
    `;
  });

  if (isUndefinedColumnError(result.error)) {
    result = await dbResult(async () => {
      if (categoryId) {
        return await sql<CourseListRow[]>`
          SELECT c.id, c.slug, c.title, c.description, c.duration, c.added_at, c.category_id,
            CASE WHEN cat.id IS NULL THEN NULL ELSE json_build_object('slug', cat.slug) END AS categories
          FROM courses c
          LEFT JOIN categories cat ON cat.id = c.category_id
          WHERE c.published = true AND c.category_id = ${categoryId}
          ORDER BY c.added_at DESC
        `;
      }
      return await sql<CourseListRow[]>`
        SELECT c.id, c.slug, c.title, c.description, c.duration, c.added_at, c.category_id,
          CASE WHEN cat.id IS NULL THEN NULL ELSE json_build_object('slug', cat.slug) END AS categories
        FROM courses c
        LEFT JOIN categories cat ON cat.id = c.category_id
        WHERE c.published = true
        ORDER BY c.added_at DESC
      `;
    });
  }

  const { data, error } = result;

  if (error) return [];
  let rows = ((data ?? []) as unknown) as CourseListRow[];
  if (rows.length === 0) return [];

  const getCategorySlug = (categories: { slug: string } | Array<{ slug: string }> | null | undefined) =>
    Array.isArray(categories) ? categories[0]?.slug : categories?.slug;

  if (rows.some((r) => r.category_id && !getCategorySlug(r.categories))) {
    const categoryIds = [...new Set(rows.map((r) => r.category_id).filter(Boolean))] as string[];
    if (categoryIds.length > 0) {
      const { data: catRows } = await dbResult(async () =>
        await sql<{ id: string; slug: string }[]>`
          SELECT id, slug FROM categories WHERE id = ANY(${categoryIds})
        `
      );
      const slugById = new Map((catRows ?? []).map((c) => [c.id, c.slug]));
      rows = rows.map((r) => {
        if (!r.category_id || r.categories) return r;
        const categorySlug = slugById.get(r.category_id);
        if (!categorySlug) return r;
        return { ...r, categories: { slug: categorySlug } };
      });
    }
  }

  const ids = rows.map((c) => c.id);
  if (ids.length === 0) return [];

  const [{ data: moduleRows }, { data: missionRows }] = await Promise.all([
    dbResult(async () =>
      await sql<{ course_id: string }[]>`
        SELECT course_id FROM course_modules WHERE course_id = ANY(${ids})
      `
    ),
    dbResult(async () =>
      await sql<{ course_id: string }[]>`
        SELECT course_id FROM course_missions WHERE course_id = ANY(${ids})
      `
    ),
  ]);

  const moduleCountById: Record<string, number> = {};
  for (const row of moduleRows ?? []) {
    const id = row.course_id;
    moduleCountById[id] = (moduleCountById[id] ?? 0) + 1;
  }
  const missionCountById: Record<string, number> = {};
  for (const row of missionRows ?? []) {
    const id = row.course_id;
    missionCountById[id] = (missionCountById[id] ?? 0) + 1;
  }

  return rows.map((c) => ({
    slug: c.slug,
    title: c.title,
    descriptionShort: c.description
      ? c.description.slice(0, 120) + (c.description.length > 120 ? "…" : "")
      : "",
    duration: c.duration ?? "~0h",
    moduleCount: moduleCountById[c.id] ?? 0,
    missionCount: missionCountById[c.id] ?? 0,
    categoryId: getCategorySlug(c.categories) ?? undefined,
    addedAt: c.added_at ?? undefined,
  }));
}

type CourseDetailRow = Record<string, unknown>;

/** Détail d'une formation par slug (Postgres). Par défaut uniquement publiées ; si includeUnpublished, toute formation. */
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
  if (!opts?.includeUnpublished) {
    // Priorité au nouveau schéma (status='published'), puis fallback legacy (published=true)
    // pour éviter les 404 sur des formations publiées avant la migration de status.
    let result = await dbMaybeSingle(async () =>
      await sql<CourseDetailRow[]>`
        SELECT id, slug, title, description, duration, quiz_spreadsheet_id, published, status,
          created_by, onboarding_title, onboarding_content, onboarding_presentation_embed_url,
          onboarding_quiz_sheet_name
        FROM courses
        WHERE slug = ${slug} AND status = ${STATUS_PUBLISHED}
        LIMIT 2
      `
    );
    if (isUndefinedColumnError(result.error)) {
      result = await dbMaybeSingle(async () =>
        await sql<CourseDetailRow[]>`
          SELECT id, slug, title, description, duration, quiz_spreadsheet_id, published, status,
            created_by, onboarding_title, onboarding_content, onboarding_presentation_embed_url,
            onboarding_quiz_sheet_name
          FROM courses
          WHERE slug = ${slug} AND published = true
          LIMIT 2
        `
      );
    } else if (!result.error && !result.data) {
      const legacy = await dbMaybeSingle(async () =>
        await sql<CourseDetailRow[]>`
          SELECT id, slug, title, description, duration, quiz_spreadsheet_id, published, status,
            created_by, onboarding_title, onboarding_content, onboarding_presentation_embed_url,
            onboarding_quiz_sheet_name
          FROM courses
          WHERE slug = ${slug} AND published = true
          LIMIT 2
        `
      );
      if (!legacy.error && legacy.data) {
        result = legacy;
      }
    }
    if (result.error || !result.data) return null;
    return await buildCourseDetailResult(result.data as Record<string, unknown>);
  }

  let result = await dbMaybeSingle(async () =>
    await sql<CourseDetailRow[]>`
      SELECT id, slug, title, description, duration, quiz_spreadsheet_id, published, status,
        created_by, onboarding_title, onboarding_content, onboarding_presentation_embed_url,
        onboarding_quiz_sheet_name
      FROM courses
      WHERE slug = ${slug}
      LIMIT 2
    `
  );
  if (isUndefinedColumnError(result.error)) {
    const fallback = await dbMaybeSingle(async () =>
      await sql<CourseDetailRow[]>`
        SELECT id, slug, title, description, duration, quiz_spreadsheet_id, published,
          onboarding_title, onboarding_content, onboarding_presentation_embed_url
        FROM courses
        WHERE slug = ${slug}
        LIMIT 2
      `
    );
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
  onboardingTitle?: string | null;
  onboardingContent?: string | null;
  onboardingPresentationEmbedUrl?: string | null;
  onboardingQuizSheetName?: string | null;
} | null> {
  const courseId = course.id as string;

  let modRes = await dbResult(async () =>
    await sql<Record<string, unknown>[]>`
      SELECT module_slug, title, description, duration, video_embed_url, document_embed_url,
        presentation_embed_url, quiz_sheet_id, quiz_sheet_name, mission_id_slug, content,
        position, min_quiz_score
      FROM course_modules
      WHERE course_id = ${courseId}
      ORDER BY position ASC
    `
  );
  const modSchemaErr =
    isUndefinedColumnError(modRes.error) ||
    modRes.error?.message?.includes("quiz_sheet_name") ||
    modRes.error?.message?.includes("min_quiz_score");
  if (modRes.error && modSchemaErr) {
    modRes = await dbResult(async () =>
      await sql<Record<string, unknown>[]>`
        SELECT module_slug, title, description, duration, video_embed_url, document_embed_url,
          presentation_embed_url, quiz_sheet_id, mission_id_slug, content, position
        FROM course_modules
        WHERE course_id = ${courseId}
        ORDER BY position ASC
      `
    );
  }
  const modulesRows = (modRes.data as Record<string, unknown>[] | null) ?? null;
  const quizSpreadsheetId = (course.quiz_spreadsheet_id as string | null) ?? undefined;

  const { data: missionsRows } = await dbResult(async () =>
    await sql<Record<string, unknown>[]>`
      SELECT mission_slug, title, context, objective, instructions, deliverable
      FROM course_missions
      WHERE course_id = ${courseId}
    `
  );

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
