"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CourseListItem, Category } from "@/lib/content";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GraduationCapIcon, SearchIcon, ShoppingBag, FolderTree, Send, RotateCcw } from "lucide-react";
import { getCategoryIconSvg } from "@/lib/category-icons";
import { googleSlidesToEmbedUrl } from "@/lib/google-embed";
import { ModuleQuiz } from "./[slug]/modules/[moduleId]/module-quiz";

function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const svg = getCategoryIconSvg(icon);
  if (svg) {
    return (
      <span
        className={className ? `inline-flex [&>svg]:size-full [&>svg]:shrink-0 ${className}` : "inline-flex [&>svg]:size-full [&>svg]:shrink-0"}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  return <ShoppingBag className={className} />;
}

function CategoriesPopover({
  allCategoriesForTree,
  categoryFilterSlug,
}: {
  allCategoriesForTree: CategoryWithParent[];
  categoryFilterSlug: string | null;
}) {
  const [open, setOpen] = useState(false);
  const roots = useMemo(
    () => allCategoriesForTree.filter((c) => !c.parent_id).sort((a, b) => a.label.localeCompare(b.label, "fr")),
    [allCategoriesForTree]
  );
  const getChildren = useCallback(
    (parentId: string) =>
      allCategoriesForTree
        .filter((c) => c.parent_id === parentId)
        .sort((a, b) => a.label.localeCompare(b.label, "fr")),
    [allCategoriesForTree]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Card
          className={`h-full cursor-pointer transition-colors hover:border-primary/50 ${
            !categoryFilterSlug ? "border-primary bg-primary/5" : ""
          }`}
        >
          <CardContent className="flex flex-col items-center justify-center gap-2 py-6">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <FolderTree className="text-muted-foreground size-6" />
            </div>
            <span className="font-medium">Toutes les catégories</span>
          </CardContent>
        </Card>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b px-3 py-2">
          <p className="text-muted-foreground text-sm font-medium">Choisir une catégorie</p>
        </div>
        <ScrollArea className="max-h-[min(60vh,400px)]">
          <nav className="flex flex-col gap-0.5 p-2">
            {roots.map((root) => {
              const children = getChildren(root.id);
              return (
                <div key={root.id} className="flex flex-col gap-0.5">
                  <Link
                    href={`/dashboard/courses/category/${root.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center">
                      <CategoryIcon icon={root.icon} className="size-4" />
                    </span>
                    {root.label}
                  </Link>
                  {children.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/dashboard/courses/category/${sub.slug}`}
                      onClick={() => setOpen(false)}
                      className="text-muted-foreground flex items-center gap-2 rounded-md py-1.5 pl-8 pr-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center">
                        <CategoryIcon icon={sub.icon} className="size-3.5" />
                      </span>
                      {sub.label}
                    </Link>
                  ))}
                </div>
              );
            })}
          </nav>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

type SortOption = "date" | "a-z" | "z-a";

export type CategoryPageContext = {
  label: string;
  icon: string;
  onboarding_title?: string | null;
  onboarding_content?: string | null;
  onboarding_presentation_embed_url?: string | null;
  onboarding_quiz_sheet_id?: string | null;
  onboarding_quiz_sheet_name?: string | null;
  isPreview?: boolean;
};

type CourseProgress = {
  completedModuleIds: string[];
  completedMissionIds: string[];
  pendingMissionIds?: string[];
  quizScores?: Record<string, number>;
};

type CategoryWithParent = Category & { parent_id?: string | null };
type MetierWithFormationsLite = { id: string; slug: string; label: string; course_slugs: string[] };

type CatalogueClientProps = {
  courses: CourseListItem[];
  categories: Category[];
  /** Toutes les catégories avec parent_id pour la popover "Toutes". */
  allCategoriesForTree?: CategoryWithParent[];
  categorySlug?: string | null;
  /** Quand défini, affiche la page catégorie : titre, contenu, présentation, puis les formations. */
  categoryPage?: CategoryPageContext | null;
  /** Progression par formation (slug → progression) pour afficher sur les cartes. */
  progressByCourse?: Record<string, CourseProgress>;
  /** Sous-catégories de la catégorie courante (affichées en cartes sur la page catégorie). */
  subcategories?: Category[];
  /** Parcours métiers disponibles + leurs formations (pour assignation/filtre). */
  metiersWithFormations?: MetierWithFormationsLite[];
  /** Parcours métiers assignés à l'utilisateur connecté. */
  assignedMetierIds?: string[];
};

export function CatalogueClient({
  courses: initialCourses,
  categories,
  allCategoriesForTree = [],
  categorySlug,
  categoryPage,
  progressByCourse = {},
  subcategories = [],
  metiersWithFormations = [],
  assignedMetierIds = [],
}: CatalogueClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [categoryFilterSlug, setCategoryFilterSlug] = useState<string | null>(categorySlug ?? null);
  const [metierFilterId, setMetierFilterId] = useState<string>("all");

  const hasCategoryOnboarding =
    !!categoryPage &&
    !!(categoryPage.onboarding_title || categoryPage.onboarding_content || categoryPage.onboarding_presentation_embed_url ||
      (categoryPage.onboarding_quiz_sheet_id && categoryPage.onboarding_quiz_sheet_name));
  const onboardingStorageKey =
    categorySlug ? `horrea_onboarding_cat_${categorySlug}` : "";
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [onboardingHydrated, setOnboardingHydrated] = useState(false);
  const [onboardingQuizSubmitted, setOnboardingQuizSubmitted] = useState(false);
  const [onboardingQuizResetKey, setOnboardingQuizResetKey] = useState(0);
  const [onboardingQuizStats, setOnboardingQuizStats] = useState<{ attempts: number; bestScore: number } | null>(null);

  useEffect(() => {
    setCategoryFilterSlug(categorySlug ?? null);
  }, [categorySlug]);

  useEffect(() => {
    setMetierFilterId((prev) => {
      if (prev === "all") return "all";
      if (metiersWithFormations.some((m) => m.id === prev)) return prev;
      return "all";
    });
  }, [metiersWithFormations]);

  useEffect(() => {
    if (typeof window === "undefined" || !onboardingStorageKey) return;
    setOnboardingDone(localStorage.getItem(onboardingStorageKey) === "1");
    setOnboardingHydrated(true);
    const statsKey = `horrea_onboarding_cat_${categorySlug}_stats`;
    try {
      const raw = localStorage.getItem(statsKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { attempts?: number; bestScore?: number };
        if (typeof parsed.attempts === "number" && typeof parsed.bestScore === "number") {
          setOnboardingQuizStats({ attempts: parsed.attempts, bestScore: parsed.bestScore });
        }
      }
    } catch {
      // ignore
    }
  }, [onboardingStorageKey, categorySlug]);

  const saveOnboardingQuizStats = useCallback((score: number) => {
    if (!categorySlug) return;
    const statsKey = `horrea_onboarding_cat_${categorySlug}_stats`;
    try {
      const raw = localStorage.getItem(statsKey);
      const prev = raw ? (JSON.parse(raw) as { attempts?: number; bestScore?: number }) : { attempts: 0, bestScore: 0 };
      const attempts = (prev.attempts ?? 0) + 1;
      const bestScore = Math.max(prev.bestScore ?? 0, score);
      const next = { attempts, bestScore };
      localStorage.setItem(statsKey, JSON.stringify(next));
      setOnboardingQuizStats(next);
    } catch {
      // ignore
    }
  }, [categorySlug]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => {
      m.set(c.id, c);
      m.set(c.slug, c);
    });
    return m;
  }, [categories]);

  const allowedCourseSlugs = useMemo(() => {
    if (categoryPage) return null;
    if (metierFilterId === "all") return null;
    const metier = metiersWithFormations.find((m) => m.id === metierFilterId);
    return new Set(metier?.course_slugs ?? []);
  }, [categoryPage, metierFilterId, metiersWithFormations]);

  const metierScopedCourses = useMemo(() => {
    if (!allowedCourseSlugs) return initialCourses;
    return initialCourses.filter((c) => allowedCourseSlugs.has(c.slug));
  }, [initialCourses, allowedCourseSlugs]);

  const visibleCategoryKeys = useMemo(() => {
    const keys = new Set<string>();
    metierScopedCourses.forEach((c) => {
      if (c.categoryId) keys.add(c.categoryId);
    });
    return keys;
  }, [metierScopedCourses]);

  const visibleRootCategories = useMemo(
    () => categories.filter((cat) => visibleCategoryKeys.has(cat.id) || visibleCategoryKeys.has(cat.slug)),
    [categories, visibleCategoryKeys]
  );

  const visibleSubcategories = useMemo(
    () => subcategories.filter((cat) => visibleCategoryKeys.has(cat.id) || visibleCategoryKeys.has(cat.slug)),
    [subcategories, visibleCategoryKeys]
  );

  const visibleAllCategoriesForTree = useMemo(() => {
    if (!allCategoriesForTree.length) return [];
    if (!allowedCourseSlugs) return allCategoriesForTree;

    const byId = new Map(allCategoriesForTree.map((c) => [c.id, c]));
    const keep = new Set<string>();

    allCategoriesForTree.forEach((cat) => {
      const matches = visibleCategoryKeys.has(cat.id) || visibleCategoryKeys.has(cat.slug);
      if (!matches) return;
      keep.add(cat.id);
      let parentId = cat.parent_id ?? null;
      while (parentId) {
        keep.add(parentId);
        parentId = byId.get(parentId)?.parent_id ?? null;
      }
    });

    return allCategoriesForTree.filter((cat) => keep.has(cat.id));
  }, [allCategoriesForTree, allowedCourseSlugs, visibleCategoryKeys]);

  const handleCategoryFilterChange = (value: string) => {
    const slug = value === "all" ? null : value;
    setCategoryFilterSlug(slug);
    if (slug) router.push(`/dashboard/courses/category/${slug}`);
    else router.push("/dashboard/courses");
  };

  const filteredCourses = useMemo(() => {
    let list = metierScopedCourses;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.descriptionShort ?? "").toLowerCase().includes(q)
      );
    }
    if (categoryFilterSlug) {
      const cat = categoryMap.get(categoryFilterSlug);
      list = list.filter(
        (c) =>
          c.categoryId === categoryFilterSlug ||
          (cat && c.categoryId === cat.id)
      );
    }
    const sorted = [...list];
    if (sortBy === "a-z") sorted.sort((a, b) => a.title.localeCompare(b.title, "fr"));
    if (sortBy === "z-a") sorted.sort((a, b) => b.title.localeCompare(a.title, "fr"));
    if (sortBy === "date") {
      sorted.sort((a, b) => {
        const da = a.addedAt ? new Date(a.addedAt).getTime() : 0;
        const db = b.addedAt ? new Date(b.addedAt).getTime() : 0;
        return db - da;
      });
    }
    return sorted;
  }, [metierScopedCourses, search, sortBy, categoryFilterSlug, categoryMap]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {categoryPage ? (
        <section className="space-y-6">
          {hasCategoryOnboarding && onboardingHydrated && !onboardingDone ? (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary [&>span]:size-8">
                    <CategoryIcon icon={categoryPage.icon} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold tracking-tight">{categoryPage.label}</h1>
                      {categoryPage.isPreview && (
                        <Badge variant="secondary" className="font-normal">Prévisualisation</Badge>
                      )}
                    </div>
                    {categoryPage.onboarding_title && (
                      <p className="text-muted-foreground mt-1">{categoryPage.onboarding_title}</p>
                    )}
                  </div>
                </div>
              </div>
              {categoryPage.onboarding_content && (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-muted/30 p-4"
                  dangerouslySetInnerHTML={{ __html: categoryPage.onboarding_content }}
                />
              )}
              {categoryPage.onboarding_presentation_embed_url && (
                <div className="overflow-hidden rounded-lg border bg-muted">
                  <div className="aspect-video w-full">
                    <iframe
                      src={googleSlidesToEmbedUrl(categoryPage.onboarding_presentation_embed_url)}
                      title={`Présentation ${categoryPage.label}`}
                      allowFullScreen
                      className="h-full w-full"
                    />
                  </div>
                </div>
              )}
              {categoryPage.onboarding_quiz_sheet_id && categoryPage.onboarding_quiz_sheet_name && categorySlug && (
                <ModuleQuiz
                  key={onboardingQuizResetKey}
                  courseSlug={`category:${categorySlug}`}
                  moduleId="onboarding"
                  quizSpreadsheetId={categoryPage.onboarding_quiz_sheet_id}
                  quizSheetName={categoryPage.onboarding_quiz_sheet_name}
                  onSubmitted={(score) => {
                    setOnboardingQuizSubmitted(true);
                    saveOnboardingQuizStats(score);
                  }}
                  embedActions={false}
                />
              )}
              <div className="flex justify-end pt-4">
                {categoryPage.onboarding_quiz_sheet_id && categoryPage.onboarding_quiz_sheet_name && onboardingQuizSubmitted ? (
                  <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-muted/30 px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setOnboardingQuizSubmitted(false);
                        setOnboardingQuizResetKey((k) => k + 1);
                      }}
                    >
                      <RotateCcw className="size-3.5" />
                      Refaire le quiz
                    </Button>
                    <Button
                      onClick={() => {
                        if (onboardingStorageKey) {
                          localStorage.setItem(onboardingStorageKey, "1");
                          setOnboardingDone(true);
                        }
                      }}
                    >
                      Passer l'onboarding
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      if (onboardingStorageKey) {
                        localStorage.setItem(onboardingStorageKey, "1");
                        setOnboardingDone(true);
                      }
                    }}
                  >
                    Passer l'onboarding
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary [&>span]:size-8">
                    <CategoryIcon icon={categoryPage.icon} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold tracking-tight">{categoryPage.label}</h1>
                      {categoryPage.isPreview && (
                        <Badge variant="secondary" className="font-normal">Prévisualisation</Badge>
                      )}
                    </div>
                    {categoryPage.onboarding_title && !hasCategoryOnboarding && (
                      <p className="text-muted-foreground mt-1">{categoryPage.onboarding_title}</p>
                    )}
                  </div>
                </div>
              </div>
              {hasCategoryOnboarding && onboardingDone && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                  <span className="text-muted-foreground text-sm">
                    Onboarding complété.
                    {onboardingQuizStats && onboardingQuizStats.attempts > 0 && (
                      <> · {onboardingQuizStats.attempts} tentative{onboardingQuizStats.attempts !== 1 ? "s" : ""} · Meilleur score : {onboardingQuizStats.bestScore}%</>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto gap-1 px-2 text-sm"
                    onClick={() => {
                      if (onboardingStorageKey) {
                        localStorage.removeItem(onboardingStorageKey);
                        setOnboardingDone(false);
                      }
                    }}
                  >
                    <RotateCcw className="size-3.5" />
                    Refaire l'onboarding
                  </Button>
                </div>
              )}
              {categoryPage.onboarding_content && (onboardingDone || !hasCategoryOnboarding) && (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-muted/30 p-4"
                  dangerouslySetInnerHTML={{ __html: categoryPage.onboarding_content }}
                />
              )}
              {categoryPage.onboarding_presentation_embed_url && (onboardingDone || !hasCategoryOnboarding) && (
                <div className="overflow-hidden rounded-lg border bg-muted">
                  <div className="aspect-video w-full">
                    <iframe
                      src={googleSlidesToEmbedUrl(categoryPage.onboarding_presentation_embed_url)}
                      title={`Présentation ${categoryPage.label}`}
                      allowFullScreen
                      className="h-full w-full"
                    />
                  </div>
                </div>
              )}
              {visibleSubcategories.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold">Sous-catégories</h2>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {visibleSubcategories.map((cat) => (
                      <Link key={cat.id} href={`/dashboard/courses/category/${cat.slug}`}>
                        <Card className="h-full transition-colors hover:border-primary/50">
                          <CardContent className="flex flex-col items-center justify-center gap-2 py-6">
                            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary [&>span]:size-6">
                              <CategoryIcon icon={cat.icon} />
                            </div>
                            <span className="font-medium">{cat.label}</span>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <h2 className="text-lg font-semibold">Formations de cette catégorie</h2>
            </>
          )}
        </section>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Catalogue des formations</h1>
            <p className="text-muted-foreground mt-1">
              Choisissez un parcours pour développer vos compétences en digital commerce.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/courses/propose">
              <Send className="mr-2 size-4" />
              Proposer une formation
            </Link>
          </Button>
        </div>
      )}

      {!categoryPage && metiersWithFormations.length > 0 && (
        <section className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Parcours métiers</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={metierFilterId === "all" ? "default" : "outline"}
              className="cursor-pointer transition-colors hover:opacity-90"
              onClick={() => setMetierFilterId("all")}
            >
              Tous
            </Badge>
            {metiersWithFormations.map((m) => (
              <Badge
                key={m.id}
                variant={metierFilterId === m.id ? "default" : "outline"}
                className="cursor-pointer transition-colors hover:opacity-90"
                onClick={() => setMetierFilterId(m.id)}
              >
                {assignedMetierIds.includes(m.id) && (
                  <span className="mr-1 inline-block size-1.5 rounded-full bg-current" aria-hidden />
                )}
                {m.label}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {!categoryPage && visibleRootCategories.length > 0 && (
        <section>
          <h2 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
            Catégories
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {visibleAllCategoriesForTree.length > 0 ? (
              <CategoriesPopover
                allCategoriesForTree={visibleAllCategoriesForTree}
                categoryFilterSlug={categoryFilterSlug}
              />
            ) : (
              <Link href="/dashboard/courses">
                <Card
                  className={`h-full transition-colors hover:border-primary/50 ${
                    !categoryFilterSlug ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <CardContent className="flex flex-col items-center justify-center gap-2 py-6">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                      <FolderTree className="text-muted-foreground size-6" />
                    </div>
                    <span className="font-medium">Toutes</span>
                  </CardContent>
                </Card>
              </Link>
            )}
            {visibleRootCategories.map((cat) => (
              <Link key={cat.id} href={`/dashboard/courses/category/${cat.slug}`}>
                <Card
                  className={`h-full transition-colors hover:border-primary/50 ${
                    categoryFilterSlug === cat.slug ? "border-primary bg-primary/5" : ""
                  }`}
                >
                <CardContent className="flex flex-col items-center justify-center gap-2 py-6">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary [&>span]:size-6">
                    <CategoryIcon icon={cat.icon} />
                  </div>
                  <span className="font-medium">{cat.label}</span>
                </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(!categoryPage || !hasCategoryOnboarding || onboardingDone) && (
      <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <SearchIcon className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="Rechercher une formation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={sortBy}
          onValueChange={(v) => setSortBy(v as SortOption)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tri" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date de création</SelectItem>
            <SelectItem value="a-z">Nom A → Z</SelectItem>
            <SelectItem value="z-a">Nom Z → A</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={categoryFilterSlug ?? "all"}
          onValueChange={handleCategoryFilterChange}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {visibleRootCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.slug}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredCourses.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          {search ? "Aucune formation ne correspond à votre recherche." : "Aucune formation pour le moment."}
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredCourses.map((course) => {
            const category = course.categoryId ? categoryMap.get(course.categoryId) : null;
            const progress = progressByCourse[course.slug];
            const totalModules = course.moduleCount ?? 0;
            const totalMissions = course.missionCount ?? 0;
            const completedModules = progress?.completedModuleIds?.length ?? 0;
            const completedMissions = progress?.completedMissionIds?.length ?? 0;
            const totalElements = totalModules + totalMissions;
            const completedElements = completedModules + completedMissions;
            const progressPercent = totalElements > 0 ? Math.round((completedElements / totalElements) * 100) : 0;
            const isComplete = totalElements > 0 && completedElements >= totalElements;
            return (
              <Card key={course.slug} className="flex flex-col overflow-hidden">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <GraduationCapIcon className="text-primary size-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">{course.title}</CardTitle>
                        {category && (
                          <Badge variant="outline" className="text-xs font-normal inline-flex items-center gap-1">
                            <CategoryIcon icon={category.icon} className="size-3" />
                            {category.label}
                          </Badge>
                        )}
                        {isComplete && (
                          <Badge className="bg-green-600">Terminée</Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1">{course.descriptionShort}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto space-y-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Durée estimée : {course.duration}</span>
                    <span>{course.moduleCount} modules{totalMissions > 0 ? ` · ${totalMissions} missions` : ""}</span>
                  </div>
                  {totalElements > 0 && (
                    <>
                      <Progress value={progressPercent} className="h-2" />
                      <p className="text-muted-foreground text-xs">
                        {completedModules}/{totalModules} modules
                        {totalMissions > 0 ? ` · ${completedMissions}/${totalMissions} missions` : ""}
                        {progressPercent > 0 && ` · ${progressPercent} %`}
                      </p>
                    </>
                  )}
                  {totalElements === 0 && <Progress value={0} className="h-2" />}
                  <Button asChild className="w-full">
                    <Link href={`/dashboard/courses/${course.slug}`}>
                      {isComplete ? "Voir la formation" : "Découvrir la formation"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </>
      )}

    </div>
  );
}
