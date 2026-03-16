"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CourseListItem } from "@/lib/content";
import { getCategoryIconSvg } from "@/lib/category-icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GraduationCapIcon, ShoppingBag } from "lucide-react";

type CategoryWithParent = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  parent_id?: string | null;
};

type CourseProgress = {
  completedModuleIds: string[];
  completedMissionIds: string[];
};

const CX = 400;
const CY = 320;
const R_CENTER = 0;
const R_CATEGORIES = 100;
const R_SUBCATEGORIES = 200;
const R_COURSES = 320;

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const svg = getCategoryIconSvg(icon);
  if (svg) {
    return (
      <span
        className={className ?? "inline-flex [&>svg]:size-full [&>svg]:shrink-0"}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  return <ShoppingBag className={className} />;
}

function isCourseComplete(
  progress: CourseProgress | undefined,
  moduleCount: number,
  missionCount: number
): boolean {
  if (!progress) return false;
  const total = moduleCount + (missionCount ?? 0);
  if (total === 0) return false;
  const done = progress.completedModuleIds.length + progress.completedMissionIds.length;
  return done >= total;
}

export type SkillTreeProps = {
  categories: CategoryWithParent[];
  courses: CourseListItem[];
  progressByCourse: Record<string, CourseProgress>;
  requiredCourseSlugs: Set<string>;
  userImageUrl: string | null;
  userName?: string | null;
};

export function SkillTree({
  categories,
  courses,
  progressByCourse,
  requiredCourseSlugs,
  userImageUrl,
  userName,
}: SkillTreeProps) {
  const { nodes, edges, courseState } = useMemo(() => {
    const roots = categories.filter((c) => !c.parent_id).sort((a, b) => a.label.localeCompare(b.label, "fr"));
    const subs = categories.filter((c) => c.parent_id).sort((a, b) => a.label.localeCompare(b.label, "fr"));

    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

    const nodes: Array<{
      id: string;
      type: "center" | "category" | "course";
      x: number;
      y: number;
      label: string;
      slug?: string;
      icon?: string;
      isSub?: boolean;
      courseSlug?: string;
      state?: "completed" | "required" | "available";
    }> = [];

    const edges: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> = [];

    nodes.push({
      id: "center",
      type: "center",
      x: CX,
      y: CY,
      label: "",
    });

    const nRoots = roots.length;
    const rootAngles = nRoots > 0 ? roots.map((_, i) => -90 + (360 * i) / nRoots) : [];

    roots.forEach((r, i) => {
      const { x, y } = polarToCartesian(CX, CY, R_CATEGORIES, rootAngles[i]);
      nodes.push({
        id: `cat-${r.id}`,
        type: "category",
        x,
        y,
        label: r.label,
        slug: r.slug,
        icon: r.icon,
        isSub: false,
      });
      edges.push({ from: { x: CX, y: CY }, to: { x, y } });
    });

    let angleOffset = 0;
    const subAngles = new Map<string, number>();
    subs.forEach((s) => {
      const parent = s.parent_id ? categoryById.get(s.parent_id) : null;
      const rootIndex = parent ? roots.findIndex((r) => r.id === parent.id) : -1;
      const baseAngle = rootIndex >= 0 ? rootAngles[rootIndex] : -90 + (360 * angleOffset) / Math.max(subs.length, 1);
      const spread = 40;
      const j = subs.filter((x) => x.parent_id === s.parent_id).indexOf(s);
      const totalSiblings = subs.filter((x) => x.parent_id === s.parent_id).length;
      const angle = totalSiblings <= 1 ? baseAngle : baseAngle - spread / 2 + (spread * j) / Math.max(totalSiblings - 1, 1);
      subAngles.set(s.id, angle);
      const { x, y } = polarToCartesian(CX, CY, R_SUBCATEGORIES, angle);
      nodes.push({
        id: `cat-${s.id}`,
        type: "category",
        x,
        y,
        label: s.label,
        slug: s.slug,
        icon: s.icon,
        isSub: true,
      });
      const parentNode = parent ? nodes.find((n) => n.id === `cat-${parent.id}`) : null;
      if (parentNode) edges.push({ from: { x: parentNode.x, y: parentNode.y }, to: { x, y } });
    });

    const coursesByCategory = new Map<string, CourseListItem[]>();
    for (const c of courses) {
      const slug = c.categoryId ?? "other";
      if (!coursesByCategory.has(slug)) coursesByCategory.set(slug, []);
      coursesByCategory.get(slug)!.push(c);
    }

    const courseState: Record<string, "completed" | "required" | "available"> = {};
    let courseAngleOffset = 0;
    const courseAngleStep = 360 / Math.max(courses.length, 1);

    courses.forEach((co) => {
      const catSlug = co.categoryId ?? "other";
      const cat = categoryBySlug.get(catSlug);
      const catNode = cat ? nodes.find((n) => n.slug === catSlug && n.type === "category") : null;
      const progress = progressByCourse[co.slug];
      const complete = isCourseComplete(progress, co.moduleCount ?? 0, co.missionCount ?? 0);
      const required = requiredCourseSlugs.has(co.slug);
      courseState[co.slug] = complete ? "completed" : required ? "required" : "available";

      const angle = -90 + courseAngleOffset * courseAngleStep;
      courseAngleOffset++;
      const { x, y } = polarToCartesian(CX, CY, R_COURSES, angle);
      nodes.push({
        id: `course-${co.slug}`,
        type: "course",
        x,
        y,
        label: co.title,
        courseSlug: co.slug,
        state: courseState[co.slug],
      });
      if (catNode) edges.push({ from: { x: catNode.x, y: catNode.y }, to: { x, y } });
    });

    return { nodes, edges, courseState };
  }, [categories, courses, progressByCourse, requiredCourseSlugs]);

  const initial = userName?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Mon arbre de compétences</h2>
      <p className="text-muted-foreground text-sm">
        Visualisez vos compétences et les formations à débloquer pour votre parcours.
      </p>
      <div className="overflow-x-auto rounded-lg border bg-muted/30 p-4">
        <svg
          viewBox="0 0 800 640"
          className="mx-auto h-auto w-full max-w-4xl"
          style={{ minHeight: 400 }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-muted-foreground" />
            </marker>
            <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.6" />
              <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {edges.map((e, i) => (
            <line
              key={`edge-${i}`}
              x1={e.from.x}
              y1={e.from.y}
              x2={e.to.x}
              y2={e.to.y}
              stroke="url(#linkGrad)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ))}
          {nodes.map((n) => {
            if (n.type === "center") {
              return (
                <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                  <foreignObject x="-32" y="-32" width="64" height="64">
                    <div className="flex items-center justify-center">
                      <Avatar className="h-16 w-16 border-4 border-background ring-2 ring-primary/20">
                        <AvatarImage src={userImageUrl ?? undefined} alt="" />
                        <AvatarFallback className="bg-primary/10 text-lg font-medium text-primary">
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </foreignObject>
                </g>
              );
            }
            if (n.type === "category") {
              const size = n.isSub ? 36 : 44;
              const href = n.slug ? `/dashboard/courses/category/${n.slug}` : "#";
              return (
                <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                  <Link href={href}>
                    <foreignObject x={-size / 2} y={-size / 2} width={size} height={size}>
                      <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-primary/40 bg-background shadow-md transition hover:scale-105 hover:border-primary">
                        <span className="[&>svg]:size-5">
                          <CategoryIcon icon={n.icon ?? "book"} />
                        </span>
                      </div>
                    </foreignObject>
                  </Link>
                  <text
                    x={0}
                    y={size / 2 + 14}
                    textAnchor="middle"
                    className="fill-muted-foreground text-xs font-medium"
                  >
                    {n.label.length > 12 ? n.label.slice(0, 11) + "…" : n.label}
                  </text>
                </g>
              );
            }
            if (n.type === "course" && n.courseSlug) {
              const state = n.state ?? "available";
              const size = 48;
              const stroke =
                state === "completed"
                  ? "hsl(var(--chart-1))"
                  : state === "required"
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted-foreground))";
              const bg =
                state === "completed"
                  ? "bg-green-500/20"
                  : state === "required"
                    ? "bg-primary/15"
                    : "bg-muted";
              return (
                <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                  <Link href={`/dashboard/courses/${n.courseSlug}`}>
                    <foreignObject x={-size / 2} y={-size / 2} width={size} height={size}>
                      <div
                        className={`flex h-full w-full items-center justify-center rounded-xl border-2 shadow transition hover:scale-105 ${bg}`}
                        style={{ borderColor: stroke }}
                      >
                        <GraduationCapIcon className="size-6" style={{ color: stroke }} />
                      </div>
                    </foreignObject>
                  </Link>
                  <text
                    x={0}
                    y={size / 2 + 16}
                    textAnchor="middle"
                    className="fill-muted-foreground text-xs font-medium"
                  >
                    {n.label.length > 14 ? n.label.slice(0, 13) + "…" : n.label}
                  </text>
                  {state === "required" && (
                    <foreignObject x={-size / 2 - 4} y={-size / 2 - 4} width={24} height={24}>
                      <Badge className="bg-primary text-[10px] px-1 py-0">Objectif</Badge>
                    </foreignObject>
                  )}
                </g>
              );
            }
            return null;
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="size-4 rounded border-2 border-green-500 bg-green-500/20" />
          Débloquée
        </span>
        <span className="flex items-center gap-2">
          <span className="size-4 rounded border-2 border-primary bg-primary/15" />
          À débloquer (objectif)
        </span>
        <span className="flex items-center gap-2">
          <span className="size-4 rounded border-2 border-muted-foreground bg-muted" />
          Disponible
        </span>
      </div>
    </section>
  );
}
