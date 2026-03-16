import path from "path";
import fs from "fs";

const CONTENT_DIR = path.join(process.cwd(), "content");

export type Category = {
  id: string;
  slug: string;
  label: string;
  icon: string;
};

export type CourseListItem = {
  slug: string;
  title: string;
  descriptionShort: string;
  duration: string;
  moduleCount: number;
  /** Nombre de missions (optionnel, pour afficher la progression). */
  missionCount?: number;
  categoryId?: string;
  addedAt?: string;
};

export type CourseDetail = {
  slug: string;
  title: string;
  description: string;
  duration: string;
  moduleIds: string[];
  missionIds: string[];
};

export type ModuleData = {
  id: string;
  title: string;
  description: string;
  duration: string;
  videoEmbedUrl: string;
  documentEmbedUrl?: string;
  presentationEmbedUrl?: string;
  quizSheetId: string;
  missionId: string | null;
  content: string;
  /** Score minimum (0-100) au quiz pour valider le module. Non défini = pas d'exigence. */
  minQuizScore?: number | null;
};

export type MissionData = {
  id: string;
  title: string;
  context: string;
  objective: string;
  instructions: string[];
  deliverable: string;
};

export function getCategories(): Category[] {
  const filePath = path.join(CONTENT_DIR, "courses", "categories.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as Category[];
  return Array.isArray(data) ? data : [];
}

export function getCategoryBySlug(slug: string): Category | null {
  return getCategories().find((c) => c.slug === slug) ?? null;
}

export function getCoursesList(opts?: { categoryId?: string }): CourseListItem[] {
  const filePath = path.join(CONTENT_DIR, "courses", "index.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as { courses: CourseListItem[] };
  let courses = data.courses ?? [];
  if (opts?.categoryId) {
    courses = courses.filter((c) => c.categoryId === opts.categoryId);
  }
  courses = [...courses].sort((a, b) => {
    const dateA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
    const dateB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
    return dateB - dateA;
  });
  return courses;
}

export function getCourseBySlug(slug: string): CourseDetail | null {
  const filePath = path.join(CONTENT_DIR, "courses", `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as CourseDetail;
}

export function getModule(courseSlug: string, moduleId: string): ModuleData | null {
  const filePath = path.join(CONTENT_DIR, "modules", courseSlug, `${moduleId}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ModuleData;
}

export function getMission(courseSlug: string, missionId: string): MissionData | null {
  const filePath = path.join(CONTENT_DIR, "missions", courseSlug, `${missionId}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as MissionData;
}
