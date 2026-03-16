"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ProposeImportClient() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      let text: string;
      if (file.name.toLowerCase().endsWith(".zip")) {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        const names = ["formation-complete.template.json", "formation-complete.json"];
        let entry: { async: (t: string) => Promise<string> } | null = null;
        for (const name of names) {
          const path = Object.keys(zip.files).find((p) => p.endsWith(name) || p.includes("formation-complete"));
          if (path) {
            entry = zip.file(path);
            if (entry) break;
          }
          entry = zip.file(name);
          if (entry) break;
        }
        if (!entry) {
          const firstJson = Object.keys(zip.files).find((p) => p.endsWith(".json"));
          if (firstJson) entry = zip.file(firstJson);
        }
        if (!entry) throw new Error("Aucun fichier formation-complete ou .json trouvé dans le ZIP.");
        text = await entry.async("string");
      } else {
        text = await file.text();
      }
      const data = JSON.parse(text);
      if (!data.course?.slug) throw new Error("Le JSON doit contenir un objet 'course' avec 'slug'.");
      const res = await fetch("/api/courses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Erreur import");
      toast.success("Formation proposée. Elle sera mise en ligne après validation par un administrateur.");
      router.push("/dashboard/courses");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'import");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importer une formation (JSON ou ZIP)</CardTitle>
        <CardDescription>
          Envoyez un fichier formation-complete.json ou une archive ZIP le contenant. La formation sera enregistrée en attente de validation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <input
          ref={inputRef}
          type="file"
          accept=".json,.zip"
          className="hidden"
          onChange={handleImport}
          disabled={importing}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={importing}
        >
          {importing ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Upload className="mr-2 size-4" />
          )}
          {importing ? "Import en cours…" : "Choisir un fichier JSON ou ZIP"}
        </Button>
      </CardContent>
    </Card>
  );
}
