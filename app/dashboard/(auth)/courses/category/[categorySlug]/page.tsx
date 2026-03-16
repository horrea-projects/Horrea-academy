import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getCoursesList, getCategoryBySlug, getCategories } from "@/lib/content";
import type { Category } from "@/lib/content";
import { getPublishedCoursesFromDb, getCategoryBySlugFromDb, getCategoriesFromDb } from "@/lib/courses-catalogue";
import { getProgressForAllCourses } from "@/lib/progress";
import type { CategoryPageContext } from "../../catalogue-client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CatalogueClient } from "../../catalogue-client";

type Props = { params: Promise<{ categorySlug: string }> };

export async function generateMetadata({ params }: Props) {
  const { categorySlug } = await params;
  const fromFile = getCategoryBySlug(categorySlug);
  const fromDb = await getCategoryBySlugFromDb(categorySlug);
  const label = fromDb?.label ?? fromFile?.label ?? categorySlug;
  return {
    title: `${label} | Catalogue | Horrea Academy`,
    description: `Formations de la catégorie ${label}.`,
  };
}

export default async function CourseCategoryPage({ params }: Props) {
  const { categorySlug } = await params;
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;
  const categoryFromFile = getCategoryBySlug(categorySlug);
  let categoryFromDb = await getCategoryBySlugFromDb(categorySlug);
  if (!categoryFromDb && isAdmin) {
    categoryFromDb = await getCategoryBySlugFromDb(categorySlug, { includeUnpublished: true });
  }
  if (!categoryFromFile && !categoryFromDb) notFound();

  const isPreview = isAdmin && categoryFromDb && (categoryFromDb as { status?: string }).status !== "published";

  const label = categoryFromDb?.label ?? categoryFromFile?.label ?? categorySlug;
  const icon = categoryFromDb?.icon ?? categoryFromFile?.icon ?? "book";
  const categoryPage: CategoryPageContext = {
    label,
    icon,
    onboarding_title: categoryFromDb?.onboarding_title ?? null,
    onboarding_content: categoryFromDb?.onboarding_content ?? null,
    onboarding_presentation_embed_url: categoryFromDb?.onboarding_presentation_embed_url ?? null,
    onboarding_quiz_sheet_id: categoryFromDb?.onboarding_quiz_sheet_id ?? null,
    onboarding_quiz_sheet_name: categoryFromDb?.onboarding_quiz_sheet_name ?? null,
    isPreview: isPreview ?? false,
  };

  const [fileCategories, dbCategories, fileCourses, dbCourses] = await Promise.all([
    Promise.resolve(getCategories()),
    getCategoriesFromDb(),
    Promise.resolve(getCoursesList({ categoryId: categoryFromFile?.id })),
    getPublishedCoursesFromDb({ categorySlug }),
  ]);
  const categoryBySlug = new Map<string, Category>(fileCategories.map((c) => [c.slug, c]));
  for (const c of dbCategories) categoryBySlug.set(c.slug, { id: c.id, slug: c.slug, label: c.label, icon: c.icon });
  const categories = [...categoryBySlug.values()].sort((a, b) => a.label.localeCompare(b.label, "fr"));

  const currentCategoryId = categoryFromDb?.id ?? categoryFromFile?.id ?? null;
  const subcategories: Category[] = currentCategoryId
    ? dbCategories
        .filter((c) => c.parent_id === currentCategoryId)
        .map((c) => ({ id: c.id, slug: c.slug, label: c.label, icon: c.icon }))
        .sort((a, b) => a.label.localeCompare(b.label, "fr"))
    : [];

  /** Chaîne des catégories parentes (racine → parent direct) pour le fil d'ariane. */
  const breadcrumbTrail: { slug: string; label: string }[] = [];
  const currentInDb = dbCategories.find((c) => c.slug === categorySlug);
  if (currentInDb?.parent_id) {
    let parentId: string | null = currentInDb.parent_id;
    while (parentId) {
      const parent = dbCategories.find((c) => c.id === parentId);
      if (!parent) break;
      breadcrumbTrail.push({ slug: parent.slug, label: parent.label });
      parentId = parent.parent_id ?? null;
    }
    breadcrumbTrail.reverse();
  }

  const bySlug = new Map(fileCourses.map((c) => [c.slug, c]));
  for (const c of dbCourses) bySlug.set(c.slug, c);
  const courses = [...bySlug.values()].sort((a, b) => {
    const dateA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
    const dateB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
    return dateB - dateA;
  });

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
            <BreadcrumbLink asChild>
              <Link href="/dashboard/courses">Catalogue des formations</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {breadcrumbTrail.map((item) => (
            <span key={item.slug} className="flex items-center gap-2">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/dashboard/courses/category/${item.slug}`}>{item.label}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </span>
          ))}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <CatalogueClient
        courses={courses}
        categories={categories}
        categorySlug={categorySlug}
        categoryPage={categoryPage}
        progressByCourse={progressByCourse}
        subcategories={subcategories}
      />
    </div>
  );
}
