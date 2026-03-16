# Intégration Google (Docs, Sheets, Slides, Vidéos) dans les formations

## Pourquoi « docs.google.com n'autorise pas la connexion » ?

Ce message apparaît lorsque le contenu Google est affiché dans une **iframe** sur un site dont le domaine n’est pas autorisé par Google. Google restreint l’affichage en iframe pour des raisons de sécurité (X-Frame-Options / Content-Security-Policy). Même avec un fichier « partagé avec toute personne disposant du lien », l’embed peut être refusé sur certains sites.

## Process pour rendre les fichiers accessibles

### 1. Partager le fichier

- **Google Docs / Sheets / Slides** : Ouvrir le fichier → Partager → « Limité » → Changer en **« Toute personne disposant du lien »** (lecteur ou commentateur selon le besoin).
- **Vidéos (Google Drive)** : Clic droit sur la vidéo → Partager → Même réglage.

Sans cela, seuls les comptes explicitement invités peuvent accéder au contenu (et l’embed échoue souvent).

### 2. Obtenir l’URL d’embed correcte

- **Google Docs**  
  - Fichier → Partager → Publier sur le Web → « Intégrer » → copier l’URL dans `src="..."`.  
  - Format typique : `https://docs.google.com/document/d/ID_DU_DOC/preview`.

- **Google Sheets**  
  - Pour un onglet : Fichier → Partager → Publier sur le Web → choisir l’onglet → « Intégrer » → copier l’URL.

- **Google Slides**  
  - Fichier → Partager → Publier sur le Web → « Intégrer » → copier l’URL.  
  - Format : `https://docs.google.com/presentation/d/ID/embed`.

- **Vidéos (Drive)**  
  - Ouvrir la vidéo dans Drive → ⋮ → Intégrer l’élément → copier l’URL d’embed (avec `/preview` ou `/embed`).

Utilisez toujours l’URL fournie par Google pour l’**intégration** (embed), pas l’URL de simple consultation.

### 3. Vérifier le domaine (si l’embed est bloqué)

Si après partage et bonne URL vous voyez encore « n’autorise pas la connexion » :

- Votre site doit être en **HTTPS**.
- Le domaine (ex. `votresite.com` ou `*.netlify.app`) n’est en général **pas** configurable côté Google pour autoriser l’embed. Les restrictions dépendent de Google et peuvent varier selon le type de document.

## Alternative : lien d’ouverture dans un nouvel onglet

Si l’embed reste bloqué sur votre domaine, proposez un **lien « Ouvrir dans un nouvel onglet »** à côté (ou à la place) de l’iframe :

- L’utilisateur clique → le Doc/Sheet/Slide/Vidéo s’ouvre dans un nouvel onglet.
- Le partage « toute personne disposant du lien » suffit pour que le lien fonctionne.

Dans l’admin, vous pouvez stocker à la fois :

- **URL d’embed** : pour l’iframe (si Google l’accepte sur votre domaine).
- **URL de consultation** : pour le bouton « Ouvrir dans un nouvel onglet » en secours.

Résumé : **partage « toute personne disposant du lien »** + **URL d’embed fournie par Google** + si besoin **lien d’ouverture dans un nouvel onglet** pour garantir l’accès aux contenus dans les formations.
