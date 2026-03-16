"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Trash2, Search, Eye } from "lucide-react";
import { toast } from "sonner";

type UserAggregate = {
  email: string;
  modulesCompleted: number;
  coursesCompleted: number;
  coursesCreated: number;
  lastActivityAt: string | null;
};

export function UsersListClient() {
  const [users, setUsers] = useState<UserAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const router = useRouter();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Impossible de charger les utilisateurs");
      const data = (await res.json()) as { users: UserAggregate[] };
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (e: React.MouseEvent, userEmail: string) => {
    e.stopPropagation();
    if (!confirm(`Supprimer l’utilisateur ${userEmail} de la base ?`)) return;
    setDeletingEmail(userEmail);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userEmail)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur suppression");
      toast.success("Utilisateur supprimé de la base");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeletingEmail(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.email.toLowerCase().includes(q));
  }, [users, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="Rechercher par email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {loading && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Chargement des statistiques...
          </div>
        )}
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </Card>
      )}

      {!loading && !error && filteredUsers.length === 0 && (
        <p className="text-muted-foreground text-sm">Aucun utilisateur trouvé.</p>
      )}

      {!error && filteredUsers.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Email</TableHead>
                <TableHead className="text-center w-24 shrink-0">Modules complétés</TableHead>
                <TableHead className="text-center w-28 shrink-0">Formations complétées</TableHead>
                <TableHead className="text-center w-24 shrink-0">Formations créées</TableHead>
                <TableHead className="min-w-[140px]">Dernière activité</TableHead>
                <TableHead className="text-right w-32 shrink-0">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow
                  key={user.email}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/admin/users/${encodeURIComponent(user.email)}`)}
                >
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{user.modulesCompleted}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{user.coursesCompleted}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{user.coursesCreated ?? 0}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {user.lastActivityAt
                      ? new Date(user.lastActivityAt).toLocaleString("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short"
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" asChild title="Voir la fiche">
                      <Link href={`/dashboard/admin/users/${encodeURIComponent(user.email)}`}>
                        <Eye className="size-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" asChild title="Modifier">
                      <Link href={`/dashboard/admin/users/${encodeURIComponent(user.email)}`}>
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      title="Supprimer"
                      onClick={(e) => handleDelete(e, user.email)}
                      disabled={deletingEmail === user.email}
                    >
                      {deletingEmail === user.email ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
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

