import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getCourseBySlug, getMission } from "@/lib/content";
import { getCourseBySlugFromDb } from "@/lib/courses-catalogue";
import { getProgressForCourse } from "@/lib/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ListChecks, Target } from "lucide-react";
import { MarkMissionComplete } from "./mark-mission-complete";

type Props = {
  params: Promise<{ slug: string; missionId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug, missionId } = await params;
  const courseFromFile = getCourseBySlug(slug);
  const fromDb = courseFromFile ? null : await getCourseBySlugFromDb(slug);
  const course = courseFromFile ?? fromDb?.course;
  const mission = courseFromFile ? getMission(slug, missionId) : fromDb?.missions.find((m) => m.id === missionId);
  if (!course || !mission) return { title: "Mission | Horrea Academy" };
  return {
    title: `${mission.title} | ${course.title} | Horrea Academy`,
    description: mission.objective,
  };
}

export default async function MissionPage({ params }: Props) {
  const { slug, missionId } = await params;
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;
  const courseFromFile = getCourseBySlug(slug);
  let fromDb = courseFromFile ? null : await getCourseBySlugFromDb(slug);
  if (!fromDb && isAdmin) fromDb = await getCourseBySlugFromDb(slug, { includeUnpublished: true });
  if (!fromDb && user && !courseFromFile) {
    fromDb = await getCourseBySlugFromDb(slug, { includeUnpublished: true });
  }
  const course = courseFromFile ?? fromDb?.course;
  const mission = courseFromFile ? getMission(slug, missionId) : fromDb?.missions?.find((m) => m.id === missionId);
  if (!course || !mission) notFound();

  const email = user?.emailAddresses?.[0]?.emailAddress;
  const progress = email ? await getProgressForCourse(email, slug) : { completedMissionIds: [] as string[], pendingMissionIds: [] as string[] };
  const isMissionCompleted = progress.completedMissionIds?.includes(missionId) ?? false;
  const isMissionPendingValidation = progress.pendingMissionIds?.includes(missionId) ?? false;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/courses/${slug}`}>
            <ArrowLeft className="mr-1 size-4" />
            {course.title}
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{mission.title}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-5" />
            Contexte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-muted-foreground">{mission.context}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Objectif</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{mission.objective}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-5" />
            Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {mission.instructions.map((step, i) => (
              <p key={i} className="whitespace-pre-wrap">{step}</p>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Livrable attendu</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-muted-foreground">{mission.deliverable}</p>
        </CardContent>
      </Card>

      <MarkMissionComplete
        courseSlug={slug}
        missionId={missionId}
        isCompleted={isMissionCompleted}
        isPendingValidation={isMissionPendingValidation}
      />

      <Button variant="outline" asChild>
        <Link href={`/dashboard/courses/${slug}`}>Retour à la formation</Link>
      </Button>
    </div>
  );
}
