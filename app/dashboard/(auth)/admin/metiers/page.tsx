import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { MetiersListClient } from "./metiers-list-client";

export const metadata = {
  title: "Parcours métiers | Admin | Horrea Academy",
  description: "Gérer les parcours métiers et les formations requises pour l'arbre de compétences.",
};

export default function AdminMetiersPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/admin">Administration</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Parcours métiers</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Parcours métiers</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Définissez les métiers (ex. Chef de projet) et les formations requises pour chaque parcours. Ces formations
          apparaîtront comme objectifs sur l&apos;arbre de compétences des utilisateurs assignés.
        </p>
      </div>
      <MetiersListClient />
    </div>
  );
}
