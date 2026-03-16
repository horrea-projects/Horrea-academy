"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Props = {
  courseSlug: string;
  moduleId: string;
  nextModuleId: string | null;
  isCompleted: boolean;
  /** Le module a un quiz configuré. */
  hasQuiz?: boolean;
  /** Score minimum (0-100) requis au quiz pour valider. Défini uniquement si le module a un quiz. */
  minQuizScore?: number;
  /** Score actuel de l'utilisateur à ce quiz (dernier enregistré). */
  quizScore?: number;
};

export function MarkModuleComplete({ courseSlug, moduleId, nextModuleId, isCompleted, hasQuiz, minQuizScore, quizScore }: Props) {
  const mustPassQuiz = Boolean(hasQuiz && minQuizScore != null && minQuizScore > 0);
  const hasPassedQuiz = !mustPassQuiz || (quizScore != null && quizScore >= minQuizScore!);
  const canValidate = !mustPassQuiz || hasPassedQuiz;
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug,
          moduleId,
          status: "completed",
          type: "module",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de l'enregistrement.");
        return;
      }
      toast.success("Module validé. Votre progression a été enregistrée.");
      if (nextModuleId) {
        router.push(`/dashboard/courses/${courseSlug}/modules/${nextModuleId}`);
      } else {
        router.push(`/dashboard/courses/${courseSlug}`);
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  if (isCompleted) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
            <CheckCircle className="size-5" />
            Module validé
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground text-sm">
            Vous avez déjà validé ce module.
          </span>
          {nextModuleId ? (
            <Button asChild size="sm">
              <Link href={`/dashboard/courses/${courseSlug}/modules/${nextModuleId}`}>
                Module suivant
                <ChevronRight className="ml-1 size-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/courses/${courseSlug}`}>
                Retour à la formation
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Valider le module</CardTitle>
      </CardHeader>
      <CardContent>
        {mustPassQuiz && !hasPassedQuiz && (
          <p className="text-muted-foreground mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
            Ce module exige un score d&apos;au moins {minQuizScore}% au quiz pour être validé.
            {quizScore != null ? ` Votre dernier score : ${quizScore}%.` : " Passez le quiz ci-dessus puis revenez ici pour valider."}
          </p>
        )}
        <p className="text-muted-foreground mb-4 text-sm">
          {canValidate
            ? "Une fois le contenu et le quiz (s'il y en a un) terminés, validez ce module pour enregistrer votre progression et passer au suivant."
            : "Terminez le quiz avec le score requis pour débloquer la validation."}
        </p>
        <div className="flex justify-end">
          <Button onClick={handleValidate} disabled={loading || !canValidate}>
            {loading ? "Enregistrement…" : "Valider le module"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
