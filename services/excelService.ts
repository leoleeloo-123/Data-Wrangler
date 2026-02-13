
declare const XLSX: any;

export interface ExcelSheetInfo {
  name: string;
  headers: string[];
  previewRows: any[];
}

export const parseExcelMetadata = async (file: File): Promise<ExcelSheetInfo[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheets: ExcelSheetInfo[] = workbook.SheetNames.map((name: string) => {
          const worksheet = workbook.Sheets[name];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0, defval: "" });
          const headers = (json[0] || []) as string[];
          return {
            name,
            headers: headers.filter(h => h && h.toString().trim() !== ""),
            previewRows: json.slice(1, 6)
          };
        });
        resolve(sheets);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

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
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) throw new Error(`Sheet ${sheetName} not found`);
        
        // Convert to JSON starting from startRow (0-indexed)
        const json = XLSX.utils.sheet_to_json(worksheet, { 
          range: startRow,
          defval: null
        }) as any[];

        // If endRow is specified, slice the array.
        // startRow is where headers are. Data starts at startRow + 1.
        // If startRow = 2 (Excel Row 3), headers are at index 2.
        // sheet_to_json with range: 2 returns objects starting from Row 4 (index 3).
        // If endRow = 30, we want to stop after index 30 in the sheet.
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
