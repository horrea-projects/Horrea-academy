import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import type { Category } from "@/lib/content";
import { getCoursesList, getCategories } from "@/lib/content";
import { getPublishedCoursesFromDb, getCategoriesFromDb } from "@/lib/courses-catalogue";
import { getProgressForAllCourses } from "@/lib/progress";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CatalogueClient } from "./catalogue-client";

export const metadata = {
  title: "Catalogue des formations | Horrea Academy",
  description: "Parcours de formation au digital commerce - Shopify et plus.",
};

export default async function CoursesCataloguePage() {
  const [fileCourses, dbCourses, fileCategories, dbCategories, user] = await Promise.all([
    Promise.resolve(getCoursesList()),
    getPublishedCoursesFromDb(),
    Promise.resolve(getCategories()),
    getCategoriesFromDb(),
    currentUser(),
  ]);
  const bySlug = new Map(fileCourses.map((c) => [c.slug, c]));
  for (const c of dbCourses) bySlug.set(c.slug, c);
  const courses = [...bySlug.values()].sort((a, b) => {
    const dateA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
    const dateB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
    return dateB - dateA;
  });
  const categoryBySlug = new Map<string, Category>(fileCategories.map((c) => [c.slug, c]));
  const dbRootCategories = dbCategories.filter((c) => !c.parent_id);
  for (const c of dbRootCategories) categoryBySlug.set(c.slug, { id: c.id, slug: c.slug, label: c.label, icon: c.icon });
  const categories = [...categoryBySlug.values()].sort((a, b) => a.label.localeCompare(b.label, "fr"));

  /** Toutes les catégories avec parent_id pour la popover "Toutes" (filtre par catégorie). */
  const allCategoriesForTree = [
    ...fileCategories.map((c) => ({ ...c, parent_id: null as string | null })),
    ...dbCategories.map((c) => ({ id: c.id, slug: c.slug, label: c.label, icon: c.icon, parent_id: c.parent_id ?? null })),
  ];

  const email = user?.emailAddresses?.[0]?.emailAddress;
  const progressByCourse = email ? await getProgressForAllCourses(email) : {};

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Catalogue des formations</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <CatalogueClient
        courses={courses}
        categories={categories}
        allCategoriesForTree={allCategoriesForTree}
        categorySlug={null}
        progressByCourse={progressByCourse}
      />
    </div>
  );
}
