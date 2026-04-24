import type { Handler, HandlerEvent } from "@netlify/functions";
import { google } from "googleapis";

const getAuth = () => {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly", "https://www.googleapis.com/auth/spreadsheets"],
    });
    return auth;
  } catch {
    return null;
  }
};

type QuizRow = { reponse: string; explication: string };
type GoogleAuthClient = NonNullable<ReturnType<typeof getAuth>>;

async function fetchQuizWithAnswers(
  auth: GoogleAuthClient,
  spreadsheetId: string,
  sheetName: string
): Promise<QuizRow[]> {
  const range = /^[A-Za-z0-9_]+$/.test(sheetName) ? `${sheetName}!A:G` : `'${sheetName.replace(/'/g, "''")}'!A:G`;
  const sheets = google.sheets({ version: "v4", auth: auth! });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];

  const headers = (rows[0] as string[]).map((h) => (h ?? "").toLowerCase());
  const questionIndex = headers.findIndex((h) => h.includes("question") || h === "question");
  const optionsStart = headers.findIndex((h) => h.includes("option") || h === "option_a");
  const reponseIndex = headers.findIndex((h) => h === "reponse" || h.includes("reponse"));
  const explicationIndex = headers.findIndex((h) => h === "explication" || h.includes("explication"));

  const out: QuizRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as string[];
    const questionText = questionIndex >= 0 ? (row[questionIndex] ?? "") : row[0] ?? "";
    if (!questionText.trim()) continue;
    const reponse = reponseIndex >= 0 ? String(row[reponseIndex] ?? "").trim() : "";
    const explication = explicationIndex >= 0 ? String(row[explicationIndex] ?? "").trim() : "";
    out.push({ reponse, explication });
  }
  return out;
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const auth = getAuth();
  if (!auth) {
    return {
      statusCode: 503,
      body: JSON.stringify({ error: "GOOGLE_SERVICE_ACCOUNT_JSON non configuré" }),
    };
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
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Body JSON invalide" }) };
  }

  const { email, courseSlug, moduleId, answers, quizSpreadsheetId, quizSheetName, quizSheetId } = body;
  if (!email || !courseSlug || !moduleId || !Array.isArray(answers)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "email, courseSlug, moduleId, answers requis" }),
    };
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
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "quizSpreadsheetId et quizSheetName (ou quizSheetId) requis pour le calcul du score" }),
    };
  }

  let quizRows: QuizRow[];
  try {
    quizRows = await fetchQuizWithAnswers(auth, spreadsheetId, sheetName);
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Impossible de lire le fichier quiz pour la correction" }),
    };
  }

  const results: { questionId: string; correct: boolean; explanation: string }[] = [];
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
    });
  }

  const total = Math.max(results.length, quizRows.length);
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const sheetId = process.env.QUIZ_RESULTS_SHEET_ID;
  if (sheetId) {
    try {
      const sheets = google.sheets({ version: "v4", auth });
      const date = new Date().toISOString();
      const answersStr = JSON.stringify(answers);
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Sheet1!A:F",
        valueInputOption: "RAW",
        requestBody: {
          values: [[email, courseSlug, moduleId, score, date, answersStr]],
        },
      });
    } catch (err) {
      console.error("Append QUIZ_RESULTS_SHEET_ID", err);
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      score,
      total,
      correctCount,
      results,
    }),
  };
};
