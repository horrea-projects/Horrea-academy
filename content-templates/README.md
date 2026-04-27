# Templates de formation

Ces fichiers servent de modeles pour creer une nouvelle formation sans toucher au code.

- **course.template.json** : à enregistrer sous `content/courses/{slug}.json`. Penser à ajouter une entrée dans `content/courses/index.json` (slug, title, descriptionShort, duration, moduleCount).
- **module.template.json** : un fichier par module, à enregistrer sous `content/modules/{courseSlug}/{moduleId}.json`. Les champs `documentEmbedUrl`, `presentationEmbedUrl`, `quizSheetId`, `missionId` et `content` peuvent être vides ou null.
- **mission.template.json** : à enregistrer sous `content/missions/{courseSlug}/{missionId}.json`.
- **formation-complete.template.json** : un seul JSON (course + modules + missions) pour generation par outil (ex. ChatGPT). Une fois rempli, importer via l'admin ou utiliser le script d'import : `node scripts/import-formation.js chemin/vers/formation-complete.json`.
- **quiz-google-sheet-template.md** : structure attendue pour les quiz (un fichier Google Sheet par formation, une feuille par quiz). **quiz-feuille-exemple.csv** : exemple à importer dans une feuille Google Sheet.

Voir [docs/CREATION_FORMATIONS.md](../docs/CREATION_FORMATIONS.md) pour le guide complet.
