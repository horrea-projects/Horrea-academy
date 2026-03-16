import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserDetailClient } from "./user-detail-client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Props = {
  params: Promise<{ email: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { email } = await params;
  const decodedEmail = decodeURIComponent(email);
  return {
    title: `Utilisateur ${decodedEmail} | Admin | Horrea Academy`,
    description: `Statistiques de progression pour ${decodedEmail}.`
  };
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { email } = await params;
  if (!email) notFound();
  const decodedEmail = decodeURIComponent(email);

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
            <BreadcrumbLink asChild>
              <Link href="/dashboard/admin/users">Utilisateurs</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="truncate max-w-[200px]">{decodedEmail}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fiche utilisateur</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Détail des compétences et de la progression pour {decodedEmail}.
        </p>
      </div>

      <UserDetailClient email={decodedEmail} />
    </div>
  );
}

