"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";
import { googleSlidesToEmbedUrl } from "@/lib/google-embed";

type Props = { embedUrl: string };

export function ModulePresentation({ embedUrl }: Props) {
  const [loaded, setLoaded] = useState(false);
  const embedSrc = googleSlidesToEmbedUrl(embedUrl);
  const hasValidEmbed =
    embedSrc &&
    (embedSrc.includes("docs.google.com/presentation") ||
      embedSrc.includes("docs.google.com/presentation/"));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Présentation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {hasValidEmbed ? (
          <>
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
              {!loaded && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              )}
              <iframe
                src={embedSrc}
                title="Présentation du module"
                allowFullScreen
                className="h-full w-full"
                onLoad={() => setLoaded(true)}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Si la présentation ne s'affiche pas (connexion refusée),{" "}
              <Button variant="link" className="h-auto p-0 text-xs" asChild>
                <a href={embedSrc?.replace(/\/embed\b/, "").split("?")[0] || embedSrc} target="_blank" rel="noopener noreferrer">
                  ouvrir dans un nouvel onglet <ExternalLink className="ml-0.5 inline size-3" />
                </a>
              </Button>
            </p>
          </>
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-muted-foreground text-sm">
            Présentation à venir — configurez l’URL d’embed Google Slides dans le JSON du module.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
