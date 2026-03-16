import { supabaseAdmin } from "@/lib/supabase/admin";

export type CourseProgress = {
  completedModuleIds: string[];
  completedMissionIds: string[];
  /** Missions envoyées, en attente de validation par admin/auteur. */
  pendingMissionIds: string[];
  /** Meilleur score au quiz par module (type = 'quiz'). */
  quizScores: Record<string, number>;
};

export async function getProgressForCourse(
  email: string,
  courseSlug: string
): Promise<CourseProgress> {
  const { data: completedData, error: completedError } = await supabaseAdmin
    .from("user_progress")
    .select("module_id, type, score")
    .eq("email", email)
    .eq("course_slug", courseSlug)
    .eq("status", "completed");

  if (completedError) {
    console.error("getProgressForCourse", completedError);
    return { completedModuleIds: [], completedMissionIds: [], pendingMissionIds: [], quizScores: {} };
  }

  const { data: pendingData } = await supabaseAdmin
    .from("user_progress")
    .select("module_id")
    .eq("email", email)
    .eq("course_slug", courseSlug)
    .eq("type", "mission")
    .eq("status", "pending_validation");

  const rows = completedData ?? [];
  const completedModuleIds = [...new Set(rows.filter((r) => r.type === "module").map((r) => r.module_id))];
  const completedMissionIds = [...new Set(rows.filter((r) => r.type === "mission").map((r) => r.module_id))];
  const pendingMissionIds = [...new Set((pendingData ?? []).map((r) => r.module_id))];
  const quizScores: Record<string, number> = {};
  for (const r of rows.filter((r) => r.type === "quiz" && r.module_id && r.score != null)) {
    const mid = r.module_id as string;
    const s = Number(r.score);
    if (!(mid in quizScores) || s > quizScores[mid]) quizScores[mid] = s;
  }
  return { completedModuleIds, completedMissionIds, pendingMissionIds, quizScores };
}

export type CourseProgressStats = {
  /** Emails des personnes ayant terminé toute la formation (tous les modules + toutes les missions). */
  completedBy: string[];
  /** Par module : liste des emails ayant complété ce module. */
  perModule: { moduleId: string; emails: string[] }[];
};

/** Statistiques de progression pour une formation (côté admin). Formation terminée = tous les modules ET toutes les missions validées. */
export async function getCourseProgressStatsForAdmin(
  courseSlug: string,
  moduleIds: string[],
  missionIds: string[] = []
): Promise<CourseProgressStats> {
  const { data: moduleData, error: moduleError } = await supabaseAdmin
    .from("user_progress")
    .select("email, module_id")
    .eq("course_slug", courseSlug)
    .eq("type", "module")
    .eq("status", "completed");

  const { data: missionData } = await supabaseAdmin
    .from("user_progress")
    .select("email, module_id")
    .eq("course_slug", courseSlug)
    .eq("type", "mission")
    .eq("status", "completed");

  if (moduleError || !moduleData) {
    return { completedBy: [], perModule: moduleIds.map((moduleId) => ({ moduleId, emails: [] })) };
  }

  const moduleRows = moduleData as { email: string; module_id: string }[];
  const missionRows = (missionData ?? []) as { email: string; module_id: string }[];
  const perModule = new Map<string, Set<string>>();
  for (const id of moduleIds) perModule.set(id, new Set());
  const modulesByEmail = new Map<string, Set<string>>();
  const missionsByEmail = new Map<string, Set<string>>();

  for (const row of moduleRows) {
    const email = row.email?.toLowerCase();
    const moduleId = row.module_id;
    if (!email || !moduleId) continue;
    perModule.get(moduleId)?.add(email);
    if (!modulesByEmail.has(email)) modulesByEmail.set(email, new Set());
    modulesByEmail.get(email)!.add(moduleId);
  }
  for (const row of missionRows) {
    const email = row.email?.toLowerCase();
    const missionId = row.module_id;
    if (!email || !missionId) continue;
    if (!missionsByEmail.has(email)) missionsByEmail.set(email, new Set());
    missionsByEmail.get(email)!.add(missionId);
  }

  const totalModules = moduleIds.length;
  const totalMissions = missionIds.length;
  const completedBy = [...modulesByEmail.entries()]
    .filter(([email]) => {
      const modules = modulesByEmail.get(email) ?? new Set();
      const missions = missionsByEmail.get(email) ?? new Set();
      return modules.size >= totalModules && missions.size >= totalMissions;
    })
    .map(([email]) => email);

  return {
    completedBy,
    perModule: moduleIds.map((moduleId) => ({
      moduleId,
      emails: [...(perModule.get(moduleId) ?? new Set<string>())],
    })),
  };
}

/** Progression de l'utilisateur pour toutes les formations (catalogue). */
export async function getProgressForAllCourses(email: string): Promise<Record<string, CourseProgress>> {
  const { data, error } = await supabaseAdmin
    .from("user_progress")
    .select("course_slug, module_id, type, score, status")
    .eq("email", email);

  if (error || !data) return {};

  const byCourse = new Map<string, { completedModuleIds: Set<string>; completedMissionIds: Set<string>; pendingMissionIds: Set<string>; quizScores: Map<string, number> }>();

  for (const row of data as { course_slug: string; module_id: string; type: string; score: number | null; status: string }[]) {
    const slug = row.course_slug;
    if (!slug) continue;
    if (!byCourse.has(slug)) {
      byCourse.set(slug, {
        completedModuleIds: new Set(),
        completedMissionIds: new Set(),
        pendingMissionIds: new Set(),
        quizScores: new Map(),
      });
    }
    const cur = byCourse.get(slug)!;
    if (row.status === "completed") {
      if (row.type === "module") cur.completedModuleIds.add(row.module_id);
      else if (row.type === "mission") cur.completedMissionIds.add(row.module_id);
      else if (row.type === "quiz" && row.module_id && row.score != null) {
        const s = Number(row.score);
        const prev = cur.quizScores.get(row.module_id);
        if (prev == null || s > prev) cur.quizScores.set(row.module_id, s);
      }
    } else if (row.type === "mission" && row.status === "pending_validation") {
      cur.pendingMissionIds.add(row.module_id);
    }
  }

  const out: Record<string, CourseProgress> = {};
  for (const [slug, cur] of byCourse.entries()) {
    const quizScores: Record<string, number> = {};
    cur.quizScores.forEach((v, k) => { quizScores[k] = v; });
    out[slug] = {
      completedModuleIds: [...cur.completedModuleIds],
      completedMissionIds: [...cur.completedMissionIds],
      pendingMissionIds: [...cur.pendingMissionIds],
      quizScores,
    };
  }
  return out;
}

export type PendingMissionSubmission = {
  email: string;
  missionId: string;
  date: string;
};

/** Missions en attente de validation pour une formation (admin / auteur). */
export async function getPendingMissionSubmissions(courseSlug: string): Promise<PendingMissionSubmission[]> {
  const { data, error } = await supabaseAdmin
    .from("user_progress")
    .select("email, module_id, date")
    .eq("course_slug", courseSlug)
    .eq("type", "mission")
    .eq("status", "pending_validation")
    .order("date", { ascending: false });

  if (error) {
    console.error("getPendingMissionSubmissions", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    email: r.email ?? "",
    missionId: r.module_id ?? "",
    date: r.date ?? new Date().toISOString(),
  }));
}

/** Missions déjà validées pour une formation (admin / auteur). */
export async function getValidatedMissionSubmissions(courseSlug: string): Promise<PendingMissionSubmission[]> {
  const { data, error } = await supabaseAdmin
    .from("user_progress")
    .select("email, module_id, date")
    .eq("course_slug", courseSlug)
    .eq("type", "mission")
    .eq("status", "completed")
    .order("date", { ascending: false });

  if (error) {
    console.error("getValidatedMissionSubmissions", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    email: r.email ?? "",
    missionId: r.module_id ?? "",
    date: r.date ?? new Date().toISOString(),
  }));
}
