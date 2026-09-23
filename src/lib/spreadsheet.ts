import Papa from "papaparse";
import * as XLSX from "xlsx";

export type SpreadsheetData = {
  headers: string[];
  rows: Record<string, string>[];
};

function cellString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function fromObjects(records: Record<string, unknown>[]): SpreadsheetData {
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const rec of records) {
    for (const k of Object.keys(rec)) {
      if (seen.has(k) || !k.trim()) continue;
      seen.add(k);
      headers.push(k);
    }
  }
  const rows = records
    .map((rec) => {
      const row: Record<string, string> = {};
      for (const h of headers) row[h] = cellString(rec[h]);
      return row;
    })
    .filter((row) => headers.some((h) => row[h]));
  return { headers, rows };
}

export function parseCsvText(text: string): SpreadsheetData {
  const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: "greedy" });
  if (parsed.errors.length && !parsed.data.length) {
    throw new Error(parsed.errors[0]?.message ?? "Could not parse CSV");
  }
  return fromObjects(parsed.data);
}

export function parseXlsxBuffer(buf: ArrayBuffer): SpreadsheetData {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) throw new Error("Workbook has no sheets");
  const sheet = wb.Sheets[name];
  if (!sheet) throw new Error("Workbook has no sheets");
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  return fromObjects(json);
}

export async function parseSpreadsheetFile(file: File): Promise<SpreadsheetData> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv" || file.type === "text/plain") {
    return parseCsvText(await file.text());
  }
  if (name.endsWith(".xlsx") || file.type.includes("spreadsheetml")) {
    return parseXlsxBuffer(await file.arrayBuffer());
  }
  throw new Error("Use a .csv or .xlsx file");
}
