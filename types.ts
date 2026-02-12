
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
}

export interface TransformationTemplate {
  id: string;
  name: string;
  definitionId: string;
  sheetName: string;
  startRow: number;
  mapping: Mapping;
  expectedHeaders: string[]; // Added to allow validation without re-uploading file
  exportFileName: string;
  exportSheetName: string;
  updatedAt: string;
}
