/**
 * Normalise une URL Google Slides (view, edit ou partagée) en URL d'embed
 * pour afficher uniquement le diaporama (présentation), sans l’interface d’édition.
 *
 * Lien classique : /d/ID/view ou /edit → .../d/ID/embed
 * Lien « Publier sur le Web » : /d/e/2PACX-... → .../d/e/2PACX-.../pubembed
 */
const EMBED_QUERY = "start=false&loop=false&delayms=3000";

export function googleSlidesToEmbedUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Déjà en format pubembed (lien « Publier sur le Web »)
  if (trimmed.includes("/pubembed")) {
    const base = trimmed.split("?")[0];
    return `${base}${base.endsWith("/") ? "" : "/"}?${EMBED_QUERY}`;
  }

  // Format « Publier sur le Web » : /presentation/d/e/2PACX-.../view ou /edit
  const publishedMatch = trimmed.match(/\/presentation\/d\/e\/([a-zA-Z0-9_-]+)/);
  if (publishedMatch) {
    const id = publishedMatch[1];
    return `https://docs.google.com/presentation/d/e/${id}/pubembed?${EMBED_QUERY}`;
  }

  // Déjà en format embed classique
  if (trimmed.includes("/embed")) {
    const match = trimmed.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1] !== "e") return buildEmbedUrl(match[1]);
    return trimmed;
  }

  // Format view ou edit classique : /d/ID/view ou /d/ID/edit (ID ≠ "e")
  const classicMatch = trimmed.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)\//);
  if (classicMatch && classicMatch[1] !== "e") {
    return buildEmbedUrl(classicMatch[1]);
  }

  return trimmed;
}

function buildEmbedUrl(presentationId: string): string {
  return `https://docs.google.com/presentation/d/${presentationId}/embed?${EMBED_QUERY}`;
}

/**
 * Normalise une URL Google Doc (view, edit ou « Publier sur le Web ») en URL d'embed.
 */
export function googleDocsToEmbedUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (trimmed.includes("/document/d/e/") && (trimmed.includes("/pub") || trimmed.includes("widget=true"))) {
    const base = trimmed.split("?")[0].replace(/\/view$|\/edit.*$/, "");
    return base.includes("/pub") ? `${base}?widget=true&headers=false` : `${base}/pub?widget=true&headers=false`;
  }
  const publishedMatch = trimmed.match(/\/document\/d\/e\/([a-zA-Z0-9_-]+)/);
  if (publishedMatch) {
    return `https://docs.google.com/document/d/e/${publishedMatch[1]}/pub?widget=true&headers=false`;
  }
  if (trimmed.includes("/preview")) return trimmed;
  const classicMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)\//);
  if (classicMatch && classicMatch[1] !== "e") {
    return `https://docs.google.com/document/d/${classicMatch[1]}/preview`;
  }
  return trimmed;
}

/**
 * Extrait l'ID d'un fichier Google Sheet depuis une URL complète ou retourne la chaîne telle quelle si c'est déjà un ID.
 * Ex. https://docs.google.com/spreadsheets/d/1ABC...xyz/edit → 1ABC...xyz
 */
export function parseGoogleSheetId(urlOrId: string | null | undefined): string {
  if (!urlOrId || typeof urlOrId !== "string") return "";
  const trimmed = urlOrId.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return trimmed;
}
