
declare const XLSX: any;

export interface ExcelSheetInfo {
  name: string;
}

/**
 * Lightweight extraction of workbook metadata.
 * Only retrieves sheet names to ensure high performance on large workbooks.
 */
export const parseExcelMetadata = async (file: File): Promise<ExcelSheetInfo[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        // Using { bookSheets: true } or default to just get basic structure
        const workbook = XLSX.read(data, { type: 'array' });
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
 * Extracts data from a specific sheet only.
 * This ensures we don't waste memory or CPU on sheets that are not part of the transformation.
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
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Attempt to find worksheet by name
        let worksheet = workbook.Sheets[sheetName];
        
        // Robustness fallback: if sheet not found, use first sheet
        if (!worksheet && workbook.SheetNames.length > 0) {
          console.warn(`Sheet "${sheetName}" not found in file "${file.name}". Falling back to first sheet.`);
          worksheet = workbook.Sheets[workbook.SheetNames[0]];
        }

        if (!worksheet) throw new Error(`Sheet "${sheetName}" not found.`);
        
        // Convert only the target sheet to JSON
        const json = XLSX.utils.sheet_to_json(worksheet, { 
          range: startRow,
          defval: null
        }) as any[];

        if (endRow !== undefined && endRow !== null) {
          const limit = Math.max(0, endRow - startRow);
          resolve(json.slice(0, limit));
        } else {
          resolve(json);
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};
