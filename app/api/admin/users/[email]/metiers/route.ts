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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { email } = await params;
  const decodedEmail = decodeURIComponent(email ?? "");
  if (!decodedEmail) return NextResponse.json({ error: "Email manquant" }, { status: 400 });

  let body: { metier_ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const metierIds = Array.isArray(body.metier_ids) ? body.metier_ids.filter((id) => typeof id === "string" && id.trim()) : [];

  const { data: appUser, error: userError } = await supabaseAdmin
    .from("app_users")
    .select("clerk_id")
    .ilike("email", decodedEmail)
    .maybeSingle();

  if (userError || !appUser?.clerk_id) {
    return NextResponse.json(
      { error: "Utilisateur non trouvé (aucun compte avec cet email). L'assignation de parcours nécessite une connexion." },
      { status: 404 }
    );
  }

  const clerkId = (appUser as { clerk_id: string }).clerk_id;

  const { error: delError } = await supabaseAdmin.from("user_metiers").delete().eq("clerk_id", clerkId);
  if (delError) {
    console.error(delError);
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  if (metierIds.length > 0) {
    const { error: insError } = await supabaseAdmin.from("user_metiers").insert(
      metierIds.map((metier_id) => ({
        clerk_id: clerkId,
        metier_id,
        assigned_by: adminUser.id,
      }))
    );
    if (insError) {
      console.error(insError);
      return NextResponse.json({ error: insError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
