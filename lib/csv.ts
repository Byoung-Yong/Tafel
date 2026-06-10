export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

function splitLine(line: string, delimiter: string): string[] {
  if (delimiter === 'whitespace') {
    return line.trim().split(/\s+/).map((cell) => cell.trim());
  }

  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"' && inQuotes) {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return delimiter === '|' ? cells.filter((cell) => cell.length > 0) : cells;
}

function hasHeader(cells: string[]): boolean {
  return cells.some((cell) => !Number.isFinite(Number(cell)));
}

function detectDelimiter(headerLine: string): string {
  const candidates = [',', '\t', ';', '|', 'whitespace'];
  const best = candidates
    .map((delimiter) => ({ delimiter, count: splitLine(headerLine, delimiter).length }))
    .sort((a, b) => b.count - a.count)[0];
  return best.count > 1 ? best.delimiter : ',';
}

export function parseCsv(text: string): ParsedCsv {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 1) {
    throw new Error('Data must contain at least one row.');
  }

  const delimiter = detectDelimiter(lines[0]);
  const firstCells = splitLine(lines[0], delimiter);
  const firstRowIsHeader = hasHeader(firstCells);
  const headers = firstRowIsHeader
    ? firstCells.map((h) => h.trim())
    : firstCells.map((_, index) => `column_${index + 1}`);
  const dataLines = firstRowIsHeader ? lines.slice(1) : lines;

  if (dataLines.length < 1) {
    throw new Error('Data must contain at least one data row.');
  }

  const rows = dataLines.map((line) => {
    const cells = splitLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });

  return { headers, rows };
}
