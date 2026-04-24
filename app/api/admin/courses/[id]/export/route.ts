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

/** Format compatible avec l'import (formation-complete). */
type ExportCourse = {
  slug: string;
  title: string;
  description?: string;
  duration?: string;
  moduleIds?: string[];
  missionIds?: string[];
  categoryId?: string;
  onboardingTitle?: string;
  onboardingContent?: string;
  onboardingPresentationEmbedUrl?: string;
  finalQuizSheetId?: string;
  finalQuizSheetName?: string;
  finalQuizMinScore?: number | null;
};

type ExportModule = {
  id: string;
  title?: string;
  description?: string;
  duration?: string;
  videoEmbedUrl?: string;
  documentEmbedUrl?: string;
  presentationEmbedUrl?: string;
  quizSheetId?: string;
  quizSheetName?: string;
  missionId?: string | null;
  content?: string;
  minQuizScore?: number | null;
};

type ExportMission = {
  id: string;
  title?: string;
  context?: string;
  objective?: string;
  instructions?: string[];
  deliverable?: string;
};

/** GET : exporte une formation au format JSON compatible avec l'import. */
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

  let courseResult = await supabaseAdmin
    .from("courses")
    .select("id, slug, title, description, duration, category_id, onboarding_title, onboarding_content, onboarding_presentation_embed_url, quiz_spreadsheet_id, final_quiz_sheet_id, final_quiz_sheet_name, final_quiz_min_score, categories(slug)")
    .eq("id", id)
    .single();

  if (courseResult.error?.code === "42703" || courseResult.error?.message?.includes("schema cache")) {
    courseResult = await supabaseAdmin
      .from("courses")
      .select("id, slug, title, description, duration, category_id, onboarding_title, onboarding_content, quiz_spreadsheet_id, categories(slug)")
      .eq("id", id)
      .single();
  }

  const course = courseResult.data;
  const courseError = courseResult.error;
  if (courseError || !course) {
    return NextResponse.json({ error: "Formation non trouvée" }, { status: 404 });
  }

  const c = course as {
    slug: string;
    title: string;
    description?: string;
    duration?: string;
    category_id?: string | null;
    onboarding_title?: string | null;
    onboarding_content?: string | null;
    onboarding_presentation_embed_url?: string | null;
    quiz_spreadsheet_id?: string | null;
    final_quiz_sheet_id?: string | null;
    final_quiz_sheet_name?: string | null;
    final_quiz_min_score?: number | null;
    categories?: Array<{ slug: string }> | { slug: string } | null;
  };
  if (!("onboarding_presentation_embed_url" in c)) (c as Record<string, unknown>).onboarding_presentation_embed_url = null;
  if (!("final_quiz_sheet_id" in c)) (c as Record<string, unknown>).final_quiz_sheet_id = null;
  if (!("final_quiz_sheet_name" in c)) (c as Record<string, unknown>).final_quiz_sheet_name = null;
  if (!("final_quiz_min_score" in c)) (c as Record<string, unknown>).final_quiz_min_score = null;

  const categorySlug = Array.isArray(c.categories) ? (c.categories[0]?.slug ?? null) : (c.categories?.slug ?? null);

  let modulesRows: { data: unknown; error: { code?: string; message?: string } | null } = await supabaseAdmin
    .from("course_modules")
    .select("module_slug, title, description, duration, video_embed_url, document_embed_url, presentation_embed_url, quiz_sheet_id, quiz_sheet_name, mission_id_slug, content, position, min_quiz_score")
    .eq("course_id", id)
    .order("position", { ascending: true });

  if (modulesRows.error && (modulesRows.error.code === "42703" || modulesRows.error.message?.includes("quiz_sheet_name") || modulesRows.error.message?.includes("min_quiz_score"))) {
    modulesRows = await supabaseAdmin
      .from("course_modules")
      .select("module_slug, title, description, duration, video_embed_url, document_embed_url, presentation_embed_url, quiz_sheet_id, mission_id_slug, content, position")
      .eq("course_id", id)
      .order("position", { ascending: true });
  }

  const modules = (modulesRows.data ?? []) as Array<{
    module_slug: string;
    title?: string;
    description?: string;
    duration?: string;
    video_embed_url?: string | null;
    document_embed_url?: string | null;
    presentation_embed_url?: string | null;
    quiz_sheet_id?: string | null;
    quiz_sheet_name?: string | null;
    mission_id_slug?: string | null;
    content?: string | null;
    position?: number;
    min_quiz_score?: number | null;
  }>;

  const { data: missionsRows } = await supabaseAdmin
    .from("course_missions")
    .select("mission_slug, title, context, objective, instructions, deliverable")
    .eq("course_id", id);

  const missions = (missionsRows ?? []) as Array<{
    mission_slug: string;
    title?: string;
    context?: string;
    objective?: string;
    instructions?: string[];
    deliverable?: string;
  }>;

  const quizSpreadsheetId = c.quiz_spreadsheet_id ?? c.final_quiz_sheet_id ?? undefined;

  const exportPayload = {
    course: {
      slug: c.slug,
      title: c.title,
      description: c.description ?? "",
      duration: c.duration ?? "~0h",
      moduleIds: modules.map((m) => m.module_slug),
      missionIds: missions.map((m) => m.mission_slug),
      ...(categorySlug && { categoryId: categorySlug }),
      ...(c.onboarding_title && { onboardingTitle: c.onboarding_title }),
      ...(c.onboarding_content && { onboardingContent: c.onboarding_content }),
      ...(c.onboarding_presentation_embed_url && { onboardingPresentationEmbedUrl: c.onboarding_presentation_embed_url }),
      ...(quizSpreadsheetId && { finalQuizSheetId: quizSpreadsheetId }),
      ...(c.final_quiz_sheet_name && { finalQuizSheetName: c.final_quiz_sheet_name }),
      ...(c.final_quiz_min_score != null && { finalQuizMinScore: c.final_quiz_min_score }),
    } as ExportCourse,
    modules: modules.map((m) => ({
      id: m.module_slug,
      title: m.title ?? "",
      description: m.description ?? "",
      duration: m.duration ?? "",
      videoEmbedUrl: m.video_embed_url ?? "",
      documentEmbedUrl: m.document_embed_url ?? "",
      presentationEmbedUrl: m.presentation_embed_url ?? "",
      quizSheetId: m.quiz_sheet_id ?? quizSpreadsheetId ?? "",
      ...(m.quiz_sheet_name && { quizSheetName: m.quiz_sheet_name }),
      missionId: m.mission_id_slug ?? null,
      content: m.content ?? "",
      ...(m.min_quiz_score != null && { minQuizScore: m.min_quiz_score }),
    })) as ExportModule[],
    missions: missions.map((m) => ({
      id: m.mission_slug,
      title: m.title ?? "",
      context: m.context ?? "",
      objective: m.objective ?? "",
      instructions: Array.isArray(m.instructions) ? m.instructions : [],
      deliverable: m.deliverable ?? "",
    })) as ExportMission[],
  };

  return NextResponse.json(exportPayload, {
    headers: {
      "Content-Disposition": `attachment; filename="formation-${c.slug}.json"`,
    },
  });
}
