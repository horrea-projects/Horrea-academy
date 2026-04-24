import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCourseTotals } from "@/lib/courses-catalogue";

export type ProgressRow = {
  email: string;
  courseSlug: string;
  moduleId: string;
  status: string;
  score?: number;
  type?: string;
  date?: string;
};

type UserAggregate = {
  email: string;
  clerkId: string | null;
  modulesCompleted: number;
  coursesCompleted: number;
  coursesCreated: number;
  lastActivityAt: string | null;
};

async function requireAdmin(_req: NextRequest) {
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;
  if (!user || !isAdmin) {
    return null;
  }
  return user;
}

export async function readProgressRows(): Promise<ProgressRow[]> {
  const { data, error } = await supabaseAdmin
    .from("user_progress")
    .select("email, course_slug, module_id, status, score, type, date");

  if (error || !data) {
    console.error("Erreur lecture user_progress", error);
    return [];
  }

  return data
    .map((row): ProgressRow | null => {
      const { email, course_slug, module_id, status, score, type, date } = row as any;
      if (!email || !course_slug || !module_id || !status) return null;
      return {
        email: String(email),
        courseSlug: String(course_slug),
        moduleId: String(module_id),
        status: String(status),
        score: typeof score === "number" ? score : score ? Number(score) : undefined,
        type: type ? String(type) : undefined,
        date: date ? String(date) : undefined
      };
    })
    .filter((row): row is ProgressRow => row !== null);
}

type CourseTotals = { totalModules: number; totalMissions: number };

function aggregateByUser(rows: ProgressRow[], courseTotals: Map<string, CourseTotals>): UserAggregate[] {
  type UserState = {
    modulesCompletedSet: Set<string>;
    perCourseModules: Map<string, Set<string>>;
    perCourseMissions: Map<string, Set<string>>;
    lastActivityAt: string | null;
  };

  const byUser = new Map<string, UserState>();

  for (const row of rows) {
    const { email, courseSlug, moduleId, status, type, date } = row;
    const key = email.toLowerCase();
    if (!byUser.has(key)) {
      byUser.set(key, {
        modulesCompletedSet: new Set(),
        perCourseModules: new Map(),
        perCourseMissions: new Map(),
        lastActivityAt: null
      });
    }
    const user = byUser.get(key)!;

    if (date) {
      if (!user.lastActivityAt || new Date(date).getTime() > new Date(user.lastActivityAt).getTime()) {
        user.lastActivityAt = date;
      }
    }

    if (status !== "completed") continue;
    if (type === "module") {
      const moduleKey = `${courseSlug}:${moduleId}`;
      user.modulesCompletedSet.add(moduleKey);
      if (!user.perCourseModules.has(courseSlug)) user.perCourseModules.set(courseSlug, new Set());
      user.perCourseModules.get(courseSlug)!.add(moduleId);
    } else if (type === "mission") {
      if (!user.perCourseMissions.has(courseSlug)) user.perCourseMissions.set(courseSlug, new Set());
      user.perCourseMissions.get(courseSlug)!.add(moduleId);
    }
  }

  const aggregates: UserAggregate[] = [];
  for (const [email, state] of byUser.entries()) {
    let coursesCompleted = 0;
    for (const courseSlug of new Set([...state.perCourseModules.keys(), ...state.perCourseMissions.keys()])) {
      const totals = courseTotals.get(courseSlug) ?? { totalModules: 0, totalMissions: 0 };
      const completedModules = state.perCourseModules.get(courseSlug)?.size ?? 0;
      const completedMissions = state.perCourseMissions.get(courseSlug)?.size ?? 0;
      if (totals.totalModules > 0 && totals.totalMissions >= 0 &&
          completedModules >= totals.totalModules && completedMissions >= totals.totalMissions) {
        coursesCompleted += 1;
      }
    }
    aggregates.push({
      email,
      clerkId: null,
      modulesCompleted: state.modulesCompletedSet.size,
      coursesCompleted,
      coursesCreated: 0,
      lastActivityAt: state.lastActivityAt
    });
  }

  aggregates.sort((a, b) => {
    const dateA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const dateB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    return b.modulesCompleted - a.modulesCompleted;
  });

  return aggregates;
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const [appUsersRes, progressRows, coursesByCreatorRes] = await Promise.all([
      supabaseAdmin.from("app_users").select("clerk_id, email"),
      readProgressRows(),
      supabaseAdmin.from("courses").select("created_by").not("created_by", "is", null)
    ]);

    const slugs = [...new Set(progressRows.map((r) => r.courseSlug))];
    const totalsList = await Promise.all(slugs.map((slug) => getCourseTotals(slug)));
    const courseTotals = new Map(slugs.map((slug, i) => [slug, totalsList[i]]));

    const progressByEmail = new Map<string, Omit<UserAggregate, "clerkId" | "coursesCreated">>();
    for (const a of aggregateByUser(progressRows, courseTotals)) {
      progressByEmail.set(a.email.toLowerCase(), {
        email: a.email,
        modulesCompleted: a.modulesCompleted,
        coursesCompleted: a.coursesCompleted,
        lastActivityAt: a.lastActivityAt
      });
    }

    const coursesCreatedByClerkId: Record<string, number> = {};
    for (const row of coursesByCreatorRes.data ?? []) {
      const id = (row as { created_by: string }).created_by;
      if (id) coursesCreatedByClerkId[id] = (coursesCreatedByClerkId[id] ?? 0) + 1;
    }

    const appUsers = (appUsersRes.data ?? []) as { clerk_id: string; email: string }[];
    const merged: UserAggregate[] = appUsers.map((u) => {
      const stats = progressByEmail.get(u.email.toLowerCase());
      return {
        email: u.email,
        clerkId: u.clerk_id ?? null,
        modulesCompleted: stats?.modulesCompleted ?? 0,
        coursesCompleted: stats?.coursesCompleted ?? 0,
        coursesCreated: coursesCreatedByClerkId[u.clerk_id] ?? 0,
        lastActivityAt: stats?.lastActivityAt ?? null
      };
    });

    merged.sort((a, b) => {
      const dateA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const dateB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      return b.modulesCompleted - a.modulesCompleted;
    });

    return NextResponse.json({ users: merged });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Impossible de lire les données utilisateurs ou progression" },
      { status: 500 }
    );
  }
}

