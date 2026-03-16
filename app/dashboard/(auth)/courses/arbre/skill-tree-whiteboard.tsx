"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { CourseListItem } from "@/lib/content";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSkillTreeGraph, type CategoryWithParent, type CourseProgress } from "./use-skill-tree-graph";
import { SkillTreeSvg } from "./skill-tree-svg";

type AssignedMetier = { id: string; label: string; slug: string; course_slugs: string[] };

const CX = 400;
const CY = 300;
const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 720;
const MIN_SCALE = 0.25;
const MAX_SCALE = 2;
const PAN_STEP = 40;
const ZOOM_STEP = 0.1;

export type SkillTreeWhiteboardProps = {
  categories: CategoryWithParent[];
  courses: CourseListItem[];
  progressByCourse: Record<string, CourseProgress>;
  assignedMetiersWithFormations: AssignedMetier[];
  userImageUrl: string | null;
  userName?: string | null;
};

export function SkillTreeWhiteboard({
  categories,
  courses,
  progressByCourse,
  assignedMetiersWithFormations,
  userImageUrl,
  userName,
}: SkillTreeWhiteboardProps) {
  const [selectedMetierId, setSelectedMetierId] = useState<string | null>(null);
  const [scale, setScale] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0, pointerX: 0, pointerY: 0 });
  const isPanning = useRef(false);

  const requiredCourseSlugs = useMemo(() => {
    if (selectedMetierId) {
      const m = assignedMetiersWithFormations.find((x) => x.id === selectedMetierId);
      return new Set(m?.course_slugs ?? []);
    }
    const set = new Set<string>();
    assignedMetiersWithFormations.forEach((m) => m.course_slugs.forEach((s) => set.add(s)));
    return set;
  }, [assignedMetiersWithFormations, selectedMetierId]);

  const { nodes, edges, activeNodeIds, activeEdgeSet } = useSkillTreeGraph(
    categories,
    courses,
    progressByCourse,
    requiredCourseSlugs
  );

  /** Quand un parcours est sélectionné, on n'affiche que le chemin (formations de ce parcours). */
  const displayNodes = useMemo(() => {
    if (!selectedMetierId) return nodes;
    return nodes.filter((n) => activeNodeIds.has(n.id));
  }, [nodes, activeNodeIds, selectedMetierId]);

  /** Arêtes affichées :
   *  - toujours toutes les arêtes du graphe quand aucun parcours n'est filtré
   *  - en vue filtrée : uniquement le chemin actif (sans les autres arêtes du centre).
   */
  const displayEdges = useMemo(() => {
    if (!selectedMetierId) return edges;
    return edges.filter((e) => activeEdgeSet.has(`${e.fromId}-${e.toId}`));
  }, [edges, activeEdgeSet, selectedMetierId]);

  /** En vue filtrée (un parcours choisi), tout ce qu'on affiche est actif. */
  const displayActiveNodeIds = selectedMetierId ? new Set(displayNodes.map((n) => n.id)) : activeNodeIds;
  const displayActiveEdgeSet = useMemo(() => {
    if (!selectedMetierId) return activeEdgeSet;
    return new Set(displayEdges.map((e) => `${e.fromId}-${e.toId}`));
  }, [selectedMetierId, displayEdges, activeEdgeSet]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)));
    },
    []
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isPanning.current = true;
    panStart.current = { x: pan.x, y: pan.y, pointerX: e.clientX, pointerY: e.clientY };
  }, [pan.x, pan.y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: panStart.current.x + e.clientX - panStart.current.pointerX,
      y: panStart.current.y + e.clientY - panStart.current.pointerY,
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    isPanning.current = false;
  }, []);

  const zoomIn = useCallback(() => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP)), []);
  const panLeft = useCallback(() => setPan((p) => ({ ...p, x: p.x + PAN_STEP })), []);
  const panRight = useCallback(() => setPan((p) => ({ ...p, x: p.x - PAN_STEP })), []);
  const panUp = useCallback(() => setPan((p) => ({ ...p, y: p.y + PAN_STEP })), []);
  const panDown = useCallback(() => setPan((p) => ({ ...p, y: p.y - PAN_STEP })), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 shrink-0 border-b bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/60 md:px-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Parcours métiers</p>
          {selectedMetierId && (() => {
            const m = assignedMetiersWithFormations.find((x) => x.id === selectedMetierId);
            return m ? (
              <span className="text-muted-foreground text-xs">
                — Affichage : <strong className="text-foreground">{m.label}</strong> ({m.course_slugs.length} formation{m.course_slugs.length > 1 ? "s" : ""})
              </span>
            ) : null;
          })()}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={selectedMetierId === null ? "default" : "outline"}
            className="cursor-pointer transition-colors hover:opacity-90"
            onClick={() => setSelectedMetierId(null)}
          >
            Tous
          </Badge>
          {assignedMetiersWithFormations.length === 0 ? (
            <span className="text-muted-foreground text-sm">Aucun parcours assigné — assignez-vous des parcours depuis le catalogue.</span>
          ) : (
            assignedMetiersWithFormations.map((m) => (
              <Badge
                key={m.id}
                variant={selectedMetierId === m.id ? "default" : "outline"}
                className="cursor-pointer transition-colors hover:opacity-90"
                onClick={() => setSelectedMetierId(m.id)}
              >
                {m.label}
              </Badge>
            ))
          )}
        </div>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-hidden bg-muted/20"
        onWheel={onWheel}
        style={{ touchAction: "none" }}
      >
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1 rounded-lg border bg-background/95 p-1 shadow-md backdrop-blur">
          <div className="flex items-center justify-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={panUp} aria-label="Haut">
              <ChevronUp className="size-4" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={panLeft} aria-label="Gauche">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={panRight} aria-label="Droite">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={panDown} aria-label="Bas">
              <ChevronDown className="size-4" />
            </Button>
          </div>
          <div className="my-1 border-t" />
          <div className="flex items-center justify-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} aria-label="Zoom avant">
              <Plus className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} aria-label="Zoom arrière">
              <Minus className="size-4" />
            </Button>
          </div>
        </div>
        <div
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <SkillTreeSvg
            nodes={displayNodes}
            edges={displayEdges}
            activeNodeIds={displayActiveNodeIds}
            activeEdgeSet={displayActiveEdgeSet}
            userImageUrl={userImageUrl}
            userName={userName}
          />
        </div>
      </div>
    </div>
  );
}
