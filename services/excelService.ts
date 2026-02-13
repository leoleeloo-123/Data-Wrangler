
import { RowFilter } from "../types";

declare const XLSX: any;

export interface ExcelSheetInfo {
  name: string;
  headers?: string[];
  previewRows?: any[];
}

/**
 * Internal cache for file buffers to prevent redundant disk/memory reads.
 */
const bufferCache = new Map<string, ArrayBuffer>();

const getFileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

const getFileBuffer = async (file: File): Promise<ArrayBuffer> => {
  const key = getFileKey(file);
  if (bufferCache.has(key)) return bufferCache.get(key)!;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      bufferCache.set(key, buffer);
      resolve(buffer);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Utility to convert 0-based column index to Excel column name (A, B, C... Z, AA, AB...)
 */
export const getExcelColumnName = (idx: number): string => {
  let name = '';
  let i = idx;
  while (i >= 0) {
    name = String.fromCharCode((i % 26) + 65) + name;
    i = Math.floor(i / 26) - 1;
  }
  return name;
};

/**
 * Lightweight extraction of workbook metadata (Sheet names only).
 * Targeted to be near-instant even for 50MB+ files.
 */
export const parseExcelMetadata = async (file: File): Promise<ExcelSheetInfo[]> => {
  try {
    const buffer = await getFileBuffer(file);
    // CRITICAL: We only read the sheet names, skipping all cell content
    const workbook = XLSX.read(new Uint8Array(buffer), { 
      type: 'array', 
      bookSheets: true,
      bookProps: false,
      bookDeps: false,
      cellFormula: false,
      cellHTML: false,
      cellText: false,
      cellStyles: false
    });
    return workbook.SheetNames.map((name: string) => ({ name }));
  } catch (err) {
    console.error("[ExcelService] Metadata extraction failed:", err);
    throw err;
  }
};

/**
 * Detects headers for a specific sheet at a given row index.
 * Uses range-limiting to avoid parsing the entire sheet.
 */
export const getSheetHeaders = async (file: File, sheetName: string, startRow: number, minCols: number = 0): Promise<string[]> => {
  const buffer = await getFileBuffer(file);
  
  // Only parse the specific sheet and only enough rows to find the header
  const workbook = XLSX.read(new Uint8Array(buffer), { 
    type: 'array', 
    sheets: [sheetName],
    sheetRows: startRow + 5, // Minimal read
    bookProps: false,
    bookDeps: false
  });

  if (!workbook.SheetNames.includes(sheetName)) {
    throw new Error(`Sheet "${sheetName}" not found.`);
  }

  const worksheet = workbook.Sheets[sheetName];
  const ref = worksheet['!ref'] || 'A1:A1';
  const decodedRef = XLSX.utils.decode_range(ref);
  const fileEndCol = decodedRef.e.c;
  
  const maxCols = Math.max(fileEndCol + 1, minCols);

  const rawRows = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1, 
    range: startRow, 
    defval: "" 
  }) as any[][];

  if (!rawRows || rawRows.length === 0) return Array.from({ length: maxCols }, (_, i) => `Column ${getExcelColumnName(i)}`);

  const headerRow = rawRows[0] || [];
  const headers: string[] = [];

  for (let i = 0; i < maxCols; i++) {
    const val = String(headerRow[i] || "").trim();
    headers.push(val !== "" ? val : `Column ${getExcelColumnName(i)}`);
  }
  
  return headers;
};

/**
 * Robust data extraction with single-sheet parsing and range-limiting.
 */
export const extractSheetData = async (
  file: File, 
  sheetName: string, 
  startRow: number,
  endRow?: number,
  rowFilter?: RowFilter
): Promise<any[]> => {
  try {
    const buffer = await getFileBuffer(file);
    
    // Performance: Explicitly request ONLY the sheet we need
    const readOptions: any = { 
      type: 'array', 
      sheets: [sheetName],
      bookProps: false,
      bookDeps: false,
      cellFormula: false,
      cellHTML: false,
      cellText: false,
      cellStyles: false
    };

    if (endRow !== undefined && endRow !== null) {
      readOptions.sheetRows = endRow + 1; 
    }

    const workbook = XLSX.read(new Uint8Array(buffer), readOptions);
    
    if (!workbook.SheetNames.includes(sheetName)) {
      throw new Error(`Sheet "${sheetName}" not found in file.`);
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      range: startRow, 
      defval: null 
    }) as any[][];

    if (rawRows.length === 0) return [];

    const keys = await getSheetHeaders(file, sheetName, startRow);

    const dataRows = rawRows.slice(1);
    let result = dataRows.map(row => {
      const obj: any = {};
      keys.forEach((key, i) => {
        obj[key] = (row[i] !== undefined && row[i] !== null) ? row[i] : null;
      });
      return obj;
    });

    if (rowFilter && rowFilter.columnName) {
      result = result.filter(obj => {
        const val = obj[rowFilter.columnName];
        const strVal = val !== null && val !== undefined ? String(val).trim() : "";
        const numVal = Number(val);

        switch (rowFilter.operator) {
          case 'not_null': return val !== null && val !== undefined && val !== "";
          case 'not_empty': return strVal !== "";
          case 'not_zero': return val !== 0 && val !== "0" && !isNaN(numVal) && numVal !== 0;
          case 'equals': return strVal === (rowFilter.value || "");
          case 'contains': return strVal.includes(rowFilter.value || "");
          default: return true;
        }
      });
    }

    if (endRow !== undefined && endRow !== null) {
      const limit = Math.max(0, endRow - startRow);
      result = result.slice(0, limit);
    }
    
    return result;
  } catch (err) {
    console.error("[ExcelService] Extraction error:", err);
    throw err;
  }
};
