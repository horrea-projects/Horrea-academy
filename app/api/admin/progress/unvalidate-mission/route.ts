import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** POST : annuler la validation d'une mission (repasser en attente). Réservé admin ou auteur de la formation. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { courseSlug?: string; missionId?: string; userEmail?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }
  const { courseSlug, missionId, userEmail } = body;
  if (!courseSlug || !missionId || !userEmail) {
    return NextResponse.json(
      { error: "courseSlug, missionId et userEmail requis" },
      { status: 400 }
    );
  }

  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("created_by")
    .eq("slug", courseSlug)
    .maybeSingle();

  const createdBy = (course as { created_by?: string | null } | null)?.created_by ?? null;
  if (!isAdmin && user.id !== createdBy) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("user_progress")
    .update({ status: "pending_validation" })
    .eq("email", userEmail)
    .eq("course_slug", courseSlug)
    .eq("module_id", missionId)
    .eq("type", "mission")
    .eq("status", "completed")
    .select("id");

  if (error) {
    console.error("unvalidate-mission", error);
    return NextResponse.json({ error: "Erreur lors de l'annulation de la validation" }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json(
      { error: "Aucune mission validée trouvée pour cet utilisateur et cette mission" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
