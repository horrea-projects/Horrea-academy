"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

type Props = { embedUrl: string };

export function ModuleVideo({ embedUrl }: Props) {
  const hasValidEmbed = embedUrl && embedUrl.includes("drive.google.com");
  const viewUrl = embedUrl?.replace(/\/preview\b/, "").replace(/\/embed\b/, "").split("?")[0] || embedUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vidéo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {hasValidEmbed ? (
          <>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
              <iframe
                src={embedUrl}
                title="Vidéo du module"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Si la vidéo ne s'affiche pas (connexion refusée),{" "}
              <Button variant="link" className="h-auto p-0 text-xs" asChild>
                <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                  ouvrir dans un nouvel onglet <ExternalLink className="ml-0.5 inline size-3" />
                </a>
              </Button>
            </p>
          </>
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
            Vidéo à venir — configurez l’URL d’embed Google Drive dans le JSON du module.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
