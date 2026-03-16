import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CategoriesListClient } from "./categories-list-client";

export const metadata = {
  title: "Catégories | Admin | Horrea Academy",
  description: "Gérer les catégories et icônes des formations.",
};

export default function AdminCategoriesPage() {
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
            <BreadcrumbPage>Catégories</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Catégories</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Gérez les catégories des formations et associez une icône SVG à chacune.
        </p>
      </div>
      <CategoriesListClient />
    </div>
  );
}
