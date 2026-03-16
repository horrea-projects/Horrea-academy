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
  preview = false
}: SkillTreeSvgProps) {
  const initial = userName?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className="h-full w-full"
      style={preview ? undefined : { minWidth: VIEWBOX_WIDTH, minHeight: VIEWBOX_HEIGHT }}
      preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="linkGradActive" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="linkGradInactive" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.1" />
        </linearGradient>
        <clipPath id="clip-center">
          <circle r="36" cx="0" cy="0" />
        </clipPath>
      </defs>
      {edges.map((e, i) => {
        const key = `${e.fromId}-${e.toId}`;
        const active = activeEdgeSet.has(key);
        const isFromCenter = e.fromId === "center";
        return (
          <line
            key={`edge-${i}`}
            x1={e.from.x}
            y1={e.from.y}
            x2={e.to.x}
            y2={e.to.y}
            stroke={
              isFromCenter
                ? "hsl(var(--foreground))"
                : active
                  ? "url(#linkGradActive)"
                  : "url(#linkGradInactive)"
            }
            strokeWidth={isFromCenter ? 2.4 : active ? 2 : 1.5}
            strokeLinecap="round"
            strokeDasharray={isFromCenter ? undefined : active ? undefined : "6 4"}
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
