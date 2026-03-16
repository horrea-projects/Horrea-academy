"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getCategoryIconSvg } from "@/lib/category-icons";
import Link from "next/link";
import { Loader2, Plus, Pencil, Trash2, Eye, Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { CategoryIconPicker } from "./category-icon-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Category = { id: string; slug: string; label: string; icon: string; parent_id?: string | null; created_by?: string | null; approved?: boolean; status?: string; author_email?: string | null; course_count?: number; completed_users_count?: number; onboarding_title?: string | null; onboarding_content?: string | null; onboarding_presentation_embed_url?: string | null; onboarding_quiz_sheet_id?: string | null; onboarding_quiz_sheet_name?: string | null };
type AuthorOption = { clerk_id: string; email: string; name?: string };

export function CategoriesListClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("book");
  const [onboardingTitle, setOnboardingTitle] = useState("");
  const [onboardingContent, setOnboardingContent] = useState("");
  const [onboardingPresentationUrl, setOnboardingPresentationUrl] = useState("");
  const [onboardingQuizSheetId, setOnboardingQuizSheetId] = useState("");
  const [onboardingQuizSheetName, setOnboardingQuizSheetName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [createdBy, setCreatedBy] = useState<string | null>(null);
  const [authors, setAuthors] = useState<AuthorOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const filteredCategories = searchQuery.trim()
    ? categories.filter(
        (c) =>
          c.label.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          c.slug.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : categories;
  function isDescendantOf(catId: string, ancestorId: string): boolean {
    if (catId === ancestorId) return true;
    const cat = categoryById[catId];
    if (!cat?.parent_id) return false;
    return isDescendantOf(cat.parent_id, ancestorId);
  }
  function parentLabel(cat: Category, depth = 0): string {
    const prefix = depth ? "— ".repeat(depth) : "";
    return prefix + cat.label;
  }
  function buildParentOptions(list: Category[], depth = 0): { id: string; label: string }[] {
    const result: { id: string; label: string }[] = [];
    for (const c of list) {
      if (c.id === editingId) continue;
      if (editingId && isDescendantOf(c.id, editingId)) continue;
      result.push({ id: c.id, label: parentLabel(c, depth) });
      const children = categories.filter((x) => x.parent_id === c.id);
      if (children.length) result.push(...buildParentOptions(children, depth + 1));
    }
    return result;
  }
  const NO_PARENT = "__none__";
  const flatParentOptions = [{ id: NO_PARENT, label: "— Aucune (racine)" }, ...buildParentOptions(categories.filter((c) => !c.parent_id))];

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/categories");
      if (!res.ok) throw new Error("Impossible de charger les catégories");
      const data = await res.json();
      setCategories(data.categories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (dialogOpen) {
      fetch("/api/admin/authors")
        .then((r) => r.json())
        .then((d) => setAuthors(d.users ?? []))
        .catch(() => setAuthors([]));
    }
  }, [dialogOpen]);

  const openCreate = () => {
    setEditingId(null);
    setSlug("");
    setLabel("");
    setIcon("book");
    setParentId(null);
    setStatus("draft");
    setCreatedBy(null);
    setOnboardingTitle("");
    setOnboardingContent("");
    setOnboardingPresentationUrl("");
    setOnboardingQuizSheetId("");
    setOnboardingQuizSheetName("");
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id);
    setSlug(c.slug);
    setLabel(c.label);
    setIcon((c.icon && c.icon.trim()) || "book");
    setParentId(c.parent_id ?? null);
    setStatus(c.status ?? (c.approved === false ? "pending" : "published"));
    setCreatedBy(c.created_by ?? null);
    setOnboardingTitle(c.onboarding_title ?? "");
    setOnboardingContent(c.onboarding_content ?? "");
    setOnboardingPresentationUrl(c.onboarding_presentation_embed_url ?? "");
    setOnboardingQuizSheetId(c.onboarding_quiz_sheet_id ?? "");
    setOnboardingQuizSheetName(c.onboarding_quiz_sheet_name ?? "");
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/categories/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: slug.trim(),
            label: label.trim(),
            icon: icon.trim() || "book",
            parent_id: parentId || null,
            status,
            created_by: createdBy,
            onboarding_title: onboardingTitle.trim() || null,
            onboarding_content: onboardingContent.trim() || null,
            onboarding_presentation_embed_url: onboardingPresentationUrl.trim() || null,
            onboarding_quiz_sheet_id: onboardingQuizSheetId.trim() || null,
            onboarding_quiz_sheet_name: onboardingQuizSheetName.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erreur");
        toast.success("Catégorie mise à jour");
      } else {
        const res = await fetch("/api/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: slug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "categorie",
            label: label.trim() || slug,
            icon: icon.trim() || "book",
            parent_id: parentId || null,
            status,
            created_by: createdBy,
            onboarding_title: onboardingTitle.trim() || null,
            onboarding_content: onboardingContent.trim() || null,
            onboarding_presentation_embed_url: onboardingPresentationUrl.trim() || null,
            onboarding_quiz_sheet_id: onboardingQuizSheetId.trim() || null,
            onboarding_quiz_sheet_name: onboardingQuizSheetName.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erreur");
        toast.success("Catégorie créée");
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (s: string) => (s === "published" ? "Publié" : s === "draft" ? "Brouillon" : "En attente");

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/categories/${deleteId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      toast.success("Catégorie supprimée");
      setDeleteId(null);
      load();
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
        Chargement...
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="Rechercher par libellé ou slug…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              Nouvelle catégorie
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>{editingId ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-2">
                <Label htmlFor="cat-label">Libellé</Label>
                <Input
                  id="cat-label"
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    if (!editingId && !slug) setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                  }}
                  placeholder="Ex. Shopify"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cat-slug">Slug</Label>
                <Input
                  id="cat-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="shopify"
                />
              </div>
              <CategoryIconPicker value={icon} onChange={setIcon} />
              <div className="grid gap-2">
                <Label>Catégorie parente</Label>
                <Select
                  value={parentId ?? NO_PARENT}
                  onValueChange={(v) => setParentId(v === NO_PARENT ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune (racine)" />
                  </SelectTrigger>
                  <SelectContent>
                    {flatParentOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 border-t pt-4">
                <Label className="text-muted-foreground text-xs uppercase">Onboarding (optionnel)</Label>
                <div className="grid gap-2">
                  <Label className="text-xs">Titre</Label>
                  <Input value={onboardingTitle} onChange={(e) => setOnboardingTitle(e.target.value)} placeholder="Ex. Bienvenue" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Contenu</Label>
                  <Textarea value={onboardingContent} onChange={(e) => setOnboardingContent(e.target.value)} placeholder="Texte ou HTML" rows={2} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Présentation (URL embed)</Label>
                  <Input value={onboardingPresentationUrl} onChange={(e) => setOnboardingPresentationUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Quiz onboarding — ID Google Sheet</Label>
                  <Input value={onboardingQuizSheetId} onChange={(e) => setOnboardingQuizSheetId(e.target.value)} placeholder="ID du Sheet (optionnel)" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Quiz onboarding — Nom de la feuille</Label>
                  <Input value={onboardingQuizSheetName} onChange={(e) => setOnboardingQuizSheetName(e.target.value)} placeholder="Ex. Onboarding (optionnel)" />
                </div>
              </div>
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
              </div>
              <DialogFooter className="shrink-0 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : editingId ? "Enregistrer" : "Créer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {categories.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune catégorie. Créez-en une.</p>
      ) : filteredCategories.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun résultat pour « {searchQuery} ».</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 shrink-0">Icône</TableHead>
                <TableHead className="min-w-[120px]">Libellé</TableHead>
                <TableHead className="min-w-[100px]">Slug</TableHead>
                <TableHead className="min-w-[100px]">Parent</TableHead>
                <TableHead className="text-center w-20 shrink-0">Formations</TableHead>
                <TableHead className="text-center w-24 shrink-0">Complétée par</TableHead>
                <TableHead className="min-w-[140px]">Auteur</TableHead>
                <TableHead className="min-w-[90px] shrink-0">Statut</TableHead>
                <TableHead className="text-right w-32 shrink-0">Actions</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {filteredCategories.map((c) => {
              const parent = c.parent_id ? categoryById[c.parent_id] : null;
              const svg = getCategoryIconSvg(c.icon);
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    {svg ? (
                      <span
                        className="inline-flex size-8 items-center justify-center [&>svg]:size-5 [&>svg]:text-foreground"
                        dangerouslySetInnerHTML={{ __html: svg }}
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{c.label}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.slug}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{parent ? parent.label : "—"}</TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">{c.course_count ?? 0}</TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">{c.completed_users_count ?? 0} personne{(c.completed_users_count ?? 0) !== 1 ? "s" : ""}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.author_email ?? c.created_by ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "published" ? "default" : "secondary"}>
                      {statusLabel(c.status ?? (c.approved === false ? "pending" : "published"))}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild title="Prévisualiser">
                      <Link href={`/dashboard/courses/category/${c.slug}`} target="_blank" rel="noopener noreferrer">
                        <Eye className="size-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Modifier">
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(c.id)}
                      title="Supprimer"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la catégorie</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les formations liées à cette catégorie n&apos;auront plus de catégorie. Les sous-catégories devront être réassignées ou supprimées avant de pouvoir supprimer une catégorie parente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
