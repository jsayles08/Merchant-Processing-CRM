export type ParsedResidualImportRow = {
  lineNumber: number;
  merchant_id?: string;
  business_name?: string;
  agent_id?: string;
  month?: string;
  processing_volume: number;
  net_residual: number;
};

export type ResidualImportParseResult = {
  rows: ParsedResidualImportRow[];
  errors: string[];
};

const headerAliases: Record<string, keyof ParsedResidualImportRow> = {
  merchantid: "merchant_id",
  merchant_id: "merchant_id",
  businessname: "business_name",
  business_name: "business_name",
  merchant: "business_name",
  agentid: "agent_id",
  agent_id: "agent_id",
  month: "month",
  statementmonth: "month",
  statement_month: "month",
  processingvolume: "processing_volume",
  processing_volume: "processing_volume",
  volume: "processing_volume",
  netresidual: "net_residual",
  net_residual: "net_residual",
  residual: "net_residual",
};

export function parseProcessorResidualCsv(csvText: string): ResidualImportParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [], errors: ["Upload a CSV with a header row and at least one residual row."] };
  }

  const headers = splitCsvLine(lines[0]).map((header) => headerAliases[normalizeHeader(header)] ?? null);
  const rows: ParsedResidualImportRow[] = [];
  const errors: string[] = [];

  for (const [index, line] of lines.slice(1).entries()) {
    const lineNumber = index + 2;
    const cells = splitCsvLine(line);
    const row: Partial<ParsedResidualImportRow> = { lineNumber };

    headers.forEach((header, cellIndex) => {
      if (!header) return;
      const value = cells[cellIndex]?.trim();
      if (!value) return;

      assignResidualImportValue(row, header, value);
    });

    if (!row.merchant_id && !row.business_name) {
      errors.push(`Line ${lineNumber}: include merchant_id or business_name.`);
      continue;
    }

    if (!Number.isFinite(row.processing_volume)) {
      errors.push(`Line ${lineNumber}: processing_volume is required.`);
      continue;
    }

    if (!Number.isFinite(row.net_residual)) {
      errors.push(`Line ${lineNumber}: net_residual is required.`);
      continue;
    }

    rows.push(row as ParsedResidualImportRow);
  }

  return { rows, errors };
}

function assignResidualImportValue(
  row: Partial<ParsedResidualImportRow>,
  header: keyof ParsedResidualImportRow,
  value: string,
) {
  switch (header) {
    case "processing_volume":
    case "net_residual":
      row[header] = parseMoney(value);
      break;
    case "lineNumber":
      row.lineNumber = Number(value);
      break;
    default:
      row[header] = value;
  }
}

export function normalizeImportMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Choose a valid statement month.");
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function parseMoney(value: string) {
  const normalized = value.replace(/[$,\s]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : Number.NaN;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}
