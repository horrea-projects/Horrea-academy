"use client";

import { useState, useEffect, useMemo } from "react";
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
  sectionId?: string;
};

type QuizSection = {
  id: string;
  title: string;
  description?: string;
};

type QuizSlide =
  | { type: "section"; section: QuizSection }
  | { type: "question"; question: QuizQuestion };

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
  const [sections, setSections] = useState<QuizSection[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const hasQuiz = quizSheetId || (quizSpreadsheetId && quizSheetName);
  const sectionById = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const slides = useMemo<QuizSlide[]>(() => {
    const out: QuizSlide[] = [];
    if (questions.length === 0) return out;

    let lastSectionId: string | undefined;
    for (const q of questions) {
      const secId = q.sectionId;
      if (secId && secId !== lastSectionId) {
        const section = sectionById.get(secId);
        if (section) out.push({ type: "section", section });
      }
      out.push({ type: "question", question: q });
      lastSectionId = secId;
    }
    return out;
  }, [questions, sectionById]);
  const totalSteps = slides.length;
  const currentSlide = slides[currentStep];
  const currentQuestion = currentSlide?.type === "question" ? currentSlide.question : undefined;
  const currentSection =
    currentSlide?.type === "section"
      ? currentSlide.section
      : currentQuestion?.sectionId
        ? sectionById.get(currentQuestion.sectionId)
        : undefined;
  const currentSectionIndex =
    currentSection && sections.length > 0
      ? Math.max(0, sections.findIndex((s) => s.id === currentSection.id)) + 1
      : 0;
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
        if (data && !data.error) {
          if (Array.isArray(data.sections)) setSections(data.sections);
          // Compatibilité: si backend legacy, on garde le parsing questions seul.
          if (Array.isArray(data.questions)) setQuestions(data.questions);
          setCurrentStep(0);
        }
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
    const sectionStats = sections
      .map((s) => {
        const questionsInSection = questions.filter((q) => q.sectionId === s.id);
        const total = questionsInSection.length;
        const correct = questionsInSection.filter((q) => resultByKey.get(q.id)?.correct).length;
        return { section: s, total, correct };
      })
      .filter((x) => x.total > 0);

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
          {sectionStats.length > 0 && (
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="mb-3 text-sm font-medium">Bonnes réponses par section</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {sectionStats.map(({ section, total, correct }) => (
                  <div key={section.id} className="rounded-md border bg-background px-3 py-2 text-sm">
                    <p className="font-medium">{section.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {correct}/{total} bonne{correct > 1 ? "s" : ""} réponse{total > 1 ? "s" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-4">
            {questions.map((q, index) => {
              const r = resultByKey.get(q.id);
              const userAnswer = answers[q.id] ?? "—";
              const section = q.sectionId ? sectionById.get(q.sectionId) : undefined;
              const prev = index > 0 ? questions[index - 1] : undefined;
              const showSectionHeader = !!section && section.id !== prev?.sectionId;
              return (
                <div key={q.id} className="space-y-2">
                  {showSectionHeader && (
                    <div className="rounded-md border bg-muted/20 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Section
                          </p>
                          <p className="text-sm font-medium">{section.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {(() => {
                            const inSection = questions.filter((x) => x.sectionId === section.id);
                            const total = inSection.length;
                            const correct = inSection.filter((x) => resultByKey.get(x.id)?.correct).length;
                            return `${correct}/${total}`;
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                  <div
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
            <span>Étape {currentStep + 1} sur {totalSteps}</span>
            {sections.length > 0 && currentSectionIndex > 0 && (
              <span>Section {currentSectionIndex}/{sections.length}</span>
            )}
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {currentSlide?.type === "question" && currentSection && (
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {currentSection.title}
            </p>
            {currentSection.description && (
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                {currentSection.description}
              </p>
            )}
          </div>
        )}
        {currentSlide?.type === "section" ? (
          <div className="rounded-lg border bg-muted/20 px-5 py-8">
            <p className="text-center text-2xl font-semibold">{currentSlide.section.title}</p>
            {currentSlide.section.description && (
              <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground whitespace-pre-wrap">
                {currentSlide.section.description}
              </p>
            )}
          </div>
        ) : (
          <>
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
          </>
        )}
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
              disabled={currentSlide?.type === "question" ? !answers[currentQuestion?.id ?? ""] : false}
              className="gap-1"
            >
              Suivant
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitting ||
                questions.some((q) => {
                  const v = answers[q.id];
                  return !v || !v.trim();
                })
              }
            >
              {submitting ? "Envoi…" : "Voir le résultat"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
