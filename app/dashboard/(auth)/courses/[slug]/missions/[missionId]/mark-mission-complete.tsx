"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

type Props = {
  courseSlug: string;
  missionId: string;
  isCompleted?: boolean;
  isPendingValidation?: boolean;
};

export function MarkMissionComplete({ courseSlug, missionId, isCompleted = false, isPendingValidation = false }: Props) {
  const router = useRouter();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(isPendingValidation);
  const [completed, setCompleted] = useState(isCompleted);

  const handleComplete = async () => {
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) {
      toast.error("Session invalide. Reconnectez-vous.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug,
          moduleId: missionId,
          status: "pending_validation",
          type: "mission",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.error) {
        setPending(true);
        router.refresh();
        toast.success("Mission envoyée. Elle est en attente de validation par un administrateur ou l'auteur de la formation.");
      } else {
        toast.error(data.error ?? "Erreur lors de l’enregistrement.");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  if (completed) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
        <CardContent className="flex items-center gap-2 pt-6">
          <CheckCircle className="text-green-600 size-5" />
          <span className="font-medium">Mission validée</span>
        </CardContent>
      </Card>
    );
  }

  if (pending || isPendingValidation) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Clock className="text-amber-600 size-5 shrink-0" />
            <span className="font-medium">En attente de validation</span>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            Un administrateur ou l'auteur de la formation validera votre mission.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const res = await fetch("/api/progress/cancel-mission", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ courseSlug, missionId }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && !data.error) {
                  setPending(false);
                  router.refresh();
                  toast.success("Envoi annulé. Vous pouvez refaire la mission.");
                } else {
                  toast.error(data.error ?? "Erreur lors de l'annulation.");
                }
              } catch {
                toast.error("Erreur réseau");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Annulation…" : "Annuler l'envoi / Refaire la mission"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suivi</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4 text-sm">
          Une fois le livrable réalisé, envoyez votre mission. Elle passera en attente de validation par un administrateur ou l'auteur de la formation.
        </p>
        <Button onClick={handleComplete} disabled={loading}>
          {loading ? "Envoi…" : "Envoyer pour validation"}
        </Button>
      </CardContent>
    </Card>
  );
}
