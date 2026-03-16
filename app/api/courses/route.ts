import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Créer une formation en proposition (en attente). Utilisateur connecté, published forcé à false. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return new NextResponse("Non authentifié", { status: 401 });
  }

  let body: {
    slug: string;
    title: string;
    description: string;
    duration: string;
    category_id?: string | null;
    onboarding_title?: string | null;
    onboarding_content?: string | null;
    onboarding_presentation_embed_url?: string | null;
    final_quiz_sheet_id?: string | null;
    quiz_spreadsheet_id?: string | null;
    final_quiz_sheet_name?: string | null;
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

  const { slug, title, description, duration, category_id, onboarding_title, onboarding_content, onboarding_presentation_embed_url, final_quiz_sheet_id, quiz_spreadsheet_id, final_quiz_sheet_name, modules = [], missions = [] } = body;
  if (!slug?.trim() || !title?.trim() || !description || !duration) {
    return NextResponse.json({ error: "slug, title, description, duration requis" }, { status: 400 });
  }

  try {
    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .insert({
        slug: slug.trim(),
        title: title.trim(),
        description,
        duration,
        category_id: category_id || null,
        published: false,
        created_by: user.id,
        onboarding_title: onboarding_title?.trim() || null,
        onboarding_content: onboarding_content?.trim() || null,
        onboarding_presentation_embed_url: onboarding_presentation_embed_url?.trim() || null,
        final_quiz_sheet_id: final_quiz_sheet_id?.trim() || null,
        quiz_spreadsheet_id: quiz_spreadsheet_id?.trim() || null,
        final_quiz_sheet_name: final_quiz_sheet_name?.trim() || null,
      })
      .select("id, slug")
      .single();

    if (courseError || !course) {
      console.error(courseError);
      return NextResponse.json({ error: courseError?.message ?? "Erreur création formation" }, { status: 500 });
    }

    if (modules.length > 0) {
      const rows = modules.map((m) => ({
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
        position: m.position
      }));
      const { error: modErr } = await supabaseAdmin.from("course_modules").insert(rows);
      if (modErr) console.error(modErr);
    }

    if (missions.length > 0) {
      const rows = missions.map((m) => ({
        course_id: course.id,
        mission_slug: m.mission_slug,
        title: m.title,
        context: m.context ?? "",
        objective: m.objective ?? "",
        instructions: m.instructions ?? [],
        deliverable: m.deliverable ?? ""
      }));
      const { error: missErr } = await supabaseAdmin.from("course_missions").insert(rows);
      if (missErr) console.error(missErr);
    }

    return NextResponse.json({ id: course.id, slug: (course as { slug?: string }).slug ?? slug.trim(), ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
