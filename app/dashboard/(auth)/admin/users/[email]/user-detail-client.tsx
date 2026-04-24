"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Network, Pencil, Trash2, Briefcase } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { SkillTreePreview, type SkillTreePreviewProps } from "@/app/dashboard/(auth)/pages/profile/components/skill-tree-preview";

type CourseSummary = {
  courseSlug: string;
  courseTitle: string;
  totalModules: number;
  modulesCompleted: number;
  totalMissions: number;
  missionsCompleted: number;
  completionPercent: number;
};

type LastModuleEntry = {
  courseSlug: string;
  moduleId: string;
  moduleTitle: string;
  courseTitle: string;
  date: string | null;
};

type QuizStatEntry = {
  courseSlug: string;
  courseTitle: string;
  moduleId: string;
  moduleTitle: string;
  attempts: number;
  bestScore: number;
};

type UserDetailResponse = {
  email: string;
  name: string | null;
  is_admin: boolean;
  clerk_id: string | null;
  userMetiers: { id: string; label?: string; slug?: string }[];
  modulesCompleted: number;
  coursesCompleted: number;
  lastActivityAt: string | null;
  courses: CourseSummary[];
  lastModules: LastModuleEntry[];
  quizStats: QuizStatEntry[];
};

type Props = {
  email: string;
};

export function UserDetailClient({ email }: Props) {
  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [metiers, setMetiers] = useState<{ id: string; slug: string; label: string }[]>([]);
  const [metiersLoading, setMetiersLoading] = useState(false);
  const [metierIds, setMetierIds] = useState<string[]>([]);
  const [metiersSaving, setMetiersSaving] = useState(false);
  const [skillTreeData, setSkillTreeData] = useState<SkillTreePreviewProps | null>(null);
  const [skillTreeLoading, setSkillTreeLoading] = useState(false);
  const router = useRouter();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}`);
      if (!res.ok) {
        throw new Error("Impossible de charger les statistiques de l'utilisateur");
      }
      const json = (await res.json()) as UserDetailResponse;
      setData(json);
      setEditName(json.name ?? "");
      setEditIsAdmin(json.is_admin);
      setMetierIds((json.userMetiers ?? []).map((um) => um.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [email]);

  useEffect(() => {
    if (!data || !email) return;
    let cancelled = false;
    setSkillTreeLoading(true);
    fetch(`/api/admin/users/${encodeURIComponent(email)}/skill-tree`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setSkillTreeData(json);
      })
      .catch(() => {
        if (!cancelled) setSkillTreeData(null);
      })
      .finally(() => {
        if (!cancelled) setSkillTreeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data, email]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMetiersLoading(true);
      try {
        const res = await fetch("/api/admin/metiers");
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setMetiers(json.metiers ?? []);
        }
      } finally {
        if (!cancelled) setMetiersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleMetier = (id: string) => {
    setMetierIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSaveMetiers = async () => {
    setMetiersSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}/metiers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metier_ids: metierIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Erreur lors de l'enregistrement des parcours");
      }
      toast.success("Parcours métiers mis à jour");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setMetiersSaving(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName || null, is_admin: editIsAdmin })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Erreur lors de la mise à jour");
      }
      toast.success("Utilisateur mis à jour");
      setEditOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer cet utilisateur de la base ? (L’authentification Clerk n’est pas supprimée.)")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      toast.success("Utilisateur supprimé de la base");
      router.push("/dashboard/admin/users");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Chargement de la fiche utilisateur...
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        {error}
      </Card>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground text-sm">Aucune donnée pour cet utilisateur.</p>;
  }

  const formattedLastActivity = data.lastActivityAt
    ? new Date(data.lastActivityAt).toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short"
      })
    : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
              <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (open) { setEditName(data.name ?? ""); setEditIsAdmin(data.is_admin); } }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Pencil className="mr-1 size-4" />
                    Modifier
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Modifier l’utilisateur</DialogTitle>
                    <DialogDescription>Email : {data.email}</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-name">Nom</Label>
                      <Input
                        id="edit-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nom affiché"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="edit-admin" checked={editIsAdmin} onCheckedChange={setEditIsAdmin} />
                      <Label htmlFor="edit-admin">Administrateur</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/admin/users")}>
                Retour à la liste
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Supprimer
              </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          {data.clerk_id != null ? (
            <Card>
              <CardHeader className="px-6 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="size-4" />
                  Parcours métiers
                </CardTitle>
                <CardDescription>
                  Parcours assignés à cet utilisateur. Ils définissent les formations à débloquer sur son arbre de compétences.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-0">
                {metiersLoading ? (
                  <p className="text-muted-foreground text-sm">Chargement des parcours...</p>
                ) : metiers.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Aucun parcours métier défini. Créez-en dans Administration → Parcours métiers.</p>
                ) : (
                  <>
                    <ScrollArea className="h-40 rounded-md border p-2">
                      <div className="space-y-2">
                        {metiers.map((m) => (
                          <label key={m.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={metierIds.includes(m.id)}
                              onCheckedChange={() => toggleMetier(m.id)}
                            />
                            <span>{m.label}</span>
                            <span className="text-muted-foreground text-xs">({m.slug})</span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                    <Button className="mt-3" size="sm" onClick={handleSaveMetiers} disabled={metiersSaving}>
                      {metiersSaving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer les parcours"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="px-6 py-4">
                <p className="text-muted-foreground text-sm">
                  L&apos;assignation de parcours métiers est possible une fois que l&apos;utilisateur s&apos;est connecté (compte app_users avec clerk_id).
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="min-w-0">
          <Card>
            <CardHeader className="px-6 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="size-4" />
                Arbre de compétences
              </CardTitle>
              <CardDescription>
                Aperçu de l&apos;arbre de compétences de cette personne (parcours assignés et formations à débloquer).
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-0">
              {skillTreeLoading ? (
                <p className="text-muted-foreground py-8 text-center text-sm">Chargement de l&apos;arbre...</p>
              ) : skillTreeData ? (
                <SkillTreePreview {...skillTreeData} noLink />
              ) : (
                <p className="text-muted-foreground py-4 text-sm">Impossible de charger l&apos;arbre ou aucune donnée.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="px-6 pb-3">
          <CardTitle className="text-base">Résumé des compétences</CardTitle>
          <CardDescription>{data.email}{data.name ? ` · ${data.name}` : ""}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-6 pb-6 pt-0 sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs uppercase">Modules complétés</p>
            <p className="mt-1 text-lg font-semibold">{data.modulesCompleted}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Formations complétées</p>
            <p className="mt-1 text-lg font-semibold">{data.coursesCompleted}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Dernière activité</p>
            <p className="mt-1 text-xs">{formattedLastActivity}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-6 pb-3">
          <CardTitle className="text-base">Progression par formation</CardTitle>
          <CardDescription>Vue d’ensemble des formations suivies par cet utilisateur.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-0">
          {data.courses.length === 0 ? (
            <p className="text-muted-foreground px-6 pb-6 pt-2 text-sm">
              Aucun module complété pour le moment.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Formation</TableHead>
                    <TableHead className="min-w-[200px] shrink-0">Progression</TableHead>
                    <TableHead className="w-32 shrink-0">Modules</TableHead>
                    <TableHead className="w-28 shrink-0">Missions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.courses.map((course) => (
                    <TableRow key={course.courseSlug}>
                      <TableCell className="min-w-0 max-w-xs whitespace-normal font-medium">
                        <Link
                          href={`/dashboard/courses/${encodeURIComponent(course.courseSlug)}`}
                          className="text-primary hover:underline"
                        >
                          {course.courseTitle}
                        </Link>
                      </TableCell>
                      <TableCell className="w-64">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <Progress value={course.completionPercent} className="h-2" />
                          </div>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {course.completionPercent}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {course.modulesCompleted}/{course.totalModules}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {course.missionsCompleted}/{course.totalMissions}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {(data.quizStats?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="px-6 pb-3">
            <CardTitle className="text-base">Scores aux quiz</CardTitle>
            <CardDescription>Nombre d'essais et meilleur score par module (par formation).</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-0">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Formation</TableHead>
                    <TableHead className="min-w-[180px]">Module</TableHead>
                    <TableHead className="w-24 text-center">Essais</TableHead>
                    <TableHead className="w-32 text-center">Meilleur score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.quizStats ?? []).map((q) => (
                    <TableRow key={`${q.courseSlug}-${q.moduleId}`}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/courses/${encodeURIComponent(q.courseSlug)}`}
                          className="text-primary hover:underline"
                        >
                          {q.courseTitle}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <Link
                          href={`/dashboard/courses/${encodeURIComponent(q.courseSlug)}/modules/${encodeURIComponent(q.moduleId)}`}
                          className="text-primary hover:underline"
                        >
                          {q.moduleTitle}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{q.attempts}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">{q.bestScore} %</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="px-6 pb-3">
          <CardTitle className="text-base">Derniers modules complétés</CardTitle>
          <CardDescription>Les 5 derniers modules terminés par cet utilisateur.</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          {data.lastModules.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun module complété pour le moment.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.lastModules.map((m) => (
                <li key={`${m.courseSlug}-${m.moduleId}-${m.date ?? ""}`} className="flex flex-col">
                  <Link
                    href={`/dashboard/courses/${encodeURIComponent(m.courseSlug)}/modules/${encodeURIComponent(m.moduleId)}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {m.moduleTitle}
                  </Link>
                  <span className="text-muted-foreground text-xs">
                    <Link
                      href={`/dashboard/courses/${encodeURIComponent(m.courseSlug)}`}
                      className="text-primary hover:underline"
                    >
                      {m.courseTitle}
                    </Link>
                    {" • "}
                    {m.date
                      ? new Date(m.date).toLocaleString("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short"
                        })
                      : "date inconnue"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

