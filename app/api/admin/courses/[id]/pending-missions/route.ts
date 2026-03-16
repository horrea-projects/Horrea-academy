import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPendingMissionSubmissions, getValidatedMissionSubmissions } from "@/lib/progress";

type Params = { params: Promise<{ id: string }> };

/** GET : liste des missions en attente de validation (admin ou auteur de la formation). */
export async function GET(_req: Request, { params }: Params) {
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id: courseId } = await params;
  if (!courseId) {
    return NextResponse.json({ error: "id requis" }, { status: 400 });
  }

  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("slug, created_by")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const slug = (course as { slug: string }).slug;
  const createdBy = (course as { created_by?: string | null }).created_by ?? null;
  if (!isAdmin && user.id !== createdBy) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const [submissions, validated] = await Promise.all([
    getPendingMissionSubmissions(slug),
    getValidatedMissionSubmissions(slug),
  ]);
  return NextResponse.json({ submissions, validated });
}
