"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RotateCcw, Loader2 } from "lucide-react";
import { googleSlidesToEmbedUrl } from "@/lib/google-embed";
import { ModuleQuiz } from "./modules/[moduleId]/module-quiz";

function OnboardingPresentationEmbed({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  const embedSrc = googleSlidesToEmbedUrl(url);
  return (
    <div className="relative overflow-hidden rounded-lg border bg-muted">
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <div className="aspect-video w-full">
        <iframe
          src={embedSrc}
          title="Présentation d'onboarding"
          allowFullScreen
          className="h-full w-full"
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  );
}

type Props = {
  courseSlug: string;
  courseTitle: string;
  onboardingTitle?: string | null;
  onboardingContent?: string | null;
  onboardingPresentationEmbedUrl?: string | null;
  onboardingQuizSpreadsheetId?: string | null;
  onboardingQuizSheetName?: string | null;
  children: React.ReactNode;
};

const STORAGE_PREFIX = "horrea_onboarding_course_";

export function CourseOnboardingGate({
  courseSlug,
  courseTitle,
  onboardingTitle,
  onboardingContent,
  onboardingPresentationEmbedUrl,
  onboardingQuizSpreadsheetId,
  onboardingQuizSheetName,
  children,
}: Props) {
  const hasOnboarding = !!(
    onboardingTitle ||
    onboardingContent ||
    onboardingPresentationEmbedUrl ||
    (onboardingQuizSpreadsheetId && onboardingQuizSheetName)
  );
  const storageKey = `${STORAGE_PREFIX}${courseSlug}`;
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnboardingDone(localStorage.getItem(storageKey) === "1");
    setHydrated(true);
  }, [storageKey]);

  if (!hasOnboarding) return <>{children}</>;

  if (!hydrated) return <>{children}</>;

  if (hasOnboarding && !onboardingDone) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{courseTitle}</h1>
          <p className="text-muted-foreground text-sm">Onboarding — à lire avant de commencer</p>
        </div>
        {onboardingTitle && (
          <h2 className="text-lg font-semibold">{onboardingTitle}</h2>
        )}
        {onboardingContent && (
          <div
            className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-muted/30 p-4"
            dangerouslySetInnerHTML={{ __html: onboardingContent }}
          />
        )}
        {onboardingPresentationEmbedUrl && (
          <OnboardingPresentationEmbed url={onboardingPresentationEmbedUrl} />
        )}
        {onboardingQuizSpreadsheetId && onboardingQuizSheetName && (
          <ModuleQuiz
            courseSlug={courseSlug}
            moduleId="onboarding"
            quizSpreadsheetId={onboardingQuizSpreadsheetId}
            quizSheetName={onboardingQuizSheetName}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/courses">Retour au catalogue</Link>
          </Button>
          <Button
            onClick={() => {
              localStorage.setItem(storageKey, "1");
              setOnboardingDone(true);
            }}
          >
            Valider l'onboarding, passer aux modules
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <span className="text-muted-foreground text-sm">Onboarding complété.</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto gap-1 px-2 text-sm"
          onClick={() => {
            localStorage.removeItem(storageKey);
            setOnboardingDone(false);
          }}
        >
          <RotateCcw className="size-3.5" />
          Refaire l'onboarding
        </Button>
      </div>
      {children}
    </>
  );
}
