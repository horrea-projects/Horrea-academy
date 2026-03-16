"use client";

import { useMemo } from "react";
import type { CourseListItem } from "@/lib/content";

export type CategoryWithParent = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  parent_id?: string | null;
};

export type CourseProgress = {
  completedModuleIds: string[];
  completedMissionIds: string[];
};

const CX = 400;
const CY = 340;
/** Écart minimal entre deux anneaux (cercles). */
const RING_GAP = 100;
/** Distance minimale entre centres de nœuds sur un même cercle (pour calcul du rayon). */
const MIN_NODE_DISTANCE = 62;
/** Rayon minimum par anneau (pour peu d'éléments). */
const R_MIN_LEVEL1 = 100;
const R_MIN_LEVEL2 = 100;
const R_MIN_LEVEL3 = 140;
/** Rayon max pour rester dans le viewBox (800×720, centre 400,340). */
const MAX_RADIUS = 320;
const COURSE_ARC_SPREAD = 42;
const MIN_COURSE_ANGLE_DEG = 18;
const MAX_SPREAD_DEG = 140;
const MIN_SUB_ANGLE_DEG = 28;
const MAX_SUB_SPREAD_DEG = 90;

/**
 * Rayon d'un cercle pour que n nœuds répartis uniformément gardent au moins MIN_NODE_DISTANCE entre eux.
 * Chord entre deux voisins = 2*R*sin(π/n) >= MIN_NODE_DISTANCE => R >= MIN_NODE_DISTANCE / (2*sin(π/n)).
 */
function radiusForN(n: number, minRadius: number): number {
  if (n <= 0) return minRadius;
  const sinHalf = Math.sin(Math.PI / Math.max(1, n));
  return Math.max(minRadius, MIN_NODE_DISTANCE / (2 * sinHalf));
}

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
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

export type SkillTreeNode = {
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
};

export type SkillTreeEdge = {
  fromId: string;
  toId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

export function useSkillTreeGraph(
  categories: CategoryWithParent[],
  courses: CourseListItem[],
  progressByCourse: Record<string, CourseProgress>,
  requiredCourseSlugs: Set<string>
) {
  return useMemo(() => {
    const roots = categories.filter((c) => !c.parent_id).sort((a, b) => a.label.localeCompare(b.label, "fr"));
    const subs = categories.filter((c) => c.parent_id).sort((a, b) => a.label.localeCompare(b.label, "fr"));
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

    const nodes: SkillTreeNode[] = [];
    const edges: SkillTreeEdge[] = [];

    nodes.push({ id: "center", type: "center", x: CX, y: CY, label: "" });

    /** Répartition par niveau : anneau 1 = racine (catégories racine + formations sans catégorie), anneau 2 = 2e niveau (sous-catégories + formations des cat. racine), anneau 3 = 3e niveau (formations des sous-catégories). */
    const coursesNoCat: CourseListItem[] = [];
    const coursesInRootCat: { course: CourseListItem; categoryId: string }[] = [];
    const coursesInSubcat: { course: CourseListItem; categoryId: string }[] = [];
    for (const co of courses) {
      const catSlugOrId = co.categoryId ?? "other";
      const cat = categoryBySlug.get(catSlugOrId) ?? categoryById.get(catSlugOrId) ?? categories.find((c) => c.slug === catSlugOrId || c.id === catSlugOrId);
      if (!cat || catSlugOrId === "other") {
        coursesNoCat.push(co);
        continue;
      }
      if (cat.parent_id) coursesInSubcat.push({ course: co, categoryId: cat.id });
      else coursesInRootCat.push({ course: co, categoryId: cat.id });
    }

    const nLevel1 = roots.length + coursesNoCat.length;
    const nLevel2 = subs.length + coursesInRootCat.length;
    const nLevel3 = coursesInSubcat.length;

    /** Rayons des cercles : adaptés au nombre d'éléments par niveau. */
    const R1 = Math.min(MAX_RADIUS, radiusForN(nLevel1, R_MIN_LEVEL1));
    const R2 = nLevel2 > 0 ? Math.min(MAX_RADIUS, Math.max(R1 + RING_GAP, radiusForN(nLevel2, R_MIN_LEVEL2))) : R1;
    const R3 = nLevel3 > 0 ? Math.min(MAX_RADIUS, Math.max(R2 + RING_GAP, radiusForN(nLevel3, R_MIN_LEVEL3))) : R2;

    /** Anneau 1 : catégories racine + formations sans catégorie, répartis uniformément sur 360°. */
    const level1Angles = nLevel1 > 0 ? Array.from({ length: nLevel1 }, (_, i) => -90 + (360 * i) / nLevel1) : [];
    let level1Index = 0;
    roots.forEach((r) => {
      const angle = level1Angles[level1Index++];
      const { x, y } = polarToCartesian(CX, CY, R1, angle);
      nodes.push({ id: `cat-${r.id}`, type: "category", x, y, label: r.label, slug: r.slug, icon: r.icon, isSub: false });
      edges.push({ fromId: "center", toId: `cat-${r.id}`, from: { x: CX, y: CY }, to: { x, y } });
    });
    const rootAnglesById = new Map<string, number>();
    roots.forEach((r, i) => rootAnglesById.set(r.id, level1Angles[i]));

    coursesNoCat.forEach((co) => {
      const angle = level1Angles[level1Index++];
      const { x, y } = polarToCartesian(CX, CY, R1, angle);
      const progress = progressByCourse[co.slug];
      const complete = isCourseComplete(progress, co.moduleCount ?? 0, co.missionCount ?? 0);
      const required = requiredCourseSlugs.has(co.slug);
      const state: "completed" | "required" | "available" = complete ? "completed" : required ? "required" : "available";
      nodes.push({ id: `course-${co.slug}`, type: "course", x, y, label: co.title, courseSlug: co.slug, state });
      edges.push({ fromId: "center", toId: `course-${co.slug}`, from: { x: CX, y: CY }, to: { x, y } });
    });

    /** Anneau 2 : sous-catégories (angle = parent) + formations des catégories racine (arc autour de la catégorie). */
    subs.forEach((s) => {
      const parent = s.parent_id ? categoryById.get(s.parent_id) : null;
      const baseAngle = parent ? (rootAnglesById.get(parent.id) ?? -90) : -90;
      const siblings = subs.filter((x) => x.parent_id === s.parent_id);
      const j = siblings.indexOf(s);
      const totalSiblings = siblings.length;
      const spread = totalSiblings <= 1 ? 0 : Math.min(MAX_SUB_SPREAD_DEG, (totalSiblings - 1) * MIN_SUB_ANGLE_DEG);
      const angle = totalSiblings <= 1 ? baseAngle : baseAngle - spread / 2 + (spread * j) / (totalSiblings - 1);
      const { x, y } = polarToCartesian(CX, CY, R2, angle);
      const parentId = parent ? `cat-${parent.id}` : "center";
      const fromNode = nodes.find((n) => n.id === parentId);
      nodes.push({ id: `cat-${s.id}`, type: "category", x, y, label: s.label, slug: s.slug, icon: s.icon, isSub: true });
      edges.push({
        fromId: parentId,
        toId: `cat-${s.id}`,
        from: fromNode ? { x: fromNode.x, y: fromNode.y } : { x: CX, y: CY },
        to: { x, y },
      });
    });

    const categoryAngleDeg = (node: SkillTreeNode) => (Math.atan2(CY - node.y, node.x - CX) * 180) / Math.PI;

    coursesInRootCat.forEach(({ course: co, categoryId }) => {
      const catNode = nodes.find((n) => n.id === `cat-${categoryId}`);
      const baseAngle = catNode ? categoryAngleDeg(catNode) : -90;
      const sameCat = coursesInRootCat.filter((x) => x.categoryId === categoryId);
      const n = sameCat.length;
      const idx = sameCat.findIndex((x) => x.course.slug === co.slug);
      const spread = n <= 1 ? 0 : Math.min(MAX_SPREAD_DEG, Math.max(COURSE_ARC_SPREAD, (n - 1) * MIN_COURSE_ANGLE_DEG));
      const startAngle = baseAngle - spread / 2;
      const angle = n <= 1 ? baseAngle : startAngle + (spread * idx) / (n - 1);
      const { x, y } = polarToCartesian(CX, CY, R2, angle);
      const progress = progressByCourse[co.slug];
      const complete = isCourseComplete(progress, co.moduleCount ?? 0, co.missionCount ?? 0);
      const required = requiredCourseSlugs.has(co.slug);
      const state: "completed" | "required" | "available" = complete ? "completed" : required ? "required" : "available";
      nodes.push({ id: `course-${co.slug}`, type: "course", x, y, label: co.title, courseSlug: co.slug, state });
      const fromNode = nodes.find((n) => n.id === `cat-${categoryId}`);
      edges.push({
        fromId: `cat-${categoryId}`,
        toId: `course-${co.slug}`,
        from: fromNode ? { x: fromNode.x, y: fromNode.y } : { x: CX, y: CY },
        to: { x, y },
      });
    });

    /** Anneau 3 : formations des sous-catégories (arc autour de la sous-catégorie). */
    coursesInSubcat.forEach(({ course: co, categoryId }) => {
      const catNode = nodes.find((n) => n.id === `cat-${categoryId}`);
      const baseAngle = catNode ? categoryAngleDeg(catNode) : -90;
      const sameCat = coursesInSubcat.filter((x) => x.categoryId === categoryId);
      const n = sameCat.length;
      const idx = sameCat.findIndex((x) => x.course.slug === co.slug);
      const spread = n <= 1 ? 0 : Math.min(MAX_SPREAD_DEG, Math.max(COURSE_ARC_SPREAD, (n - 1) * MIN_COURSE_ANGLE_DEG));
      const startAngle = baseAngle - spread / 2;
      const angle = n <= 1 ? baseAngle : startAngle + (spread * idx) / (n - 1);
      const { x, y } = polarToCartesian(CX, CY, R3, angle);
      const progress = progressByCourse[co.slug];
      const complete = isCourseComplete(progress, co.moduleCount ?? 0, co.missionCount ?? 0);
      const required = requiredCourseSlugs.has(co.slug);
      const state: "completed" | "required" | "available" = complete ? "completed" : required ? "required" : "available";
      nodes.push({ id: `course-${co.slug}`, type: "course", x, y, label: co.title, courseSlug: co.slug, state });
      const fromNode = nodes.find((n) => n.id === `cat-${categoryId}`);
      edges.push({
        fromId: `cat-${categoryId}`,
        toId: `course-${co.slug}`,
        from: fromNode ? { x: fromNode.x, y: fromNode.y } : { x: CX, y: CY },
        to: { x, y },
      });
    });

    const activeNodeIds = new Set<string>();
    activeNodeIds.add("center");
    nodes.filter((n) => n.type === "course" && requiredCourseSlugs.has(n.courseSlug ?? "")).forEach((n) => activeNodeIds.add(n.id));
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of edges) {
        if (activeNodeIds.has(e.toId) && !activeNodeIds.has(e.fromId)) {
          activeNodeIds.add(e.fromId);
          changed = true;
        }
      }
    }

    const activeEdgeSet = new Set<string>();
    edges.forEach((e) => {
      if (activeNodeIds.has(e.fromId) && activeNodeIds.has(e.toId)) activeEdgeSet.add(`${e.fromId}-${e.toId}`);
    });

    return { nodes, edges, activeNodeIds, activeEdgeSet };
  }, [categories, courses, progressByCourse, requiredCourseSlugs]);
}
