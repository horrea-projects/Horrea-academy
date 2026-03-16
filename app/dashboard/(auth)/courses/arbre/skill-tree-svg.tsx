"use client";

import Link from "next/link";
import { getCategoryIconSvg } from "@/lib/category-icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GraduationCapIcon, ShoppingBag } from "lucide-react";
import type { SkillTreeNode } from "./use-skill-tree-graph";

const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 720;

function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const svg = getCategoryIconSvg(icon);
  if (svg) {
    return (
      <span
        className={
          className ??
          "inline-flex size-6 shrink-0 items-center justify-center [&>svg]:block [&>svg]:size-6 [&>svg]:shrink-0"
        }
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  return <ShoppingBag className={className} />;
}

export type SkillTreeSvgProps = {
  nodes: SkillTreeNode[];
  edges: Array<{
    fromId: string;
    toId: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
  }>;
  activeNodeIds: Set<string>;
  activeEdgeSet: Set<string>;
  userImageUrl: string | null;
  userName?: string | null;
  /** En mode preview, pas de liens cliquables */
  preview?: boolean;
};

export function SkillTreeSvg({
  nodes,
  edges,
  activeNodeIds,
  activeEdgeSet,
  userImageUrl,
  userName,
  preview = false,
}: SkillTreeSvgProps) {
  const initial = userName?.slice(0, 2).toUpperCase() ?? "?";
  // Rayons visuels approximatifs des différents types de nœuds
  const CENTER_RADIUS = 40; // clipPath r=36 + bordures
  const CATEGORY_RADIUS = 24;
  const SUBCATEGORY_RADIUS = 20;
  const COURSE_RADIUS = 26;

  const radiusForNode = (n: SkillTreeNode | undefined): number => {
    if (!n) return 0;
    if (n.type === "center") return CENTER_RADIUS;
    if (n.type === "category") return n.isSub ? SUBCATEGORY_RADIUS : CATEGORY_RADIUS;
    if (n.type === "course") return COURSE_RADIUS;
    return 0;
  };

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className="h-full w-full"
      style={preview ? undefined : { minWidth: VIEWBOX_WIDTH, minHeight: VIEWBOX_HEIGHT }}
      preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id="clip-center">
          <circle r="36" cx="0" cy="0" />
        </clipPath>
      </defs>
      {edges.map((e, i) => {
        const key = `${e.fromId}-${e.toId}`;
        const active = activeEdgeSet.has(key);
        const fromNode = nodes.find((n) => n.id === e.fromId);
        const toNode = nodes.find((n) => n.id === e.toId);

        // Vecteur unitaire de from → to
        const dx = e.to.x - e.from.x;
        const dy = e.to.y - e.from.y;
        const d = Math.hypot(dx, dy) || 1;
        const ux = dx / d;
        const uy = dy / d;

        // On coupe la ligne aux bords des cercles de départ et d'arrivée
        const rFrom = radiusForNode(fromNode);
        const rTo = radiusForNode(toNode);
        const x1 = e.from.x + ux * rFrom;
        const y1 = e.from.y + uy * rFrom;
        const x2 = e.to.x - ux * rTo;
        const y2 = e.to.y - uy * rTo;

        // Couleur unique pour toutes les arêtes (gris), avec pointillés pour tout le monde.
        const strokeColor = "#9ca3af";

        return (
          <line
            key={`edge-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={strokeColor}
            strokeWidth={active ? 2 : 1.5}
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
        );
      })}
      {nodes.map((n) => {
        if (n.type === "center") {
          return (
            <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
              <g clipPath="url(#clip-center)">
                <foreignObject x="-36" y="-36" width="72" height="72">
                  <div className="border-primary bg-background ring-primary flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 ring-2">
                    <Avatar className="border-background h-16 w-16 shrink-0 border-2">
                      <AvatarImage src={userImageUrl ?? undefined} alt="" />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </foreignObject>
              </g>
            </g>
          );
        }
        const active = activeNodeIds.has(n.id);
        const opacity = active ? 1 : 0.5;
        if (n.type === "category") {
          const size = n.isSub ? 40 : 48;
          const href = n.slug ? `/dashboard/courses/category/${n.slug}` : "#";
          const content = (
            <>
              <div
                className="border-primary/50 bg-background hover:border-primary absolute inset-0 rounded-full border-2 shadow-md transition hover:scale-105"
                style={{ opacity }}
              />
              <span
                className="text-foreground relative z-10 flex size-6 shrink-0 items-center justify-center [&>svg]:block [&>svg]:size-6 [&>svg]:shrink-0"
                style={{ color: "hsl(var(--foreground))" }}>
                <CategoryIcon icon={n.icon ?? "book"} />
              </span>
            </>
          );
          return (
            <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
              {preview ? (
                <foreignObject x={-size / 2} y={-size / 2} width={size} height={size}>
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full">
                    {content}
                  </div>
                </foreignObject>
              ) : (
                <Link href={href}>
                  <foreignObject x={-size / 2} y={-size / 2} width={size} height={size}>
                    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full">
                      {content}
                    </div>
                  </foreignObject>
                </Link>
              )}
              <text
                x={0}
                y={size / 2 + 16}
                textAnchor="middle"
                className="fill-foreground text-xs font-medium"
                style={{ opacity }}>
                {n.label.length > 14 ? n.label.slice(0, 13) + "…" : n.label}
              </text>
            </g>
          );
        }
        if (n.type === "course" && n.courseSlug) {
          const state = n.state ?? "available";
          const size = 52;
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
          const nodeContent = (
            <>
              <div
                className={`absolute inset-0 rounded-full border-2 shadow transition hover:scale-105 ${bg}`}
                style={{ borderColor: stroke, opacity }}
              />
              <span className="relative z-10 flex size-6 shrink-0 items-center justify-center">
                <GraduationCapIcon className="size-6 shrink-0" style={{ color: stroke }} />
              </span>
            </>
          );
          return (
            <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
              {preview ? (
                <foreignObject x={-size / 2} y={-size / 2} width={size} height={size}>
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full">
                    {nodeContent}
                  </div>
                </foreignObject>
              ) : (
                <Link href={`/dashboard/courses/${n.courseSlug}`}>
                  <foreignObject x={-size / 2} y={-size / 2} width={size} height={size}>
                    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full">
                      {nodeContent}
                    </div>
                  </foreignObject>
                </Link>
              )}
              <text
                x={0}
                y={size / 2 + 18}
                textAnchor="middle"
                className="fill-foreground text-xs font-medium"
                style={{ opacity }}>
                {n.label.length > 16 ? n.label.slice(0, 15) + "…" : n.label}
              </text>
              {!preview && state === "required" && (
                <foreignObject x={-size / 2 - 6} y={-size / 2 - 6} width={28} height={24}>
                  <Badge className="bg-primary px-1.5 py-0 text-[10px]">Objectif</Badge>
                </foreignObject>
              )}
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}
