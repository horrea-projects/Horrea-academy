"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";
import { googleDocsToEmbedUrl } from "@/lib/google-embed";

type Props = { embedUrl: string };

export function ModuleDocument({ embedUrl }: Props) {
  const [loaded, setLoaded] = useState(false);
  const embedSrc = googleDocsToEmbedUrl(embedUrl);
  const hasValidEmbed =
    embedSrc &&
    (embedSrc.includes("docs.google.com/document") || embedSrc.includes("docs.google.com/document/"));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {hasValidEmbed ? (
          <>
            <div className="relative w-full overflow-hidden rounded-lg bg-muted min-h-[400px]">
              {!loaded && (
                <div className="absolute inset-0 z-10 flex min-h-[400px] items-center justify-center bg-muted">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              )}
              <iframe
                src={embedSrc}
                title="Document du module"
                className="h-[60vh] w-full min-h-[400px] border-0"
                onLoad={() => setLoaded(true)}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Si le document ne s'affiche pas (connexion refusée),{" "}
              <Button variant="link" className="h-auto p-0 text-xs" asChild>
                <a href={embedSrc?.replace(/\/preview\b|\/pub\b/, "").split("?")[0] || embedSrc} target="_blank" rel="noopener noreferrer">
                  ouvrir dans un nouvel onglet <ExternalLink className="ml-0.5 inline size-3" />
                </a>
              </Button>
            </p>
          </>
        ) : (
          <div className="flex h-40 w-full items-center justify-center rounded-lg bg-muted text-muted-foreground text-sm">
            Document à venir — configurez l’URL d’embed Google Doc dans le JSON du module.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
