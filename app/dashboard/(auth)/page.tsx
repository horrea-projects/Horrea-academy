import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { getCoursesList, getCategories } from "@/lib/content";
import { getPublishedCoursesFromDb, getCategoriesFromDb } from "@/lib/courses-catalogue";
import { getMetiersWithFormations, getUserMetiers } from "@/lib/metiers";
import { getProgressForAllCourses } from "@/lib/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GraduationCapIcon } from "lucide-react";
import { SkillTreeCard } from "./pages/profile/components/skill-tree-card";

export const metadata = {
  title: "Dashboard | Horrea Academy",
  description: "Votre espace de formation - suivez vos parcours et votre progression.",
};

export default async function DashboardPage() {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null;
  const clerkId = user?.id ?? null;

  const [fileCourses, dbCourses, fileCategories, dbCategories, metiersWithFormations, userMetiers, progressByCourse] =
    await Promise.all([
      Promise.resolve(getCoursesList()),
      getPublishedCoursesFromDb(),
      Promise.resolve(getCategories()),
      getCategoriesFromDb(),
      getMetiersWithFormations(),
      clerkId ? getUserMetiers(clerkId) : Promise.resolve(null),
      email ? getProgressForAllCourses(email) : Promise.resolve({}),
    ]);

  const bySlug = new Map(fileCourses.map((c) => [c.slug, c]));
  for (const c of dbCourses) bySlug.set(c.slug, c);
  const courses = [...bySlug.values()].sort((a, b) => {
    const da = a.addedAt ? new Date(a.addedAt).getTime() : 0;
    const db = b.addedAt ? new Date(b.addedAt).getTime() : 0;
    return db - da;
  });

  const fileCats = fileCategories.map((c) => ({ ...c, parent_id: null as string | null }));
  const dbCats = dbCategories.map((c) => ({
    id: c.id,
    slug: c.slug,
    label: c.label,
    icon: c.icon,
    parent_id: c.parent_id ?? null,
  }));
  const bySlugCat = new Map<string, { id: string; slug: string; label: string; icon: string; parent_id: string | null }>();
  for (const c of fileCats) bySlugCat.set(c.slug, c);
  for (const c of dbCats) bySlugCat.set(c.slug, c);
  const allCategoriesForTree = [...bySlugCat.values()];

  const assignedMetierIds = (userMetiers ?? []).map((um) => um.metier_id);
  const assignedMetiersWithFormations = metiersWithFormations
    .filter((m) => assignedMetierIds.includes(m.id))
    .map((m) => ({ id: m.id, label: m.label, slug: m.slug, course_slugs: m.course_slugs }));

  // Formations à faire : celles requises par les parcours métiers, non encore complétées.
  const requiredCourseSlugs = new Set<string>();
  assignedMetiersWithFormations.forEach((m) => m.course_slugs.forEach((s) => requiredCourseSlugs.add(s)));
  const isCourseComplete = (slug: string) => {
    const p = (progressByCourse as any)[slug] as
      | { completedModuleIds?: string[]; completedMissionIds?: string[] }
      | undefined;
    if (!p) return false;
    const done = (p.completedModuleIds?.length ?? 0) + (p.completedMissionIds?.length ?? 0);
    // On considère qu'une formation est "faite" dès qu'au moins 1 élément est complété
    // (logique douce pour n'afficher que les parcours encore vierges ou en cours).
    return done > 0;
  };
  // Formations à faire : toutes les formations des parcours métiers (sans filtrer sur l'avancement pour l'instant).
  const todoCourses = courses.filter((c) => requiredCourseSlugs.has(c.slug));

  const parcoursTotal = requiredCourseSlugs.size;
  const parcoursDone = courses.filter((c) => requiredCourseSlugs.has(c.slug) && isCourseComplete(c.slug)).length;
  const parcoursPercent = parcoursTotal ? (parcoursDone / parcoursTotal) * 100 : 0;

  const globalTotal = courses.length;
  const globalDone = courses.filter((c) => isCourseComplete(c.slug)).length;
  const globalPercent = globalTotal ? (globalDone / globalTotal) * 100 : 0;

  // Formations consultées = formations où au moins un module/mission est complété.
  const consultedCourses = courses.filter((c) => isCourseComplete(c.slug));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenue sur Horrea Academy. Consultez vos formations et poursuivez votre progression.
        </p>
      </div>

      {user && (
        <section>
          <SkillTreeCard
            categories={allCategoriesForTree}
            courses={courses}
            progressByCourse={progressByCourse}
            assignedMetiersWithFormations={assignedMetiersWithFormations}
            userImageUrl={user.imageUrl ?? null}
            userName={
              user.firstName || user.lastName
                ? [user.firstName, user.lastName].filter(Boolean).join(" ")
                : email
            }
            completionStats={{
              parcoursPercent,
              globalPercent,
            }}
          />
        </section>
      )}

      <section>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold mb-3">Mes formations à faire</h2>
            {todoCourses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-muted-foreground text-sm">
                    Vous n&apos;avez aucune formation à commencer pour vos parcours métiers.
                  </p>
                  <Button asChild className="mt-4" variant="outline">
                    <Link href="/dashboard/courses">Voir le catalogue</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {todoCourses.map((course) => {
                  const complete = isCourseComplete(course.slug);
                  const progressValue = complete ? 100 : 0;
                  return (
                  <Card key={course.slug} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                          <GraduationCapIcon className="text-primary size-5" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">
                            <Link
                              href={`/dashboard/courses/${course.slug}`}
                              className="hover:underline"
                            >
                              {course.title}
                            </Link>
                          </CardTitle>
                          {complete && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Validée
                            </span>
                          )}
                          </div>
                          <CardDescription>{course.descriptionShort}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{course.duration}</span>
                        <span>{course.moduleCount} modules</span>
                      </div>
                      <Progress value={progressValue} className="h-2" />
                      <Button variant="outline" size="sm" asChild className="w-full">
                        <Link href={`/dashboard/courses/${course.slug}`}>
                          Accéder à la formation
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );})}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Dernières formations consultées</h2>
            {consultedCourses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-muted-foreground text-sm">
                    Vous n&apos;avez pas encore consulté de formation.
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/dashboard/courses">Voir le catalogue</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="space-y-2 py-4">
                  <ul className="space-y-2">
                    {consultedCourses.slice(0, 5).map((course) => (
                      <li key={course.slug}>
                        <Link
                          href={`/dashboard/courses/${course.slug}`}
                          className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                        >
                          <span className="truncate">{course.title}</span>
                          <span className="text-muted-foreground text-xs">Consultée</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
