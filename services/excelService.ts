
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
        
        // Attempt to find worksheet by name
        let worksheet = workbook.Sheets[sheetName];
        
        // Robustness: If specified sheet name isn't found, try falling back to the first sheet
        if (!worksheet && workbook.SheetNames.length > 0) {
          console.warn(`Sheet "${sheetName}" not found in file "${file.name}". Using first sheet: "${workbook.SheetNames[0]}"`);
          worksheet = workbook.Sheets[workbook.SheetNames[0]];
        }

        if (!worksheet) throw new Error(`Sheet "${sheetName}" not found and no alternative sheets available.`);
        
        // Convert to JSON starting from startRow (0-indexed)
        const json = XLSX.utils.sheet_to_json(worksheet, { 
          range: startRow,
          defval: null
        }) as any[];

        // If endRow is specified, slice the array.
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
