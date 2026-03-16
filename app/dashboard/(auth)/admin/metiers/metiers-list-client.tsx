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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type Metier = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  course_slugs: string[];
};

type CourseOption = { slug: string; title: string };

export function MetiersListClient() {
  const [metiers, setMetiers] = useState<Metier[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [courseSlugs, setCourseSlugs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMetiers = searchQuery.trim()
    ? metiers.filter(
        (m) =>
          m.label.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          m.slug.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          (m.description ?? "").toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : metiers;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metiersRes, coursesRes] = await Promise.all([
        fetch("/api/admin/metiers"),
        fetch("/api/admin/courses"),
      ]);
      if (!metiersRes.ok) throw new Error("Impossible de charger les métiers");
      const metiersData = await metiersRes.json();
      setMetiers(metiersData.metiers ?? []);

      if (coursesRes.ok) {
        const coursesData = await coursesRes.json();
        const list = (coursesData.courses ?? []).map((c: { slug: string; title: string }) => ({
          slug: c.slug,
          title: c.title,
        }));
        setCourses(list);
      } else {
        setCourses([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setSlug("");
    setLabel("");
    setDescription("");
    setCourseSlugs([]);
    setDialogOpen(true);
  };

  const openEdit = (m: Metier) => {
    setEditingId(m.id);
    setSlug(m.slug);
    setLabel(m.label);
    setDescription(m.description ?? "");
    setCourseSlugs(m.course_slugs ?? []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const slugNorm = slug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "metier";
    const labelVal = label.trim() || slugNorm;
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/metiers/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: slugNorm,
            label: labelVal,
            description: description.trim() || null,
            course_slugs: courseSlugs,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Erreur lors de la mise à jour");
        }
        toast.success("Métier mis à jour");
      } else {
        const res = await fetch("/api/admin/metiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: slugNorm,
            label: labelVal,
            description: description.trim() || null,
            course_slugs: courseSlugs,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Erreur lors de la création");
        }
        toast.success("Métier créé");
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/metiers/${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur lors de la suppression");
      }
      toast.success("Métier supprimé");
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeleting(false);
    }
  };

  const toggleCourse = (courseSlug: string) => {
    setCourseSlugs((prev) =>
      prev.includes(courseSlug) ? prev.filter((s) => s !== courseSlug) : [...prev, courseSlug]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Chargement des parcours métiers...
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
            type="search"
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
              Nouveau parcours
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Modifier le métier" : "Nouveau métier"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="metier-label">Nom du métier</Label>
                <Input
                  id="metier-label"
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    if (!editingId) setSlug(e.target.value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                  }}
                  placeholder="ex. Chef de projet"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="metier-slug">Slug</Label>
                <Input
                  id="metier-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="chef-de-projet"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="metier-desc">Description (optionnel)</Label>
                <Textarea
                  id="metier-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Attendus de compétences pour ce rôle..."
                  rows={2}
                />
              </div>
              <div className="grid gap-2">
                <Label>Formations requises (objectifs sur l&apos;arbre de compétences)</Label>
                <ScrollArea className="h-48 rounded-md border p-2">
                  <div className="space-y-2">
                    {courses.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Aucune formation disponible.</p>
                    ) : (
                      courses.map((c) => (
                        <label key={c.slug} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={courseSlugs.includes(c.slug)}
                            onCheckedChange={() => toggleCourse(c.slug)}
                          />
                          <span className="truncate">{c.title}</span>
                          <span className="text-muted-foreground text-xs">({c.slug})</span>
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
                {courseSlugs.length > 0 && (
                  <p className="text-muted-foreground text-xs">
                    {courseSlugs.length} formation(s) sélectionnée(s)
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {editingId ? "Enregistrer" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {metiers.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun parcours métier. Créez-en un.</p>
      ) : filteredMetiers.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun résultat pour « {searchQuery} ».</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Métier</TableHead>
                <TableHead className="min-w-[120px]">Slug</TableHead>
                <TableHead className="min-w-[200px]">Formations requises</TableHead>
                <TableHead className="text-right w-32 shrink-0">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMetiers.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div>
                    <span className="font-medium">{m.label}</span>
                    {m.description ? (
                      <p className="text-muted-foreground text-xs line-clamp-1">{m.description}</p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{m.slug}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(m.course_slugs ?? []).length === 0 ? (
                      <span className="text-muted-foreground text-sm">—</span>
                    ) : (
                      (m.course_slugs ?? []).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(m)} title="Modifier">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(m.id)}
                    className="text-destructive hover:text-destructive"
                    title="Supprimer"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce métier ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les assignations utilisateur pour ce métier seront également supprimées. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground">
              {deleting ? <Loader2 className="size-4 animate-spin" /> : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
