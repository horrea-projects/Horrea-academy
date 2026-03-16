"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronRight, FileJson, Upload, Search, Download, FileDown, Loader2, FolderArchive } from "lucide-react";
import { toast } from "sonner";

type Category = { id: string; slug: string; label: string; icon: string };

const steps = [
  {
    title: "Télécharger le ZIP (templates + exemple)",
    description:
      "Cliquez sur « Télécharger les templates (ZIP) ». Le ZIP contient formation-complete.example.json (exemple prêt à l'emploi) et formation-complete.template.json (à remplir). Pour tester : utilisez l'exemple tel quel. Pour votre formation : décompressez et remplissez le template.",
    icon: Download,
  },
  {
    title: "Préparer votre fichier",
    description:
      "Pour un test rapide : créez un ZIP avec uniquement formation-complete.example.json à la racine. Pour votre formation : placez formation-complete.template.json rempli dans un dossier et compressez-le en ZIP.",
    icon: FileJson,
  },
  {
    title: "Déposer le ZIP et choisir la catégorie",
    description:
      "Dans ce guide, déposez votre ZIP puis choisissez une catégorie (existante ou nouvelle). Cliquez sur « Préparer l’import ». Un ZIP est téléchargé : il contient les fichiers prêts à intégrer au projet.",
    icon: Upload,
  },
  {
    title: "Publication par un admin",
    description:
      "La formation n’est pas publiée tout de suite. Le ZIP généré contient un fichier ADD_TO_INDEX.json : un administrateur devra l’ajouter au catalogue (content/courses/index.json) pour que la formation apparaisse.",
    icon: Search,
  },
];

type FormationComplete = {
  course: {
    slug: string;
    title: string;
    description?: string;
    descriptionShort?: string;
    duration?: string;
    moduleIds?: string[];
    missionIds?: string[];
    categoryId?: string;
    addedAt?: string;
  };
  modules?: Array<{
    id: string;
    title?: string;
    description?: string;
    duration?: string;
    videoEmbedUrl?: string;
    documentEmbedUrl?: string;
    presentationEmbedUrl?: string;
    quizSheetId?: string;
    missionId?: string | null;
    content?: string;
  }>;
  missions?: Array<{
    id: string;
    title?: string;
    context?: string;
    objective?: string;
    instructions?: string[];
    deliverable?: string;
  }>;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function findFormationJsonInZip(zip: { file: (path: string) => { async: (type: string) => Promise<string> } | null; files: Record<string, unknown> }): Promise<string | null> {
  const names = ["formation-complete.template.json", "formation-complete.json", "formation-complete.example.json"];
  for (const name of names) {
    const entry = zip.file(name);
    if (entry) {
      const text = await entry.async("string");
      if (text && text.trim()) return text;
    }
  }
  const paths = Object.keys(zip.files || {});
  for (const path of paths) {
    const name = path.split("/").pop() || "";
    if (names.includes(name)) {
      const entry = zip.file(path);
      if (entry) {
        const text = await entry.async("string");
        if (text && text.trim()) return text;
      }
    }
  }
  return null;
}

type ImportGuideSheetProps = {
  /** Affiche le bouton « Proposer cette formation » qui envoie vers l’API (page Proposer une formation). */
  proposeMode?: boolean;
  /** Libellé du bouton qui ouvre le panneau. */
  triggerLabel?: string;
};

export function ImportGuideSheet({ proposeMode = false, triggerLabel }: ImportGuideSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [proposeLoading, setProposeLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [formationData, setFormationData] = useState<FormationComplete | null>(null);
  const [categoryChoice, setCategoryChoice] = useState<"existing" | "new">("existing");
  const [existingCategoryId, setExistingCategoryId] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [zipLoading, setZipLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetch("/api/categories")
        .then((r) => r.json())
        .then((data) => setCategories(data?.categories ?? []))
        .catch(() => setCategories([]));
    }
  }, [open]);

  const handleTemplatesDownload = async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/templates/zip");
      if (!res.ok) throw new Error("Téléchargement impossible");
      const blob = await res.blob();
      downloadBlob(blob, "horrea-academy-templates.zip");
      toast.success("ZIP des templates téléchargé");
    } catch {
      toast.error("Erreur lors du téléchargement des templates");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleZipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipFile(file);
    setFormationData(null);
    try {
      let text: string;
      const isJson = file.name.toLowerCase().endsWith(".json");
      if (isJson && proposeMode) {
        text = await file.text();
      } else {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        text = await findFormationJsonInZip(zip) ?? "";
        if (!text) {
          toast.error("Aucun fichier formation-complete.template.json ou formation-complete.json trouvé dans le ZIP.");
          return;
        }
      }
      const data = JSON.parse(text) as FormationComplete;
      if (!data.course?.slug) {
        toast.error("Le JSON doit contenir un objet « course » avec « slug ».");
        return;
      }
      setFormationData(data);
      if (categories.length > 0) setExistingCategoryId(categories[0].id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ZIP ou JSON invalide.");
      setZipFile(null);
    }
    e.target.value = "";
  };

  const getCategorySlug = () => {
    if (categoryChoice === "existing") {
      return categories.find((c) => c.id === existingCategoryId)?.slug ?? "";
    }
    return newCategoryName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "nouvelle-categorie";
  };

  const handlePropose = async () => {
    if (!formationData?.course?.slug || !proposeMode) return;
    setProposeLoading(true);
    try {
      let categorySlug = getCategorySlug();
      if (categoryChoice === "new" && newCategoryName.trim()) {
        const catRes = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: newCategoryName.trim() }),
        });
        const catData = await catRes.json();
        if (!catRes.ok) throw new Error(catData.error ?? "Erreur création catégorie");
        categorySlug = catData.category?.slug ?? (newCategoryName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "nouvelle-categorie");
      }
      const body = {
        course: { ...formationData.course, categoryId: categorySlug || undefined },
        modules: formationData.modules ?? [],
        missions: formationData.missions ?? [],
      };
      const res = await fetch("/api/courses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Erreur import");
      toast.success("Formation proposée. Elle sera mise en ligne après validation par un administrateur.");
      setOpen(false);
      router.push("/dashboard/courses");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la proposition");
    } finally {
      setProposeLoading(false);
    }
  };

  const buildImportZip = async () => {
    if (!formationData?.course?.slug) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const { course, modules = [], missions = [] } = formationData;
    const slug = course.slug;

    const categoryId = categoryChoice === "existing" ? existingCategoryId : (newCategoryName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "nouvelle-categorie");
    const descriptionShort =
      course.descriptionShort ||
      (course.description ? course.description.slice(0, 120) + (course.description.length > 120 ? "…" : "") : "");

    const catalogueEntry = {
      slug: course.slug,
      title: course.title,
      descriptionShort,
      duration: course.duration || "~0h",
      moduleCount: modules.length,
      categoryId: categoryId || undefined,
      addedAt: new Date().toISOString().slice(0, 10),
    };

    zip.file(
      "ADD_TO_INDEX.json",
      JSON.stringify(
        {
          instruction: "Ajouter cette entrée dans content/courses/index.json (tableau courses) lorsque la formation est validée par un admin.",
          entry: catalogueEntry,
        },
        null,
        2
      )
    );

    const isNewCategory = categoryChoice === "new";
    zip.file(
      "INSTRUCTIONS.txt",
      `Formation : ${course.title} (${slug})\n\nAvec la plateforme (Supabase) : la formation peut être proposée directement via « Proposer cette formation » ; un admin la publie depuis Administration → Formations.\n\nImport manuel (sans base) :\n1. Extraire les dossiers content/courses, content/modules, content/missions dans le dossier content/ du projet.\n2. Ajouter l'entrée de ADD_TO_INDEX.json au tableau "courses" dans content/courses/index.json.\n3. ${isNewCategory ? "Ajouter la catégorie de ADD_TO_CATEGORY.json dans content/courses/categories.json." : "Catégorie existante : rien à faire pour les catégories."}`
    );

    if (isNewCategory && newCategoryName.trim()) {
      const newCatSlug = newCategoryName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      zip.file(
        "ADD_TO_CATEGORY.json",
        JSON.stringify(
          {
            instruction: "Ajouter cet objet au tableau dans content/courses/categories.json (avant de publier la formation).",
            entry: { id: newCatSlug || "nouvelle-categorie", slug: newCatSlug || "nouvelle-categorie", label: newCategoryName.trim(), icon: "BookOpen" },
          },
          null,
          2
        )
      );
    }

    const coursePayload = {
      slug: course.slug,
      title: course.title,
      description: course.description || "",
      duration: course.duration || "~0h",
      moduleIds: course.moduleIds || modules.map((m) => m.id),
      missionIds: course.missionIds || missions.map((m) => m.id),
    };
    zip.file(`content/courses/${slug}.json`, JSON.stringify(coursePayload, null, 2));

    for (const mod of modules) {
      const modulePayload: Record<string, unknown> = {
        id: mod.id,
        title: mod.title || "",
        description: mod.description || "",
        duration: mod.duration || "",
        videoEmbedUrl: mod.videoEmbedUrl || "",
        quizSheetId: mod.quizSheetId ?? "",
        missionId: mod.missionId ?? null,
        content: mod.content ?? "",
      };
      if (mod.documentEmbedUrl !== undefined) modulePayload.documentEmbedUrl = mod.documentEmbedUrl || "";
      if (mod.presentationEmbedUrl !== undefined) modulePayload.presentationEmbedUrl = mod.presentationEmbedUrl || "";
      zip.file(`content/modules/${slug}/${mod.id}.json`, JSON.stringify(modulePayload, null, 2));
    }

    for (const mission of missions) {
      const missionPayload = {
        id: mission.id,
        title: mission.title || "",
        context: mission.context || "",
        objective: mission.objective || "",
        instructions: Array.isArray(mission.instructions) ? mission.instructions : [],
        deliverable: mission.deliverable || "",
      };
      zip.file(`content/missions/${slug}/${mission.id}.json`, JSON.stringify(missionPayload, null, 2));
    }

    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `formation-${slug}-import.zip`);
    toast.success("ZIP d’import téléchargé. La formation sera visible après validation par un admin.");
  };

  const handlePrepareImport = async () => {
    if (!formationData) return;
    setZipLoading(true);
    try {
      await buildImportZip();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la préparation du ZIP");
    } finally {
      setZipLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          {triggerLabel ?? "Importer une formation"}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <div className="flex flex-col gap-4 px-5 pb-6 pt-2">
          <SheetHeader className="px-0">
            <SheetTitle>Guide : importer une formation</SheetTitle>
            <SheetDescription>
              Téléchargez le ZIP des templates, remplissez le fichier formation complète, puis importez votre ZIP.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold">Télécharger les templates</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Un seul ZIP contient tous les templates et un README complet. Décompressez, remplissez formation-complete.template.json, puis recréez un ZIP pour l’import.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
                onClick={handleTemplatesDownload}
                disabled={templatesLoading}
              >
                {templatesLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FolderArchive className="size-4" />
                )}
                Télécharger les templates (ZIP)
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-semibold">{proposeMode ? "Déposer un fichier (JSON ou ZIP)" : "Importer un ZIP"}</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Déposez un ZIP contenant votre formation-complete.template.json rempli. Choisissez une catégorie, puis préparez l’import. La formation ne sera pas publiée tout de suite (validation admin).
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={proposeMode ? ".json,.zip,application/json,application/zip" : ".zip,application/zip"}
                className="hidden"
                onChange={handleZipChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fileInputRef.current?.click()}
              >
                {proposeMode ? "Déposer un fichier JSON ou ZIP" : "Déposer un fichier ZIP"}
              </Button>
              {zipFile && (
                <p className="text-muted-foreground mt-2 text-xs">
                  Fichier : {zipFile.name}
                  {formationData ? " — prêt." : ""}
                </p>
              )}

              {formationData && (
                <div className="mt-4 space-y-4 rounded-lg border p-4">
                  <h4 className="text-xs font-medium">Catégorie</h4>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="cat-existing"
                        checked={categoryChoice === "existing"}
                        onChange={() => setCategoryChoice("existing")}
                        className="size-4"
                      />
                      <Label htmlFor="cat-existing" className="text-sm font-normal">Catégorie existante</Label>
                    </div>
                    {categoryChoice === "existing" && (
                      <select
                        value={existingCategoryId}
                        onChange={(e) => setExistingCategoryId(e.target.value)}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                        {categories.length === 0 && (
                          <option value="">Aucune catégorie (ajoutez-en dans content/courses/categories.json)</option>
                        )}
                      </select>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="cat-new"
                        checked={categoryChoice === "new"}
                        onChange={() => setCategoryChoice("new")}
                        className="size-4"
                      />
                      <Label htmlFor="cat-new" className="text-sm font-normal">Nouvelle catégorie</Label>
                    </div>
                    {categoryChoice === "new" && (
                      <input
                        type="text"
                        placeholder="Nom de la catégorie (ex. Shopify)"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {proposeMode && (
                      <Button
                        className="w-full"
                        size="sm"
                        onClick={handlePropose}
                        disabled={proposeLoading}
                      >
                        {proposeLoading ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Envoi en cours…
                          </>
                        ) : (
                          "Proposer cette formation"
                        )}
                      </Button>
                    )}
                    <Button
                      variant={proposeMode ? "outline" : "default"}
                      className="w-full"
                      size="sm"
                      onClick={handlePrepareImport}
                      disabled={zipLoading}
                    >
                    {zipLoading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Préparation...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 size-4" />
                        Préparer l’import (télécharger le ZIP)
                      </>
                    )}
                  </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <ol className="mt-6 space-y-6 border-t border-border pt-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={index} className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs font-medium">Étape {index + 1}</span>
                      <ChevronRight className="text-muted-foreground size-4" />
                    </div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="text-muted-foreground text-sm">{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="border-t border-border pt-4">
            <p className="text-muted-foreground text-xs">
              Script en local : <code className="rounded bg-muted px-1">node scripts/import-formation.js &lt;fichier.json&gt;</code>
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
