import Link from "next/link";
import { AdminCourseFormClient } from "@/app/dashboard/(auth)/admin/courses/course-form-client";
import { ImportGuideSheet } from "../import-guide-sheet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const metadata = {
  title: "Proposer une formation | Horrea Academy",
  description: "Proposez une formation. Elle sera mise en ligne après validation par un administrateur.",
};

export default function ProposeCoursePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
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
            <BreadcrumbPage>Proposer une formation</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Proposer une formation</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Créez une formation ou importez un fichier JSON/ZIP. Elle sera enregistrée en attente et un administrateur la mettra en ligne après validation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Importer une formation (JSON ou ZIP)</CardTitle>
          <CardDescription>
            Ouvrez le guide pour télécharger les templates, déposer votre fichier formation-complete.json ou ZIP, puis proposer la formation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportGuideSheet proposeMode triggerLabel="Ouvrir le guide d'import (templates + dépôt de fichier)" />
        </CardContent>
      </Card>

      <div className="border-t pt-8">
        <h2 className="text-lg font-semibold mb-4">Ou créer une formation manuellement</h2>
        <AdminCourseFormClient proposeMode />
      </div>
    </div>
  );
}
