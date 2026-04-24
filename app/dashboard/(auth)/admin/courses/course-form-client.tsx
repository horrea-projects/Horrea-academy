"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getCategoryIconSvg } from "@/lib/category-icons";
import { parseGoogleSheetId } from "@/lib/google-embed";
import { Loader2, Plus, Trash2, GripVertical, FileDown } from "lucide-react";
import { toast } from "sonner";

type Category = { id: string; slug: string; label: string; icon: string };

type ModuleRow = {
  module_slug: string;
  title: string;
  description: string;
  duration: string;
  video_embed_url: string;
  document_embed_url: string;
  presentation_embed_url: string;
  quiz_sheet_id: string;
  quiz_sheet_name: string;
  mission_id_slug: string;
  content: string;
  min_quiz_score: number | "";
};

type MissionRow = {
  mission_slug: string;
  title: string;
  context: string;
  objective: string;
  /** Une seule chaîne (comme contexte/livrable), convertie en tableau de lignes à l'envoi. */
  instructions: string;
  deliverable: string;
};

const emptyModule = (): ModuleRow => ({
  module_slug: "",
  title: "",
  description: "",
  duration: "",
  video_embed_url: "",
  document_embed_url: "",
  presentation_embed_url: "",
  quiz_sheet_id: "",
  quiz_sheet_name: "",
  mission_id_slug: "",
  content: "",
  min_quiz_score: "",
});

const emptyMission = (): MissionRow => ({
  mission_slug: "",
  title: "",
  context: "",
  objective: "",
  instructions: "",
  deliverable: "",
});

type Props = {
  courseId?: string;
  /** Mode proposition depuis le catalogue : formulaire vers POST /api/courses, pas de champ Publié, statut en attente. */
  proposeMode?: boolean;
};

export function AdminCourseFormClient({ courseId, proposeMode = false }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryChoice, setCategoryChoice] = useState<"existing" | "new">("existing");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [published, setPublished] = useState(false);
  const [status, setStatus] = useState<string>("draft");
  const [createdBy, setCreatedBy] = useState<string | null>(null);
  const [authors, setAuthors] = useState<{ clerk_id: string; email: string; name?: string }[]>([]);
  const [onboardingTitle, setOnboardingTitle] = useState("");
  const [onboardingContent, setOnboardingContent] = useState("");
  const [onboardingPresentationUrl, setOnboardingPresentationUrl] = useState("");
  const [onboardingQuizSheetName, setOnboardingQuizSheetName] = useState("");
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [quizSpreadsheetId, setQuizSpreadsheetId] = useState("");
  const [finalQuizSheetName, setFinalQuizSheetName] = useState("");
  const [finalQuizSheetId, setFinalQuizSheetId] = useState("");
  const [finalQuizMinScore, setFinalQuizMinScore] = useState<number | "">("");
  const [loading, setLoading] = useState(!!courseId);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const router = useRouter();
  const isEdit = !!courseId && !proposeMode;

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const url = proposeMode ? "/api/categories" : "/api/admin/categories";
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories ?? []);
        }
      } catch {
        // ignore
      }
    };
    loadCategories();
  }, [proposeMode]);

  useEffect(() => {
    if (!proposeMode) {
      fetch("/api/admin/authors")
        .then((r) => r.json())
        .then((d) => setAuthors(d.users ?? []))
        .catch(() => setAuthors([]));
    }
  }, [proposeMode]);

  useEffect(() => {
    if (!courseId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/courses/${courseId}`);
        if (!res.ok) throw new Error("Formation introuvable");
        const c = await res.json();
        setSlug(c.slug ?? "");
        setTitle(c.title ?? "");
        setDescription(c.description ?? "");
        setDuration(c.duration ?? "");
        setCategoryId(c.category_id ?? null);
        setPublished(c.published ?? false);
        setStatus((c as { status?: string }).status ?? ((c as { published?: boolean }).published ? "published" : "draft"));
        setCreatedBy((c as { created_by?: string | null }).created_by ?? null);
        setOnboardingTitle(c.onboarding_title ?? "");
        setOnboardingContent(c.onboarding_content ?? "");
        setOnboardingPresentationUrl(c.onboarding_presentation_embed_url ?? "");
        setOnboardingQuizSheetName((c as { onboarding_quiz_sheet_name?: string }).onboarding_quiz_sheet_name ?? "");
        setQuizSpreadsheetId(c.quiz_spreadsheet_id ?? "");
        setFinalQuizSheetName(c.final_quiz_sheet_name ?? "");
        setFinalQuizSheetId(c.final_quiz_sheet_id ?? "");
        setFinalQuizMinScore((c as { final_quiz_min_score?: number | null }).final_quiz_min_score != null ? Number((c as { final_quiz_min_score?: number }).final_quiz_min_score) : "");
        setModules(
          (c.modules ?? []).map((m: Record<string, unknown>) => ({
            module_slug: String(m.module_slug ?? ""),
            title: String(m.title ?? ""),
            description: String(m.description ?? ""),
            duration: String(m.duration ?? ""),
            video_embed_url: String(m.video_embed_url ?? ""),
            document_embed_url: String(m.document_embed_url ?? ""),
            presentation_embed_url: String(m.presentation_embed_url ?? ""),
            quiz_sheet_id: String(m.quiz_sheet_id ?? ""),
            quiz_sheet_name: String(m.quiz_sheet_name ?? ""),
            mission_id_slug: String(m.mission_id_slug ?? ""),
            content: String(m.content ?? ""),
            min_quiz_score: m.min_quiz_score != null && m.min_quiz_score !== "" ? Number(m.min_quiz_score) : "",
          }))
        );
        setMissions(
          (c.missions ?? []).map((m: Record<string, unknown>) => ({
            mission_slug: String(m.mission_slug ?? ""),
            title: String(m.title ?? ""),
            context: String(m.context ?? ""),
            objective: String(m.objective ?? ""),
            instructions: Array.isArray(m.instructions)
              ? (m.instructions as string[]).join("\n")
              : typeof m.instructions === "string"
                ? m.instructions
                : "",
            deliverable: String(m.deliverable ?? ""),
          }))
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur");
        router.push("/dashboard/admin/courses");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [courseId, router]);

  const addModule = () => setModules((prev) => [...prev, emptyModule()]);
  const removeModule = (i: number) => setModules((prev) => prev.filter((_, j) => j !== i));
  const updateModule = (i: number, field: keyof ModuleRow, value: string | number | "") => {
    setModules((prev) => {
      const next = [...prev];
      (next[i] as Record<string, unknown>)[field] = value;
      return next;
    });
  };

  const addMission = () => setMissions((prev) => [...prev, emptyMission()]);
  const removeMission = (i: number) => setMissions((prev) => prev.filter((_, j) => j !== i));
  const updateMission = (i: number, field: keyof MissionRow, value: string | string[]) => {
    setMissions((prev) => {
      const next = [...prev];
      (next[i] as Record<string, unknown>)[field] = value;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
      toast.error("Titre et slug requis");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: slug.trim(),
        title: title.trim(),
        description,
        duration,
        category_id: categoryId || null,
        published: proposeMode ? false : status === "published",
        status: proposeMode ? undefined : status,
        created_by: proposeMode ? undefined : createdBy,
        onboarding_title: onboardingTitle.trim() || null,
        onboarding_content: onboardingContent.trim() || null,
        onboarding_presentation_embed_url: onboardingPresentationUrl.trim() || null,
        onboarding_quiz_sheet_name: onboardingQuizSheetName.trim() || null,
        quiz_spreadsheet_id: parseGoogleSheetId(quizSpreadsheetId).trim() || null,
        final_quiz_sheet_name: finalQuizSheetName.trim() || null,
        final_quiz_sheet_id: parseGoogleSheetId(finalQuizSheetId).trim() || (parseGoogleSheetId(quizSpreadsheetId).trim() || null),
        final_quiz_min_score: finalQuizMinScore !== "" && finalQuizMinScore != null ? Number(finalQuizMinScore) : null,
        modules: modules
          .filter((m) => m.module_slug.trim() || m.title.trim())
          .map((m, idx) => ({
            module_slug: m.module_slug.trim() || `module-${idx + 1}`,
            title: m.title.trim() || `Module ${idx + 1}`,
            description: m.description ?? "",
            duration: m.duration ?? "",
            video_embed_url: m.video_embed_url ?? "",
            document_embed_url: m.document_embed_url || null,
            presentation_embed_url: m.presentation_embed_url || null,
            quiz_sheet_id: m.quiz_sheet_id?.trim() || null,
            quiz_sheet_name: m.quiz_sheet_name?.trim() || null,
            mission_id_slug: m.mission_id_slug?.trim() || null,
            content: m.content ?? null,
            position: idx,
            min_quiz_score: m.min_quiz_score !== "" && m.min_quiz_score != null ? Number(m.min_quiz_score) : null,
          })),
        missions: missions
          .filter((m) => m.mission_slug.trim() || m.title.trim())
          .map((m) => ({
            mission_slug: m.mission_slug.trim() || "mission",
            title: m.title.trim() || "Mission",
            context: m.context ?? "",
            objective: m.objective ?? "",
            instructions: (m.instructions ?? "").split("\n"),
            deliverable: m.deliverable ?? "",
          })),
      };

      if (isEdit) {
        const res = await fetch(`/api/admin/courses/${courseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Erreur");
        toast.success("Formation mise à jour");
        if (data.modulesQuizNotSaved) {
          toast.warning(
            "Les quiz par module (nom de feuille, score minimum) n'ont pas été enregistrés : la base n'a pas encore les colonnes nécessaires. Exécutez la migration SQL (quiz_sheet_name, min_quiz_score sur course_modules) puis ré-enregistrez la formation.",
            { duration: 8000 }
          );
        }
      } else if (proposeMode) {
        let finalCategoryId: string | null = payload.category_id;
        if (categoryChoice === "new" && newCategoryName.trim()) {
          const label = newCategoryName.trim();
          const slug = label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "nouvelle-categorie";
          const catRes = await fetch("/api/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label, slug, icon: "book" }),
          });
          const catData = await catRes.json();
          if (!catRes.ok) throw new Error(catData.error ?? "Erreur création catégorie");
          finalCategoryId = catData.category?.id ?? null;
        }
        const res = await fetch("/api/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, category_id: finalCategoryId, published: false }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
        toast.success("Formation proposée. Elle sera mise en ligne après validation par un administrateur.");
        router.push("/dashboard/courses");
        return;
      } else {
        const res = await fetch("/api/admin/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Erreur");
        toast.success("Formation créée");
        if (data.modulesQuizNotSaved) {
          toast.warning(
            "Les quiz par module n'ont pas été enregistrés : exécutez la migration SQL (quiz_sheet_name, min_quiz_score sur course_modules) puis ré-enregistrez la formation.",
            { duration: 8000 }
          );
        }
        router.push(`/dashboard/admin/courses/${data.id}/edit`);
        return;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Chargement...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
          <CardDescription>Titre, slug, description, catégorie et visibilité.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Introduction à Next.js" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex. intro-nextjs" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description de la formation" rows={3} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="duration">Durée</Label>
            <Input id="duration" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Ex. 2h" />
          </div>
          <div className="grid gap-2">
            <Label>Catégorie</Label>
            {proposeMode && (
              <div className="flex gap-4 mb-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={categoryChoice === "existing"}
                    onChange={() => setCategoryChoice("existing")}
                    className="size-4"
                  />
                  Catégorie existante
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={categoryChoice === "new"}
                    onChange={() => setCategoryChoice("new")}
                    className="size-4"
                  />
                  Proposer une nouvelle catégorie
                </label>
              </div>
            )}
            {(!proposeMode || categoryChoice === "existing") && (
              <Select value={categoryId ?? "none"} onValueChange={(v) => setCategoryId(v === "none" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {categories.map((cat) => {
                    const iconSvg = getCategoryIconSvg(cat.icon);
                    return (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          {iconSvg && <span className="inline-flex size-4 shrink-0 [&>svg]:size-4" dangerouslySetInnerHTML={{ __html: iconSvg }} />}
                          {cat.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            {proposeMode && categoryChoice === "new" && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="grid gap-2">
                  <Label className="text-xs">Nom de la catégorie</Label>
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Ex. E-commerce"
                  />
                </div>
                <p className="text-muted-foreground text-xs">La catégorie sera créée en attente et devra être approuvée par un administrateur. Le slug sera dérivé du nom.</p>
              </div>
            )}
          </div>
          {!proposeMode && (
            <>
              <div className="grid gap-2">
                <Label>Statut</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="published">Publié</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Auteur</Label>
                <Select value={createdBy ?? "__none__"} onValueChange={(v) => setCreatedBy(v === "__none__" ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un auteur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Non défini</SelectItem>
                    {authors.map((a) => (
                      <SelectItem key={a.clerk_id} value={a.clerk_id}>
                        {a.name || a.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {proposeMode && (
            <p className="text-muted-foreground rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/30">
              Votre formation sera enregistrée en attente. Un administrateur la mettra en ligne après validation.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fichier Google Sheet</CardTitle>
          <CardDescription>Un seul fichier Google Sheet pour toute la formation (quiz onboarding, modules, quiz final). Collez l’URL ou l’ID du fichier. Voir le template dans content-templates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>URL ou ID du fichier Google Sheet</Label>
            <Input
              value={quizSpreadsheetId}
              onChange={(e) => setQuizSpreadsheetId(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/... ou l'ID (ex. 1ABC...)"
            />
            <p className="text-xs text-muted-foreground">Collez l’URL complète du Sheet ou uniquement l’ID.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Onboarding</CardTitle>
          <CardDescription>Contenu affiché en début de formation (avant les modules).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Titre de l&apos;onboarding</Label>
            <Input value={onboardingTitle} onChange={(e) => setOnboardingTitle(e.target.value)} placeholder="Ex. Bienvenue dans la formation" />
          </div>
          <div className="grid gap-2">
            <Label>Contenu onboarding</Label>
            <Textarea value={onboardingContent} onChange={(e) => setOnboardingContent(e.target.value)} placeholder="Texte ou HTML de présentation..." rows={4} />
          </div>
          <div className="grid gap-2">
            <Label>Présentation (URL embed)</Label>
            <Input value={onboardingPresentationUrl} onChange={(e) => setOnboardingPresentationUrl(e.target.value)} placeholder="https://... (Google Slides, etc.)" />
          </div>
          <div className="grid gap-2">
            <Label>Quiz onboarding — Nom de la feuille</Label>
            <Input value={onboardingQuizSheetName} onChange={(e) => setOnboardingQuizSheetName(e.target.value)} placeholder="Ex. Onboarding (dans le même fichier Sheet que les modules)" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
          <CardDescription>Ordre = ordre d&apos;affichage. Un seul fichier Google Sheet par formation : indiquez le nom de la feuille (onglet) pour le quiz de chaque module.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {modules.map((mod, i) => (
            <Card key={i} className="border-dashed">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <GripVertical className="size-4 text-muted-foreground" />
                    Module {i + 1}
                  </CardTitle>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeModule(i)} className="text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label>Slug module</Label>
                    <Input value={mod.module_slug} onChange={(e) => updateModule(i, "module_slug", e.target.value)} placeholder="01-intro" />
                  </div>
                  <div className="grid gap-1">
                    <Label>Titre</Label>
                    <Input value={mod.title} onChange={(e) => updateModule(i, "title", e.target.value)} placeholder="Titre du module" />
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label>Description</Label>
                  <Input value={mod.description} onChange={(e) => updateModule(i, "description", e.target.value)} placeholder="Courte description" />
                </div>
                <div className="grid gap-1">
                  <Label>Durée</Label>
                  <Input value={mod.duration} onChange={(e) => updateModule(i, "duration", e.target.value)} placeholder="30 min" className="max-w-[120px]" />
                </div>
                <div className="grid gap-1">
                  <Label>URL vidéo (embed)</Label>
                  <Input value={mod.video_embed_url} onChange={(e) => updateModule(i, "video_embed_url", e.target.value)} placeholder="https://..." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label>Document (embed URL)</Label>
                    <Input value={mod.document_embed_url} onChange={(e) => updateModule(i, "document_embed_url", e.target.value)} placeholder="Optionnel" />
                  </div>
                  <div className="grid gap-1">
                    <Label>Présentation (embed URL)</Label>
                    <Input value={mod.presentation_embed_url} onChange={(e) => updateModule(i, "presentation_embed_url", e.target.value)} placeholder="Optionnel" />
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label>Nom de la feuille (quiz du module)</Label>
                  <Input value={mod.quiz_sheet_name} onChange={(e) => updateModule(i, "quiz_sheet_name", e.target.value)} placeholder="Ex. Module 01 ou 01-intro (nom de l’onglet dans le fichier quiz)" />
                </div>
                <div className="grid gap-1">
                  <Label>Score minimum au quiz pour valider (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={mod.min_quiz_score === "" ? "" : mod.min_quiz_score}
                    onChange={(e) => updateModule(i, "min_quiz_score", e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Ex. 80 (vide = pas d'exigence)"
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Mission liée (slug)</Label>
                  <Input value={mod.mission_id_slug} onChange={(e) => updateModule(i, "mission_id_slug", e.target.value)} placeholder="Optionnel" />
                </div>
                <div className="grid gap-1">
                  <Label>Contenu texte</Label>
                  <Textarea value={mod.content} onChange={(e) => updateModule(i, "content", e.target.value)} placeholder="Optionnel" rows={2} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button type="button" variant="outline" onClick={addModule} className="w-full">
            <Plus className="mr-2 size-4" />
            Ajouter un module
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Missions</CardTitle>
          <CardDescription>Missions pratiques après les modules (optionnel).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {missions.map((miss, i) => (
            <Card key={i} className="border-dashed">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Mission {i + 1}</CardTitle>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeMission(i)} className="text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label>Slug mission</Label>
                    <Input value={miss.mission_slug} onChange={(e) => updateMission(i, "mission_slug", e.target.value)} placeholder="01-mission" />
                  </div>
                  <div className="grid gap-1">
                    <Label>Titre</Label>
                    <Input value={miss.title} onChange={(e) => updateMission(i, "title", e.target.value)} placeholder="Titre" />
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label>Contexte</Label>
                  <Textarea value={miss.context} onChange={(e) => updateMission(i, "context", e.target.value)} rows={2} />
                </div>
                <div className="grid gap-1">
                  <Label>Objectif</Label>
                  <Input value={miss.objective} onChange={(e) => updateMission(i, "objective", e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <Label>Instructions (comme le contexte ou le livrable, sauts de ligne conservés)</Label>
                  <Textarea
                    value={miss.instructions}
                    onChange={(e) => updateMission(i, "instructions", e.target.value)}
                    placeholder="Décrivez les étapes à suivre..."
                    rows={5}
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Livrable</Label>
                  <Textarea value={miss.deliverable} onChange={(e) => updateMission(i, "deliverable", e.target.value)} placeholder="Décrivez le livrable attendu..." rows={4} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button type="button" variant="outline" onClick={addMission} className="w-full">
            <Plus className="mr-2 size-4" />
            Ajouter une mission
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quiz</CardTitle>
          <CardDescription>Feuilles (onglets) du fichier Google Sheet pour les quiz : nom de la feuille du quiz final, et optionnellement un autre fichier pour le quiz final.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Nom de la feuille (onglet) — Quiz final</Label>
            <Input value={finalQuizSheetName} onChange={(e) => setFinalQuizSheetName(e.target.value)} placeholder="Ex. Quiz final ou Test final" />
          </div>
          <div className="grid gap-2">
            <Label>Fichier quiz final différent (optionnel)</Label>
            <Input
              value={finalQuizSheetId}
              onChange={(e) => setFinalQuizSheetId(e.target.value)}
              placeholder="Vide = même fichier que ci-dessus. Sinon URL ou ID d'un autre Sheet."
            />
          </div>
          <div className="grid gap-2">
            <Label>Score minimum à atteindre au quiz final (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={finalQuizMinScore === "" ? "" : finalQuizMinScore}
              onChange={(e) => setFinalQuizMinScore(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Vide = pas d'exigence de score"
            />
            <p className="text-xs text-muted-foreground">Si vide, aucun score minimum n’est requis pour le quiz final.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Enregistrer" : "Créer"}
        </Button>
        {isEdit && (
          <Button
            type="button"
            variant="outline"
            disabled={exporting}
            onClick={async () => {
              if (!courseId) return;
              setExporting(true);
              try {
                const res = await fetch(`/api/admin/courses/${courseId}/export`);
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  toast.error(err.error ?? "Erreur lors de l'export");
                  return;
                }
                const json = await res.json();
                const slug = json?.course?.slug ?? "formation";
                const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `formation-${slug}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Formation exportée en JSON.");
              } catch {
                toast.error("Erreur lors de l'export");
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="mr-2 size-4" />}
            Exporter en JSON
          </Button>
        )}
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/admin/courses">Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
