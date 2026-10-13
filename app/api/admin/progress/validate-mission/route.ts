import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import sql, { dbResult, dbMaybeSingle } from "@/lib/db";

/** POST : valider une mission (passer de pending_validation à completed). Réservé admin ou auteur de la formation. */
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

  const { data: course } = await dbMaybeSingle(async () =>
    await sql<{ created_by: string | null }[]>`
      SELECT created_by FROM courses WHERE slug = ${courseSlug} LIMIT 2
    `
  );

  const createdBy = course?.created_by ?? null;
  if (!isAdmin && user.id !== createdBy) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { data, error } = await dbResult(async () =>
    await sql<{ id: string }[]>`
      UPDATE user_progress
      SET status = ${"completed"}
      WHERE email = ${userEmail}
        AND course_slug = ${courseSlug}
        AND module_id = ${missionId}
        AND type = ${"mission"}
        AND status = ${"pending_validation"}
      RETURNING id
    `
  );

  if (error) {
    console.error("validate-mission", error);
    return NextResponse.json({ error: "Erreur lors de la validation" }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json(
      { error: "Aucune soumission en attente trouvée pour cet utilisateur et cette mission" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
