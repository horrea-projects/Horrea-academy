# Création de formations — guide d’intégration

Ce document décrit comment une formation s’intègre dans la plateforme et comment créer une nouvelle formation à partir des templates JSON.

## 1. Comment une formation s’intègre aujourd’hui

Le contenu est **piloté par des fichiers JSON** dans le dossier `content/`. Il n’y a pas d’interface d’administration : toute nouvelle formation est ajoutée en créant ou modifiant ces fichiers.

### Arborescence

```
content/
├── courses/
│   ├── index.json          ← Liste des formations (catalogue)
│   └── {slug}.json         ← Fiche d’une formation
├── modules/
│   └── {courseSlug}/
│       └── {moduleId}.json ← Un fichier par module
└── missions/
    └── {courseSlug}/
        └── {missionId}.json ← Un fichier par mission (optionnel)
```

- **Catalogue** : `content/courses/index.json` liste les formations (avec optionnellement `categoryId` et `addedAt` pour le tri et les filtres). Chaque entrée doit avoir un fichier `content/courses/{slug}.json` correspondant.
- **Catégories** : `content/courses/categories.json` définit les catégories (id, slug, label, icon). Les formations peuvent référencer une catégorie via `categoryId` dans l’index.
- **Fiche formation** : `content/courses/{slug}.json` décrit la formation et référence les IDs des modules et des missions (ordre = ordre d’affichage).
- **Modules** : un fichier par module dans `content/modules/{courseSlug}/{moduleId}.json`. Les `moduleId` doivent être ceux listés dans le cours.
- **Missions** : optionnel, dans `content/missions/{courseSlug}/{missionId}.json`, référencées par le cours et éventuellement par un module via `missionId`.

Le chargement est fait côté serveur dans `lib/content.ts` (pas de base de données).

### Étapes pour qu’une nouvelle formation apparaisse

1. Ajouter une entrée dans `content/courses/index.json`.
2. Créer `content/courses/{slug}.json`.
3. Créer les JSON des modules dans `content/modules/{slug}/`.
4. Optionnel : créer les JSON des missions dans `content/missions/{slug}/`.

---

## 2. Supports disponibles

| Support | Champ dans le module | Comment l’obtenir |
|--------|----------------------|--------------------|
| **Vidéo** | `videoEmbedUrl` | Google Drive : partager la vidéo « Toute personne avec le lien », puis utiliser l’URL d’embed au format `https://drive.google.com/file/d/{ID}/preview`. |
| **Quiz** | `quizSheetId` | Google Sheet : créer une feuille avec en-têtes (ex. `question`, `option_a`, `option_b`…), partager en lecture avec le compte de service, mettre l’ID du spreadsheet dans `quizSheetId`. Vous pouvez aussi ajouter des sections de contexte avec colonnes optionnelles `type`, `title`/`titre`, `description` (`type=section`), puis des lignes `type=question`. |
| **Texte** | `content` | Texte libre affiché dans la page du module. |
| **Document** | `documentEmbedUrl` | Google Doc : Fichier → Publier sur le Web → Intégrer, copier l’URL de l’iframe (format `https://docs.google.com/document/d/{ID}/pub?embedded=true`). |
| **Présentation** | `presentationEmbedUrl` | Google Slides : Fichier → Publier sur le Web → Intégrer, copier l’URL de l’iframe. |
| **Mission** | `missionId` (dans le module) | Référence vers un fichier dans `content/missions/{courseSlug}/{missionId}.json`. |

---

## 3. Utilisation des templates

Des fichiers templates sont disponibles dans `content-templates/` :

- **course.template.json** : structure d’un fichier `courses/{slug}.json`.
- **module.template.json** : structure d’un module (vidéo, quiz, document, présentation, texte, mission).
- **mission.template.json** : structure d’une mission.
- **formation-complete.template.json** : un seul JSON qui décrit une formation entière (course + modules + missions), pour génération par outil (ex. ChatGPT) puis import via le script.

### Remplir les templates

1. Copier le template concerné.
2. Remplacer les valeurs (titres, descriptions, URLs d’embed, IDs de sheet, etc.).
3. Pour une formation complète : déposer le fichier rempli dans le repo et lancer le script d’import (voir section 5).
4. Pour des fichiers séparés : enregistrer chaque fichier au bon emplacement (`content/courses/`, `content/modules/{slug}/`, `content/missions/{slug}/`) et ajouter la ligne dans `content/courses/index.json`.

---

## 4. Emplacements des fichiers

Après avoir rempli les templates :

- **Fiche formation** : enregistrer sous `content/courses/{slug}.json` (ex. `content/courses/ma-formation.json`).
- **Module** : enregistrer sous `content/modules/{slug}/{moduleId}.json` (ex. `content/modules/ma-formation/01-intro.json`). Créer le dossier `content/modules/{slug}/` si besoin.
- **Mission** : enregistrer sous `content/missions/{slug}/{missionId}.json`.
- **Catalogue** : ouvrir `content/courses/index.json` et ajouter une entrée avec `slug`, `title`, `descriptionShort`, `duration`, `moduleCount` (nombre de modules).

---

## 5. Import d’une formation complète (script)

Si vous avez un seul fichier JSON « formation complète » (course + modules + missions), vous pouvez utiliser le script d’import :

```bash
node scripts/import-formation.js content-templates/ma-formation-complete.json
```

Le script :

- Met à jour `content/courses/index.json` (ajoute la formation au catalogue).
- Crée `content/courses/{slug}.json`.
- Crée chaque fichier dans `content/modules/{slug}/`.
- Crée chaque fichier dans `content/missions/{slug}/` si des missions sont présentes.

Le fichier passé en argument doit respecter le schéma de `formation-complete.template.json`.
