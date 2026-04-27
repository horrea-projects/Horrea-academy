# Horrea Academy

Plateforme interne de formation pour les équipes Horrea. Parcours pratiques autour du digital commerce (Shopify et autres thématiques à venir).

## Stack

- **Frontend** : Next.js 16, React 19, Tailwind CSS, shadcn/ui
- **Auth** : Clerk (connexion Google SSO)
- **Contenu** : import/export JSON + gestion via interface d'administration (persistance Supabase)
- **Vidéos** : Google Drive (embed iframe)
- **Quiz & progression** : Google Sheets via Netlify Functions (compte de service)
- **Hébergement** : Coolify (VPS Hostinger, proxy Traefik)

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

## Deploiement sur Coolify (VPS)

1. **Connecter le depot**
   - Dans Coolify : creer une nouvelle application depuis le repository GitHub.
   - Build pack : Nixpacks (Node.js).
   - Port interne de l'application : `3000`.

2. **Variables d'environnement (Coolify)**
   Renseigner au minimum :
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `GOOGLE_SERVICE_ACCOUNT_JSON` (si quiz/progression Google Sheets)
   - `PROGRESSION_SHEET_ID` (si active)
   - `QUIZ_RESULTS_SHEET_ID` (si active)
   - `NIXPACKS_NODE_VERSION=22`

3. **Domaine**
   - Ajouter le FQDN dans le champ `Domains` de l'application.
   - Exemple : `https://academy.horrea.fr:3000` (le `:3000` cible le port interne du conteneur).
   - Cote DNS, creer un enregistrement `A` vers l'IP du VPS (ex. `academy -> 72.60.186.18`).

4. **Deploiement**
   - Lancer le deploiement depuis Coolify.
   - Verifier que l'application repond bien sur le domaine configure.

5. **Clerk en production**
   Dans le dashboard Clerk, configurer l'URL de production (ex. `https://academy.horrea.fr`) et les redirect URLs associees.

### Notes operations proxy

- Le proxy Coolify (Traefik) doit etre le frontal principal sur les ports `80/443`.
- Si vous maintenez des routes manuelles dans `/data/coolify/proxy/dynamic/*.yaml`, verifier les backends apres chaque redeploiement (les noms de conteneurs peuvent changer).
- En phase de test via `sslip.io`, un certificat auto-signe peut etre servi (avertissement navigateur normal tant que Let's Encrypt n'est pas actif pour ce host).

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
