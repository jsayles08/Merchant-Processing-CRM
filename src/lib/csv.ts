export type CsvCell = string | number | boolean | null | undefined;

export function toCsv(rows: Record<string, CsvCell>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ];

  return lines.join("\n");
}

function escapeCsv(value: CsvCell) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  if (!/[",\n\r]/.test(stringValue)) return stringValue;
  return `"${stringValue.replaceAll('"', '""')}"`;
}
