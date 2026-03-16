import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Liste des catégories approuvées (utilisateur connecté). Utilisé par la page « Proposer une formation ». */
export async function GET() {
  const user = await currentUser();
  if (!user) {
    return new NextResponse("Non authentifié", { status: 401 });
  }

  const selectCols = "id, slug, label, icon";
  let result = await supabaseAdmin
    .from("categories")
    .select(selectCols)
    .eq("status", "published")
    .order("label");

  if (result.error?.code === "42703") {
    result = await supabaseAdmin.from("categories").select(selectCols).eq("approved", true).order("label");
  }
  if (result.error?.code === "42703") {
    result = await supabaseAdmin.from("categories").select(selectCols).order("label");
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

  const { data: existing } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Une catégorie avec ce slug existe déjà." }, { status: 400 });
  }

  const insertPayload: Record<string, unknown> = {
    slug,
    label: label || slug,
    icon,
    status: "pending",
    created_by: user.id,
  };

  let result = await supabaseAdmin
    .from("categories")
    .insert(insertPayload)
    .select("id, slug, label, icon")
    .single();

  if (result.error?.code === "42703") {
    const fallback = { slug, label: label || slug, icon, approved: false, created_by: user.id } as Record<string, unknown>;
    result = await supabaseAdmin.from("categories").insert(fallback).select("id, slug, label, icon").single();
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
