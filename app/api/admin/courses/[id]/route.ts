import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

  let courseResult: { data: unknown; error: { code?: string; message?: string } | null } = await supabaseAdmin
    .from("courses")
    .select("id, slug, title, description, duration, category_id, published, status, added_at, created_by, onboarding_title, onboarding_content, onboarding_presentation_embed_url, onboarding_quiz_sheet_name, final_quiz_sheet_id, quiz_spreadsheet_id, final_quiz_sheet_name, final_quiz_min_score, categories(id, slug, label, icon)")
    .eq("id", id)
    .single();
  if (courseResult.error?.code === "42703" || courseResult.error?.code === "PGRST204") {
    const msg = courseResult.error?.message ?? "";
    if (msg.includes("status") || msg.includes("created_by")) {
      courseResult = await supabaseAdmin
        .from("courses")
        .select("id, slug, title, description, duration, category_id, published, added_at, created_by, onboarding_title, onboarding_content, onboarding_presentation_embed_url, onboarding_quiz_sheet_name, final_quiz_sheet_id, quiz_spreadsheet_id, final_quiz_sheet_name, final_quiz_min_score, categories(id, slug, label, icon)")
        .eq("id", id)
        .single();
    }
    if (courseResult.error && (courseResult.error.code === "42703" || courseResult.error.code === "PGRST204") && courseResult.error?.message?.includes("final_quiz_min_score")) {
      courseResult = await supabaseAdmin
        .from("courses")
        .select("id, slug, title, description, duration, category_id, published, added_at, created_by, onboarding_title, onboarding_content, onboarding_presentation_embed_url, onboarding_quiz_sheet_name, final_quiz_sheet_id, quiz_spreadsheet_id, final_quiz_sheet_name, categories(id, slug, label, icon)")
        .eq("id", id)
        .single();
    }
  }
  const { data: course, error: courseError } = courseResult;
  if (courseError || !course) {
    return NextResponse.json({ error: "Formation non trouvée" }, { status: 404 });
  }
  const withStatus = course as { status?: string; published?: boolean } & typeof course;
  if (withStatus.status == null) (withStatus as { status: string }).status = withStatus.published ? "published" : "draft";

  let modulesResult: { data: unknown; error: { code?: string; message?: string } | null } = await supabaseAdmin
    .from("course_modules")
    .select("id, module_slug, title, description, duration, video_embed_url, document_embed_url, presentation_embed_url, quiz_sheet_id, quiz_sheet_name, mission_id_slug, content, position, min_quiz_score")
    .eq("course_id", id)
    .order("position", { ascending: true });
  if (modulesResult.error && (modulesResult.error.code === "42703" || modulesResult.error.code === "PGRST204" || modulesResult.error.message?.includes("schema cache") || modulesResult.error.message?.includes("min_quiz_score") || modulesResult.error.message?.includes("quiz_sheet_name"))) {
    modulesResult = await supabaseAdmin
      .from("course_modules")
      .select("id, module_slug, title, description, duration, video_embed_url, document_embed_url, presentation_embed_url, quiz_sheet_id, mission_id_slug, content, position")
      .eq("course_id", id)
      .order("position", { ascending: true });
  }
  const modules = (modulesResult.data ?? []) as Array<Record<string, unknown>>;

  return NextResponse.json({
    ...withStatus,
    modules: modules.map((m) => ({ ...m, quiz_sheet_name: (m as { quiz_sheet_name?: string }).quiz_sheet_name ?? "", min_quiz_score: (m as { min_quiz_score?: number | null }).min_quiz_score ?? "" })),
    missions: (await supabaseAdmin.from("course_missions").select("id, mission_slug, title, context, objective, instructions, deliverable").eq("course_id", id)).data ?? []
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
      updates.final_quiz_min_score = (v !== null && v !== "" && !Number.isNaN(Number(v))) ? Number(v) : null;
    }

    if (Object.keys(updates).length > 0) {
      let updateResult = await supabaseAdmin.from("courses").update(updates).eq("id", id);
      const schemaError = updateResult.error?.code === "42703" || updateResult.error?.code === "PGRST204" || updateResult.error?.message?.includes("schema cache");
      if (updateResult.error && schemaError) {
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
        updateResult = await supabaseAdmin.from("courses").update(fallback).eq("id", id);
      }
      if (updateResult.error) {
        console.error(updateResult.error);
        return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
      }
    }

    if (body.modules !== undefined) {
      const delMod = await supabaseAdmin.from("course_modules").delete().eq("course_id", id);
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
          min_quiz_score: m.min_quiz_score != null && m.min_quiz_score !== "" ? Number(m.min_quiz_score) : null,
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
        let insMod = await supabaseAdmin.from("course_modules").insert(fullRows);
        const schemaErr = insMod.error?.code === "42703" || insMod.error?.code === "PGRST204" || insMod.error?.message?.includes("schema cache") || insMod.error?.message?.includes("min_quiz_score") || insMod.error?.message?.includes("quiz_sheet_name");
        if (insMod.error && schemaErr) {
          insMod = await supabaseAdmin.from("course_modules").insert(baseRows);
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
      const delMiss = await supabaseAdmin.from("course_missions").delete().eq("course_id", id);
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
        const insMiss = await supabaseAdmin.from("course_missions").insert(rows);
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

  const { error } = await supabaseAdmin.from("courses").delete().eq("id", id);
  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
