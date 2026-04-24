import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { TEMPLATE_ZIP_README } from "@/lib/template-zip-readme";

const TEMPLATE_NAMES = ["formation-complete", "course", "module", "mission"] as const;

export async function GET() {
  const templatesDir = path.join(process.cwd(), "content-templates");

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  zip.file("README.md", TEMPLATE_ZIP_README);

  const examplePath = path.join(templatesDir, "formation-complete.example.json");
  if (fs.existsSync(examplePath)) {
    zip.file("formation-complete.example.json", fs.readFileSync(examplePath, "utf-8"));
  }

  const quizExamplePath = path.join(templatesDir, "quiz-exemple.csv");
  if (fs.existsSync(quizExamplePath)) {
    zip.file("quiz-exemple.csv", fs.readFileSync(quizExamplePath, "utf-8"));
  }

  for (const name of TEMPLATE_NAMES) {
    const filePath = path.join(templatesDir, `${name}.template.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const filename = name === "formation-complete" ? "formation-complete.template.json" : `${name}.template.json`;
      zip.file(filename, raw);
    }
  }

  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
  const zipBlob = new Blob([zipBuffer], { type: "application/zip" });
  return new NextResponse(zipBlob, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="horrea-academy-templates.zip"',
    },
  });
}
