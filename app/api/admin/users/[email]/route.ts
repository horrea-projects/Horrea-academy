import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { getCourseBySlug, getModule } from "@/lib/content";
import { getCourseBySlugFromDb, getCourseTotals } from "@/lib/courses-catalogue";
import { getUserMetiers } from "@/lib/metiers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readProgressRows, type ProgressRow } from "../route";

type CourseDetailSummary = {
  courseSlug: string;
  courseTitle: string;
  totalModules: number;
  modulesCompleted: number;
  totalMissions: number;
  missionsCompleted: number;
  completionPercent: number;
};

type LastModuleEntry = {
  courseSlug: string;
  moduleId: string;
  moduleTitle: string;
  courseTitle: string;
  date: string | null;
};

export type QuizStatEntry = {
  courseSlug: string;
  courseTitle: string;
  moduleId: string;
  moduleTitle: string;
  attempts: number;
  bestScore: number;
};

export type UserDetailResponse = {
  email: string;
  name: string | null;
  is_admin: boolean;
  clerk_id: string | null;
  userMetiers: { id: string; label?: string; slug?: string }[];
  modulesCompleted: number;
  coursesCompleted: number;
  lastActivityAt: string | null;
  courses: CourseDetailSummary[];
  lastModules: LastModuleEntry[];
  quizStats: QuizStatEntry[];
};

async function requireAdmin(_req: NextRequest) {
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;
  if (!user || !isAdmin) {
    return null;
  }
  return user;
}

function filterRowsForEmail(rows: ProgressRow[], emailParam: string) {
  const target = emailParam.toLowerCase();
  return rows.filter((row) => row.email.toLowerCase() === target);
}

type CourseTotals = { totalModules: number; totalMissions: number };

function buildUserDetail(
  email: string,
  rows: ProgressRow[],
  courseTotals: Map<string, CourseTotals>,
  courseTitles: Map<string, string>
): UserDetailResponse {
  type CourseState = { completedModules: Set<string>; completedMissions: Set<string> };
  const perCourse = new Map<string, CourseState>();
  let lastActivityAt: string | null = null;
  const completedModuleKeys = new Set<string>();

  for (const row of rows) {
    const { courseSlug, moduleId, status, type, date } = row;
    if (date) {
      if (!lastActivityAt || new Date(date).getTime() > new Date(lastActivityAt).getTime()) {
        lastActivityAt = date;
      }
    }
    if (status !== "completed") continue;
    if (type === "module") {
      completedModuleKeys.add(`${courseSlug}:${moduleId}`);
      if (!perCourse.has(courseSlug)) perCourse.set(courseSlug, { completedModules: new Set(), completedMissions: new Set() });
      perCourse.get(courseSlug)!.completedModules.add(moduleId);
    } else if (type === "mission") {
      if (!perCourse.has(courseSlug)) perCourse.set(courseSlug, { completedModules: new Set(), completedMissions: new Set() });
      perCourse.get(courseSlug)!.completedMissions.add(moduleId);
    }
  }

  let coursesCompleted = 0;
  const courseSummaries: CourseDetailSummary[] = [];

  for (const [courseSlug, state] of perCourse.entries()) {
    const totals = courseTotals.get(courseSlug) ?? { totalModules: 0, totalMissions: 0 };
    const totalModules = totals.totalModules;
    const totalMissions = totals.totalMissions;
    const courseTitle = courseTitles.get(courseSlug) ?? courseSlug;
    const modulesCompleted = state.completedModules.size;
    const missionsCompleted = state.completedMissions.size;
    const totalElements = totalModules + totalMissions;
    const completedElements = modulesCompleted + missionsCompleted;
    const completionPercent = totalElements > 0 ? Math.round((completedElements / totalElements) * 100) : 0;
    if (totalModules > 0 && totalMissions >= 0 && modulesCompleted >= totalModules && missionsCompleted >= totalMissions) {
      coursesCompleted += 1;
    }
    courseSummaries.push({
      courseSlug,
      courseTitle,
      totalModules,
      modulesCompleted,
      totalMissions,
      missionsCompleted,
      completionPercent
    });
  }

  courseSummaries.sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));

  const lastModules: LastModuleEntry[] = rows
    .filter((row) => row.status === "completed" && (!row.type || row.type === "module"))
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 5)
    .map((row) => {
      const course = getCourseBySlug(row.courseSlug);
      const module = getModule(row.courseSlug, row.moduleId);
      return {
        courseSlug: row.courseSlug,
        moduleId: row.moduleId,
        moduleTitle: module?.title ?? row.moduleId,
        courseTitle: course?.title ?? row.courseSlug,
        date: row.date ?? null
      };
    });

  // Agrégation des scores quiz par (courseSlug, moduleId) : nombre d'essais et meilleur score
  const quizByKey = new Map<string, { attempts: number; bestScore: number }>();
  for (const row of rows) {
    if (row.type !== "quiz" || row.moduleId == null) continue;
    const score = row.score != null ? Number(row.score) : 0;
    const key = `${row.courseSlug}:${row.moduleId}`;
    if (!quizByKey.has(key)) quizByKey.set(key, { attempts: 0, bestScore: 0 });
    const cur = quizByKey.get(key)!;
    cur.attempts += 1;
    if (score > cur.bestScore) cur.bestScore = score;
  }
  const quizStats: QuizStatEntry[] = [];
  for (const [key, { attempts, bestScore }] of quizByKey.entries()) {
    const [courseSlug, moduleId] = key.split(":");
    const courseTitle = courseTitles.get(courseSlug) ?? courseSlug;
    const module = getModule(courseSlug, moduleId);
    quizStats.push({
      courseSlug,
      courseTitle,
      moduleId,
      moduleTitle: module?.title ?? moduleId,
      attempts,
      bestScore: Math.round(bestScore),
    });
  }
  quizStats.sort((a, b) => a.courseTitle.localeCompare(b.courseTitle) || a.moduleTitle.localeCompare(b.moduleTitle));

  return {
    email,
    name: null,
    is_admin: false,
    modulesCompleted: completedModuleKeys.size,
    coursesCompleted,
    lastActivityAt,
    courses: courseSummaries,
    lastModules,
    quizStats,
  };
}

async function getAppUserByEmail(email: string): Promise<{ name: string | null; is_admin: boolean; clerk_id: string | null } | null> {
  const { data } = await supabaseAdmin
    .from("app_users")
    .select("name, is_admin, clerk_id")
    .ilike("email", email)
    .maybeSingle();
  return data as { name: string | null; is_admin: boolean; clerk_id: string | null } | null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ email: string }> }) {
  const user = await requireAdmin(req);
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { email } = await params;
  if (!email) {
    return NextResponse.json({ error: "Email manquant" }, { status: 400 });
  }

  const decodedEmail = decodeURIComponent(email);

  try {
    const [rows, appUser] = await Promise.all([
      readProgressRows(),
      getAppUserByEmail(decodedEmail)
    ]);
    const userRows = filterRowsForEmail(rows, decodedEmail);
    if (userRows.length === 0) {
      return NextResponse.json({
        email: decodedEmail,
        name: appUser?.name ?? null,
        is_admin: appUser?.is_admin ?? false,
        modulesCompleted: 0,
        coursesCompleted: 0,
        lastActivityAt: null,
        courses: [] as CourseDetailSummary[],
        lastModules: [] as LastModuleEntry[],
        quizStats: [] as QuizStatEntry[],
      });
    }
    const slugs = [...new Set(userRows.map((r) => r.courseSlug))];
    const [totalsList, titlesList] = await Promise.all([
      Promise.all(slugs.map((slug) => getCourseTotals(slug))),
      Promise.all(slugs.map((slug) => getCourseBySlug(slug)))
    ]);
    const courseTotals = new Map(slugs.map((slug, i) => [slug, totalsList[i]]));
    const courseTitles = new Map(slugs.map((slug, i) => [slug, titlesList[i]?.title ?? slug]));
    const fromDbList = await Promise.all(slugs.map((s) => getCourseBySlugFromDb(s, { includeUnpublished: true })));
    fromDbList.forEach((fd, i) => {
      if (fd) courseTitles.set(slugs[i], fd.course.title);
    });
    const clerkId = (appUser as { clerk_id?: string } | null)?.clerk_id ?? null;
    const userMetiers = clerkId ? await getUserMetiers(clerkId) : [];
    const base = {
      ...buildUserDetail(decodedEmail, userRows, courseTotals, courseTitles),
      name: appUser?.name ?? null,
      is_admin: appUser?.is_admin ?? false,
      clerk_id: clerkId ?? null,
      userMetiers: userMetiers.map((um) => ({ id: um.metier_id, label: um.metier?.label, slug: um.metier?.slug })),
    };
    // Enrichir les titres des modules (quiz) pour les formations venant de la DB
    for (let i = 0; i < slugs.length; i++) {
      const fd = fromDbList[i];
      if (!fd) continue;
      const slug = slugs[i];
      for (const q of base.quizStats) {
        if (q.courseSlug === slug) {
          const mod = fd.modules.find((m) => m.id === q.moduleId);
          if (mod) q.moduleTitle = mod.title;
        }
      }
    }
    return NextResponse.json(base);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Impossible de lire les données de progression pour cet utilisateur" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { email } = await params;
  if (!email) {
    return NextResponse.json({ error: "Email manquant" }, { status: 400 });
  }

  const decodedEmail = decodeURIComponent(email);
  let body: { name?: string | null; is_admin?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  try {
    const { data: appUser } = await supabaseAdmin
      .from("app_users")
      .select("id, clerk_id")
      .ilike("email", decodedEmail)
      .maybeSingle();

    if (!appUser) {
      return NextResponse.json({ error: "Utilisateur non trouvé dans app_users" }, { status: 404 });
    }

    const updates: { name?: string | null; is_admin?: boolean; updated_at: string } = {
      updated_at: new Date().toISOString()
    };
    if (body.name !== undefined) updates.name = body.name;
    if (body.is_admin !== undefined) updates.is_admin = body.is_admin;

    const { error: updateError } = await supabaseAdmin
      .from("app_users")
      .update(updates)
      .eq("id", appUser.id);

    if (updateError) {
      console.error(updateError);
      return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
    }

    if (body.is_admin !== undefined && appUser.clerk_id) {
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(appUser.clerk_id, {
          publicMetadata: { isAdmin: body.is_admin }
        });
      } catch (clerkErr) {
        console.error("Clerk metadata update failed:", clerkErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { email } = await params;
  if (!email) {
    return NextResponse.json({ error: "Email manquant" }, { status: 400 });
  }

  const decodedEmail = decodeURIComponent(email);

  try {
    const { error } = await supabaseAdmin
      .from("app_users")
      .delete()
      .ilike("email", decodedEmail);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

