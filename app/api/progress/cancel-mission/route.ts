import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import sql, { dbResult } from "@/lib/db";

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

  const { error } = await dbResult(async () => {
    await sql`
      DELETE FROM user_progress
      WHERE email = ${email}
        AND course_slug = ${courseSlug}
        AND module_id = ${missionId}
        AND type = ${"mission"}
        AND status = ${"pending_validation"}
    `;
    return true;
  });

  if (error) {
    console.error("cancel-mission", error);
    return NextResponse.json({ error: "Erreur lors de l'annulation" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
