import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getMetiersWithFormations } from "@/lib/metiers";
import sql, { dbResult, dbSingle } from "@/lib/db";

async function requireAdmin() {
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;
  if (!user || !isAdmin) return null;
  return user;
}

type MetierRow = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  try {
    const metiers = await getMetiersWithFormations();
    return NextResponse.json({ metiers });
  } catch (err) {
    console.error("GET /api/admin/metiers", err);
    return NextResponse.json({ error: "Erreur lecture métiers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  let body: { slug: string; label: string; description?: string; course_slugs?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }
  const slug =
    (body.slug ?? "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") ||
    "metier";
  const label = (body.label ?? "").trim() || slug;
  const description = (body.description ?? "").trim() || null;
  const course_slugs = Array.isArray(body.course_slugs)
    ? body.course_slugs.filter((s) => typeof s === "string" && s.trim())
    : [];

  const updatedAt = new Date().toISOString();
  const { data: metier, error: insertError } = await dbSingle(() =>
    sql<MetierRow[]>`
      INSERT INTO metiers ${sql(
        { slug, label, description, updated_at: updatedAt },
        "slug",
        "label",
        "description",
        "updated_at"
      )}
      RETURNING id, slug, label, description, created_at, updated_at
    `
  );

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Un métier avec ce slug existe déjà." }, { status: 400 });
    }
    console.error(insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const metierId = (metier as { id: string }).id;
  if (course_slugs.length > 0) {
    const { error: formError } = await dbResult(() =>
      sql`
        INSERT INTO metier_formations ${sql(
          course_slugs.map((course_slug) => ({ metier_id: metierId, course_slug })),
          "metier_id",
          "course_slug"
        )}
      `
    );
    if (formError) console.error("metier_formations insert", formError);
  }

  const result = { ...(metier as object), course_slugs };
  return NextResponse.json({ metier: result });
}
