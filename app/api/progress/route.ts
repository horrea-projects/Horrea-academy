import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProgressForCourse, getProgressForAllCourses } from "@/lib/progress";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user?.emailAddresses?.[0]?.emailAddress) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const email = user.emailAddresses[0].emailAddress;
  const courseSlug = req.nextUrl.searchParams.get("courseSlug");

  if (courseSlug) {
    const progress = await getProgressForCourse(email, courseSlug);
    return NextResponse.json({
      completedModuleIds: progress.completedModuleIds,
      completedMissionIds: progress.completedMissionIds,
      pendingMissionIds: progress.pendingMissionIds,
      quizScores: progress.quizScores,
    });
  }

  const progressByCourse = await getProgressForAllCourses(email);
  return NextResponse.json({ progressByCourse });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user?.emailAddresses?.[0]?.emailAddress) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const email = user.emailAddresses[0].emailAddress;

  let body: { courseSlug?: string; moduleId?: string; status?: string; type?: string; score?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }
  const { courseSlug, moduleId, status, type, score } = body;
  if (!courseSlug || !moduleId || !status) {
    return NextResponse.json(
      { error: "courseSlug, moduleId et status requis" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from("user_progress").insert({
    email,
    course_slug: courseSlug,
    module_id: moduleId,
    status,
    type: type ?? "module",
    score: score ?? null,
    date: new Date().toISOString(),
  });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur enregistrement progression" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
