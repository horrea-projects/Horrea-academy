import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getCourseBySlug, getMission, getModule } from "@/lib/content";
import { getCourseBySlugFromDb } from "@/lib/courses-catalogue";
import { getProgressForCourse, getCourseProgressStatsForAdmin } from "@/lib/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Check, Play, Users, BookOpen } from "lucide-react";
import { CourseOnboardingGate } from "./course-onboarding-gate";
import { PendingMissionsCard } from "./pending-missions-card";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const course = getCourseBySlug(slug) ?? (await getCourseBySlugFromDb(slug))?.course;
  if (!course) return { title: "Formation | Horrea Academy" };
  return {
    title: `${course.title} | Horrea Academy`,
    description: course.description,
  };
}

export default async function CourseDetailPage({ params }: Props) {
  const { slug } = await params;
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;

  const courseFromFile = getCourseBySlug(slug);
  let fromDb = courseFromFile ? null : await getCourseBySlugFromDb(slug);
  if (!fromDb && isAdmin) {
    fromDb = await getCourseBySlugFromDb(slug, { includeUnpublished: true });
  }

  const course = courseFromFile ?? fromDb?.course;
  if (!course) notFound();

  const isPublished = fromDb && (fromDb.status === "published" || (fromDb.status == null && fromDb.published === true));
  const isPreview = isAdmin && fromDb && !isPublished;
  const isAuthor = !!user?.id && user.id === fromDb?.created_by;
  const canSeeStats = (isAdmin || isAuthor) && course.moduleIds.length > 0;
  const email = user?.emailAddresses?.[0]?.emailAddress;
  const progress = email ? await getProgressForCourse(email, slug) : { completedModuleIds: [] as string[], completedMissionIds: [] as string[], pendingMissionIds: [] as string[], quizScores: {} as Record<string, number> };
  const completedCount = progress.completedModuleIds.length;
  const totalModules = course.moduleIds.length;

  const progressStats = canSeeStats ? await getCourseProgressStatsForAdmin(slug, course.moduleIds, course.missionIds) : null;
  const canManageMissions = (isAdmin || isAuthor) && course.missionIds.length > 0;
  const missionList =
    fromDb?.missions?.map((m) => ({ id: m.id, title: m.title })) ??
    course.missionIds.map((id) => ({ id, title: getMission(slug, id)?.title ?? id }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <CourseOnboardingGate
        courseSlug={slug}
        courseTitle={course.title}
        onboardingTitle={fromDb?.onboardingTitle ?? null}
        onboardingContent={fromDb?.onboardingContent ?? null}
        onboardingPresentationEmbedUrl={fromDb?.onboardingPresentationEmbedUrl ?? null}
        onboardingQuizSpreadsheetId={fromDb?.quizSpreadsheetId ?? null}
        onboardingQuizSheetName={fromDb?.onboardingQuizSheetName ?? null}
      >
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
              <BreadcrumbPage>{course.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
            {isPreview && (
              <Badge variant="secondary" className="font-normal">
                Prévisualisation (non publiée)
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{course.description}</p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Durée : {course.duration}</span>
            <span>{totalModules} modules</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Progression</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={totalModules ? (completedCount / totalModules) * 100 : 0} className="h-2" />
          </CardContent>
        </Card>

        <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {course.moduleIds.map((moduleId, index) => {
              const moduleData = fromDb
                ? fromDb.modules.find((m) => m.id === moduleId)
                : getModule(slug, moduleId);
              const completed = progress.completedModuleIds.includes(moduleId);
              return (
                <li key={moduleId}>
                  <Link
                    href={`/dashboard/courses/${slug}/modules/${moduleId}`}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      {completed ? (
                        <Check className="text-green-600 size-4" />
                      ) : (
                        <Play className="text-muted-foreground size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {moduleData?.title ?? `Module ${index + 1}`}
                      </p>
                      {moduleData && (
                        <p className="text-muted-foreground text-sm">{moduleData.duration}</p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {course.missionIds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Missions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {course.missionIds.map((missionId) => (
                <li key={missionId}>
                  <Button variant="outline" asChild className="w-full justify-start">
                    <Link href={`/dashboard/courses/${slug}/missions/${missionId}`}>
                      Voir la mission
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {canManageMissions && fromDb?.courseId && (
        <PendingMissionsCard courseId={fromDb.courseId} courseSlug={slug} missions={missionList} />
      )}

      {progressStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Suivi de la formation
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Visible uniquement par l’administrateur ou l’auteur de la formation.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="mb-2 flex items-center gap-2 font-medium">
                <Check className="size-4 text-green-600" />
                Formation terminée ({progressStats.completedBy.length} personne{progressStats.completedBy.length !== 1 ? "s" : ""})
              </h4>
              {progressStats.completedBy.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucune personne n’a encore terminé tous les modules.</p>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-2 text-left font-medium">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressStats.completedBy.map((e) => (
                        <tr key={e} className="border-b last:border-0">
                          <td className="px-4 py-2 text-muted-foreground">{e}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <h4 className="mb-2 flex items-center gap-2 font-medium">
                <BookOpen className="size-4" />
                Par module : qui a complété
              </h4>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Module</th>
                      <th className="px-4 py-2 text-left font-medium">Complété par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progressStats.perModule.map(({ moduleId, emails }) => {
                      const moduleData = fromDb?.modules.find((m) => m.id === moduleId) ?? getModule(slug, moduleId);
                      const title = moduleData?.title ?? `Module ${moduleId}`;
                      return (
                        <tr key={moduleId} className="border-b last:border-0">
                          <td className="px-4 py-2 font-medium">{title}</td>
                          <td className="px-4 py-2 text-muted-foreground">{emails.length === 0 ? "—" : emails.join(", ")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

        <Button variant="ghost" asChild>
          <Link href="/dashboard/courses">Retour au catalogue</Link>
        </Button>
      </CourseOnboardingGate>
    </div>
  );
}
