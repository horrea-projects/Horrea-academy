import Link from "next/link";
import { UsersListClient } from "./users-list-client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const metadata = {
  title: "Utilisateurs & progression | Admin | Horrea Academy"
};

export default function AdminUsersPage() {
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
            <BreadcrumbPage>Utilisateurs & progression</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Utilisateurs & progression</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Visualisez le nombre de modules et de formations complétés par utilisateur.
        </p>
      </div>

      <UsersListClient />
    </div>
  );
}

