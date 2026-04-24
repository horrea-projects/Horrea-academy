import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function requireAdmin() {
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;
  if (!user || !isAdmin) return null;
  return user;
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

  let body: { slug?: string; label?: string; icon?: string; parent_id?: string | null; onboarding_title?: string; onboarding_content?: string; onboarding_presentation_embed_url?: string; onboarding_quiz_sheet_id?: string; onboarding_quiz_sheet_name?: string; approved?: boolean; status?: string; created_by?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.status !== undefined && ["pending", "draft", "published"].includes(body.status)) updates.status = body.status;
  if (body.approved !== undefined) updates.approved = !!body.approved;
  if (body.created_by !== undefined) updates.created_by = body.created_by === "" || body.created_by === null ? null : body.created_by;
  if (body.slug !== undefined) {
    updates.slug = body.slug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || undefined;
  }
  if (body.label !== undefined) updates.label = body.label.trim() || undefined;
  if (body.icon !== undefined) updates.icon = body.icon.trim() || "book";
  if (body.parent_id !== undefined) {
    const v = body.parent_id?.trim() || null;
    updates.parent_id = v === "__none__" || v === "" ? null : v;
  }
  if (body.onboarding_title !== undefined) updates.onboarding_title = body.onboarding_title?.trim() || null;
  if (body.onboarding_content !== undefined) updates.onboarding_content = body.onboarding_content?.trim() || null;
  if (body.onboarding_presentation_embed_url !== undefined) updates.onboarding_presentation_embed_url = body.onboarding_presentation_embed_url?.trim() || null;
  if (body.onboarding_quiz_sheet_id !== undefined) updates.onboarding_quiz_sheet_id = body.onboarding_quiz_sheet_id?.trim() || null;
  if (body.onboarding_quiz_sheet_name !== undefined) updates.onboarding_quiz_sheet_name = body.onboarding_quiz_sheet_name?.trim() || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  if (updates.parent_id === id) {
    return NextResponse.json({ error: "Une catégorie ne peut pas être sa propre parente." }, { status: 400 });
  }

  const optionalColumns = ["parent_id", "approved", "status", "created_by", "onboarding_quiz_sheet_id", "onboarding_quiz_sheet_name"];
  const selectMinimal = "id, slug, label, icon, onboarding_title, onboarding_content, onboarding_presentation_embed_url";
  const selectFull = "id, slug, label, icon, parent_id, onboarding_title, onboarding_content, onboarding_presentation_embed_url, onboarding_quiz_sheet_id, onboarding_quiz_sheet_name, approved, status, created_by";

  function extractMissingColumn(message: string | null): string | null {
    if (!message) return null;
    const m = message.match(/'([a-z_]+)'\s*column/);
    return m ? m[1] : null;
  }

  let payload = { ...updates } as Record<string, unknown>;
  let result = await supabaseAdmin.from("categories").update(payload).eq("id", id).select(selectFull).single();

  while (result.error && (result.error.code === "42703" || result.error.code === "PGRST204" || result.error.message?.includes("schema cache"))) {
    const col = extractMissingColumn(result.error.message ?? null);
    if (col && optionalColumns.includes(col) && col in payload) {
      delete payload[col];
      result = await supabaseAdmin.from("categories").update(payload).eq("id", id).select(selectMinimal).single();
    } else {
      break;
    }
  }

  if (!result.error) {
    const data = (result.data ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      category: {
        ...data,
        parent_id: data.parent_id ?? updates.parent_id ?? null,
        created_by: data.created_by ?? updates.created_by ?? null,
        approved: (data.approved as boolean) ?? (updates.approved as boolean) ?? (body.status === "published"),
        status: (data.status as string) ?? (updates.status as string) ?? body.status ?? "draft",
        onboarding_quiz_sheet_id: data.onboarding_quiz_sheet_id ?? updates.onboarding_quiz_sheet_id ?? null,
        onboarding_quiz_sheet_name: data.onboarding_quiz_sheet_name ?? updates.onboarding_quiz_sheet_name ?? null,
      },
    });
  }

  if (result.error) {
    if (result.error.code === "23505") return NextResponse.json({ error: "Ce slug est déjà utilisé." }, { status: 400 });
    if (result.error.code === "23503") return NextResponse.json({ error: "La catégorie parente n'existe pas." }, { status: 400 });
    console.error(result.error);
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
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

  const { error } = await supabaseAdmin.from("categories").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "Impossible de supprimer : cette catégorie est utilisée (formations ou sous-catégories)." },
        { status: 400 }
      );
    }
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
