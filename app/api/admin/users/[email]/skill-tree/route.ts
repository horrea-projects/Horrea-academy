import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import type { CourseListItem } from "@/lib/content";
import { getCoursesList, getCategories } from "@/lib/content";
import { getPublishedCoursesFromDb, getCategoriesFromDb } from "@/lib/courses-catalogue";
import { getMetiersWithFormations, getUserMetiers } from "@/lib/metiers";
import { getProgressForAllCourses } from "@/lib/progress";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function getAppUserByEmail(email: string): Promise<{ clerk_id: string | null; name: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("clerk_id, name")
    .ilike("email", email)
    .maybeSingle();
  if (error || !data) return null;
  return data as { clerk_id: string | null; name: string | null };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ email: string }> }
) {
  const user = await currentUser();
  if (!user || user.publicMetadata?.isAdmin !== true) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { email } = await context.params;
  const decodedEmail = decodeURIComponent(email);
  const appUser = await getAppUserByEmail(decodedEmail);
  const clerkId = appUser?.clerk_id ?? null;

  const [fileCourses, dbCourses, fileCategories, dbCategories, metiersWithFormations, userMetiers] =
    await Promise.all([
      Promise.resolve(getCoursesList()),
      getPublishedCoursesFromDb(),
      Promise.resolve(getCategories()),
      getCategoriesFromDb(),
      getMetiersWithFormations(),
      clerkId ? getUserMetiers(clerkId) : Promise.resolve(null),
    ]);

  const bySlug = new Map<string, CourseListItem>(fileCourses.map((c) => [c.slug, c]));
  for (const c of dbCourses) bySlug.set(c.slug, c);
  const courses = [...bySlug.values()].sort((a, b) => {
    const dateA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
    const dateB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
    return dateB - dateA;
  });

  const fileCats = fileCategories.map((c) => ({ ...c, parent_id: null as string | null }));
  const dbCats = dbCategories.map((c) => ({ id: c.id, slug: c.slug, label: c.label, icon: c.icon, parent_id: c.parent_id ?? null }));
  const bySlugCat = new Map<string, { id: string; slug: string; label: string; icon: string; parent_id: string | null }>();
  for (const c of fileCats) bySlugCat.set(c.slug, c);
  for (const c of dbCats) bySlugCat.set(c.slug, c);
  const allCategoriesForTree = [...bySlugCat.values()];

  const progressByCourse = await getProgressForAllCourses(decodedEmail);
  const assignedMetierIds = (userMetiers ?? []).map((um) => um.metier_id);
  const assignedMetiersWithFormations = metiersWithFormations
    .filter((m) => assignedMetierIds.includes(m.id))
    .map((m) => ({ id: m.id, label: m.label, slug: m.slug, course_slugs: m.course_slugs }));

  return NextResponse.json({
    categories: allCategoriesForTree,
    courses,
    progressByCourse,
    assignedMetiersWithFormations,
    userImageUrl: null,
    userName: appUser?.name ?? decodedEmail,
  });
}
