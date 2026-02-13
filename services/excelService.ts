
declare const XLSX: any;

export interface ExcelSheetInfo {
  name: string;
  // headers and previewRows are now optional or removed from the base metadata call
  // to prioritize speed. We fetch them on-demand later.
  headers?: string[];
  previewRows?: any[];
}

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
 * Lightweight extraction of workbook metadata.
 * Strictly fetches sheet names only to ensure the UI remains responsive 
 * for large workbooks with many tabs.
 */
export const parseExcelMetadata = async (file: File): Promise<ExcelSheetInfo[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        // Only read metadata (bookSheets: true, bookProps: false etc. if supported by lib)
        const workbook = XLSX.read(data, { type: 'array', bookSheets: true });
        const sheets: ExcelSheetInfo[] = workbook.SheetNames.map((name: string) => ({
          name
        }));
        resolve(sheets);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Efficiently extracts data from a specific sheet using a limited range for configuration/preview.
 * Handles blank headers by assigning stable fallback names based on column position.
 */
export const extractSheetData = async (
  file: File, 
  sheetName: string, 
  startRow: number,
  endRow?: number
): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        // We only parse the specific sheet we need
        const workbook = XLSX.read(data, { type: 'array', sheets: [sheetName] });
        
        let worksheet = workbook.Sheets[sheetName];
        
        // Fallback to first sheet if name mismatch in batch
        if (!worksheet && workbook.SheetNames.length > 0) {
          worksheet = workbook.Sheets[workbook.SheetNames[0]];
        }

        if (!worksheet) throw new Error(`Sheet "${sheetName}" not found.`);
        
        // Read raw data as array of arrays to handle headers manually
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          range: startRow, 
          defval: null 
        }) as any[][];

        if (rawRows.length === 0) return resolve([]);

        const headerRow = rawRows[0] || [];
        // Determine the actual column count based on both header and data rows
        const maxCols = Math.max(headerRow.length, ...rawRows.slice(1, 10).map(r => r.length));

        // Construct stable keys: use trimmed header text or "Column [Letter]" if blank
        const keys: string[] = [];
        for (let i = 0; i < maxCols; i++) {
          const val = String(headerRow[i] || "").trim();
          keys.push(val !== "" ? val : `Column ${getExcelColumnName(i)}`);
        }

        // Map data rows to objects using the generated keys
        const dataRows = rawRows.slice(1);
        const result = dataRows.map(row => {
          const obj: any = {};
          keys.forEach((key, i) => {
            obj[key] = (row[i] !== undefined && row[i] !== null) ? row[i] : null;
          });
          return obj;
        });

        if (endRow !== undefined && endRow !== null) {
          const limit = Math.max(0, endRow - startRow);
          resolve(result.slice(0, limit));
        } else {
          resolve(result);
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};
