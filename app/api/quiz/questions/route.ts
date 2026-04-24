import { NextResponse } from "next/server";
import { fetchQuizQuestions, getQuizAuth, getQuizAuthDiagnostic } from "@/lib/quiz-google";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const quizSpreadsheetId = searchParams.get("quizSpreadsheetId");
  const quizSheetName = searchParams.get("quizSheetName");
  const quizSheetId = searchParams.get("quizSheetId");

  let spreadsheetId: string;
  let sheetName: string;

  if (quizSpreadsheetId && quizSheetName) {
    spreadsheetId = quizSpreadsheetId;
    sheetName = quizSheetName.trim() || "Sheet1";
  } else if (quizSheetId) {
    spreadsheetId = quizSheetId;
    sheetName = "Sheet1";
  } else {
    return NextResponse.json(
      { error: "quizSpreadsheetId + quizSheetName, ou quizSheetId requis" },
      { status: 400 }
    );
  }

  const auth = getQuizAuth();
  if (!auth) {
    const diag = getQuizAuthDiagnostic();
    const message =
      diag === "missing"
        ? "GOOGLE_SERVICE_ACCOUNT_JSON absent. Ajoutez-le dans .env.local puis redémarrez le serveur (pnpm dev)."
        : "GOOGLE_SERVICE_ACCOUNT_JSON invalide. Dans .env.local le JSON doit être sur une seule ligne (sans retours à la ligne). Redémarrez le serveur après modification.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  try {
    const { sections, questions } = await fetchQuizQuestions(spreadsheetId, sheetName);
    return NextResponse.json({ sections, questions });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Impossible de lire le Google Sheet" },
      { status: 500 }
    );
  }
}
