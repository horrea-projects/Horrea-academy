"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
};

type QuizResult = {
  questionId: string;
  correct: boolean;
  explanation: string;
  correctAnswer: string;
};

type Props = {
  courseSlug: string;
  moduleId: string;
  quizSheetId?: string;
  quizSpreadsheetId?: string;
  quizSheetName?: string;
  /** Appelé quand le quiz a été envoyé avec succès (score en %). */
  onSubmitted?: (score: number) => void;
  /** Si false, ne pas afficher le bouton "Refaire le quiz" dans l'écran résultat (le parent l'affiche). */
  embedActions?: boolean;
};

export function ModuleQuiz({ courseSlug, moduleId, quizSheetId, quizSpreadsheetId, quizSheetName, onSubmitted, embedActions = true }: Props) {
  const router = useRouter();
  const { user } = useUser();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const hasQuiz = quizSheetId || (quizSpreadsheetId && quizSheetName);
  const totalSteps = questions.length;
  const currentQuestion = questions[currentStep];
  const progressPercent = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  useEffect(() => {
    if (!hasQuiz) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({ courseSlug, moduleId });
    if (quizSpreadsheetId && quizSheetName) {
      params.set("quizSpreadsheetId", quizSpreadsheetId);
      params.set("quizSheetName", quizSheetName);
    } else if (quizSheetId) {
      params.set("quizSheetId", quizSheetId);
    }
    fetch(`/api/quiz/questions?${params.toString()}`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            const msg = data?.error ?? "Impossible de charger le quiz";
            if (res.status === 503) toast.error(msg);
            else if (res.status === 500) toast.error("Impossible de lire le Google Sheet. Vérifiez qu'il est partagé avec le compte de service (voir README).");
            else toast.error(msg);
            return { error: msg };
          });
        }
        return res.json();
      })
      .then((data) => {
        if (data && !data.error && data.questions) setQuestions(data.questions);
      })
      .catch(() => toast.error("Impossible de charger le quiz"))
      .finally(() => setLoading(false));
  }, [courseSlug, moduleId, quizSheetId, quizSpreadsheetId, quizSheetName, hasQuiz]);

  const handleSubmit = async () => {
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) {
      toast.error("Session invalide. Reconnectez-vous.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        email,
        courseSlug,
        moduleId,
        answers: Object.entries(answers).map(([id, value]) => ({ questionId: id, value })),
      };
      if (quizSpreadsheetId && quizSheetName) {
        payload.quizSpreadsheetId = quizSpreadsheetId;
        payload.quizSheetName = quizSheetName;
      } else if (quizSheetId) {
        payload.quizSheetId = quizSheetId;
      }
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.score != null) {
        setScore(data.score);
        setResults(Array.isArray(data.results) ? data.results : []);
        setSubmitted(true);
        onSubmitted?.(data.score);
        toast.success(`Score enregistré : ${data.score}%`);
        try {
          const progressRes = await fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courseSlug,
              moduleId,
              status: "completed",
              type: "quiz",
              score: data.score,
            }),
          });
          if (progressRes.ok) router.refresh();
        } catch {
          // non bloquant
        }
      } else {
        toast.error(data.error ?? "Erreur lors de l'envoi du quiz");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefaire = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    setResults([]);
    setCurrentStep(0);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quiz</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Chargement des questions…</p>
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quiz</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Aucune question disponible. Vérifiez que le Google Sheet est partagé en lecture avec l'email du compte de service (Google Cloud → IAM → compte de service). Voir README section « Google ».
          </p>
        </CardContent>
      </Card>
    );
  }

  // Écran résultat : score + détail (votre choix vs bonne réponse) + bouton Refaire
  if (submitted && score != null) {
    const resultByKey = new Map(results.map((r) => [r.questionId, r]));
    return (
      <Card>
        <CardHeader>
          <CardTitle>Résultat du quiz</CardTitle>
          <p className="text-muted-foreground text-sm">
            {results.filter((r) => r.correct).length} bonne(s) réponse(s) sur {questions.length}. Chaque tentative est enregistrée.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-1">
            <p className="text-3xl font-bold">Score : {score}%</p>
          </div>
          <div className="space-y-4">
            {questions.map((q) => {
              const r = resultByKey.get(q.id);
              const userAnswer = answers[q.id] ?? "—";
              return (
                <div
                  key={q.id}
                  className={`rounded-xl border p-4 text-sm ${r?.correct ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"}`}
                >
                  <div className="flex items-start gap-2">
                    {r?.correct ? (
                      <CheckCircle className="mt-0.5 size-5 shrink-0 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="font-medium">{q.question}</p>
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Votre réponse :</span> {userAnswer}
                      </p>
                      {!r?.correct && r?.correctAnswer && (
                        <p className="text-green-700 dark:text-green-400">
                          <span className="font-medium">Bonne réponse :</span> {r.correctAnswer}
                        </p>
                      )}
                      {r?.explanation ? (
                        <p className="text-muted-foreground italic">{r.explanation}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {embedActions && (
            <Button onClick={handleRefaire} variant="outline" className="w-full sm:w-auto gap-2">
              <RotateCcw className="size-4" />
              Refaire le quiz
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Une question à la fois + stepper
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Quiz</CardTitle>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Question {currentStep + 1} sur {totalSteps}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="min-h-[120px] flex flex-col justify-center">
          <p className="text-center text-xl font-medium leading-snug md:text-2xl">
            {currentQuestion?.question}
          </p>
        </div>
        <RadioGroup
          value={answers[currentQuestion?.id ?? ""] ?? ""}
          onValueChange={(value) =>
            setAnswers((prev) => ({ ...prev, [currentQuestion?.id ?? ""]: value }))
          }
          className="grid gap-3"
        >
          {currentQuestion?.options.map((opt, i) => (
            <Label
              key={i}
              htmlFor={`${currentQuestion?.id}-${i}`}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
            >
              <RadioGroupItem value={opt} id={`${currentQuestion?.id}-${i}`} />
              <span className="font-normal">{opt}</span>
            </Label>
          ))}
        </RadioGroup>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="gap-1"
          >
            <ChevronLeft className="size-4" />
            Précédent
          </Button>
          {currentStep < totalSteps - 1 ? (
            <Button
              type="button"
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!answers[currentQuestion?.id ?? ""]}
              className="gap-1"
            >
              Suivant
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || Object.keys(answers).length < totalSteps}
            >
              {submitting ? "Envoi…" : "Voir le résultat"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
