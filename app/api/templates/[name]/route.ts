import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const ALLOWED_NAMES = ["formation-complete", "course", "module", "mission"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const safeName = name.replace(/[^a-z0-9-]/gi, "");
  if (!ALLOWED_NAMES.includes(safeName)) {
    return NextResponse.json({ error: "Template inconnu" }, { status: 400 });
  }

  const templatePath = path.join(
    process.cwd(),
    "content-templates",
    `${safeName}.template.json`
  );
  if (!fs.existsSync(templatePath)) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }

  const raw = fs.readFileSync(templatePath, "utf-8");
  const contentType = "application/json";
  const filename = `${safeName}.template.json`;

  return new NextResponse(raw, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
