import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const CONTENT_DIR = path.join(process.cwd(), "content");

export async function GET() {
  const indexPath = path.join(CONTENT_DIR, "courses", "index.json");
  if (!fs.existsSync(indexPath)) {
    return NextResponse.json({ courses: [] });
  }
  const raw = fs.readFileSync(indexPath, "utf-8");
  const data = JSON.parse(raw) as { courses: unknown[] };
  return NextResponse.json(data);
}
