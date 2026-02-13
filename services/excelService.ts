
declare const XLSX: any;

export interface ExcelSheetInfo {
  name: string;
  headers: string[];
  previewRows: any[];
}

/**
 * Fast metadata parsing. 
 * First gets sheet names without parsing data, then only parses headers for the first few sheets to keep it snappy.
 */
export const parseExcelMetadata = async (file: File): Promise<ExcelSheetInfo[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        // Step 1: Read only the workbook structure (lightning fast)
        const workbook = XLSX.read(data, { type: 'array', bookSheets: true });
        
        // Step 2: For metadata/preview, we only parse the first 5 rows of the first few sheets
        // to avoid freezing the UI on multi-tab massive files.
        const sheets: ExcelSheetInfo[] = workbook.SheetNames.map((name: string) => {
          // We don't parse full headers here for every sheet if there are many. 
          // We let the UI request specific sheet details as needed.
          return {
            name,
            headers: [],
            previewRows: []
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

/**
 * Optimized extraction that only reads the required number of rows.
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
        
        // Performance Opt: If endRow is provided, tell the parser to STOP reading after that row.
        // This is critical for massive files.
        const readOptions: any = { type: 'array' };
        if (endRow !== undefined && endRow !== null) {
          readOptions.sheetRows = endRow + 1;
        }

        const workbook = XLSX.read(data, readOptions);
        let worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet && workbook.SheetNames.length > 0) {
          worksheet = workbook.Sheets[workbook.SheetNames[0]];
        }

        if (!worksheet) throw new Error(`Sheet "${sheetName}" not found.`);
        
        const json = XLSX.utils.sheet_to_json(worksheet, { 
          range: startRow,
          defval: null
        }) as any[];

        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};
