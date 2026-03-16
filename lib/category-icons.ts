/**
 * Icônes SVG prédéfinies pour les catégories de formations.
 * Chaque entrée peut être utilisée comme valeur "icon" en base (clé) ou on peut stocker du SVG personnalisé.
 */

export const CATEGORY_ICONS: { id: string; label: string; svg: string }[] = [
  {
    id: "book",
    label: "Livre",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/><path d="M8 11h8"/></svg>',
  },
  {
    id: "cart",
    label: "Panier",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>',
  },
  {
    id: "store",
    label: "Boutique",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-2.82 0 2.7 2.7 0 0 1-1.59.63H9a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-2.82 0A2.7 2.7 0 0 1 3 10v0a2 2 0 0 1-2-2V7"/></svg>',
  },
  {
    id: "chart",
    label: "Graphique",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>',
  },
  {
    id: "graduation",
    label: "Diplôme",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
  },
  {
    id: "package",
    label: "Colis",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05"/><path d="M12 22.08V12"/></svg>',
  },
  {
    id: "tag",
    label: "Étiquette",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>',
  },
  {
    id: "sparkles",
    label: "Étincelles",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
  },
];

const byId = new Map(CATEGORY_ICONS.map((i) => [i.id, i]));

/** Style pour que stroke/fill "currentColor" des SVG suivent le thème (clair/sombre). */
const THEME_COLOR_STYLE = ' style="color: hsl(var(--foreground));"';

/**
 * Remplace fill="black" et stroke="black" (ou #000, #000000) par currentColor pour adapter au thème.
 */
function normalizeBlackToCurrentColor(svg: string): string {
  return svg
    .replace(/\bfill="black"/gi, 'fill="currentColor"')
    .replace(/\bstroke="black"/gi, 'stroke="currentColor"')
    .replace(/\bfill="#000000"/gi, 'fill="currentColor"')
    .replace(/\bstroke="#000000"/gi, 'stroke="currentColor"')
    .replace(/\bfill="#000\b"/gi, 'fill="currentColor"')
    .replace(/\bstroke="#000\b"/gi, 'stroke="currentColor"');
}

/**
 * Injecte la couleur du thème dans la balise <svg> pour que currentColor s'adapte au thème.
 */
function withThemeColor(svg: string): string {
  const trimmed = svg.trim();
  if (!trimmed.toLowerCase().startsWith("<svg")) return svg;
  let out = normalizeBlackToCurrentColor(trimmed);
  if (/<svg[^>]*\sstyle\s*=/i.test(out)) return out;
  out = out.replace(/<svg(\s)/i, `<svg${THEME_COLOR_STYLE}$1`);
  return out;
}

/** Retourne le SVG pour une clé prédéfinie ou null. Les SVG utilisent currentColor, adapté au thème. */
export function getCategoryIconSvg(icon: string | null | undefined): string | null {
  if (!icon?.trim()) return null;
  const raw = icon.trim().toLowerCase().startsWith("<svg") ? icon.trim() : byId.get(icon.trim())?.svg ?? null;
  return raw ? withThemeColor(raw) : null;
}

/** Indique si la valeur est un SVG personnalisé (brut). */
export function isCustomSvg(icon: string | null | undefined): boolean {
  return !!icon?.trim().toLowerCase().startsWith("<svg");
}
