"use client";

import Link from "next/link";
import { Briefcase, Network } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkillTreePreview, type SkillTreePreviewProps } from "./skill-tree-preview";

export type SkillTreeCardProps = SkillTreePreviewProps & {
  completionStats?: {
    parcoursPercent: number;
    globalPercent: number;
  };
};

export function SkillTreeCard(props: SkillTreeCardProps) {
  const { assignedMetiersWithFormations, completionStats } = props;
  const hasMetiers = assignedMetiersWithFormations.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="size-5" />
            Parcours Métier
          </CardTitle>
          {completionStats && (
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <span>
                Parcours :{" "}
                <span className="font-medium text-foreground">
                  {Math.round(completionStats.parcoursPercent)}%
                </span>
              </span>
              <span className="hidden sm:inline text-border">|</span>
              <span>
                Catalogue :{" "}
                <span className="font-medium text-foreground">
                  {Math.round(completionStats.globalPercent)}%
                </span>
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasMetiers ? (
          <>
            <div className="flex flex-wrap gap-2">
              {assignedMetiersWithFormations.map((m) => (
                <Badge key={m.id} variant="secondary">
                  {m.label}
                </Badge>
              ))}
            </div>
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Aperçu de l&apos;arbre de compétences
              </p>
              <SkillTreePreview {...props} />
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Aucun parcours métier assigné. Choisissez vos parcours dans le{" "}
            <Link href="/dashboard/courses" className="text-primary hover:underline">
              catalogue des formations
            </Link>{" "}
            pour voir les formations à débloquer sur votre arbre.
          </p>
        )}
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link href="/dashboard/courses/arbre" className="inline-flex items-center gap-2">
            <Network className="size-4" />
            Consulter l&apos;arbre des compétences
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
