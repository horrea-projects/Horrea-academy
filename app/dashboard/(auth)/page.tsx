import Link from "next/link";
import { getCoursesList } from "@/lib/content";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GraduationCapIcon } from "lucide-react";

export const metadata = {
  title: "Dashboard | Horrea Academy",
  description: "Votre espace de formation - suivez vos parcours et votre progression.",
};

export default function DashboardPage() {
  const courses = getCoursesList();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenue sur Horrea Academy. Consultez vos formations et poursuivez votre progression.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Mes formations</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <Card key={course.slug} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <GraduationCapIcon className="text-primary size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      <Link
                        href={`/dashboard/courses/${course.slug}`}
                        className="hover:underline"
                      >
                        {course.title}
                      </Link>
                    </CardTitle>
                    <CardDescription>{course.descriptionShort}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{course.duration}</span>
                  <span>{course.moduleCount} modules</span>
                </div>
                <Progress value={0} className="h-2" />
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={`/dashboard/courses/${course.slug}`}>
                    Accéder à la formation
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Derniers modules consultés</h2>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground text-sm">
              Aucun module récent. Commencez une formation pour voir votre activité ici.
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/courses">Voir le catalogue</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
