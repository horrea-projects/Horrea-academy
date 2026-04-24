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

export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const selectCols = "id, slug, label, icon, onboarding_title, onboarding_content, onboarding_presentation_embed_url, onboarding_quiz_sheet_id, onboarding_quiz_sheet_name";
  const selectColsWithoutQuiz = "id, slug, label, icon, onboarding_title, onboarding_content, onboarding_presentation_embed_url";
  const selectColsMinimal = "id, slug, label, icon";
  let result: { data: unknown; error: { code?: string; message?: string } | null } = await supabaseAdmin
    .from("categories")
    .select(`${selectCols}, parent_id, created_by, approved, status`)
    .order("label");

  if (result.error && (result.error.code === "42703" || result.error.code === "PGRST204")) {
    result = await supabaseAdmin
      .from("categories")
      .select(`${selectColsWithoutQuiz}, parent_id, created_by, approved, status`)
      .order("label");
  }
  if (result.error && (result.error.code === "42703" || result.error.code === "PGRST204")) {
    result = await supabaseAdmin
      .from("categories")
      .select(`${selectColsWithoutQuiz}, parent_id, created_by, approved`)
      .order("label");
  }
  if (result.error && (result.error.code === "42703" || result.error.code === "PGRST204")) {
    result = await supabaseAdmin
      .from("categories")
      .select(selectColsMinimal)
      .order("label");
  }
  if (result.error) {
    console.error(result.error);
    return NextResponse.json({ error: "Erreur lecture catégories" }, { status: 500 });
  }

  const raw = (result.data ?? []) as Array<Record<string, unknown>>;
  const rows = raw.map((r) => {
    const hasApproved = "approved" in r && r.approved !== undefined;
    const hasStatus = "status" in r && (r as { status?: string }).status != null;
    const approved = hasApproved ? !!(r as { approved?: boolean }).approved : undefined;
    const status = hasStatus
      ? (r as { status?: string }).status
      : hasApproved
        ? (approved ? "published" : "pending")
        : "draft";
    return {
      ...r,
      parent_id: (r as { parent_id?: string | null }).parent_id ?? null,
      created_by: (r as { created_by?: string | null }).created_by ?? null,
      approved: status === "published",
      status: status ?? "draft",
    };
  });
  const withAuthors = await resolveCategoryAuthors(rows);
  const withStats = await addCategoryStats(withAuthors);
  return NextResponse.json({ categories: withStats });
}

async function resolveCategoryAuthors(
  rows: Array<Record<string, unknown> & { created_by?: string | null }>
): Promise<Array<Record<string, unknown>>> {
  const clerkIds = [...new Set((rows.map((r) => r.created_by).filter(Boolean) as string[]))];
  if (clerkIds.length === 0) return rows.map((r) => ({ ...r, author_email: null }));
  const { data: appUsers } = await supabaseAdmin
    .from("app_users")
    .select("clerk_id, email")
    .in("clerk_id", clerkIds);
  const emailByClerk = Object.fromEntries(((appUsers ?? []) as { clerk_id: string; email: string }[]).map((u) => [u.clerk_id, u.email]));
  return rows.map((r) => ({ ...r, author_email: r.created_by ? emailByClerk[r.created_by] ?? r.created_by : null }));
}

async function addCategoryStats(
  rows: Array<Record<string, unknown> & { id?: string }>
): Promise<Array<Record<string, unknown>>> {
  const categoryIds = rows.map((r) => r.id).filter(Boolean) as string[];
  if (categoryIds.length === 0) return rows.map((r) => ({ ...r, course_count: 0, completed_users_count: 0 }));

  const { data: coursesData } = await supabaseAdmin
    .from("courses")
    .select("id, slug, category_id")
    .in("category_id", categoryIds);
  const courses = (coursesData ?? []) as { id: string; slug: string; category_id: string }[];

  const courseCountByCategoryId: Record<string, number> = {};
  for (const id of categoryIds) courseCountByCategoryId[id] = 0;
  for (const c of courses) {
    if (c.category_id) courseCountByCategoryId[c.category_id] = (courseCountByCategoryId[c.category_id] ?? 0) + 1;
  }

  const courseIds = courses.map((c) => c.id);
  const [moduleCountRes, progressRes] = await Promise.all([
    courseIds.length > 0
      ? supabaseAdmin.from("course_modules").select("course_id").in("course_id", courseIds)
      : Promise.resolve({ data: [] as { course_id: string }[] }),
    supabaseAdmin
      .from("user_progress")
      .select("email, course_slug, module_id")
      .eq("type", "module")
      .eq("status", "completed"),
  ]);

  const moduleCountByCourseId: Record<string, number> = {};
  for (const row of moduleCountRes.data ?? []) {
    const cid = (row as { course_id: string }).course_id;
    moduleCountByCourseId[cid] = (moduleCountByCourseId[cid] ?? 0) + 1;
  }
  const slugByCourseId = new Map(courses.map((c) => [c.id, c.slug]));
  const totalModulesBySlug: Record<string, number> = {};
  for (const c of courses) {
    totalModulesBySlug[c.slug] = moduleCountByCourseId[c.id] ?? 0;
  }

  const completedByUserSlug = new Map<string, number>();
  for (const row of progressRes.data ?? []) {
    const email = (row as { email: string }).email?.toLowerCase();
    const slug = (row as { course_slug: string }).course_slug;
    if (!email || !slug) continue;
    const key = `${email}:${slug}`;
    completedByUserSlug.set(key, (completedByUserSlug.get(key) ?? 0) + 1);
  }

  const completedEmailsByCategoryId = new Map<string, Set<string>>();
  for (const id of categoryIds) completedEmailsByCategoryId.set(id, new Set());
  for (const c of courses) {
    const total = totalModulesBySlug[c.slug] ?? 0;
    if (total === 0) continue;
    const categoryId = c.category_id;
    if (!categoryId) continue;
    const set = completedEmailsByCategoryId.get(categoryId) ?? new Set<string>();
    for (const [key, count] of completedByUserSlug) {
      const [, slug] = key.split(":");
      if (slug === c.slug && count >= total) {
        const email = key.split(":")[0];
        set.add(email);
      }
    }
    completedEmailsByCategoryId.set(categoryId, set);
  }

  return rows.map((r) => ({
    ...r,
    course_count: courseCountByCategoryId[(r as { id: string }).id] ?? 0,
    completed_users_count: completedEmailsByCategoryId.get((r as { id: string }).id)?.size ?? 0,
  }));
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let body: { slug: string; label: string; icon: string; parent_id?: string | null; status?: string; created_by?: string | null; onboarding_title?: string; onboarding_content?: string; onboarding_presentation_embed_url?: string; onboarding_quiz_sheet_id?: string; onboarding_quiz_sheet_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const slug = (body.slug ?? "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "categorie";
  const label = (body.label ?? "").trim() || slug;
  const icon = (body.icon ?? "").trim() || "book";
  const rawParent = body.parent_id?.trim() || null;
  const parent_id = rawParent === "__none__" || rawParent === "" ? null : rawParent;
  const status = ["pending", "draft", "published"].includes(body.status ?? "") ? body.status : "draft";
  const created_by = body.created_by === "" || body.created_by == null ? user.id : body.created_by;
  const onboarding_title = body.onboarding_title?.trim() || null;
  const onboarding_content = body.onboarding_content?.trim() || null;
  const onboarding_presentation_embed_url = body.onboarding_presentation_embed_url?.trim() || null;
  const onboarding_quiz_sheet_id = body.onboarding_quiz_sheet_id?.trim() || null;
  const onboarding_quiz_sheet_name = body.onboarding_quiz_sheet_name?.trim() || null;

  const selectCols = "id, slug, label, icon, onboarding_title, onboarding_content, onboarding_presentation_embed_url, onboarding_quiz_sheet_id, onboarding_quiz_sheet_name";
  const selectColsWithoutQuiz = "id, slug, label, icon, onboarding_title, onboarding_content, onboarding_presentation_embed_url";
  const insertPayload = {
    slug,
    label,
    icon,
    onboarding_title,
    onboarding_content,
    onboarding_presentation_embed_url,
    onboarding_quiz_sheet_id,
    onboarding_quiz_sheet_name,
    parent_id,
    created_by,
    status,
    approved: status === "published",
  } as Record<string, unknown>;

  let result: { data: unknown; error: { code?: string; message?: string } | null } = await supabaseAdmin
    .from("categories")
    .insert(insertPayload)
    .select(`${selectCols}, parent_id, created_by, approved, status`)
    .single();

  const schemaError = result.error?.code === "42703" || result.error?.code === "PGRST204" || result.error?.message?.includes("schema cache") || result.error?.message?.includes("approved");
  if (schemaError) {
    const fallbackPayload: Record<string, unknown> = {
      slug,
      label,
      icon,
      onboarding_title,
      onboarding_content,
      onboarding_presentation_embed_url,
      onboarding_quiz_sheet_id,
      onboarding_quiz_sheet_name,
    };
    if (parent_id != null) fallbackPayload.parent_id = parent_id;
    if (created_by != null) fallbackPayload.created_by = created_by;
    result = await supabaseAdmin
      .from("categories")
      .insert(fallbackPayload)
      .select(selectCols)
      .single();
    if (result.error && (result.error.code === "42703" || result.error.code === "PGRST204")) {
      delete fallbackPayload.onboarding_quiz_sheet_id;
      delete fallbackPayload.onboarding_quiz_sheet_name;
      result = await supabaseAdmin.from("categories").insert(fallbackPayload).select(selectColsWithoutQuiz).single();
    }
    if (result.error && (result.error.code === "42703" || result.error.code === "PGRST204")) {
      delete fallbackPayload.parent_id;
      delete fallbackPayload.created_by;
      result = await supabaseAdmin.from("categories").insert(fallbackPayload).select(selectColsWithoutQuiz).single();
    }
    if (result.error?.code === "23505") {
      const { data: existing } = await supabaseAdmin.from("categories").select(selectCols).eq("slug", slug).single();
      if (existing) return NextResponse.json({ category: { ...existing, parent_id: null, created_by: user.id, approved: true, status: "draft" } });
    }
  }

  if (result.error) {
    if (result.error.code === "23505") return NextResponse.json({ error: "Une catégorie avec ce slug existe déjà." }, { status: 400 });
    console.error(result.error);
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const data = result.data as Record<string, unknown>;
  const category = {
    ...data,
    parent_id: data?.parent_id ?? null,
    created_by: data?.created_by ?? user.id,
    approved: (data?.approved as boolean) ?? true,
    status: (data?.status as string) ?? status,
  };
  return NextResponse.json({ category });
}
