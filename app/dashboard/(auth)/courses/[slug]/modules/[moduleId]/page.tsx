import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getCourseBySlug, getModule } from "@/lib/content";
import { getCourseBySlugFromDb } from "@/lib/courses-catalogue";
import { getProgressForCourse } from "@/lib/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Target } from "lucide-react";
import { ModuleVideo } from "./module-video";
import { ModuleDocument } from "./module-document";
import { ModulePresentation } from "./module-presentation";
import { ModuleQuiz } from "./module-quiz";
import { ModuleSidebar, ModuleSidebarMobile, type ModuleNavItem } from "./module-sidebar";
import { MarkModuleComplete } from "./mark-module-complete";

type Props = {
  params: Promise<{ slug: string; moduleId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug, moduleId } = await params;
  const courseFromFile = getCourseBySlug(slug);
  const fromDb = courseFromFile ? null : await getCourseBySlugFromDb(slug);
  const course = courseFromFile ?? fromDb?.course;
  const moduleData = courseFromFile
    ? getModule(slug, moduleId)
    : fromDb?.modules.find((m) => m.id === moduleId);
  if (!course || !moduleData) return { title: "Module | Horrea Academy" };
  return {
    title: `${moduleData.title} | ${course.title} | Horrea Academy`,
    description: moduleData.description,
  };
}

export default async function ModulePage({ params }: Props) {
  const { slug, moduleId } = await params;
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;
  const courseFromFile = getCourseBySlug(slug);
  let fromDb = courseFromFile ? null : await getCourseBySlugFromDb(slug);
  if (!fromDb && isAdmin) fromDb = await getCourseBySlugFromDb(slug, { includeUnpublished: true });
  if (!fromDb && user && !courseFromFile) {
    fromDb = await getCourseBySlugFromDb(slug, { includeUnpublished: true });
  }
  const course = courseFromFile ?? fromDb?.course;
  const moduleData = courseFromFile
    ? getModule(slug, moduleId)
    : fromDb?.modules.find((m) => m.id === moduleId);
  if (!course || !moduleData) notFound();

  const email = user?.emailAddresses?.[0]?.emailAddress;
  const progress = email ? await getProgressForCourse(email, slug) : { completedModuleIds: [] as string[], completedMissionIds: [] as string[], pendingMissionIds: [] as string[], quizScores: {} as Record<string, number> };
  const navModules: ModuleNavItem[] = course.moduleIds.map((id) => {
    const m = fromDb
      ? fromDb.modules.find((x) => x.id === id)
      : getModule(slug, id);
    return {
      id,
      title: m?.title ?? `Module ${id}`,
      duration: m?.duration ?? "",
      completed: progress.completedModuleIds.includes(id),
      current: id === moduleId,
    };
  });
  const completedCount = progress.completedModuleIds.length;
  const currentIndex = course.moduleIds.indexOf(moduleId);
  const nextModuleId = currentIndex >= 0 && currentIndex < course.moduleIds.length - 1
    ? course.moduleIds[currentIndex + 1]
    : null;
  const moduleWithQuiz = moduleData as typeof moduleData & { quizSheetName?: string; minQuizScore?: number | null };
  const hasQuiz = Boolean(
    moduleData.quizSheetId ||
      (fromDb?.quizSpreadsheetId && moduleWithQuiz.quizSheetName)
  );
  const minQuizScore = moduleWithQuiz.minQuizScore ?? null;
  const quizScore = progress.quizScores?.[moduleId] ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/courses">Catalogue des formations</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/dashboard/courses/${slug}`}>{course.title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{moduleData.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{moduleData.title}</h1>
            <p className="text-muted-foreground">{moduleData.description}</p>
            <p className="text-muted-foreground text-sm">Durée : {moduleData.duration}</p>
          </div>

          {/* Vidéo, document ou présentation : n'afficher que les blocs qui ont du contenu */}
          {(moduleData.videoEmbedUrl || moduleData.documentEmbedUrl || moduleData.presentationEmbedUrl) && (
            <>
              {moduleData.videoEmbedUrl && (
                <ModuleVideo embedUrl={moduleData.videoEmbedUrl} />
              )}
              {moduleData.documentEmbedUrl && (
                <ModuleDocument embedUrl={moduleData.documentEmbedUrl} />
              )}
              {moduleData.presentationEmbedUrl && (
                <ModulePresentation embedUrl={moduleData.presentationEmbedUrl} />
              )}
            </>
          )}

      {moduleData.content && (
        <Card>
          <CardHeader>
            <CardTitle>Contenu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap">{moduleData.content}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {moduleData.missionId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-5" />
              Mission associée
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/dashboard/courses/${slug}/missions/${moduleData.missionId}`}>
                Accéder à la mission
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {hasQuiz && (
        <ModuleQuiz
          courseSlug={slug}
          moduleId={moduleId}
          quizSheetId={moduleData.quizSheetId}
          quizSpreadsheetId={fromDb?.quizSpreadsheetId}
          quizSheetName={moduleWithQuiz.quizSheetName}
        />
      )}


      <MarkModuleComplete
        courseSlug={slug}
        moduleId={moduleId}
        nextModuleId={nextModuleId}
        isCompleted={progress.completedModuleIds.includes(moduleId)}
        hasQuiz={hasQuiz}
        minQuizScore={minQuizScore ?? undefined}
        quizScore={quizScore ?? undefined}
      />

          <Button variant="outline" asChild>
            <Link href={`/dashboard/courses/${slug}`}>Retour à la formation</Link>
          </Button>
        </div>

        <div className="hidden space-y-4 lg:block">
          <ModuleSidebar
            slug={slug}
            modules={navModules}
            completedCount={completedCount}
          />
        </div>
      </div>

      <ModuleSidebarMobile
        slug={slug}
        modules={navModules}
        completedCount={completedCount}
      />
    </div>
  );
}
