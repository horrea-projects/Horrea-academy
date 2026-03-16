export const TEMPLATE_ZIP_README = `# Templates de formation — Horrea Academy

Ce dossier contient les fichiers pour créer une nouvelle formation. Vous pouvez **tester tout de suite** avec l’exemple pré-rempli ou **créer votre formation** à partir du template.

---

## Fichiers inclus

- **formation-complete.example.json** — **Exemple complet prêt à l’emploi.** Une formation « Introduction à Next.js » avec 3 modules et 1 mission. Pour tester : placez ce fichier seul dans un ZIP, déposez-le dans le guide d’import, choisissez une catégorie puis « Proposer cette formation » (ou « Préparer l’import » pour télécharger le ZIP des fichiers). Aucune modification nécessaire.
- **formation-complete.template.json** — Fichier vide à remplir pour créer votre propre formation (fiche + modules + missions).
- **quiz-exemple.csv** — **Exemple de quiz pour Excel / Google Sheets.** Ouvrable dans Excel ou importable dans Google Sheets. Montre la structure attendue : colonnes \`question\`, \`option_a\`, \`option_b\`, \`option_c\`, \`option_d\`. Une ligne d’en-tête + une ligne par question. Utilisez ce format dans un Google Sheet, partagez le fichier en lecture, puis indiquez l’ID du Sheet et le nom de la feuille (onglet) dans la formation.
- **course.template.json**, **module.template.json**, **mission.template.json** — Structures séparées (référence).

Pour l’import : utilisez **formation-complete.example.json** pour un test, ou **formation-complete.template.json** après l’avoir rempli. Le ZIP peut ne contenir qu’un seul de ces fichiers (à la racine).

---

## Comment remplir formation-complete.template.json

### Objet \`course\`

- **slug** : identifiant unique de la formation (minuscules, tirets). Ex. : \`ma-formation\`.
- **title** : titre affiché dans le catalogue.
- **description** : description détaillée de la formation.
- **duration** : durée estimée (ex. \`~4h\`).
- **moduleIds** : tableau des IDs des modules, dans l’ordre d’affichage (ex. \`["01-intro", "02-module-2"]\`).
- **missionIds** : tableau des IDs des missions.
- **categoryId** : optionnel. Sera renseigné lors de l’import (choix d’une catégorie existante ou création).
- **addedAt** : optionnel. Sera géré par la plateforme à l’import.

### Chaque objet dans \`modules\`

- **id** : identifiant du module (doit figurer dans \`course.moduleIds\`).
- **title**, **description**, **duration** : texte et durée du module.
- **videoEmbedUrl** : URL d’embed Google Drive (format \`https://drive.google.com/file/d/ID/preview\`).
- **documentEmbedUrl** : optionnel. URL d’embed Google Doc (Publier sur le Web → Intégrer).
- **presentationEmbedUrl** : optionnel. URL d’embed Google Slides.
- **quizSheetId** : optionnel. ID du Google Sheet contenant les questions (colonnes question, option_a, etc.).
- **missionId** : optionnel. ID d’une mission liée au module.
- **content** : optionnel. Texte libre affiché sous la vidéo.

### Chaque objet dans \`missions\`

- **id** : identifiant (doit figurer dans \`course.missionIds\`).
- **title**, **context**, **objective**, **instructions** (tableau), **deliverable**.

---

## Import sur la plateforme — processus complet

### Option A : Tester avec l’exemple (recommandé pour un premier essai)

1. Téléchargez ce ZIP (vous y trouverez \`formation-complete.example.json\`).
2. **Soit** créez un nouveau ZIP ne contenant que \`formation-complete.example.json\` (à la racine).
3. Sur la plateforme : **Catalogue** → **Proposer une formation** → ouvrez le **guide d’import**.
4. Cliquez sur **« Déposer un fichier JSON ou ZIP »** et sélectionnez votre ZIP (ou le fichier \`.example.json\` directement si l’interface l’accepte).
5. Choisissez une **catégorie** (existante ou proposez-en une nouvelle avec un nom).
6. Cliquez sur **« Proposer cette formation »** : la formation est enregistrée en base en statut « en attente ». Un administrateur pourra la **publier** depuis l’admin (Formations).
7. Ou cliquez sur **« Préparer l’import »** : un ZIP est téléchargé avec \`content/courses/...\`, \`content/modules/...\`, etc. et les instructions pour un import manuel.

### Option B : Créer votre propre formation

1. **Remplissez** \`formation-complete.template.json\` (à la main ou avec un outil type ChatGPT). Vous pouvez vous inspirer de \`formation-complete.example.json\`.
2. **Placez** ce fichier dans un dossier et compressez-le en **ZIP** (ou gardez le fichier tel quel si vous déposez du JSON).
3. Sur la plateforme : **Proposer une formation** → guide d’import → **Déposer un fichier** → sélectionnez votre ZIP.
4. Choisissez une **catégorie** (existante ou nouvelle).
5. **« Proposer cette formation »** : enregistrement en base, statut « en attente ». Un admin publiera la formation depuis l’administration.
6. **« Préparer l’import »** : téléchargement d’un ZIP avec la structure \`content/\` et \`ADD_TO_INDEX.json\` pour intégration manuelle au projet (si vous n’utilisez pas la base Supabase).

---

## Structure du ZIP généré par « Préparer l’import »

Le ZIP téléchargé contient :

- \`content/courses/{slug}.json\` — Fiche de la formation.
- \`content/modules/{slug}/*.json\` — Un fichier par module.
- \`content/missions/{slug}/*.json\` — Un fichier par mission (si présentes).
- \`ADD_TO_INDEX.json\` — Entrée pour \`content/courses/index.json\` (si import manuel).
- \`INSTRUCTIONS.txt\` — Rappel des étapes.

**Avec la base de données (Supabase)** : privilégiez **« Proposer cette formation »** plutôt que « Préparer l’import ». La formation est alors créée directement en base ; un administrateur la met en ligne (statut Publié) depuis **Administration → Formations**.

---

## Supports disponibles (Google)

| Support      | Champ / Fichier | Comment l’obtenir |
|-------------|------------------|-------------------|
| Vidéo       | \`videoEmbedUrl\` | Drive : partager « Toute personne avec le lien », URL d’embed \`.../file/d/ID/preview\`. |
| Document    | \`documentEmbedUrl\` | Doc : Fichier → Publier sur le Web → Intégrer, copier l’URL. |
| Présentation| \`presentationEmbedUrl\` | **Slides : Publier sur le Web → Intégrer.** Utilisez l'URL \`.../embed\` pour le diaporama uniquement. Lien Voir/Modifier : remplacer \`/view\` ou \`/edit\` par \`/embed\`. |
| Quiz        | \`quiz_spreadsheet_id\` + nom de feuille | Google Sheet avec en-têtes **question**, **option_a**, **option_b**, **option_c**, **option_d**. Voir \`quiz-exemple.csv\` dans ce ZIP. Partager le Sheet en lecture. |

---

## Structure du fichier quiz (Excel / Google Sheets)

Le fichier **quiz-exemple.csv** fourni dans ce ZIP peut être ouvert dans **Excel** ou importé dans **Google Sheets**. Structure obligatoire :

| Colonne    | Description |
|------------|-------------|
| **question** | Texte de la question (une seule colonne). |
| **option_a** | Première réponse possible. |
| **option_b** | Deuxième réponse possible. |
| **option_c** | Troisième réponse (optionnel). |
| **option_d** | Quatrième réponse (optionnel). |
| **reponse** | Texte de la **bonne réponse** (identique à l’une des options). Utilisé pour calculer le score. |
| **explication** | Explication affichée après soumission (optionnel). |

- **Ligne 1** : en-têtes exactement comme ci-dessus (minuscules, underscores).
- **Lignes suivantes** : une ligne par question (question, options, reponse, explication). Le score est calculé automatiquement ; dans l’admin, vous pouvez définir un **score minimum** par module pour que l’utilisateur doive l’atteindre avant de pouvoir valider le module.

Pour une formation : un seul fichier Google Sheet peut contenir **plusieurs feuilles (onglets)** — une feuille par quiz de module, plus une pour le quiz final. Dans l’admin, on renseigne l’ID du fichier Sheet et le **nom de chaque feuille** pour chaque module / quiz final.

---

## Script en local (optionnel)

Vous pouvez aussi utiliser le script Node en local :

\`\`\`bash
node scripts/import-formation.js chemin/vers/formation-complete.json
\`\`\`

Le script écrit directement dans \`content/\` et met à jour \`index.json\`. Sur la plateforme, l’import via ZIP ne modifie pas le catalogue tant qu’un admin n’a pas validé la formation.
`;
