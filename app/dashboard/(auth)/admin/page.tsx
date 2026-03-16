import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { AdminDashboardClient } from "./admin-dashboard-client";

export const metadata = {
  title: "Administration | Horrea Academy",
  description: "Tableau de bord d’administration – formations récentes et utilisateurs actifs."
};

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Administration</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Vue d’ensemble des formations récentes et des utilisateurs les plus actifs.
        </p>
      </div>
      <AdminDashboardClient />
    </div>
  );
}
