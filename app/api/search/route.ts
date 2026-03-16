import { NextResponse } from "next/server";
import { getCoursesList, getCourseBySlug, getModule } from "@/lib/content";

export type SearchResultCourse = {
  slug: string;
  title: string;
  descriptionShort: string;
  href: string;
};

export type SearchResultModule = {
  courseSlug: string;
  moduleId: string;
  title: string;
  courseTitle: string;
  href: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  if (!q) {
    return NextResponse.json({ courses: [], modules: [] });
  }

  const courses = getCoursesList();
  const matchedCourses: SearchResultCourse[] = [];
  const matchedModules: SearchResultModule[] = [];

  for (const course of courses) {
    const matchCourse =
      course.title.toLowerCase().includes(q) ||
      (course.descriptionShort ?? "").toLowerCase().includes(q);
    if (matchCourse) {
      matchedCourses.push({
        slug: course.slug,
        title: course.title,
        descriptionShort: course.descriptionShort ?? "",
        href: `/dashboard/courses/${course.slug}`,
      });
    }

    const courseDetail = getCourseBySlug(course.slug);
    const moduleIds = courseDetail?.moduleIds ?? [];
    for (const moduleId of moduleIds) {
      const mod = getModule(course.slug, moduleId);
      if (!mod) continue;
      const matchModule =
        mod.title.toLowerCase().includes(q) ||
        (mod.description ?? "").toLowerCase().includes(q);
      if (matchModule) {
        matchedModules.push({
          courseSlug: course.slug,
          moduleId: mod.id,
          title: mod.title,
          courseTitle: course.title,
          href: `/dashboard/courses/${course.slug}/modules/${mod.id}`,
        });
      }
    }
  }

  return NextResponse.json({ courses: matchedCourses, modules: matchedModules });
}
