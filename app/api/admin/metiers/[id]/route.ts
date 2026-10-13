import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getMetierById } from "@/lib/metiers";
import sql, { dbResult } from "@/lib/db";

async function requireAdmin() {
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;
  if (!user || !isAdmin) return null;
  return user;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });
  const metier = await getMetierById(id);
  if (!metier) return NextResponse.json({ error: "Métier introuvable" }, { status: 404 });
  return NextResponse.json({ metier });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

  let body: { slug?: string; label?: string; description?: string; course_slugs?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.slug !== undefined) {
    updates.slug =
      (body.slug ?? "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") ||
      undefined;
  }
  if (body.label !== undefined) updates.label = (body.label ?? "").trim() || undefined;
  if (body.description !== undefined) updates.description = (body.description ?? "").trim() || null;
  updates.updated_at = new Date().toISOString();

  for (const k of Object.keys(updates)) {
    if (updates[k] === undefined) delete updates[k];
  }

  // updated_at is always set; only run UPDATE when there is at least one other field
  if (Object.keys(updates).length > 1) {
    const keys = Object.keys(updates);
    const { error: updateError } = await dbResult(() =>
      sql`
        UPDATE metiers SET ${sql(updates, ...keys)}
        WHERE id = ${id}
      `
    );
    if (updateError) {
      if (updateError.code === "23505") {
        return NextResponse.json({ error: "Ce slug est déjà utilisé." }, { status: 400 });
      }
      console.error(updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  if (body.course_slugs !== undefined) {
    const course_slugs = Array.isArray(body.course_slugs)
      ? body.course_slugs.filter((s) => typeof s === "string" && s.trim())
      : [];
    const { error: delError } = await dbResult(() =>
      sql`
        DELETE FROM metier_formations
        WHERE metier_id = ${id}
      `
    );
    if (delError) {
      console.error(delError);
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }
    if (course_slugs.length > 0) {
      const { error: insError } = await dbResult(() =>
        sql`
          INSERT INTO metier_formations ${sql(
            course_slugs.map((course_slug) => ({ metier_id: id, course_slug })),
            "metier_id",
            "course_slug"
          )}
        `
      );
      if (insError) {
        console.error(insError);
        return NextResponse.json({ error: insError.message }, { status: 500 });
      }
    }
  }

  const metier = await getMetierById(id);
  return NextResponse.json({
    metier: metier ?? { id, slug: "", label: "", description: null, course_slugs: [] },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

  const { error } = await dbResult(() =>
    sql`
      DELETE FROM metiers
      WHERE id = ${id}
    `
  );
  if (error) {
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "Impossible de supprimer : ce métier est assigné à des utilisateurs." },
        { status: 400 }
      );
    }
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
