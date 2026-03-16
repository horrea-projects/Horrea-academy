#!/usr/bin/env node
/**
 * Importe une formation complète à partir d'un fichier JSON unique.
 * Usage: node scripts/import-formation.js <chemin-vers-formation-complete.json>
 *
 * Le fichier doit contenir: { course, modules, missions }
 * - course: { slug, title, description, duration, moduleIds, missionIds }
 * - modules: tableau d'objets module (id, title, description, duration, videoEmbedUrl, etc.)
 * - missions: tableau d'objets mission (id, title, context, objective, instructions, deliverable)
 */

const fs = require("fs");
const path = require("path");

const CONTENT_DIR = path.join(process.cwd(), "content");

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node scripts/import-formation.js <chemin-vers-formation-complete.json>");
    process.exit(1);
  }

  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath);
  if (!fs.existsSync(absolutePath)) {
    console.error("Fichier introuvable:", absolutePath);
    process.exit(1);
  }

  let data;
  try {
    const raw = fs.readFileSync(absolutePath, "utf-8");
    data = JSON.parse(raw);
  } catch (err) {
    console.error("Erreur lecture/JSON:", err.message);
    process.exit(1);
  }

  const { course, modules = [], missions = [] } = data;
  if (!course || !course.slug) {
    console.error("Le JSON doit contenir un objet 'course' avec au moins 'slug'.");
    process.exit(1);
  }

  const slug = course.slug;

  // 1. Mettre à jour content/courses/index.json
  const indexPath = path.join(CONTENT_DIR, "courses", "index.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  const existingIndex = index.courses.findIndex((c) => c.slug === slug);
  const catalogueEntry = {
    slug: course.slug,
    title: course.title,
    descriptionShort: course.descriptionShort || (course.description ? course.description.slice(0, 120) + (course.description.length > 120 ? "…" : "") : ""),
    duration: course.duration || "~0h",
    moduleCount: modules.length,
    ...(course.categoryId && { categoryId: course.categoryId }),
    addedAt: course.addedAt || new Date().toISOString().slice(0, 10),
  };
  if (existingIndex >= 0) {
    index.courses[existingIndex] = catalogueEntry;
  } else {
    index.courses.push(catalogueEntry);
  }
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n", "utf-8");
  console.log("Mis à jour:", indexPath);

  // 2. Écrire content/courses/{slug}.json
  const coursePath = path.join(CONTENT_DIR, "courses", `${slug}.json`);
  const coursePayload = {
    slug: course.slug,
    title: course.title,
    description: course.description || "",
    duration: course.duration || "~0h",
    moduleIds: course.moduleIds || modules.map((m) => m.id),
    missionIds: course.missionIds || missions.map((m) => m.id),
  };
  fs.writeFileSync(coursePath, JSON.stringify(coursePayload, null, 2) + "\n", "utf-8");
  console.log("Écrit:", coursePath);

  // 3. Écrire chaque module dans content/modules/{slug}/
  const modulesDir = path.join(CONTENT_DIR, "modules", slug);
  if (!fs.existsSync(modulesDir)) {
    fs.mkdirSync(modulesDir, { recursive: true });
  }
  for (const mod of modules) {
    const modulePayload = {
      id: mod.id,
      title: mod.title || "",
      description: mod.description || "",
      duration: mod.duration || "",
      videoEmbedUrl: mod.videoEmbedUrl || "",
      quizSheetId: mod.quizSheetId ?? "",
      missionId: mod.missionId ?? null,
      content: mod.content ?? "",
    };
    if (mod.documentEmbedUrl !== undefined) modulePayload.documentEmbedUrl = mod.documentEmbedUrl || "";
    if (mod.presentationEmbedUrl !== undefined) modulePayload.presentationEmbedUrl = mod.presentationEmbedUrl || "";
    const modulePath = path.join(modulesDir, `${mod.id}.json`);
    fs.writeFileSync(modulePath, JSON.stringify(modulePayload, null, 2) + "\n", "utf-8");
    console.log("Écrit:", modulePath);
  }

  // 4. Écrire chaque mission dans content/missions/{slug}/
  if (missions.length > 0) {
    const missionsDir = path.join(CONTENT_DIR, "missions", slug);
    if (!fs.existsSync(missionsDir)) {
      fs.mkdirSync(missionsDir, { recursive: true });
    }
    for (const mission of missions) {
      const missionPayload = {
        id: mission.id,
        title: mission.title || "",
        context: mission.context || "",
        objective: mission.objective || "",
        instructions: Array.isArray(mission.instructions) ? mission.instructions : [],
        deliverable: mission.deliverable || "",
      };
      const missionPath = path.join(missionsDir, `${mission.id}.json`);
      fs.writeFileSync(missionPath, JSON.stringify(missionPayload, null, 2) + "\n", "utf-8");
      console.log("Écrit:", missionPath);
    }
  }

  console.log("\nImport terminé pour la formation:", course.title);
}

main();
