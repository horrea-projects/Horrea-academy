import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Liste minimale des utilisateurs (clerk_id, email) pour les sélecteurs d’auteur. Admin uniquement. */
export async function GET() {
  const user = await currentUser();
  if (!user?.publicMetadata?.isAdmin) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("clerk_id, email, name")
    .order("email");
  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur lecture utilisateurs" }, { status: 500 });
  }
  return NextResponse.json({
    users: (data ?? []).map((u: { clerk_id: string; email: string; name?: string | null }) => ({
      clerk_id: u.clerk_id,
      email: u.email,
      name: u.name ?? undefined,
    })),
  });
}
