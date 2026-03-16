# Horrea Academy

Plateforme interne de formation pour les équipes Horrea. Parcours pratiques autour du digital commerce (Shopify et autres thématiques à venir).

## Stack

- **Frontend** : Next.js 16, React 19, Tailwind CSS, shadcn/ui
- **Auth** : Clerk (connexion Google SSO)
- **Contenu** : JSON dans le repo (`/content/courses`, `/content/modules`, `/content/missions`)
- **Vidéos** : Google Drive (embed iframe)
- **Quiz & progression** : Google Sheets via Netlify Functions (compte de service)
- **Hébergement** : Netlify

## Prérequis

- Node.js 20+
- Compte [Clerk](https://clerk.com) (Google SSO)
- Optionnel : projet Google Cloud + compte de service pour Google Sheets (progression et quiz)

## Installation et test en local

1. **Cloner le dépôt et installer les dépendances**

   ```bash
   cd Horrea-academy
   npm install
   ```

2. **Variables d’environnement**

   Copier `.env.example` vers `.env.local` et renseigner au minimum les clés Clerk :

   ```bash
   cp .env.example .env.local
   ```

   Dans `.env.local` :

   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` et `CLERK_SECRET_KEY` (depuis le [dashboard Clerk](https://dashboard.clerk.com))
   - Pour activer Google Sheets en local : `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON du compte de service en une ligne) et éventuellement `PROGRESSION_SHEET_ID`, `QUIZ_RESULTS_SHEET_ID`

3. **Lancer l’app**

   ```bash
   npm run dev
   ```

   Ouvrir [http://localhost:3000](http://localhost:3000). Vous serez redirigé vers la page de connexion Clerk puis, après authentification, vers le dashboard.

## Déploiement sur Netlify

1. **Connecter le dépôt**  
   Dans Netlify : New site → Import an existing project → choisir le repo.

2. **Build**

   - Build command : `npm run build` (ou laisser Netlify détecter Next.js)
   - Publish directory : géré par le plugin Next.js (souvent `.next`)

3. **Variables d’environnement** (Netlify → Site settings → Environment variables)

   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - Pour la progression et les quiz :
     - `GOOGLE_SERVICE_ACCOUNT_JSON` (contenu JSON du fichier de clé du compte de service)
     - `PROGRESSION_SHEET_ID` (ID du Google Sheet « Progression »)
     - `QUIZ_RESULTS_SHEET_ID` (ID du Google Sheet « Résultats quiz »)

4. **Clerk en production**  
   Dans le dashboard Clerk, configurer l’URL du site Netlify et, pour Google SSO, créer des identifiants OAuth dans Google Cloud Console puis les renseigner dans Clerk (custom credentials).

## Google : OAuth vs compte de service

- **OAuth (Client ID + Client Secret)** : sert à la connexion « Sign in with Google » côté Clerk. Ces identifiants se configurent dans le **dashboard Clerk** (Social connections → Google → Use custom credentials), pas dans `.env` de l’app. L’app n’a besoin que des clés Clerk.
- **Compte de service (JSON)** : requis pour les **Netlify Functions** qui lisent/écrivent Google Sheets (progression, quiz). Les functions tournent sans utilisateur connecté ; OAuth ne convient pas (pas de flux de consentement). Il faut créer un **compte de service** dans Google Cloud, télécharger la clé JSON, et définir `GOOGLE_SERVICE_ACCOUNT_JSON` (et les IDs des sheets). Voir la section ci‑dessous.

## Google Sheets (progression et quiz)

### Progression

- Créer un Google Sheet (ex. « Horrea Academy – Progression »).
- Colonnes recommandées : `email`, `courseSlug`, `moduleId`, `status`, `score`, `type`, `date`.
- Partager le document avec l’email du **compte de service** (éditeur).
- Mettre l’ID du sheet dans `PROGRESSION_SHEET_ID`.

### Quiz

- **Questions** : un Google Sheet par quiz (ou une feuille par quiz). Ligne 1 = en-têtes, ex. `question`, `option_a`, `option_b`, `option_c`. Dans le JSON du module (`content/modules/<course>/<moduleId>.json`), renseigner `quizSheetId` avec l’ID du spreadsheet.
- **Résultats** : un Google Sheet pour les réponses (ex. « Résultats quiz »). Colonnes : `email`, `courseSlug`, `moduleId`, `score`, `date`, `answers` (JSON). Partager avec le compte de service. Mettre l’ID dans `QUIZ_RESULTS_SHEET_ID`.

### Compte de service

1. Google Cloud Console → Créer un projet (ou en choisir un) → Activer l’API Google Sheets.
2. IAM & Admin → Comptes de service → Créer un compte de service → Télécharger la clé JSON.
3. Dans Netlify (ou `.env.local`), définir `GOOGLE_SERVICE_ACCOUNT_JSON` avec le contenu du fichier JSON (en une ligne).

## Structure du contenu

- `content/courses/index.json` : liste des formations (slug, titre, description courte, durée, nombre de modules).
- `content/courses/<slug>.json` : détail d’une formation (titre, description, durée, `moduleIds`, `missionIds`).
- `content/modules/<courseSlug>/<moduleId>.json` : titre, description, `videoEmbedUrl` (Google Drive), `quizSheetId`, `documentEmbedUrl`, `presentationEmbedUrl`, `missionId`, `content`.
- `content/missions/<courseSlug>/<missionId>.json` : titre, contexte, objectif, instructions, livrable.

**Créer une nouvelle formation** : voir le guide [docs/CREATION_FORMATIONS.md](docs/CREATION_FORMATIONS.md) et les templates dans `content-templates/`.

## Formations incluses (exemples)

- **Shopify Fundamentals** : introduction, création de boutique, produits et collections, thème et personnalisation + mission « Créer une boutique test ».
- **Shopify Project Management** : gestion de projet e-commerce, méthodologie et outils, livraison et recette + mission « Brief et planning ».

## Scripts

- `npm run dev` : serveur de développement
- `npm run build` : build de production
- `npm run start` : serveur de production (après build)
- `npm run lint` : lint
- `node scripts/import-formation.js <fichier-formation-complete.json>` : importe une formation à partir d’un JSON unique (voir [docs/CREATION_FORMATIONS.md](docs/CREATION_FORMATIONS.md))
