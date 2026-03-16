import type { Handler, HandlerEvent } from "@netlify/functions";
import { google } from "googleapis";

const getAuth = () => {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    return auth;
  } catch {
    return null;
  }
};

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const params = event.queryStringParameters ?? {};
  // Nouveau : un fichier par formation, on identifie la feuille par son nom
  const quizSpreadsheetId = params.quizSpreadsheetId;
  const quizSheetName = params.quizSheetName;
  // Ancien : un spreadsheet ID par quiz (lit la feuille "Sheet1")
  const quizSheetId = params.quizSheetId;

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
      body: JSON.stringify({ error: "quizSpreadsheetId + quizSheetName, ou quizSheetId requis" }),
    };
  }

  const auth = getAuth();
  if (!auth) {
    return {
      statusCode: 503,
      body: JSON.stringify({ error: "GOOGLE_SERVICE_ACCOUNT_JSON non configuré" }),
    };
  }

  // Colonnes A à G (question, option_a..d, reponse, explication) — on n'envoie pas reponse/explication au client
  const range = /^[A-Za-z0-9_]+$/.test(sheetName) ? `${sheetName}!A:G` : `'${sheetName.replace(/'/g, "''")}'!A:G`;

  try {
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = res.data.values ?? [];
    if (rows.length < 2) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: [] }),
      };
    }
    const headers = (rows[0] as string[]).map((h) => (h ?? "").toLowerCase());
    const questionIndex = headers.findIndex((h) => h.includes("question") || h === "question");
    const optionsStart = headers.findIndex((h) => h.includes("option") || h === "option_a");
    const questions: { id: string; question: string; options: string[] }[] = [];
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
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Impossible de lire le Google Sheet" }),
    };
  }
};
