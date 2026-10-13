import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import sql, { dbResult, dbSingle, isUndefinedColumnError } from "@/lib/db";

async function requireAdmin() {
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;
  if (!user || !isAdmin) return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // c.* never errors on missing optional columns (status, etc.); synthesize status below.
  const coursesResult = await dbResult(async () =>
    await sql<Record<string, unknown>[]>`
      SELECT c.*,
        CASE WHEN cat.id IS NULL THEN NULL
          ELSE json_build_object('slug', cat.slug, 'label', cat.label, 'icon', cat.icon)
        END AS categories
      FROM courses c
      LEFT JOIN categories cat ON cat.id = c.category_id
      ORDER BY c.added_at DESC NULLS LAST
    `
  );
  const { data: coursesData, error } = coursesResult;

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur lecture formations" }, { status: 500 });
  }

  const courses = (coursesData ?? []) as Array<Record<string, unknown>>;
  const courseIds = courses.map((c) => (c.id as string)).filter(Boolean);
  const clerkIds = [...new Set(courses.map((c) => c.created_by as string | null | undefined).filter(Boolean))] as string[];

  const [moduleCountRes, progressRes, usersRes] = await Promise.all([
    courseIds.length > 0
      ? dbResult(async () =>
          await sql<{ course_id: string }[]>`
            SELECT course_id FROM course_modules WHERE course_id = ANY(${courseIds})
          `
        )
      : Promise.resolve({ data: [] as { course_id: string }[], error: null }),
    dbResult(async () =>
      await sql<{ email: string; course_slug: string; module_id: string }[]>`
        SELECT email, course_slug, module_id
        FROM user_progress
        WHERE type = ${"module"} AND status = ${"completed"}
      `
    ),
    clerkIds.length > 0
      ? dbResult(async () =>
          await sql<{ clerk_id: string; name: string | null; email: string }[]>`
            SELECT clerk_id, name, email FROM app_users WHERE clerk_id = ANY(${clerkIds})
          `
        )
      : Promise.resolve({ data: [] as { clerk_id: string; name: string | null; email: string }[], error: null }),
  ]);

  const moduleCountByCourseId: Record<string, number> = {};
  for (const row of moduleCountRes.data ?? []) {
    const cid = (row as { course_id: string }).course_id;
    moduleCountByCourseId[cid] = (moduleCountByCourseId[cid] ?? 0) + 1;
  }
  const totalModulesBySlug: Record<string, number> = {};
  for (const c of courses) {
    const id = (c as { id: string }).id;
    const slug = (c as { slug: string }).slug;
    totalModulesBySlug[slug] = moduleCountByCourseId[id] ?? 0;
  }

  const completedByUserCourse = new Map<string, number>();
  for (const row of progressRes.data ?? []) {
    const email = (row as { email: string }).email?.toLowerCase();
    const slug = (row as { course_slug: string }).course_slug;
    if (!email || !slug) continue;
    const key = `${email}:${slug}`;
    completedByUserCourse.set(key, (completedByUserCourse.get(key) ?? 0) + 1);
  }
  const completedCountBySlug: Record<string, number> = {};
  for (const [key, count] of completedByUserCourse) {
    const slug = key.split(":")[1];
    const total = totalModulesBySlug[slug] ?? 0;
    if (total > 0 && count >= total) {
      completedCountBySlug[slug] = (completedCountBySlug[slug] ?? 0) + 1;
    }
  }

  const authorMap: Record<string, { name: string | null; email: string }> = (usersRes.data ?? []).reduce(
    (acc, u) => {
      acc[u.clerk_id] = { name: u.name ?? null, email: u.email };
      return acc;
    },
    {} as Record<string, { name: string | null; email: string }>
  );

  const coursesWithAuthor = courses.map((c: { created_by?: string | null; slug?: string; published?: boolean; status?: string; [k: string]: unknown }) => {
    const author = c.created_by ? authorMap[c.created_by as string] : null;
    const slug = c.slug as string;
    const status = c.status ?? (c.published ? "published" : "draft");
    return {
      ...c,
      status,
      author_name: author?.name ?? null,
      author_email: author?.email ?? null,
      completed_count: completedCountBySlug[slug] ?? 0,
    };
  });

  return NextResponse.json({ courses: coursesWithAuthor });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let body: {
    slug: string;
    title: string;
    description: string;
    duration: string;
    category_id?: string | null;
    published?: boolean;
    status?: string;
    created_by?: string | null;
    onboarding_title?: string | null;
    onboarding_content?: string | null;
    onboarding_presentation_embed_url?: string | null;
    onboarding_quiz_sheet_name?: string | null;
    final_quiz_sheet_id?: string | null;
    quiz_spreadsheet_id?: string | null;
    final_quiz_sheet_name?: string | null;
    final_quiz_min_score?: number | null;
    modules?: Array<{
      module_slug: string;
      title: string;
      description: string;
      duration: string;
      video_embed_url: string;
      document_embed_url?: string | null;
      presentation_embed_url?: string | null;
      quiz_sheet_id?: string | null;
      quiz_sheet_name?: string | null;
      mission_id_slug?: string | null;
      content?: string | null;
      position: number;
      min_quiz_score?: number | null;
    }>;
    missions?: Array<{
      mission_slug: string;
      title: string;
      context: string;
      objective: string;
      instructions: string[];
      deliverable: string;
    }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { slug, title, description, duration, category_id, published, status, created_by, onboarding_title, onboarding_content, onboarding_presentation_embed_url, onboarding_quiz_sheet_name, final_quiz_sheet_id, quiz_spreadsheet_id, final_quiz_sheet_name, final_quiz_min_score, modules = [], missions = [] } = body;
  if (!slug?.trim() || !title?.trim() || !description || !duration) {
    return NextResponse.json({ error: "slug, title, description, duration requis" }, { status: 400 });
  }
  const courseStatus = ["pending", "draft", "published"].includes(status ?? "") ? status : "draft";
  const createdBy = created_by === "" || created_by == null ? user.id : created_by;
  const isPublished = courseStatus === "published";

  try {
    let modulesQuizNotSaved = false;
    // N'envoyer que published pour éviter l'erreur "status column not in schema cache" si la colonne n'existe pas
    const insertPayload = {
      slug: slug.trim(),
      title: title.trim(),
      description,
      duration,
      category_id: category_id || null,
      published: isPublished,
      created_by: createdBy,
      onboarding_title: onboarding_title?.trim() || null,
      onboarding_content: onboarding_content?.trim() || null,
      onboarding_presentation_embed_url: onboarding_presentation_embed_url?.trim() || null,
      onboarding_quiz_sheet_name: onboarding_quiz_sheet_name?.trim() || null,
      final_quiz_sheet_id: final_quiz_sheet_id?.trim() || null,
      quiz_spreadsheet_id: quiz_spreadsheet_id?.trim() || null,
      final_quiz_sheet_name: final_quiz_sheet_name?.trim() || null,
      final_quiz_min_score: final_quiz_min_score != null && !Number.isNaN(final_quiz_min_score) ? final_quiz_min_score : null,
    } as Record<string, unknown>;

    let insertResult = await dbSingle(async () =>
      await sql<{ id: string; slug: string }[]>`
        INSERT INTO courses ${sql(insertPayload, ...Object.keys(insertPayload))}
        RETURNING id, slug
      `
    );
    // Si colonne absente, réessayer sans final_quiz_min_score
    const insertSchemaError =
      isUndefinedColumnError(insertResult.error) ||
      insertResult.error?.message?.includes("final_quiz_min_score");
    if (insertResult.error && insertSchemaError) {
      const fallback = { ...insertPayload } as Record<string, unknown>;
      delete fallback.final_quiz_min_score;
      // Never add `status` here: payload intentionally uses `published` only.
      // Adding a missing column would fail again.
      insertResult = await dbSingle(async () =>
        await sql<{ id: string; slug: string }[]>`
          INSERT INTO courses ${sql(fallback, ...Object.keys(fallback))}
          RETURNING id, slug
        `
      );
    }
    const { data: course, error: courseError } = insertResult;

    if (courseError || !course) {
      console.error(courseError);
      return NextResponse.json({ error: courseError?.message ?? "Erreur création formation" }, { status: 500 });
    }

    if (modules.length > 0) {
      const fullRows = modules.map((m) => ({
        course_id: course.id,
        module_slug: m.module_slug,
        title: m.title,
        description: m.description ?? "",
        duration: m.duration ?? "",
        video_embed_url: m.video_embed_url ?? "",
        document_embed_url: m.document_embed_url ?? null,
        presentation_embed_url: m.presentation_embed_url ?? null,
        quiz_sheet_id: m.quiz_sheet_id ?? null,
        quiz_sheet_name: m.quiz_sheet_name ?? null,
        mission_id_slug: m.mission_id_slug ?? null,
        content: m.content ?? null,
        position: m.position,
        min_quiz_score: m.min_quiz_score != null && !Number.isNaN(m.min_quiz_score) ? m.min_quiz_score : null,
      }));
      const baseRows = modules.map((m) => ({
        course_id: course.id,
        module_slug: m.module_slug,
        title: m.title,
        description: m.description ?? "",
        duration: m.duration ?? "",
        video_embed_url: m.video_embed_url ?? "",
        document_embed_url: m.document_embed_url ?? null,
        presentation_embed_url: m.presentation_embed_url ?? null,
        quiz_sheet_id: m.quiz_sheet_id ?? null,
        mission_id_slug: m.mission_id_slug ?? null,
        content: m.content ?? null,
        position: m.position,
      }));
      let modResult = await dbResult(async () => {
        await sql`
          INSERT INTO course_modules ${sql(
            fullRows,
            "course_id",
            "module_slug",
            "title",
            "description",
            "duration",
            "video_embed_url",
            "document_embed_url",
            "presentation_embed_url",
            "quiz_sheet_id",
            "quiz_sheet_name",
            "mission_id_slug",
            "content",
            "position",
            "min_quiz_score"
          )}
        `;
        return null;
      });
      const modSchemaErr =
        isUndefinedColumnError(modResult.error) ||
        modResult.error?.message?.includes("min_quiz_score") ||
        modResult.error?.message?.includes("quiz_sheet_name");
      if (modResult.error && modSchemaErr) {
        modResult = await dbResult(async () => {
          await sql`
            INSERT INTO course_modules ${sql(
              baseRows,
              "course_id",
              "module_slug",
              "title",
              "description",
              "duration",
              "video_embed_url",
              "document_embed_url",
              "presentation_embed_url",
              "quiz_sheet_id",
              "mission_id_slug",
              "content",
              "position"
            )}
          `;
          return null;
        });
        if (!modResult.error && modules.some((m) => m.quiz_sheet_name?.trim() || m.min_quiz_score != null)) {
          modulesQuizNotSaved = true;
        }
      }
      if (modResult.error) {
        console.error(modResult.error);
        return NextResponse.json({ error: "Erreur enregistrement modules: " + modResult.error.message }, { status: 500 });
      }
    }

    if (missions.length > 0) {
      const missionRows = missions.map((m) => ({
        course_id: course.id,
        mission_slug: m.mission_slug,
        title: m.title,
        context: m.context ?? "",
        objective: m.objective ?? "",
        instructions: m.instructions ?? [],
        deliverable: m.deliverable ?? ""
      }));
      const { error: missErr } = await dbResult(async () => {
        await sql`
          INSERT INTO course_missions ${sql(
            missionRows,
            "course_id",
            "mission_slug",
            "title",
            "context",
            "objective",
            "instructions",
            "deliverable"
          )}
        `;
        return null;
      });
      if (missErr) {
        console.error(missErr);
        return NextResponse.json({ error: "Erreur enregistrement missions: " + missErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      id: course.id,
      slug: (course as { slug?: string }).slug ?? slug.trim(),
      ok: true,
      ...(modulesQuizNotSaved && { modulesQuizNotSaved: true }),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
