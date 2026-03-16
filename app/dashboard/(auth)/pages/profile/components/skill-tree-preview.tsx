"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CourseListItem } from "@/lib/content";
import { useSkillTreeGraph, type CategoryWithParent, type CourseProgress } from "@/app/dashboard/(auth)/courses/arbre/use-skill-tree-graph";
import { SkillTreeSvg } from "@/app/dashboard/(auth)/courses/arbre/skill-tree-svg";

export type AssignedMetier = { id: string; label: string; slug: string; course_slugs: string[] };

export type SkillTreePreviewProps = {
  categories: CategoryWithParent[];
  courses: CourseListItem[];
  progressByCourse: Record<string, CourseProgress>;
  assignedMetiersWithFormations: AssignedMetier[];
  userImageUrl: string | null;
  userName?: string | null;
  /** En mode admin (autre utilisateur), pas de lien vers l'arbre. */
  noLink?: boolean;
};

export function SkillTreePreview({
  categories,
  courses,
  progressByCourse,
  assignedMetiersWithFormations,
  userImageUrl,
  userName,
  noLink = false,
}: SkillTreePreviewProps) {
  const requiredCourseSlugs = useMemo(() => {
    const set = new Set<string>();
    assignedMetiersWithFormations.forEach((m) => m.course_slugs.forEach((s) => set.add(s)));
    return set;
  }, [assignedMetiersWithFormations]);

  const { nodes, edges, activeNodeIds, activeEdgeSet } = useSkillTreeGraph(
    categories,
    courses,
    progressByCourse,
    requiredCourseSlugs
  );

  const content = (
    <div className="h-[240px] w-full">
      <SkillTreeSvg
        nodes={nodes}
        edges={edges}
        activeNodeIds={activeNodeIds}
        activeEdgeSet={activeEdgeSet}
        userImageUrl={userImageUrl}
        userName={userName}
        preview
      />
    </div>
  );

  if (noLink) {
    return (
      <div className="overflow-hidden rounded-lg border bg-muted/20">
        {content}
      </div>
    );
  }

  return (
    <Link
      href="/dashboard/courses/arbre"
      className="block overflow-hidden rounded-lg border bg-muted/20 transition hover:opacity-95"
      aria-label="Consulter l'arbre des compétences"
    >
      {content}
    </Link>
  );
}
