"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Loader2, Plus, Pencil, Trash2, Eye, Search, FileDown } from "lucide-react";
import { toast } from "sonner";

type Category = { slug: string; label: string; icon: string } | null;
type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  duration: string;
  published: boolean;
  added_at: string;
  category_id: string | null;
  categories: Category;
  author_name?: string | null;
  author_email?: string | null;
  completed_count?: number;
};

export function AdminCoursesListClient() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.categories?.label?.toLowerCase().includes(q))
    );
  }, [courses, search]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/courses");
      if (!res.ok) throw new Error("Impossible de charger les formations");
      const data = await res.json();
      setCourses(data.courses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Supprimer la formation « ${title} » ?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/courses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur suppression");
      toast.success("Formation supprimée");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Chargement des formations...
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-destructive text-sm">{error}</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="Rechercher par titre, slug ou catégorie…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/dashboard/admin/courses/new">
              <Plus className="mr-2 size-4" />
              Nouvelle formation
            </Link>
          </Button>
        </div>
      </div>
      {courses.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune formation. Créez-en une.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Titre</TableHead>
                <TableHead className="min-w-[100px]">Slug</TableHead>
                <TableHead className="min-w-[100px] shrink-0">Catégorie</TableHead>
                <TableHead className="min-w-[140px]">Auteur</TableHead>
                <TableHead className="min-w-[90px] shrink-0">Statut</TableHead>
                <TableHead className="text-center w-24 shrink-0">Terminée par</TableHead>
                <TableHead className="min-w-[80px] shrink-0">Durée</TableHead>
                <TableHead className="text-right w-32 shrink-0">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCourses.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.slug}</TableCell>
                  <TableCell>
                    {c.categories ? (
                      <Badge variant="outline">{c.categories.label}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-sm">
                      {c.author_name || c.author_email || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.published ? "default" : "secondary"}>
                      {c.published ? "Publié" : "Brouillon"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">
                    {c.completed_count ?? 0} personne{(c.completed_count ?? 0) !== 1 ? "s" : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.duration}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild title="Prévisualiser">
                      <Link href={`/dashboard/courses/${c.slug}`} target="_blank" rel="noopener noreferrer">
                        <Eye className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Exporter en JSON"
                      disabled={exportingId === c.id}
                      onClick={async () => {
                        setExportingId(c.id);
                        try {
                          const res = await fetch(`/api/admin/courses/${c.id}/export`);
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            toast.error(err.error ?? "Erreur lors de l'export");
                            return;
                          }
                          const json = await res.json();
                          const slug = json?.course?.slug ?? c.slug;
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
                          setExportingId(null);
                        }
                      }}
                    >
                      {exportingId === c.id ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" asChild title="Modifier">
                      <Link href={`/dashboard/admin/courses/${c.id}/edit`}>
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      title="Supprimer"
                      onClick={() => handleDelete(c.id, c.title)}
                      disabled={deletingId === c.id}
                    >
                      {deletingId === c.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
