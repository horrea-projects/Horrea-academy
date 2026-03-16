"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { setUserMetierAssignment } from "@/lib/metiers";
import { Loader2, Briefcase } from "lucide-react";
import { toast } from "sonner";

type Metier = { id: string; slug: string; label: string };

export type UserMetiersSelectorProps = {
  allMetiers: Metier[];
  assignedMetierIds: string[];
};

export function UserMetiersSelector({ allMetiers, assignedMetierIds: initialAssigned }: UserMetiersSelectorProps) {
  const router = useRouter();
  const [assigned, setAssigned] = useState<Set<string>>(new Set(initialAssigned));
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleToggle = async (metierId: string, checked: boolean) => {
    setLoadingId(metierId);
    try {
      const result = await setUserMetierAssignment(metierId, checked);
      if (!result.ok) {
        toast.error(result.error ?? "Erreur");
        return;
      }
      setAssigned((prev) => {
        const next = new Set(prev);
        if (checked) next.add(metierId);
        else next.delete(metierId);
        return next;
      });
      router.refresh();
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoadingId(null);
    }
  };

  if (allMetiers.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <Briefcase className="size-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Mes parcours métiers</Label>
      </div>
      <p className="text-muted-foreground text-xs">
        Cochez les parcours qui vous concernent pour afficher les formations à débloquer sur l&apos;arbre de compétences.
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {allMetiers.map((m) => (
          <label key={m.id} className="flex cursor-pointer items-center gap-2 text-sm">
            {loadingId === m.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Checkbox
                checked={assigned.has(m.id)}
                onCheckedChange={(checked) => handleToggle(m.id, !!checked)}
              />
            )}
            <span>{m.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
