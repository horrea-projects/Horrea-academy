"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, Users } from "lucide-react";

type Category = { slug: string; label: string; icon: string } | null;
type CourseRow = {
  id: string;
  slug: string;
  title: string;
  duration: string;
  published: boolean;
  added_at: string;
  categories: Category;
};

type UserAggregate = {
  email: string;
  modulesCompleted: number;
  coursesCompleted: number;
  lastActivityAt: string | null;
};

const RECENT_COUNT = 5;
const ACTIVE_COUNT = 5;

export function AdminDashboardClient() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [users, setUsers] = useState<UserAggregate[]>([]);
  const [stats, setStats] = useState<{
    totalCourses: number;
    categoriesCount: number;
    totalUsers: number;
    avgCoursesCompleted: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [coursesRes, usersRes, categoriesRes] = await Promise.all([
          fetch("/api/admin/courses"),
          fetch("/api/admin/users"),
          fetch("/api/admin/categories"),
        ]);
        if (!coursesRes.ok) throw new Error("Erreur chargement formations");
        if (!usersRes.ok) throw new Error("Erreur chargement utilisateurs");
        if (!categoriesRes.ok) throw new Error("Erreur chargement catégories");
        const coursesData = await coursesRes.json();
        const usersData = await usersRes.json();
        const categoriesData = await categoriesRes.json();
        if (!cancelled) {
          const allCourses = (coursesData.courses ?? []) as CourseRow[];
          const allUsers = (usersData.users ?? []) as UserAggregate[];

          setCourses(allCourses.slice(0, RECENT_COUNT));
          const sorted = allUsers.slice().sort((a, b) => {
            const aDate = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
            const bDate = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
            if (bDate !== aDate) return bDate - aDate;
            return (b.modulesCompleted + b.coursesCompleted) - (a.modulesCompleted + a.coursesCompleted);
          });
          setUsers(sorted.slice(0, ACTIVE_COUNT));

          const totalCourses = allCourses.length;
          const categoriesCount = (categoriesData.categories ?? []).length;
          const totalUsers = allUsers.length;
          const totalCoursesCompleted = allUsers.reduce((sum, u) => sum + u.coursesCompleted, 0);
          setStats({
            totalCourses,
            categoriesCount,
            totalUsers,
            avgCoursesCompleted: totalUsers ? totalCoursesCompleted / totalUsers : 0,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Chargement du tableau de bord...
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Nombre de formations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalCourses}</p>
              <p className="text-muted-foreground text-xs">
                dans {stats.categoriesCount} catégorie{stats.categoriesCount > 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs formés</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
              <p className="text-muted-foreground text-xs">Comptes ayant une activité de formation</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Formations complétées / utilisateur</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.avgCoursesCompleted.toFixed(1)}</p>
              <p className="text-muted-foreground text-xs">Moyenne de formations terminées par utilisateur</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BookOpen className="size-4" />
            Formations récentes
          </CardTitle>
          <Link
            href="/dashboard/admin/courses"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Voir tout
          </Link>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune formation.</p>
          ) : (
            <ul className="space-y-2">
              {courses.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/admin/courses/${c.id}/edit`}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-muted/50"
                  >
                    <span className="font-medium truncate">{c.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.categories && (
                        <Badge variant="secondary" className="text-xs">
                          {c.categories.label}
                        </Badge>
                      )}
                      {c.published ? (
                        <Badge variant="default" className="text-xs">Publié</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Brouillon</Badge>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="size-4" />
            Utilisateurs les plus actifs
          </CardTitle>
          <Link
            href="/dashboard/admin/users"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Voir tout
          </Link>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun utilisateur avec activité.</p>
          ) : (
            <ul className="space-y-2">
              {users.map((u) => (
                <li key={u.email}>
                  <Link
                    href={`/dashboard/admin/users/${encodeURIComponent(u.email)}`}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-muted/50"
                  >
                    <span className="truncate text-sm">{u.email}</span>
                    <div className="flex items-center gap-2 shrink-0 text-muted-foreground text-xs">
                      <span>{u.modulesCompleted} modules</span>
                      <span>{u.coursesCompleted} formations</span>
                      {u.lastActivityAt && (
                        <span>
                          {new Date(u.lastActivityAt).toLocaleDateString("fr-FR", { dateStyle: "short" })}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
