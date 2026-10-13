#!/usr/bin/env node
/**
 * Smoke-test core SQL paths against a local DATABASE_URL (no Clerk).
 */
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("OK:", msg);
  }
}

try {
  const cats = await sql`
    SELECT id, slug, label, icon, parent_id
    FROM categories
    WHERE status = 'published'
    ORDER BY label ASC
  `;
  assert(cats.length >= 1, `published categories (${cats.length})`);

  const courses = await sql`
    SELECT c.id, c.slug, c.title,
      CASE WHEN cat.id IS NULL THEN NULL ELSE json_build_object('slug', cat.slug) END AS categories
    FROM courses c
    LEFT JOIN categories cat ON cat.id = c.category_id
    WHERE c.status = 'published'
    ORDER BY c.added_at DESC NULLS LAST
  `;
  assert(courses.length >= 1, `published courses (${courses.length})`);
  assert(courses[0].categories?.slug === "shopify", "course embeds category slug");

  const courseId = courses[0].id;
  const modules = await sql`
    SELECT module_slug, title, position, quiz_sheet_name, min_quiz_score
    FROM course_modules WHERE course_id = ${courseId} ORDER BY position ASC
  `;
  assert(modules.length >= 1, `course modules (${modules.length})`);

  const missions = await sql`
    SELECT mission_slug, title FROM course_missions WHERE course_id = ${courseId}
  `;
  assert(missions.length >= 1, `course missions (${missions.length})`);

  const progress = await sql`
    SELECT module_id, type, score FROM user_progress
    WHERE email = ${"learner@horrea.test"} AND course_slug = ${"shopify-fundamentals"} AND status = 'completed'
  `;
  assert(progress.length >= 1, `user progress rows (${progress.length})`);

  const authors = await sql`
    SELECT clerk_id, email, name FROM app_users ORDER BY email
  `;
  assert(authors.length >= 2, `app_users (${authors.length})`);

  const userMetiers = await sql`
    SELECT um.id, um.clerk_id,
      CASE WHEN m.id IS NULL THEN NULL
        ELSE json_build_object('id', m.id, 'slug', m.slug, 'label', m.label, 'description', m.description)
      END AS metiers
    FROM user_metiers um
    LEFT JOIN metiers m ON m.id = um.metier_id
    WHERE um.clerk_id = ${"user_learner"}
  `;
  assert(userMetiers.length >= 1 && userMetiers[0].metiers?.slug === "chef-projet", "user_metiers join");

  // Upsert like syncClerkUser
  await sql`
    INSERT INTO app_users ${sql(
      {
        clerk_id: "user_smoke",
        email: "smoke@horrea.test",
        name: "Smoke",
        is_admin: false,
        updated_at: new Date().toISOString(),
      },
      "clerk_id",
      "email",
      "name",
      "is_admin",
      "updated_at"
    )}
    ON CONFLICT (clerk_id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      is_admin = EXCLUDED.is_admin,
      updated_at = EXCLUDED.updated_at
  `;
  const smoke = await sql`SELECT email FROM app_users WHERE clerk_id = ${"user_smoke"}`;
  assert(smoke[0]?.email === "smoke@horrea.test", "upsert app_users");

  // Insert progress then delete (reset-module pattern)
  await sql`
    INSERT INTO user_progress (email, course_slug, module_id, status, type, score, date)
    VALUES (${"smoke@horrea.test"}, ${"shopify-fundamentals"}, ${"intro"}, ${"completed"}, ${"quiz"}, ${88}, ${new Date().toISOString()})
  `;
  const del = await sql`
    DELETE FROM user_progress
    WHERE email = ${"smoke@horrea.test"}
      AND course_slug = ${"shopify-fundamentals"}
      AND module_id = ${"intro"}
      AND type = ANY(${["module", "quiz"]})
    RETURNING id
  `;
  assert(del.length >= 1, "delete progress by type ANY");

  console.log(failed === 0 ? "\nAll smoke checks passed." : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await sql.end({ timeout: 2 });
}
