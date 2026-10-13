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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID manquant" }, { status: 400 });
  }

  let courseResult = await dbSingle(async () =>
    await sql<Record<string, unknown>[]>`
      SELECT c.id, c.slug, c.title, c.description, c.duration, c.category_id, c.published, c.status,
        c.added_at, c.created_by, c.onboarding_title, c.onboarding_content,
        c.onboarding_presentation_embed_url, c.onboarding_quiz_sheet_name,
        c.final_quiz_sheet_id, c.quiz_spreadsheet_id, c.final_quiz_sheet_name, c.final_quiz_min_score,
        CASE WHEN cat.id IS NULL THEN NULL
          ELSE json_build_object('id', cat.id, 'slug', cat.slug, 'label', cat.label, 'icon', cat.icon)
        END AS categories
      FROM courses c
      LEFT JOIN categories cat ON cat.id = c.category_id
      WHERE c.id = ${id}
      LIMIT 2
    `
  );
  if (isUndefinedColumnError(courseResult.error)) {
    // Legacy schemas: omit status / created_by / final_quiz_min_score / onboarding quiz cols.
    courseResult = await dbSingle(async () =>
      await sql<Record<string, unknown>[]>`
        SELECT c.id, c.slug, c.title, c.description, c.duration, c.category_id, c.published,
          c.added_at, c.onboarding_title, c.onboarding_content,
          c.onboarding_presentation_embed_url,
          c.final_quiz_sheet_id, c.quiz_spreadsheet_id, c.final_quiz_sheet_name,
          CASE WHEN cat.id IS NULL THEN NULL
            ELSE json_build_object('id', cat.id, 'slug', cat.slug, 'label', cat.label, 'icon', cat.icon)
          END AS categories
        FROM courses c
        LEFT JOIN categories cat ON cat.id = c.category_id
        WHERE c.id = ${id}
        LIMIT 2
      `
    );
  }
  const { data: course, error: courseError } = courseResult;
  if (courseError || !course) {
    return NextResponse.json({ error: "Formation non trouvée" }, { status: 404 });
  }
  const withStatus = course as { status?: string; published?: boolean } & typeof course;
  if (withStatus.status == null) (withStatus as { status: string }).status = withStatus.published ? "published" : "draft";

  let modulesResult = await dbResult(async () =>
    await sql<Record<string, unknown>[]>`
      SELECT id, module_slug, title, description, duration, video_embed_url, document_embed_url,
        presentation_embed_url, quiz_sheet_id, quiz_sheet_name, mission_id_slug, content, position,
        min_quiz_score
      FROM course_modules
      WHERE course_id = ${id}
      ORDER BY position ASC
    `
  );
  if (
    modulesResult.error &&
    (isUndefinedColumnError(modulesResult.error) ||
      modulesResult.error.message?.includes("min_quiz_score") ||
      modulesResult.error.message?.includes("quiz_sheet_name"))
  ) {
    modulesResult = await dbResult(async () =>
      await sql<Record<string, unknown>[]>`
        SELECT id, module_slug, title, description, duration, video_embed_url, document_embed_url,
          presentation_embed_url, quiz_sheet_id, mission_id_slug, content, position
        FROM course_modules
        WHERE course_id = ${id}
        ORDER BY position ASC
      `
    );
  }
  const modules = (modulesResult.data ?? []) as Array<Record<string, unknown>>;

  const { data: missionsData } = await dbResult(async () =>
    await sql<Record<string, unknown>[]>`
      SELECT id, mission_slug, title, context, objective, instructions, deliverable
      FROM course_missions
      WHERE course_id = ${id}
    `
  );

  return NextResponse.json({
    ...withStatus,
    modules: modules.map((m) => ({
      ...m,
      quiz_sheet_name: (m as { quiz_sheet_name?: string }).quiz_sheet_name ?? "",
      min_quiz_score: (m as { min_quiz_score?: number | null }).min_quiz_score ?? "",
    })),
    missions: missionsData ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID manquant" }, { status: 400 });
  }

  let body: {
    slug?: string;
    title?: string;
    description?: string;
    duration?: string;
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

  try {
    let modulesQuizNotSaved = false;
    const updates: Record<string, unknown> = {};
    if (body.slug !== undefined) updates.slug = body.slug.trim();
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description;
    if (body.duration !== undefined) updates.duration = body.duration;
    if (body.category_id !== undefined) updates.category_id = body.category_id;
    if (body.published !== undefined) updates.published = body.published;
    if (body.status !== undefined && ["pending", "draft", "published"].includes(body.status)) {
      updates.status = body.status;
      updates.published = body.status === "published";
    }
    if (body.created_by !== undefined) updates.created_by = body.created_by === "" || body.created_by === null ? null : body.created_by;
    if (body.onboarding_title !== undefined) updates.onboarding_title = body.onboarding_title?.trim() || null;
    if (body.onboarding_content !== undefined) updates.onboarding_content = body.onboarding_content?.trim() || null;
    if (body.onboarding_presentation_embed_url !== undefined) updates.onboarding_presentation_embed_url = body.onboarding_presentation_embed_url?.trim() || null;
    if (body.onboarding_quiz_sheet_name !== undefined) updates.onboarding_quiz_sheet_name = body.onboarding_quiz_sheet_name?.trim() || null;
    if (body.final_quiz_sheet_id !== undefined) updates.final_quiz_sheet_id = body.final_quiz_sheet_id?.trim() || null;
    if (body.quiz_spreadsheet_id !== undefined) updates.quiz_spreadsheet_id = body.quiz_spreadsheet_id?.trim() || null;
    if (body.final_quiz_sheet_name !== undefined) updates.final_quiz_sheet_name = body.final_quiz_sheet_name?.trim() || null;
    if (body.final_quiz_min_score !== undefined) {
      const v = body.final_quiz_min_score;
      updates.final_quiz_min_score = v !== null && !Number.isNaN(v) ? v : null;
    }

    if (Object.keys(updates).length > 0) {
      let updateResult = await dbResult(async () => {
        await sql`
          UPDATE courses SET ${sql(updates, ...Object.keys(updates))} WHERE id = ${id}
        `;
        return null;
      });
      if (updateResult.error && isUndefinedColumnError(updateResult.error)) {
        const fallback = { ...updates } as Record<string, unknown>;
        const msg = updateResult.error?.message ?? "";
        if (msg.includes("status")) {
          delete fallback.status;
          if (body.status !== undefined && ["pending", "draft", "published"].includes(body.status)) {
            (fallback as { published?: boolean }).published = body.status === "published";
          }
        }
        if (msg.includes("created_by")) delete fallback.created_by;
        if (msg.includes("final_quiz_min_score")) delete fallback.final_quiz_min_score;
        if (Object.keys(fallback).length > 0) {
          updateResult = await dbResult(async () => {
            await sql`
              UPDATE courses SET ${sql(fallback, ...Object.keys(fallback))} WHERE id = ${id}
            `;
            return null;
          });
        } else {
          updateResult = { data: null, error: null };
        }
      }
      if (updateResult.error) {
        console.error(updateResult.error);
        return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
      }
    }

    if (body.modules !== undefined) {
      const delMod = await dbResult(async () => {
        await sql`DELETE FROM course_modules WHERE course_id = ${id}`;
        return null;
      });
      if (delMod.error) {
        console.error(delMod.error);
        return NextResponse.json({ error: "Erreur suppression modules: " + delMod.error.message }, { status: 500 });
      }
      if (body.modules.length > 0) {
        const fullRows = body.modules.map((m) => ({
          course_id: id,
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
        // Colonnes du schéma de base uniquement (sans quiz_sheet_name, min_quiz_score ajoutés par migrations)
        const baseRows = body.modules.map((m) => ({
          course_id: id,
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
        let insMod = await dbResult(async () => {
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
        const schemaErr =
          isUndefinedColumnError(insMod.error) ||
          insMod.error?.message?.includes("min_quiz_score") ||
          insMod.error?.message?.includes("quiz_sheet_name");
        if (insMod.error && schemaErr) {
          insMod = await dbResult(async () => {
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
          if (!insMod.error && body.modules.some((m) => m.quiz_sheet_name?.trim() || m.min_quiz_score != null)) {
            modulesQuizNotSaved = true;
          }
        }
        if (insMod.error) {
          console.error(insMod.error);
          return NextResponse.json({ error: "Erreur enregistrement modules: " + insMod.error.message }, { status: 500 });
        }
      }
    }

    if (body.missions !== undefined) {
      const delMiss = await dbResult(async () => {
        await sql`DELETE FROM course_missions WHERE course_id = ${id}`;
        return null;
      });
      if (delMiss.error) {
        console.error(delMiss.error);
        return NextResponse.json({ error: "Erreur suppression missions: " + delMiss.error.message }, { status: 500 });
      }
      if (body.missions.length > 0) {
        const rows = body.missions.map((m) => ({
          course_id: id,
          mission_slug: m.mission_slug,
          title: m.title,
          context: m.context ?? "",
          objective: m.objective ?? "",
          instructions: m.instructions ?? [],
          deliverable: m.deliverable ?? ""
        }));
        const insMiss = await dbResult(async () => {
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
        if (insMiss.error) {
          console.error(insMiss.error);
          return NextResponse.json({ error: "Erreur enregistrement missions: " + insMiss.error.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ ok: true, ...(modulesQuizNotSaved && { modulesQuizNotSaved: true }) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID manquant" }, { status: 400 });
  }

  const { error } = await dbResult(async () => {
    await sql`DELETE FROM courses WHERE id = ${id}`;
    return null;
  });
  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
