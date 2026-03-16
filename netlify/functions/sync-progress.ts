import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

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

  try {
    const { error } = await supabase.from("user_progress").insert({
      email,
      course_slug: courseSlug,
      module_id: moduleId,
      status,
      score: score ?? null,
      type: type ?? "module",
      date: new Date().toISOString(),
    });

    if (error) {
      console.error("Erreur insertion user_progress", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Erreur lors de l’écriture dans la base de données" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erreur inattendue lors de l’enregistrement de la progression" }),
    };
  }
};
