"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

type MissionInfo = { id: string; title: string };
type PendingSubmission = { email: string; missionId: string; date: string };

type Props = {
  /** UUID du cours (pour l’API admin). */
  courseId: string;
  courseSlug: string;
  missions: MissionInfo[];
};

export function PendingMissionsCard({ courseId, courseSlug, missions }: Props) {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [validated, setValidated] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState<string | null>(null);
  const [unvalidating, setUnvalidating] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/courses/${encodeURIComponent(courseId)}/pending-missions`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          if (Array.isArray(data.submissions)) setSubmissions(data.submissions);
          if (Array.isArray(data.validated)) setValidated(data.validated);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [courseId]);

  const handleValidate = async (sub: PendingSubmission) => {
    const key = `${sub.email}-${sub.missionId}`;
    setValidating(key);
    try {
      const res = await fetch("/api/admin/progress/validate-mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug,
          missionId: sub.missionId,
          userEmail: sub.email,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.error) {
        setSubmissions((prev) => prev.filter((s) => s.email !== sub.email || s.missionId !== sub.missionId));
        router.refresh();
        toast.success("Mission validée.");
      } else {
        toast.error(data.error ?? "Erreur lors de la validation");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setValidating(null);
    }
  };

  const handleUnvalidate = async (sub: PendingSubmission) => {
    const key = `${sub.email}-${sub.missionId}`;
    setUnvalidating(key);
    try {
      const res = await fetch("/api/admin/progress/unvalidate-mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug,
          missionId: sub.missionId,
          userEmail: sub.email,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.error) {
        setValidated((prev) => prev.filter((s) => s.email !== sub.email || s.missionId !== sub.missionId));
        setSubmissions((prev) => [...prev, { ...sub, date: new Date().toISOString() }]);
        router.refresh();
        toast.success("Validation annulée. La mission repasse en attente.");
      } else {
        toast.error(data.error ?? "Erreur lors de l'annulation de la validation");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setUnvalidating(null);
    }
  };

  const missionTitle = (missionId: string) => missions.find((m) => m.id === missionId)?.title ?? missionId;
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5" />
            Missions en attente de validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">Chargement…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5" />
          Missions en attente de validation
          {submissions.length > 0 && ` (${submissions.length})`}
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Validez les missions soumises par les apprenants, ou annulez une validation.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {submissions.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucune mission en attente.</p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Apprenant</th>
                  <th className="px-4 py-2 text-left font-medium">Mission</th>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub, idx) => {
                  const key = `p-${sub.email}-${sub.missionId}-${sub.date}-${idx}`;
                  const validatingKey = `${sub.email}-${sub.missionId}`;
                  const isValidating = validating === validatingKey;
                  return (
                    <tr key={key} className="border-b last:border-0">
                      <td className="px-4 py-2 text-muted-foreground">{sub.email}</td>
                      <td className="px-4 py-2 font-medium">{missionTitle(sub.missionId)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{formatDate(sub.date)}</td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleValidate(sub)}
                          disabled={isValidating}
                        >
                          {isValidating ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="mr-1 size-4" />
                              Valider
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {validated.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-2 font-medium">
              <CheckCircle className="size-4 text-green-600" />
              Missions validées ({validated.length})
            </h4>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Apprenant</th>
                    <th className="px-4 py-2 text-left font-medium">Mission</th>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {validated.map((sub, idx) => {
                    const key = `v-${sub.email}-${sub.missionId}-${sub.date}-${idx}`;
                    const unvalidatingKey = `${sub.email}-${sub.missionId}`;
                    const isUnvalidating = unvalidating === unvalidatingKey;
                    return (
                      <tr key={key} className="border-b last:border-0">
                        <td className="px-4 py-2 text-muted-foreground">{sub.email}</td>
                        <td className="px-4 py-2 font-medium">{missionTitle(sub.missionId)}</td>
                        <td className="px-4 py-2 text-muted-foreground">{formatDate(sub.date)}</td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnvalidate(sub)}
                            disabled={isUnvalidating}
                          >
                            {isUnvalidating ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="mr-1 size-4" />
                                Annuler la validation
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
