import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import type { Category } from "@/lib/content";
import { getCoursesList, getCategories } from "@/lib/content";
import { getPublishedCoursesFromDb, getCategoriesFromDb } from "@/lib/courses-catalogue";
import { getMetiersWithFormations, getUserMetiers } from "@/lib/metiers";
import { getProgressForAllCourses } from "@/lib/progress";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SkillTreeWhiteboard } from "./skill-tree-whiteboard";

export const metadata = {
  title: "Arbre de compétences | Horrea Academy",
  description: "Tableau blanc de l'arbre de compétences : parcours métiers et formations à débloquer.",
};

export default async function ArbreCompetencesPage() {
  const user = await currentUser();
  const [fileCourses, dbCourses, fileCategories, dbCategories, metiersWithFormations, userMetiers] =
    await Promise.all([
      Promise.resolve(getCoursesList()),
      getPublishedCoursesFromDb(),
      Promise.resolve(getCategories()),
      getCategoriesFromDb(),
      getMetiersWithFormations(),
      getUserMetiers(user?.id ?? null),
    ]);

  const bySlug = new Map(fileCourses.map((c) => [c.slug, c]));
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

  const email = user?.emailAddresses?.[0]?.emailAddress;
  const progressByCourse = email ? await getProgressForAllCourses(email) : {};

  const assignedMetierIds = (userMetiers ?? []).map((um) => um.metier_id);
  const assignedMetiersWithFormations = metiersWithFormations.filter((m) => assignedMetierIds.includes(m.id));

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="shrink-0 space-y-4 px-4 py-4 md:px-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard">Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard/courses">Catalogue des formations</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Arbre de compétences</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <SkillTreeWhiteboard
        categories={allCategoriesForTree}
        courses={courses}
        progressByCourse={progressByCourse}
        assignedMetiersWithFormations={assignedMetiersWithFormations.map((m) => ({
          id: m.id,
          label: m.label,
          slug: m.slug,
          course_slugs: m.course_slugs,
        }))}
        userImageUrl={user?.imageUrl ?? null}
        userName={user?.firstName || user?.lastName ? [user?.firstName, user?.lastName].filter(Boolean).join(" ") : null}
      />
    </div>
  );
}
