import { google } from "googleapis";

/** "missing" = variable non définie, "invalid" = JSON invalide (souvent dû à un JSON sur plusieurs lignes dans .env). */
export function getQuizAuthDiagnostic(): "missing" | "invalid" | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw == null || raw.trim() === "") return "missing";
  try {
    JSON.parse(raw);
    return null;
  } catch {
    return "invalid";
  }
}

export function getQuizAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  } catch {
    return null;
  }
}

export function getQuizAuthWithWrite() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    });
  } catch {
    return null;
  }
}

export type QuizQuestion = { id: string; question: string; options: string[] };

export async function fetchQuizQuestions(
  spreadsheetId: string,
  sheetName: string
): Promise<QuizQuestion[]> {
  const auth = getQuizAuth();
  if (!auth) return [];

  const range = /^[A-Za-z0-9_]+$/.test(sheetName)
    ? `${sheetName}!A:G`
    : `'${sheetName.replace(/'/g, "''")}'!A:G`;
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];

  const headers = (rows[0] as string[]).map((h) => (h ?? "").toLowerCase());
  const questionIndex = headers.findIndex((h) => h.includes("question") || h === "question");
  const optionsStart = headers.findIndex((h) => h.includes("option") || h === "option_a");
  const questions: QuizQuestion[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as string[];
    const questionText = questionIndex >= 0 ? (row[questionIndex] ?? "") : row[0] ?? "";
    if (!questionText.trim()) continue;
    const options: string[] = [];
    if (optionsStart >= 0) {
      for (let j = optionsStart; j < row.length && j < optionsStart + 4; j++) {
        if (row[j]) options.push(String(row[j]).trim());
      }
    }
    questions.push({
      id: `q-${i}`,
      question: questionText.trim(),
      options: options.length ? options : ["Oui", "Non"],
    });
  }
  return questions;
}

type QuizRow = { reponse: string; explication: string };

export async function fetchQuizWithAnswers(
  spreadsheetId: string,
  sheetName: string
): Promise<QuizRow[]> {
  const auth = getQuizAuthWithWrite();
  if (!auth) return [];

  const range = /^[A-Za-z0-9_]+$/.test(sheetName)
    ? `${sheetName}!A:G`
    : `'${sheetName.replace(/'/g, "''")}'!A:G`;
  const sheets = google.sheets({ version: "v4", auth });
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

export async function appendQuizResult(
  email: string,
  courseSlug: string,
  moduleId: string,
  score: number,
  answers: { questionId: string; value: string }[]
): Promise<void> {
  const sheetId = process.env.QUIZ_RESULTS_SHEET_ID;
  if (!sheetId) return;
  const auth = getQuizAuthWithWrite();
  if (!auth) return;
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
}
