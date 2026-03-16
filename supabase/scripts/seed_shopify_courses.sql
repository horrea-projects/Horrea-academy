-- Seed des deux formations Shopify en base (remplacer les formations en fichier).
-- À exécuter dans le SQL Editor Supabase. La catégorie "shopify" est créée si absente.
--
-- Si votre table courses a une colonne "status" au lieu de "published", après exécution lancez :
--   UPDATE public.courses SET status = 'published' WHERE slug IN ('shopify-fundamentals', 'shopify-project-management');

-- 1. Catégorie Shopify (si absente)
INSERT INTO public.categories (slug, label, icon)
VALUES ('shopify', 'Shopify', 'store')
ON CONFLICT (slug) DO NOTHING;

-- 2. Formation Shopify Fundamentals
INSERT INTO public.courses (slug, title, description, duration, category_id, published, added_at)
SELECT
  'shopify-fundamentals',
  'Shopify Fundamentals',
  'Cette formation vous permet de maîtriser les fondamentaux de Shopify : création d''une boutique, gestion des produits et des collections, personnalisation du thème. À l''issue du parcours, vous serez capable de déployer une boutique de test et de comprendre l''écosystème Shopify.',
  '~4h',
  c.id,
  true,
  '2025-01-15'::date
FROM public.categories c
WHERE c.slug = 'shopify'
LIMIT 1
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  duration = EXCLUDED.duration,
  category_id = EXCLUDED.category_id,
  published = EXCLUDED.published;

-- 3. Formation Shopify Project Management
INSERT INTO public.courses (slug, title, description, duration, category_id, published, added_at)
SELECT
  'shopify-project-management',
  'Shopify Project Management',
  'Apprenez à piloter un projet e-commerce sur Shopify : méthodologie, outils de suivi et bonnes pratiques de livraison. Cette formation s''adresse aux chefs de projet et responsables digitaux qui accompagnent des lancements ou refontes de boutiques.',
  '~3h',
  c.id,
  true,
  '2025-01-10'::date
FROM public.categories c
WHERE c.slug = 'shopify'
LIMIT 1
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  duration = EXCLUDED.duration,
  category_id = EXCLUDED.category_id,
  published = EXCLUDED.published;

-- 4. Modules Shopify Fundamentals (avec course_id récupéré)
DO $$
DECLARE
  cid uuid;
BEGIN
  SELECT id INTO cid FROM public.courses WHERE slug = 'shopify-fundamentals' LIMIT 1;
  IF cid IS NOT NULL THEN
    INSERT INTO public.course_modules (course_id, module_slug, title, description, duration, video_embed_url, content, position)
    VALUES
      (cid, '01-intro', 'Introduction à Shopify', 'Découverte de l''écosystème Shopify : qu''est-ce qu''une boutique en ligne, les concepts clés (produits, collections, thèmes), et le back-office.', '30 min', '', 'Shopify est une plateforme e-commerce complète qui permet de créer et gérer une boutique en ligne sans compétences techniques avancées. Vous y retrouverez : l''admin pour gérer produits et commandes, le thème pour l''apparence, et les apps pour étendre les fonctionnalités.', 0),
      (cid, '02-create-store', 'Créer une boutique', 'Création d''un compte Shopify, configuration de base (domaine, devise, livraison) et premiers pas dans l''admin.', '45 min', '', 'Nous verrons comment créer un compte Shopify (essai gratuit), configurer les paramètres de base de la boutique (nom, devise, zone géographique), et naviguer dans l''interface d''administration.', 1),
      (cid, '03-products-collections', 'Produits et collections', 'Ajout de produits, variantes, images, et organisation en collections.', '1h', '', 'Gestion du catalogue : créer des produits (titre, description, prix, images), gérer les variantes (taille, couleur), et organiser les produits dans des collections manuelles ou automatiques.', 2),
      (cid, '04-theme-customization', 'Thème et personnalisation', 'Choisir un thème, personnaliser les couleurs et blocs, et publier les changements.', '1h', '', 'Personnalisation de l''apparence : installation d''un thème, utilisation de l''éditeur de thème (sections, blocs), et bonnes pratiques pour une boutique professionnelle.', 3)
    ON CONFLICT (course_id, module_slug) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      duration = EXCLUDED.duration,
      content = EXCLUDED.content,
      position = EXCLUDED.position;
  END IF;
END $$;

-- 5. Modules Shopify Project Management
DO $$
DECLARE
  cid uuid;
BEGIN
  SELECT id INTO cid FROM public.courses WHERE slug = 'shopify-project-management' LIMIT 1;
  IF cid IS NOT NULL THEN
    INSERT INTO public.course_modules (course_id, module_slug, title, description, duration, video_embed_url, content, position)
    VALUES
      (cid, '01-gestion-projet', 'Gestion de projet e-commerce', 'Les spécificités d''un projet e-commerce : livrables, jalons et acteurs.', '45 min', '', 'Un projet e-commerce sur Shopify implique plusieurs phases : cadrage, design, intégration, contenu, tests et mise en production. Nous verrons les rôles (client, chef de projet, développeur, rédacteur) et les livrables attendus.', 0),
      (cid, '02-methodologie', 'Méthodologie et outils', 'Outils et bonnes pratiques pour piloter un projet Shopify.', '45 min', '', 'Outils et bonnes pratiques pour piloter un projet Shopify : brief, rétroplanning, suivi des validations et points réguliers avec le client.', 1),
      (cid, '03-livraison-projet', 'Livraison et recette', 'Phase de recette, bascule et mise en production.', '45 min', '', 'Phase de recette : checklist de validation, formation à l''admin Shopify, bascule du domaine et mise en production. Documentation et transfert de compétences.', 2)
    ON CONFLICT (course_id, module_slug) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      duration = EXCLUDED.duration,
      content = EXCLUDED.content,
      position = EXCLUDED.position;
  END IF;
END $$;

-- 6. Mission Shopify Fundamentals
DO $$
DECLARE
  cid uuid;
BEGIN
  SELECT id INTO cid FROM public.courses WHERE slug = 'shopify-fundamentals' LIMIT 1;
  IF cid IS NOT NULL THEN
    INSERT INTO public.course_missions (course_id, mission_slug, title, context, objective, instructions, deliverable)
    VALUES (
      cid,
      '01-mission-boutique',
      'Créer une boutique test',
      'Vous êtes en stage chez Horrea. Votre responsable vous demande de créer une boutique Shopify de démonstration pour un client fictif « La Maison du Thé ». L''objectif est de valider que vous maîtrisez la création de compte, l''ajout de quelques produits et la personnalisation basique du thème.',
      'Livrer l''URL d''une boutique Shopify en mode test (ou essai gratuit) contenant au moins 3 produits et un thème personnalisé (couleurs ou texte de la page d''accueil).',
      '["Créer un compte Shopify (essai gratuit si besoin).","Configurer le nom de la boutique et les paramètres de base (devise EUR).","Ajouter au moins 3 produits (nom, description, prix, image si possible).","Choisir un thème et personnaliser au moins la page d''accueil (titre ou couleurs).","Noter l''URL de la boutique et la communiquer à votre formateur (ou la renseigner dans le suivi de progression)."]'::jsonb,
      'URL de la boutique Shopify (ex. https://la-maison-du-the.myshopify.com) + capture d''écran de la page d''accueil si demandé.'
    )
    ON CONFLICT (course_id, mission_slug) DO UPDATE SET
      title = EXCLUDED.title,
      context = EXCLUDED.context,
      objective = EXCLUDED.objective,
      instructions = EXCLUDED.instructions,
      deliverable = EXCLUDED.deliverable;
  END IF;
END $$;

-- 7. Mission Shopify Project Management
DO $$
DECLARE
  cid uuid;
BEGIN
  SELECT id INTO cid FROM public.courses WHERE slug = 'shopify-project-management' LIMIT 1;
  IF cid IS NOT NULL THEN
    INSERT INTO public.course_missions (course_id, mission_slug, title, context, objective, instructions, deliverable)
    VALUES (
      cid,
      '01-mission-brief',
      'Rédiger un brief projet et un planning',
      'Horrea doit lancer un projet de refonte e-commerce pour un client « Sport & Co ». Vous êtes chef de projet junior. On vous demande de produire un brief projet et un rétroplanning sur 8 semaines (design, intégration Shopify, contenu, recette, mise en production).',
      'Produire un document de brief (objectifs, périmètre, livrables, acteurs) et un planning type (jalons et phases) pour un projet Shopify.',
      '["Rédiger un court brief projet (1 page) : objectifs, périmètre (pages, fonctionnalités), livrables attendus, acteurs (client, Horrea, rôles).","Construire un rétroplanning sur 8 semaines avec les phases : cadrage, design, intégration, contenu, recette, mise en production.","Indiquer les points de validation client (jalons) et les livrables à chaque phase.","Soumettre le document (PDF ou lien Google Doc) à votre formateur ou le déposer dans l''espace indiqué."]'::jsonb,
      'Document brief + planning (PDF ou lien partagé). Une fois réalisé, marquer la mission comme complétée dans la plateforme pour enregistrer la progression.'
    )
    ON CONFLICT (course_id, mission_slug) DO UPDATE SET
      title = EXCLUDED.title,
      context = EXCLUDED.context,
      objective = EXCLUDED.objective,
      instructions = EXCLUDED.instructions,
      deliverable = EXCLUDED.deliverable;
  END IF;
END $$;

-- Les formations sont visibles via published = true. Si votre table a une colonne "status",
-- exécutez à part : UPDATE public.courses SET status = 'published' WHERE slug IN ('shopify-fundamentals', 'shopify-project-management');
