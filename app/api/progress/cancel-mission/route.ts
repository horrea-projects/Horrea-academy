import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** POST : annuler l'envoi d'une mission (supprime la ligne en attente). L'apprenant peut ensuite refaire la mission. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  if (!user || !email) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { courseSlug?: string; missionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }
  const { courseSlug, missionId } = body;
  if (!courseSlug || !missionId) {
    return NextResponse.json(
      { error: "courseSlug et missionId requis" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("user_progress")
    .delete()
    .eq("email", email)
    .eq("course_slug", courseSlug)
    .eq("module_id", missionId)
    .eq("type", "mission")
    .eq("status", "pending_validation");

  if (error) {
    console.error("cancel-mission", error);
    return NextResponse.json({ error: "Erreur lors de l'annulation" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
