import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import sql, { dbSingle, dbResult, dbMaybeSingle } from "@/lib/db";

type FormationCompletePayload = {
  course: {
    slug: string;
    title: string;
    description?: string;
    duration?: string;
    moduleIds?: string[];
    missionIds?: string[];
    categoryId?: string;
    onboardingTitle?: string;
    onboardingContent?: string;
    finalQuizSheetId?: string;
  };
  modules?: Array<{
    id: string;
    title?: string;
    description?: string;
    duration?: string;
    videoEmbedUrl?: string;
    documentEmbedUrl?: string;
    presentationEmbedUrl?: string;
    quizSheetId?: string;
    missionId?: string | null;
    content?: string;
  }>;
  missions?: Array<{
    id: string;
    title?: string;
    context?: string;
    objective?: string;
    instructions?: string[];
    deliverable?: string;
  }>;
};

/** Importer une formation en proposition (en attente). Utilisateur connecté, published forcé à false. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return new NextResponse("Non authentifié", { status: 401 });
  }

  let body: FormationCompletePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { course, modules = [], missions = [] } = body;
  if (!course?.slug?.trim() || !course?.title?.trim()) {
    return NextResponse.json(
      { error: "Le JSON doit contenir un objet 'course' avec 'slug' et 'title'." },
      { status: 400 }
    );
  }

  const slug = course.slug.trim();
  const title = course.title.trim();
  const description = course.description ?? "";
  const duration = course.duration ?? "~0h";

  let category_id: string | null = null;
  if (course.categoryId?.trim()) {
    const { data: cat } = await dbMaybeSingle(async () =>
      await sql<{ id: string }[]>`
        SELECT id FROM categories WHERE slug = ${course.categoryId!.trim()} LIMIT 2
      `
    );
    if (cat) category_id = cat.id;
  }

  const { data: existing } = await dbMaybeSingle(async () =>
    await sql<{ id: string }[]>`
      SELECT id FROM courses WHERE slug = ${slug} LIMIT 2
    `
  );
  if (existing) {
    return NextResponse.json(
      { error: `Une formation avec le slug « ${slug} » existe déjà.` },
      { status: 400 }
    );
  }

  const { data: newCourse, error: courseError } = await dbSingle(async () =>
    await sql<{ id: string; slug: string }[]>`
      INSERT INTO courses ${sql(
        {
          slug,
          title,
          description,
          duration,
          category_id,
          published: false,
          created_by: user.id,
          onboarding_title: course.onboardingTitle?.trim() || null,
          onboarding_content: course.onboardingContent?.trim() || null,
          final_quiz_sheet_id: course.finalQuizSheetId?.trim() || null,
        },
        "slug",
        "title",
        "description",
        "duration",
        "category_id",
        "published",
        "created_by",
        "onboarding_title",
        "onboarding_content",
        "final_quiz_sheet_id"
      )}
      RETURNING id, slug
    `
  );

  if (courseError || !newCourse) {
    console.error(courseError);
    return NextResponse.json(
      { error: courseError?.message ?? "Erreur création formation" },
      { status: 500 }
    );
  }

  const courseId = newCourse.id;

  if (modules.length > 0) {
    const moduleIds = course.moduleIds ?? modules.map((m) => m.id);
    const rows = modules
      .sort((a, b) => {
        const iA = moduleIds.indexOf(a.id);
        const iB = moduleIds.indexOf(b.id);
        if (iA === -1 && iB === -1) return 0;
        if (iA === -1) return 1;
        if (iB === -1) return -1;
        return iA - iB;
      })
      .map((m, index) => ({
        course_id: courseId,
        module_slug: m.id,
        title: m.title ?? "",
        description: m.description ?? "",
        duration: m.duration ?? "",
        video_embed_url: m.videoEmbedUrl ?? "",
        document_embed_url: m.documentEmbedUrl || null,
        presentation_embed_url: m.presentationEmbedUrl || null,
        quiz_sheet_id: m.quizSheetId || null,
        mission_id_slug: m.missionId ?? null,
        content: m.content ?? null,
        position: index,
      }));
    const { error: modErr } = await dbResult(async () => {
      await sql`
        INSERT INTO course_modules ${sql(
          rows,
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
    if (modErr) console.error(modErr);
  }

  if (missions.length > 0) {
    const rows = missions.map((m) => ({
      course_id: courseId,
      mission_slug: m.id,
      title: m.title ?? "",
      context: m.context ?? "",
      objective: m.objective ?? "",
      instructions: Array.isArray(m.instructions) ? m.instructions : [],
      deliverable: m.deliverable ?? "",
    }));
    const { error: missErr } = await dbResult(async () => {
      await sql`
        INSERT INTO course_missions ${sql(
          rows,
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
    if (missErr) console.error(missErr);
  }

  return NextResponse.json({
    id: newCourse.id,
    slug: newCourse.slug ?? slug,
    ok: true,
  });
}
