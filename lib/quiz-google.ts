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

export type QuizSection = {
  id: string;
  title: string;
  description?: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  sectionId?: string;
};

export type QuizQuestionsPayload = {
  sections: QuizSection[];
  questions: QuizQuestion[];
};

function headerIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));
}

function optionIndexes(headers: string[]): number[] {
  return headers
    .map((h, idx) => ({ h, idx }))
    .filter(({ h }) => h.startsWith("option") || h.includes("option_"))
    .map(({ idx }) => idx)
    .sort((a, b) => a - b);
}

export async function fetchQuizQuestions(
  spreadsheetId: string,
  sheetName: string
): Promise<QuizQuestionsPayload> {
  const auth = getQuizAuth();
  if (!auth) return { sections: [], questions: [] };

  const range = /^[A-Za-z0-9_]+$/.test(sheetName)
    ? `${sheetName}!A:J`
    : `'${sheetName.replace(/'/g, "''")}'!A:J`;
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return { sections: [], questions: [] };

  const headers = (rows[0] as string[]).map((h) => (h ?? "").toLowerCase());
  const typeIndex = headerIndex(headers, ["type"]);
  const titleIndex = headerIndex(headers, ["title", "titre"]);
  const descriptionIndex = headerIndex(headers, ["description", "desc"]);
  const questionIndex = headerIndex(headers, ["question"]);
  const optionCols = optionIndexes(headers);

  const sections: QuizSection[] = [];
  const questions: QuizQuestion[] = [];
  let currentSectionId: string | undefined;
  let questionCounter = 0;
  let sectionCounter = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as string[];
    const type = typeIndex >= 0 ? String(row[typeIndex] ?? "").trim().toLowerCase() : "";
    const title = titleIndex >= 0 ? String(row[titleIndex] ?? "").trim() : "";
    const description = descriptionIndex >= 0 ? String(row[descriptionIndex] ?? "").trim() : "";
    const questionText = questionIndex >= 0 ? (row[questionIndex] ?? "") : row[0] ?? "";

    // Ligne section (nouveau format) :
    // - type=section, OU (fallback doux) title présent et pas de question.
    const isSectionRow = type === "section" || (!!title && !String(questionText).trim() && type !== "question");
    if (isSectionRow) {
      if (!title) continue;
      sectionCounter += 1;
      const sectionId = `s-${sectionCounter}`;
      sections.push({
        id: sectionId,
        title,
        ...(description ? { description } : {}),
      });
      currentSectionId = sectionId;
      continue;
    }

    // Lignes questions : type=question ou legacy (type vide)
    if (type && type !== "question") continue;
    if (!String(questionText).trim()) continue;

    const options: string[] = [];
    for (const colIdx of optionCols) {
      const raw = row[colIdx];
      if (raw != null && String(raw).trim()) options.push(String(raw).trim());
    }
    questionCounter += 1;
    questions.push({
      id: `q-${questionCounter}`,
      question: String(questionText).trim(),
      options: options.length ? options : ["Oui", "Non"],
      ...(currentSectionId ? { sectionId: currentSectionId } : {}),
    });
  }
  return { sections, questions };
}

type QuizRow = { reponse: string; explication: string };

export async function fetchQuizWithAnswers(
  spreadsheetId: string,
  sheetName: string
): Promise<QuizRow[]> {
  const auth = getQuizAuthWithWrite();
  if (!auth) return [];

  const range = /^[A-Za-z0-9_]+$/.test(sheetName)
    ? `${sheetName}!A:J`
    : `'${sheetName.replace(/'/g, "''")}'!A:J`;
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];

  const headers = (rows[0] as string[]).map((h) => (h ?? "").toLowerCase());
  const typeIndex = headerIndex(headers, ["type"]);
  const questionIndex = headerIndex(headers, ["question"]);
  const reponseIndex = headerIndex(headers, ["reponse"]);
  const explicationIndex = headerIndex(headers, ["explication"]);

  const out: QuizRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as string[];
    const type = typeIndex >= 0 ? String(row[typeIndex] ?? "").trim().toLowerCase() : "";
    if (type === "section") continue;
    if (type && type !== "question") continue;
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
