import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import sql, { dbResult } from "@/lib/db";

/** POST : remettre un module à zéro pour que l'apprenant puisse le refaire. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  if (!user || !email) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { courseSlug?: string; moduleId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { courseSlug, moduleId } = body;
  if (!courseSlug || !moduleId) {
    return NextResponse.json({ error: "courseSlug et moduleId requis" }, { status: 400 });
  }

  // Supprime l'état du module + les tentatives quiz liées à ce module.
  const { error } = await dbResult(async () => {
    await sql`
      DELETE FROM user_progress
      WHERE email = ${email}
        AND course_slug = ${courseSlug}
        AND module_id = ${moduleId}
        AND type = ANY(${["module", "quiz"]})
    `;
    return true;
  });

  if (error) {
    console.error("reset-module", error);
    return NextResponse.json({ error: "Erreur lors de la remise à zéro du module" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
