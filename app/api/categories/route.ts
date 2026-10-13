import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import sql, { dbResult, dbSingle, dbMaybeSingle, isUndefinedColumnError } from "@/lib/db";

type CategoryRow = { id: string; slug: string; label: string; icon: string };

/** Liste des catégories approuvées (utilisateur connecté). Utilisé par la page « Proposer une formation ». */
export async function GET() {
  const user = await currentUser();
  if (!user) {
    return new NextResponse("Non authentifié", { status: 401 });
  }

  let result = await dbResult(async () =>
    await sql<CategoryRow[]>`
      SELECT id, slug, label, icon
      FROM categories
      WHERE status = ${"published"}
      ORDER BY label ASC
    `
  );

  if (isUndefinedColumnError(result.error)) {
    result = await dbResult(async () =>
      await sql<CategoryRow[]>`
        SELECT id, slug, label, icon
        FROM categories
        WHERE approved = true
        ORDER BY label ASC
      `
    );
  }
  if (isUndefinedColumnError(result.error)) {
    result = await dbResult(async () =>
      await sql<CategoryRow[]>`
        SELECT id, slug, label, icon
        FROM categories
        ORDER BY label ASC
      `
    );
  }
  if (result.error) {
    console.error(result.error);
    return NextResponse.json({ error: "Erreur lecture catégories" }, { status: 500 });
  }
  return NextResponse.json({ categories: result.data ?? [] });
}

/** Proposer une nouvelle catégorie (non admin). Créée avec approved: false. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return new NextResponse("Non authentifié", { status: 401 });
  }
  if (user.publicMetadata?.isAdmin === true) {
    return new NextResponse("Utilisez l’administration pour créer une catégorie.", { status: 403 });
  }

  let body: { slug?: string; label?: string; icon?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const label = (body.label ?? "").trim();
  const slug = (body.slug ?? label).trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "nouvelle-categorie";
  const icon = (body.icon ?? "").trim() || "book";

  const { data: existing } = await dbMaybeSingle(async () =>
    await sql<{ id: string }[]>`
      SELECT id FROM categories WHERE slug = ${slug} LIMIT 2
    `
  );
  if (existing) {
    return NextResponse.json({ error: "Une catégorie avec ce slug existe déjà." }, { status: 400 });
  }

  let result = await dbSingle(async () =>
    await sql<CategoryRow[]>`
      INSERT INTO categories ${sql(
        {
          slug,
          label: label || slug,
          icon,
          status: "pending",
          created_by: user.id,
        },
        "slug",
        "label",
        "icon",
        "status",
        "created_by"
      )}
      RETURNING id, slug, label, icon
    `
  );

  if (isUndefinedColumnError(result.error)) {
    result = await dbSingle(async () =>
      await sql<CategoryRow[]>`
        INSERT INTO categories ${sql(
          {
            slug,
            label: label || slug,
            icon,
            approved: false,
            created_by: user.id,
          },
          "slug",
          "label",
          "icon",
          "approved",
          "created_by"
        )}
        RETURNING id, slug, label, icon
      `
    );
  }

  if (result.error) {
    if (result.error.code === "23505") {
      return NextResponse.json({ error: "Une catégorie avec ce slug existe déjà." }, { status: 400 });
    }
    console.error(result.error);
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ category: result.data });
}
