import type { Handler, HandlerEvent } from "@netlify/functions";
import postgres from "postgres";

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body: { email?: string; courseSlug?: string; moduleId?: string; status?: string; score?: number; type?: string };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Body JSON invalide" }) };
  }

  const { email, courseSlug, moduleId, status, score, type } = body;
  if (!email || !courseSlug || !moduleId || !status) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "email, courseSlug, moduleId, status requis" }),
    };
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "DATABASE_URL manquant" }),
    };
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await sql`
      INSERT INTO user_progress ${sql(
        {
          email,
          course_slug: courseSlug,
          module_id: moduleId,
          status,
          score: score ?? null,
          type: type ?? "module",
          date: new Date().toISOString(),
        },
        "email",
        "course_slug",
        "module_id",
        "status",
        "score",
        "type",
        "date"
      )}
    `;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("Erreur insertion user_progress", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erreur lors de l’écriture dans la base de données" }),
    };
  } finally {
    await sql.end();
  }
};
