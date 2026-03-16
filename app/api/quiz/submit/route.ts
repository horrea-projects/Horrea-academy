import { NextResponse } from "next/server";
import {
  fetchQuizWithAnswers,
  getQuizAuthWithWrite,
  getQuizAuthDiagnostic,
  appendQuizResult,
} from "@/lib/quiz-google";

export async function POST(request: Request) {
  const auth = getQuizAuthWithWrite();
  if (!auth) {
    const diag = getQuizAuthDiagnostic();
    const message =
      diag === "missing"
        ? "GOOGLE_SERVICE_ACCOUNT_JSON absent. Ajoutez-le dans .env.local puis redémarrez le serveur (pnpm dev)."
        : "GOOGLE_SERVICE_ACCOUNT_JSON invalide. Dans .env.local le JSON doit être sur une seule ligne (sans retours à la ligne). Redémarrez le serveur après modification.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  let body: {
    email?: string;
    courseSlug?: string;
    moduleId?: string;
    answers?: { questionId: string; value: string }[];
    quizSpreadsheetId?: string;
    quizSheetName?: string;
    quizSheetId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { email, courseSlug, moduleId, answers, quizSpreadsheetId, quizSheetName, quizSheetId } = body;
  if (!email || !courseSlug || !moduleId || !Array.isArray(answers)) {
    return NextResponse.json(
      { error: "email, courseSlug, moduleId, answers requis" },
      { status: 400 }
    );
  }

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
      {
        error:
          "quizSpreadsheetId et quizSheetName (ou quizSheetId) requis pour le calcul du score",
      },
      { status: 400 }
    );
  }

  let quizRows: { reponse: string; explication: string }[];
  try {
    quizRows = await fetchQuizWithAnswers(spreadsheetId, sheetName);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Impossible de lire le fichier quiz pour la correction" },
      { status: 500 }
    );
  }

  const results: { questionId: string; correct: boolean; explanation: string; correctAnswer: string }[] = [];
  let correctCount = 0;
  const norm = (s: string) => s.trim().toLowerCase();

  for (const a of answers) {
    const idx = parseInt(a.questionId.replace("q-", ""), 10);
    const row = quizRows[idx - 1];
    const correct = row ? norm(row.reponse) === norm(a.value) : false;
    if (correct) correctCount++;
    results.push({
      questionId: a.questionId,
      correct,
      explanation: row?.explication ?? "",
      correctAnswer: row?.reponse ?? "",
    });
  }

  const total = Math.max(results.length, quizRows.length);
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  try {
    await appendQuizResult(email, courseSlug, moduleId, score, answers);
  } catch (err) {
    console.error("Append QUIZ_RESULTS_SHEET_ID", err);
  }

  return NextResponse.json({
    ok: true,
    score,
    total,
    correctCount,
    results,
  });
}
