# Template Google Sheet pour les quiz (Horrea Academy)

Une **formation** utilise **un seul fichier Google Sheet** pour tous ses quiz. Chaque **feuille (onglet)** du fichier correspond à un quiz : une feuille par module (optionnel) + une feuille pour le quiz final.

## Structure du fichier

1. Créez un nouveau Google Sheet.
2. **Renommez la première feuille** (ex. `Module 01` ou `01-intro`) pour le quiz du premier module.
3. **Ajoutez autant de feuilles** que nécessaire : une par quiz de module, plus une pour le quiz final (ex. `Quiz final` ou `Test final`).
4. Le **nom exact de l’onglet** est à renseigner dans l’admin :  
   - pour chaque module : « Nom de la feuille (quiz du module) »,  
   - pour la formation : « Nom de la feuille du quiz final ».

## Structure d’une feuille (onglet)

Chaque feuille doit avoir **la même structure** :

- **Ligne 1** : en-têtes (obligatoire).
- **Colonnes** (ordre recommandé) :
  - Une colonne dont l’en-tête contient `question` (ou `Question`) : texte de la question.
  - Des colonnes pour les options : en-têtes contenant `option` ou `option_a`, `option_b`, `option_c`, `option_d`, etc.

Les en-têtes reconnus (insensibles à la casse) :

- Pour la question : `question` ou contenant "question".
- Pour les options : `option_a`, `option_b`, … ou tout en-tête contenant "option".

Vous pouvez avoir jusqu’à 5 options par question. S’il n’y a pas d’options détectées, "Oui" et "Non" sont proposées par défaut.

## Exemple de contenu (à coller dans une feuille)

Ligne 1 (en-têtes) :

```
question,option_a,option_b,option_c
```

Ligne 2 et suivantes (une ligne par question) :

```
Quelle est la capitale de la France ?,Paris,Lyon,Marseille
Quel framework utilise cette formation ?,Next.js,React,Vue
```

## Fichier CSV d’exemple

Le fichier `quiz-feuille-exemple.csv` contient un exemple que vous pouvez importer dans Google Sheet (Fichier > Importer > Téléverser, puis créer une feuille par quiz en important ce format).

## Récapitulatif dans l’admin

- **Formation** : champ « ID du fichier Google Sheet » = l’ID dans l’URL du Sheet  
  (`https://docs.google.com/spreadsheets/d/ **ID_ICI** /edit`).
- **Formation** : champ « Nom de la feuille du quiz final » = nom exact de l’onglet du quiz final (ex. `Quiz final`).
- **Chaque module** : champ « Nom de la feuille (quiz du module) » = nom exact de l’onglet pour ce module (ex. `01-intro`, `Module 02`).

## Partage du Sheet

Partagez le fichier Google Sheet en **lecture** avec le compte de service utilisé par l’application (variable `GOOGLE_SERVICE_ACCOUNT_JSON` / compte de service). Sans cela, les quiz ne pourront pas être chargés.
