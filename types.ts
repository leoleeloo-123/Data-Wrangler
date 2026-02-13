
export enum FieldType {
  STRING = 'string',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean'
}

export interface FieldDefinition {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  description: string;
}

export interface DataDefinition {
  id: string;
  name: string;
  description: string;
  fields: FieldDefinition[];
  createdAt: string;
}

export interface SourceConfig {
  sheetName: string;
  startRow: number;
  headers: string[];
}

export interface Mapping {
  [targetFieldId: string]: string; // Maps Target Field ID to Source Column Name
}

export interface ValidationError {
  row: number;
  field: string;
  value: any;
  message: string;
  severity: 'error' | 'warning';
}

export interface ProcessedData {
  rows: any[];
  errors: ValidationError[];
  fileCount: number;
  fieldStats: Record<string, { mismatchCount: number }>;
}

export interface TransformationTemplate {
  id: string;
  name: string;
  definitionId: string;
  sheetName: string;
  startRow: number;
  endRow?: number; // Optional end row limit
  mapping: Mapping;
  expectedHeaders: string[]; // Added to allow validation without re-uploading file
  exportFileName: string;
  exportSheetName: string;
  updatedAt: string;
  includeFileName: boolean;
  fileNamePosition: 'front' | 'back';
}

export interface BatchTask {
  id: string;
  templateId: string;
  files: File[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  results?: ProcessedData;
  customOutputSheetName: string;
  customOutputFileName: string;
  validationResults?: {
    fileName: string;
    isValid: boolean;
    error?: string;
  }[];
}

export interface BatchConfiguration {
  id: string;
  name: string;
  description: string;
  tasks: BatchTask[];
  createdAt: string;
  exportStrategy: 'multi-sheet' | 'consolidated';
  globalFileName?: string;
  globalSheetName?: string;
}

export interface DataReviewEntry {
  id: string;
  batchName: string;
  timestamp: string;
  strategy: 'multi-sheet' | 'consolidated';
  totalRows: number;
  totalErrors: number;
  tasks: {
    modelName: string;
    rowCount: number;
    sheetName: string;
    fileName: string;
    rows: any[];
    errorCount: number;
    fieldMetadata: {
      name: string;
      type: string;
      mismatchCount: number;
    }[];
  }[];
}
