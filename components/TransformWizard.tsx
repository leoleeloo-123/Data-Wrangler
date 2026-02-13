
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  ArrowRight, 
  Edit2,
  Settings2, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Download,
  Database,
  RefreshCw,
  Info,
  X,
  Eye,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  FileJson,
  Layout as LayoutIcon,
  Save,
  Trash2,
  Bookmark,
  ClipboardCheck,
  Map,
  FileText,
  Files,
  FolderOpen,
  Check,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  FileOutput,
  Copy,
  TableProperties,
  CopyX,
  Search,
  ListFilter,
  Filter
} from 'lucide-react';
import { DataDefinition, Mapping, ValidationError, ProcessedData, FieldType, TransformationTemplate, RowFilter, FilterOperator } from '../types';
import { parseExcelMetadata, extractSheetData, ExcelSheetInfo, getExcelColumnName, getSheetHeaders } from '../services/excelService';
import { suggestMappings } from '../services/geminiService';
import { translations } from '../translations';

// Performance Constants
const PREVIEW_RENDER_ROWS = 80;
const PREVIEW_RENDER_COLS = 25;

// Excel utility provided globally in index.html
declare const XLSX: any;

interface FileValidationResult {
  fileName: string;
  isValid: boolean;
  isDuplicate?: boolean;
  error?: string;
  file: File;
}

interface TransformWizardProps {
  definitions: DataDefinition[];
  templates: TransformationTemplate[];
  onSaveTemplate: (template: TransformationTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  language: 'en-US' | 'zh-CN';
}

const TransformWizard: React.FC<TransformWizardProps> = ({ 
  definitions, 
  templates, 
  onSaveTemplate, 
  onDeleteTemplate,
  language 
}) => {
  const t = translations[language].transform;
  const [step, setStep] = useState(1);
  const [selectedDef, setSelectedDef] = useState<DataDefinition | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<TransformationTemplate | null>(null);
  
  // File states
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<FileValidationResult[]>([]);
  
  const [sheetMetadata, setSheetMetadata] = useState<ExcelSheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isSheetConfirmed, setIsSheetConfirmed] = useState(false);
  const [sheetSearchQuery, setSheetSearchQuery] = useState('');
  
  // Input states
  const [startRow, setStartRow] = useState<number>(0);
  const [endRow, setEndRow] = useState<number | ''>('');
  const [filterColumn, setFilterColumn] = useState<string>('');
  const [filterOperator, setFilterOperator] = useState<FilterOperator>('not_null');
  const [filterValue, setFilterValue] = useState<string>('');

  // Applied states
  const [appliedStartRow, setAppliedStartRow] = useState<number>(0);
  const [appliedEndRow, setAppliedEndRow] = useState<number | ''>('');
  const [appliedRowFilter, setAppliedRowFilter] = useState<RowFilter | undefined>(undefined);

  const [mapping, setMapping] = useState<Mapping>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessedData | null>(null);
  
  // Preview and headers
  const [rawPreview, setRawPreview] = useState<any[][]>([]);
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  const [showSkippedRows, setShowSkippedRows] = useState(false);

  // Export States
  const [exportFileName, setExportFileName] = useState('Standardized_Tax_Data');
  const [exportSheetName, setExportSheetName] = useState('StandardizedData');
  const [includeFileName, setIncludeFileName] = useState(true);
  const [fileNamePosition, setFileNamePosition] = useState<'front' | 'back'>('front');

  // Template State
  const [newTemplateName, setNewTemplateName] = useState('');

  // Optimized preview loader
  const loadTemplatePreview = async () => {
    if (!templateFile || !selectedSheet || isProcessing) return;

    setIsProcessing(true);
    console.time('[Perf] Template Preview Parse');
    try {
      // 1. Fetch headers first using robust !ref logic
      const finalHeaders = await getSheetHeaders(templateFile, selectedSheet, Math.max(0, Number(startRow)));
      setAvailableHeaders(finalHeaders);

      // 2. Fetch preview data with safe row limit
      const previewRowsLimit = Math.max(300, Number(startRow) + 50);
      const dataBuffer = await templateFile.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(dataBuffer), { 
        type: 'array', 
        sheets: [selectedSheet], 
        sheetRows: previewRowsLimit 
      });
      const worksheet = workbook.Sheets[selectedSheet];
      const raw = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0, defval: "" }) as any[][];
      
      // Store subset in state to avoid memory bloat
      setRawPreview(raw);

      setAppliedStartRow(startRow);
      setAppliedEndRow(endRow);
      setAppliedRowFilter(filterColumn ? {
        columnName: filterColumn,
        operator: filterOperator,
        value: filterValue
      } : undefined);

    } catch (err) {
      console.error("[Wizard] Preview load crash:", err);
      setRawPreview([]);
    } finally {
      console.timeEnd('[Perf] Template Preview Parse');
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (templateFile && selectedSheet && isSheetConfirmed) {
      loadTemplatePreview();
    }
  }, [templateFile, selectedSheet, isSheetConfirmed]);

  const handleTemplateFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setTemplateFile(file);
      setIsSheetConfirmed(false);
      setRawPreview([]);
      setAvailableHeaders([]);
      setFilterColumn('');
      
      try {
        const metadata = await parseExcelMetadata(file);
        setSheetMetadata(metadata);
        if (metadata.length > 0) {
          setSelectedSheet(metadata[0].name);
          setExportSheetName(metadata[0].name + '_Standardized');
        }
      } catch (err) {
        console.error("[Wizard] Metadata parse fail:", err);
      }
    }
  };

  const validateFileSchema = async (file: File): Promise<FileValidationResult> => {
    try {
      // FIX: Use shared helper from excelService with expected column width hint to solve detection bug
      const fileHeaders = await getSheetHeaders(file, selectedSheet, Number(appliedStartRow), availableHeaders.length);
      
      const missing = availableHeaders.filter(h => !fileHeaders.includes(h));
      if (missing.length > 0) {
        // Debugging logs to confirm column range detection issues
        console.warn(`[Validation Fail] File: ${file.name}, Found: ${fileHeaders.length} cols, Template Needs: ${availableHeaders.length}, Missing:`, missing.slice(0, 10));
        
        return {
          fileName: file.name,
          isValid: false,
          error: language === 'zh-CN' ? `缺少列 (仅检出 ${fileHeaders.length} 列): ${missing.slice(0, 3).join(', ')}...` : `Missing columns (found only ${fileHeaders.length}): ${missing.slice(0, 3).join(', ')}...`,
          file
        };
      }

      return { fileName: file.name, isValid: true, file };
    } catch (err: any) {
      console.error("[Wizard] Validation error detail:", err);
      return { fileName: file.name, isValid: false, error: err.message || "Read fail", file };
    }
  };

  const handleBatchFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessing(true);
      const newFiles = Array.from(e.target.files) as File[];
      const validationResults: FileValidationResult[] = [];
      const currentFilesInfo = batchFiles.map(f => `${f.fileName}_${f.file.size}`);

      for (const file of newFiles) {
        const fileKey = `${file.name}_${file.size}`;
        const isDuplicate = currentFilesInfo.includes(fileKey);
        if (!isDuplicate) currentFilesInfo.push(fileKey);

        const res = await validateFileSchema(file);
        validationResults.push({
          ...res,
          isDuplicate,
          isValid: isDuplicate ? false : res.isValid
        });
      }
      setBatchFiles(prev => [...prev, ...validationResults]);
      setIsProcessing(false);
    }
  };

  const removeBatchFile = (index: number) => setBatchFiles(prev => prev.filter((_, i) => i !== index));
  const removeAllValid = () => setBatchFiles(prev => prev.filter(f => !f.isValid && !f.isDuplicate));

  const applyTemplate = (tpl: TransformationTemplate) => {
    const def = definitions.find(d => d.id === tpl.definitionId);
    if (!def) return;

    setSelectedDef(def);
    setActiveTemplate(tpl);
    setNewTemplateName(tpl.name);
    setSelectedSheet(tpl.sheetName);
    setIsSheetConfirmed(true); 
    setStartRow(tpl.startRow);
    setEndRow(tpl.endRow ?? '');
    setAppliedStartRow(tpl.startRow);
    setAppliedEndRow(tpl.endRow ?? '');
    setMapping(tpl.mapping);
    setAvailableHeaders(tpl.expectedHeaders || []);
    setExportFileName(tpl.exportFileName);
    setExportSheetName(tpl.exportSheetName);
    setIncludeFileName(tpl.includeFileName ?? true);
    setFileNamePosition(tpl.fileNamePosition || 'front');
    
    if ((tpl as any).rowFilter) {
      const rf = (tpl as any).rowFilter;
      setFilterColumn(rf.columnName);
      setFilterOperator(rf.operator);
      setFilterValue(rf.value || '');
      setAppliedRowFilter(rf);
    } else {
      setFilterColumn('');
      setAppliedRowFilter(undefined);
    }
    
    setStep(4); 
  };

  const handleSaveTemplate = (isNew: boolean = true) => {
    if (!selectedDef || !newTemplateName) return;
    const templateId = (isNew || !activeTemplate) ? crypto.randomUUID() : activeTemplate.id;

    const template: TransformationTemplate = {
      id: templateId,
      name: newTemplateName,
      definitionId: selectedDef.id,
      sheetName: selectedSheet,
      startRow: appliedStartRow,
      endRow: appliedEndRow === '' ? undefined : Number(appliedEndRow),
      mapping,
      expectedHeaders: availableHeaders,
      exportFileName,
      exportSheetName,
      includeFileName,
      fileNamePosition,
      updatedAt: new Date().toISOString()
    };
    (template as any).rowFilter = appliedRowFilter;

    onSaveTemplate(template);
    setNewTemplateName('');
    resetState();
    setStep(1);
    alert(t.templateSaved);
  };

  const resetState = () => {
    setResults(null);
    setSelectedDef(null);
    setActiveTemplate(null);
    setTemplateFile(null);
    setBatchFiles([]);
    setRawPreview([]);
    setAvailableHeaders([]);
    setMapping({});
    setNewTemplateName('');
    setIncludeFileName(true);
    setFileNamePosition('front');
    setStartRow(0);
    setEndRow('');
    setAppliedStartRow(0);
    setAppliedEndRow('');
    setFilterColumn('');
    setFilterValue('');
    setAppliedRowFilter(undefined);
    setIsSheetConfirmed(false);
  };

  const autoMap = async () => {
    if (!selectedDef || availableHeaders.length === 0) {
      alert(language === 'zh-CN' ? '请先在步骤2选择正确的表头行' : 'Please select a valid header row in Step 2 first');
      return;
    }
    setIsProcessing(true);
    try {
      const suggestions = await suggestMappings(selectedDef.fields, availableHeaders);
      setMapping(suggestions);
    } catch (err) {
      console.error("[Wizard] AI suggest fail:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const runTransformation = async () => {
    if (!selectedDef || !selectedSheet) return;
    
    const validFiles = batchFiles.filter(f => f.isValid && !f.isDuplicate).map(f => f.file);
    if (validFiles.length === 0) {
      alert(language === 'zh-CN' ? '没有有效的源文件可供处理' : 'No valid source files to process');
      return;
    }

    setIsProcessing(true);
    setResults(null);
    
    const endRowLimit = appliedEndRow === '' ? undefined : Number(appliedEndRow);

    try {
      const allRows: any[] = [];
      const allErrors: ValidationError[] = [];
      const fieldStats: Record<string, { mismatchCount: number }> = {};
      selectedDef.fields.forEach(f => fieldStats[f.name] = { mismatchCount: 0 });

      for (const file of validFiles) {
        try {
          const data = await extractSheetData(file, selectedSheet, Number(appliedStartRow), endRowLimit, appliedRowFilter);
          data.forEach((rawRow, rowIdx) => {
            const processedRow: any = { __source_file__: file.name, __source_sheet__: selectedSheet };
            selectedDef.fields.forEach(field => {
              const sourceColName = mapping[field.id];
              const rawValue = sourceColName ? rawRow[sourceColName] : null;
              let transformedValue = rawValue;
              let hasError = false;

              if (field.required && (rawValue === null || rawValue === undefined || rawValue === "")) {
                hasError = true;
                allErrors.push({ 
                  row: rowIdx + (Number(appliedStartRow) + 2), 
                  field: field.name, 
                  value: rawValue, 
                  message: `Required field missing`, 
                  severity: 'error' 
                });
              }

              if (field.type === FieldType.NUMBER && rawValue !== null && rawValue !== "") {
                const numValue = Number(rawValue);
                if (isNaN(numValue)) {
                  hasError = true;
                  allErrors.push({ 
                    row: rowIdx + (Number(appliedStartRow) + 2), 
                    field: field.name, 
                    value: rawValue, 
                    message: `Non-numeric value`, 
                    severity: 'error' 
                  });
                } else { transformedValue = numValue; }
              }
              if (hasError) fieldStats[field.name].mismatchCount += 1;
              processedRow[field.name] = transformedValue;
            });
            allRows.push(processedRow);
          });
        } catch (fileErr: any) {
          console.error(`[Wizard] Parse error for ${file.name}:`, fileErr);
          allErrors.push({ row: 0, field: 'FILE_PARSE', value: file.name, message: fileErr.message || "Failed to extract", severity: 'error' });
        }
      }
      setResults({ rows: allRows, errors: allErrors, fileCount: validFiles.length, fieldStats });
      setStep(5); 
    } catch (err) {
      console.error("[Wizard] Bulk execution crash:", err);
      alert(language === 'zh-CN' ? '转换过程中发生错误' : 'An error occurred during transformation');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    if (!results || !selectedDef) return;
    try {
      const exportRows = results.rows.map(row => {
        const { __source_file__, __source_sheet__, ...dataFields } = row;
        const fileNameHeader = translations[language].transform.fileNameColumn;
        const infoStr = `${__source_file__}_${__source_sheet__}`;
        const orderedRow: any = {};
        if (includeFileName && fileNamePosition === 'front') orderedRow[fileNameHeader] = infoStr;
        selectedDef.fields.forEach(f => { orderedRow[f.name] = dataFields[f.name] !== undefined ? dataFields[f.name] : null; });
        if (includeFileName && fileNamePosition === 'back') orderedRow[fileNameHeader] = infoStr;
        return orderedRow;
      });
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, exportSheetName || 'Sheet1');
      XLSX.writeFile(workbook, `${exportFileName || 'Standardized_Tax_Data'}.xlsx`);
    } catch (err) {
      console.error("[Wizard] Export failed:", err);
    }
  };

  const steps = [
    { num: 1, label: language === 'zh-CN' ? '选择定义' : 'Choose Definition' },
    { num: 2, label: language === 'zh-CN' ? '解析模板' : 'Parsing Template' },
    { num: 3, label: language === 'zh-CN' ? '映射字段' : 'Map Fields' },
    { num: 4, label: language === 'zh-CN' ? '上传源文件' : 'Upload Sources' },
    { num: 5, label: language === 'zh-CN' ? '转换结果' : 'Results' },
    { num: 6, label: language === 'zh-CN' ? '保存逻辑' : 'Save Logic' }
  ];

  const canJumpToStep = (targetStep: number) => {
    if (targetStep === 1) return true;
    if (targetStep === 2) return !!selectedDef;
    if (targetStep === 3) return !!selectedDef && (!!templateFile || (activeTemplate && availableHeaders.length > 0));
    if (targetStep === 4) return !!selectedDef && Object.keys(mapping).length > 0 && availableHeaders.length > 0;
    if (targetStep === 5) return !!results;
    if (targetStep === 6) return !!results;
    return false;
  };

  // Memoized Preview Window to prevent memory bloat and DOM overload
  const filteredPreview = useMemo(() => {
    if (!appliedRowFilter || !appliedRowFilter.columnName) return rawPreview;
    return rawPreview.filter((row, rIdx) => {
      if (rIdx <= appliedStartRow) return true;
      const headerIdx = availableHeaders.indexOf(appliedRowFilter.columnName);
      if (headerIdx === -1) return true;
      const val = row[headerIdx];
      const strVal = val !== null && val !== undefined ? String(val).trim() : "";
      const numVal = Number(val);
      switch (appliedRowFilter.operator) {
        case 'not_null': return val !== null && val !== undefined && val !== "";
        case 'not_empty': return strVal !== "";
        case 'not_zero': return val !== 0 && val !== "0" && !isNaN(numVal) && numVal !== 0;
        case 'equals': return strVal === (appliedRowFilter.value || "");
        case 'contains': return strVal.includes(appliedRowFilter.value || "");
        default: return true;
      }
    });
  }, [rawPreview, appliedRowFilter, appliedStartRow, availableHeaders]);

  // Safe Rendering Window
  const visiblePreviewRows = useMemo(() => filteredPreview.slice(0, PREVIEW_RENDER_ROWS), [filteredPreview]);

  return (
    <div className="px-8 py-10 max-w-[1800px] mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4">
      <header><h1 className="text-5xl font-black text-slate-800 tracking-tighter">{t.title}</h1><p className="text-slate-500 font-bold mt-2 text-lg">{t.subtitle}</p></header>

      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-4 z-40 transition-all hover:shadow-md">
        {steps.map((s) => {
          const isAccessible = canJumpToStep(s.num);
          const isActive = step === s.num;
          return (
            <div key={s.num} onClick={() => isAccessible && setStep(s.num)} className={`flex items-center gap-3 px-4 flex-1 justify-center last:flex-none transition-all duration-300 ${isAccessible ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60'}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm transition-all duration-300 ${step >= s.num ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-300'} ${isActive ? 'ring-4 ring-indigo-50' : ''}`}>
                {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
              </div>
              <span className={`text-[12px] font-black uppercase tracking-widest hidden lg:inline transition-colors duration-300 ${step >= s.num ? 'text-indigo-900' : 'text-slate-300'} ${isActive ? 'underline decoration-indigo-300 underline-offset-4' : ''}`}>{s.label}</span>
              {s.num < 6 && <div className="h-[2px] bg-slate-50 flex-1 mx-4 hidden lg:block" />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8">
          {!selectedDef ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {definitions.map((def) => (
                <div key={def.id} className="flex flex-col h-full bg-white rounded-2xl border-2 border-slate-200 hover:border-indigo-300 transition-all shadow-sm overflow-hidden">
                  <button onClick={() => setSelectedDef(def)} className="p-8 text-left flex-1">
                    <div className="bg-indigo-50 p-4 rounded-xl shadow-sm border border-slate-100 mb-6 inline-block"><Database className="w-8 h-8 text-indigo-600" /></div>
                    <h3 className="font-black text-slate-800 text-xl mb-3">{def.name}</h3>
                    <p className="text-slate-500 font-bold text-sm mb-6 line-clamp-3 leading-relaxed">{def.description}</p>
                  </button>
                  {templates.filter(tpl => tpl.definitionId === def.id).length > 0 && (
                    <div className="bg-slate-50 px-8 py-6 border-t border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Bookmark className="w-3.5 h-3.5" />{language === 'zh-CN' ? '保存的解析逻辑' : 'Saved Logics'}</p>
                      <div className="flex flex-col gap-3">
                        {templates.filter(tpl => tpl.definitionId === def.id).slice(0, 3).map(tpl => (
                          <button key={tpl.id} onClick={() => applyTemplate(tpl)} className="w-full flex items-center justify-between text-left p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-600 hover:bg-indigo-50 transition-all group shadow-sm">
                            <span className="text-sm font-black text-slate-600 group-hover:text-indigo-700 truncate">{tpl.name}</span>
                            <ChevronRightIcon className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-6"><div className="bg-indigo-50 p-4 rounded-xl shadow-sm"><Database className="w-8 h-8 text-indigo-600" /></div><div><h3 className="text-3xl font-black text-slate-800 tracking-tight">{selectedDef.name}</h3><p className="text-slate-400 font-black uppercase tracking-widest text-xs mt-2">{selectedDef.fields.length} Fields Configured</p></div></div>
                <button onClick={() => setSelectedDef(null)} className="p-3 text-slate-300 hover:text-slate-800 transition-colors bg-slate-50 rounded-xl"><X className="w-6 h-6" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <button onClick={() => setStep(2)} className="group bg-white p-10 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-600 hover:bg-indigo-50/30 transition-all text-center space-y-6"><div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto group-hover:bg-indigo-600 transition-colors shadow-inner"><ArrowRight className="w-8 h-8 text-slate-300 group-hover:text-white" /></div><h4 className="text-2xl font-black text-slate-800 tracking-tight">{t.startFresh}</h4><p className="text-slate-500 font-bold leading-relaxed text-sm">{language === 'zh-CN' ? '从头开始配置新文件结构的解析逻辑。' : 'Configure parsing logic from scratch for new file structures.'}</p></button>
                <div className="space-y-6">
                  <h4 className="text-lg font-black text-slate-800 uppercase tracking-widest flex items-center gap-3"><Bookmark className="w-5 h-5 text-amber-500" />{t.useTemplate}</h4>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                    {templates.filter(tpl => tpl.definitionId === selectedDef.id).map(tpl => (
                      <div key={tpl.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center justify-between group hover:border-indigo-600 transition-all shadow-sm">
                        <button onClick={() => applyTemplate(tpl)} className="flex-1 text-left min-w-0"><p className="text-lg font-black text-slate-800 group-hover:text-indigo-600 transition-colors truncate">{tpl.name}</p><p className="text-xs text-slate-400 font-bold mt-1">Updated {new Date(tpl.updatedAt).toLocaleDateString()} • {Object.keys(tpl.mapping).length} fields mapped</p></button>
                        <button onClick={() => onDeleteTemplate(tpl.id)} className="p-2 text-slate-200 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            <div className={`bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center transition-all hover:border-indigo-300 relative group shadow-inner flex flex-col items-center justify-center ${templateFile ? 'border-emerald-200 bg-emerald-50/10' : ''}`}>
              {!templateFile ? (
                <><input type="file" onChange={handleTemplateFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept=".xlsx, .xls" /><div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-105 shadow-sm transition-transform"><Upload className="w-10 h-10 text-indigo-600" /></div><h3 className="text-2xl font-black text-slate-800 tracking-tight">{t.uploadTitle}</h3><p className="text-slate-500 mt-2 font-bold text-base">{t.uploadSubtitle}</p></>
              ) : (
                <div className="flex flex-col items-center w-full"><div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-50"><CheckCircle2 className="w-8 h-8 text-emerald-600" /></div><h3 className="text-xl font-black text-slate-800 tracking-tight truncate max-w-full px-4">{templateFile.name}</h3><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">{language === 'zh-CN' ? '文件已就绪' : 'File Loaded'}</p><button onClick={() => { setTemplateFile(null); setRawPreview([]); setIsSheetConfirmed(false); }} className="mt-8 bg-white border border-slate-200 px-6 py-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:border-red-100 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm"><Trash2 className="w-4 h-4" /> {language === 'zh-CN' ? '更改模板' : 'Change Template'}</button></div>
              )}
            </div>
            <div className={`bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col transition-all duration-500 ${!templateFile ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
              <div className="flex items-center justify-between mb-6"><div className="flex items-center gap-3"><div className="bg-indigo-50 p-2.5 rounded-xl shadow-sm"><ListFilter className="w-6 h-6 text-indigo-600" /></div><h3 className="text-xl font-black text-slate-800">{language === 'zh-CN' ? '选择工作表' : 'Select Target Sheet'}</h3></div></div>
              <div className="relative mb-4"><input type="text" value={sheetSearchQuery} onChange={(e) => setSheetSearchQuery(e.target.value)} placeholder={language === 'zh-CN' ? '搜索工作表...' : 'Search sheets...'} className="w-full bg-slate-50 border border-slate-100 px-5 py-3 rounded-xl font-bold text-sm text-slate-700 outline-none focus:ring-4 focus:ring-indigo-50 transition-all pr-12" /><Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" /></div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2 max-h-[220px]">
                {sheetMetadata.filter(s => s.name.toLowerCase().includes(sheetSearchQuery.toLowerCase())).map((s) => (
                  <button key={s.name} onClick={() => { setSelectedSheet(s.name); setExportSheetName(s.name + '_Standardized'); setIsSheetConfirmed(false); }} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${selectedSheet === s.name ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-300 hover:bg-slate-50'}`}><span className="font-black text-sm truncate">{s.name}</span><div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${selectedSheet === s.name ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-300'}`}>{selectedSheet === s.name ? <Check className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}</div></button>
                ))}
              </div>
              <div className="pt-6 mt-4 border-t border-slate-50">
                <button onClick={() => setIsSheetConfirmed(true)} disabled={!selectedSheet || isSheetConfirmed || isProcessing} className={`w-full py-4 rounded-xl font-black flex items-center justify-center gap-3 transition-all transform hover:-translate-y-1 active:scale-95 shadow-lg uppercase tracking-widest text-[11px] ${isSheetConfirmed ? 'bg-emerald-100 text-emerald-600 shadow-emerald-50 pointer-events-none' : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'}`}>
                  {isSheetConfirmed ? <><CheckCircle2 className="w-4 h-4" /> {language === 'zh-CN' ? '工作表已加载' : 'Sheet Loaded'}</> : <>{isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {language === 'zh-CN' ? '加载工作表内容' : 'Load Sheet Content'}</>}
                </button>
              </div>
            </div>
          </div>

          {templateFile && isSheetConfirmed && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in slide-in-from-top-6 duration-700">
              <div className="lg:col-span-4 space-y-8">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8 h-fit"><h3 className="text-2xl font-black text-slate-800 flex items-center gap-3"><Settings2 className="w-7 h-7 text-indigo-600" />{t.configTitle}</h3><div className="space-y-6"><div className="space-y-3"><label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t.targetSheet}</label><div className="w-full px-5 py-4 border border-slate-200 rounded-xl bg-slate-50/50 font-black text-slate-700 shadow-sm">{selectedSheet}</div></div><div className="grid grid-cols-2 gap-4"><div className="space-y-3"><label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t.headerIndex}</label><input type="number" min="0" value={startRow} onChange={(e) => setStartRow(parseInt(e.target.value) || 0)} className="w-full px-5 py-4 border border-slate-200 rounded-xl font-black text-center text-2xl shadow-sm text-indigo-600 outline-none bg-slate-50/50" /></div><div className="space-y-3"><label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t.endRowIndex}</label><input type="number" min="0" value={endRow} placeholder={t.endRowPlaceholder} onChange={(e) => setEndRow(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full px-5 py-4 border border-slate-200 rounded-xl font-black text-center text-2xl shadow-sm text-slate-400 outline-none bg-slate-50/50" /></div></div></div></div>
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8 h-fit"><div className="flex items-center gap-3"><div className="bg-emerald-50 p-2.5 rounded-xl shadow-sm"><Filter className="w-6 h-6 text-emerald-600" /></div><div><h3 className="text-xl font-black text-slate-800 leading-tight">{t.rowFilterTitle}</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{t.rowFilterSubtitle}</p></div></div><div className="space-y-6"><div className="space-y-3"><label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t.filterCol}</label><div className="relative"><select value={filterColumn} onChange={(e) => setFilterColumn(e.target.value)} className="w-full px-5 py-3.5 border border-slate-200 rounded-xl bg-slate-50/50 shadow-sm outline-none font-black text-slate-700 appearance-none pr-10"><option value="">-- No Filter --</option>{availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}</select><ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" /></div></div><div className={`grid gap-4 transition-all ${filterColumn ? 'grid-cols-2 opacity-100 scale-100' : 'opacity-30 scale-95 pointer-events-none'}`}><div className="space-y-3"><label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t.filterRule}</label><div className="relative"><select value={filterOperator} onChange={(e) => setFilterOperator(e.target.value as FilterOperator)} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 shadow-sm outline-none font-bold text-slate-700 appearance-none"><option value="not_null">{t.opNotNull}</option><option value="not_empty">{t.opNotEmpty}</option><option value="not_zero">{t.opNotZero}</option><option value="equals">{t.opEquals}</option><option value="contains">{t.opContains}</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" /></div></div><div className="space-y-3"><label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t.filterValue}</label><input type="text" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} disabled={['not_null', 'not_empty', 'not_zero'].includes(filterOperator)} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 shadow-sm outline-none font-bold text-slate-700 disabled:opacity-20" /></div></div></div></div>
                <div className="pt-6 border-t border-slate-100 flex flex-col gap-4"><button onClick={loadTemplatePreview} disabled={isProcessing} className="w-full bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 px-8 py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-md shadow-indigo-50 transition-all transform hover:-translate-y-1 active:scale-95 text-lg"><RefreshCw className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`} />{language === 'zh-CN' ? '应用规则并刷新预览' : 'Apply & Refresh Preview'}</button><button onClick={() => setStep(3)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 transition-all transform hover:-translate-y-1 active:scale-95 text-lg">{t.continueMapping}<ArrowRight className="w-6 h-6" /></button></div>
              </div>
              <div className="lg:col-span-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight"><Eye className="w-7 h-7 text-emerald-500" />{t.previewTitle}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                      {language === 'zh-CN' ? `渲染安全窗口: ${PREVIEW_RENDER_ROWS}行 × ${PREVIEW_RENDER_COLS}列` : `Safe View: ${PREVIEW_RENDER_ROWS}R × ${PREVIEW_RENDER_COLS}C`}
                    </span>
                    <button onClick={() => setShowSkippedRows(!showSkippedRows)} className={`text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl border-2 transition-all shadow-sm flex items-center gap-2 ${showSkippedRows ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                      {showSkippedRows ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {language === 'zh-CN' ? (showSkippedRows ? '显示顶部' : '隐藏顶部') : (showSkippedRows ? 'Show Header' : 'Hide Header')}
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-auto custom-scrollbar max-h-[850px]">
                  {isProcessing ? (
                    <div className="p-40 flex flex-col items-center justify-center space-y-4">
                      <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin" />
                      <p className="text-slate-400 font-black uppercase tracking-widest text-xs">{language === 'zh-CN' ? '正在清洗预览数据...' : 'Cleaning preview data...'}</p>
                    </div>
                  ) : visiblePreviewRows.length > 0 ? (
                    <table className="w-full text-left text-xs border-separate border-spacing-0">
                      <thead className="bg-slate-50 sticky top-0 z-20">
                        <tr>
                          <th className="px-5 py-4 font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b-2 border-slate-100 w-20 text-center">Row</th>
                          {(visiblePreviewRows[0] || []).slice(0, PREVIEW_RENDER_COLS).map((_, i) => (
                            <th key={i} className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b-2 border-slate-100 whitespace-nowrap">
                              Col {getExcelColumnName(i)}
                            </th>
                          ))}
                          {(visiblePreviewRows[0] || []).length > PREVIEW_RENDER_COLS && (
                            <th className="px-6 py-4 font-black text-slate-300 bg-slate-50 border-b-2 border-slate-100 italic">...</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold transition-all">
                        {visiblePreviewRows.map((row, rIdx) => {
                          const isHeader = rIdx === appliedStartRow;
                          if (rIdx < appliedStartRow && !showSkippedRows) return null;
                          const endRowLimit = appliedEndRow === '' ? Infinity : Number(appliedEndRow);
                          if (rIdx > endRowLimit) return null;
                          
                          return (
                            <tr key={rIdx} className={`transition-all ${isHeader ? 'bg-indigo-50/50' : rIdx < appliedStartRow ? 'opacity-30' : 'hover:bg-slate-50/50'}`}>
                              <td className={`px-5 py-4 text-center border-r-2 border-slate-50 font-black ${isHeader ? 'text-indigo-600' : 'text-slate-300'}`}>{rIdx}</td>
                              {row.slice(0, PREVIEW_RENDER_COLS).map((cell: any, cIdx: number) => (
                                <td key={cIdx} className={`px-6 py-4 whitespace-nowrap truncate max-w-[250px] ${isHeader ? 'font-black text-indigo-900 bg-indigo-50/30' : 'text-slate-600'}`}>
                                  {cell}
                                </td>
                              ))}
                              {row.length > PREVIEW_RENDER_COLS && (
                                <td className="px-6 py-4 text-slate-300 italic font-medium">Truncated</td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-40 text-center text-slate-300 font-black italic text-xl opacity-50">{t.noDataPreview}</div>
                  )}
                </div>
                {filteredPreview.length > PREVIEW_RENDER_ROWS && (
                  <div className="text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {language === 'zh-CN' ? `仅显示前 ${PREVIEW_RENDER_ROWS} 行，共 ${filteredPreview.length} 行` : `Showing first ${PREVIEW_RENDER_ROWS} of ${filteredPreview.length} rows`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10">
          <div className="flex items-center justify-between"><div><h2 className="text-4xl font-black text-slate-800 tracking-tight">{language === 'zh-CN' ? '字段映射架构' : t.mappingTitle}</h2><p className="text-slate-500 font-bold text-lg mt-2">{t.mappingSubtitle}</p></div><button onClick={autoMap} disabled={isProcessing || availableHeaders.length === 0} className="bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 px-8 py-4 rounded-xl font-black flex items-center gap-3 transition-all shadow-lg shadow-indigo-50 disabled:opacity-50 text-lg">{isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}{t.autoMap}</button></div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"><table className="w-full text-left"><thead><tr className="bg-slate-50 border-b-2 border-slate-100"><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Field</th><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Source Template Column</th><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Constraint</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedDef?.fields.map((field) => (<tr key={field.id} className="hover:bg-slate-50/50 transition-colors"><td className="px-10 py-8"><div className="flex items-center gap-4"><div className="bg-indigo-50 p-3 rounded-xl shadow-sm border border-indigo-100"><Database className="w-5 h-5 text-indigo-500" /></div><div><p className="font-black text-slate-800 text-base">{field.name}</p><p className="text-[9px] text-slate-400 font-black mt-1 uppercase tracking-widest flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-slate-300" />{field.type}</p></div></div></td><td className="px-10 py-8"><div className="relative"><select value={mapping[field.id] || ''} onChange={(e) => setMapping(prev => ({ ...prev, [field.id]: e.target.value }))} className="w-full px-5 py-3.5 border border-slate-200 rounded-xl bg-slate-50/50 shadow-sm outline-none font-bold text-slate-700 transition-all focus:ring-4 focus:ring-indigo-50 appearance-none pr-10"><option value="">{t.unmapped}</option>{availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}</select><ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" /></div></td><td className="px-10 py-8 text-center">{field.required ? <span className="inline-flex px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-700 shadow-sm border border-red-200">Strict</span> : <span className="inline-flex px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 shadow-sm border border-slate-200">Optional</span>}</td></tr>))}</tbody></table></div>
          <div className="flex justify-between items-center pt-8"><button onClick={() => setStep(2)} className="text-slate-400 hover:text-slate-800 font-black px-8 py-4 transition-all uppercase tracking-[.3em] text-xs flex items-center gap-3 hover:bg-white rounded-xl border border-transparent hover:border-slate-200">&larr; Back</button><button onClick={() => setStep(4)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-2xl font-black flex items-center gap-4 shadow-xl shadow-indigo-100 transition-all transform hover:-translate-y-1 text-lg">{t.uploadSources}<ArrowRight className="w-6 h-6" /></button></div>
        </div>
      )}

      {step === 4 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-20 text-center transition-all hover:border-indigo-300 relative min-h-[450px] flex flex-col items-center justify-center group shadow-inner"><input type="file" multiple onChange={handleBatchFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept=".xlsx, .xls" /><div className="bg-indigo-50 w-24 h-24 rounded-full flex items-center justify-center mb-8 group-hover:scale-105 shadow-sm transition-transform"><Files className="w-10 h-10 text-indigo-600" /></div><h3 className="text-3xl font-black text-slate-800 tracking-tight">{t.batchUpload}</h3><p className="text-slate-400 font-bold mt-3 text-lg">{language === 'zh-CN' ? '支持批量拖拽多文件及文件夹' : 'Supports multi-file dynamic drag & drop and folder uploads'}</p></div>
              {batchFiles.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in"><div className="p-6 border-b-2 border-slate-50 bg-slate-50/50 flex justify-between items-center"><h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Files className="w-4 h-4 text-indigo-500" />{t.validationTitle}</h3><div className="flex gap-3"><span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100 shadow-sm">{(batchFiles.filter(f => f.isValid && !f.isDuplicate)).length} {t.validFiles}</span></div></div><div className="max-h-[600px] overflow-y-auto custom-scrollbar divide-y-2 divide-slate-50">{(batchFiles.filter(f => f.isValid && !f.isDuplicate)).length > 0 && (<div className="p-6 flex items-start justify-between bg-emerald-50/20 group transition-colors hover:bg-emerald-50/40"><div className="flex items-start gap-6"><div className="p-3 rounded-xl bg-white shadow-sm"><Check className="w-5 h-5 text-emerald-600" /></div><div className="overflow-hidden"><p className="font-black text-slate-800 text-base">{t.validationSuccess}</p><p className="text-xs font-bold text-emerald-600 mt-1 max-w-full leading-relaxed">Validated source files are ready for cleansing.</p></div></div><button onClick={removeAllValid} className="p-3 text-slate-200 hover:text-red-500 transition-all hover:bg-white rounded-xl shadow-sm"><Trash2 className="w-4 h-4" /></button></div>)}</div></div>
              )}
            </div>
            <div className="lg:col-span-4 space-y-8">
              <div className={`bg-white p-10 rounded-2xl border shadow-xl transition-all h-fit ${batchFiles.length === 0 ? 'opacity-40' : 'border-emerald-200 bg-emerald-50/30'}`}>{batchFiles.length === 0 ? <div className="text-center py-20"><Info className="w-16 h-16 text-slate-100 mx-auto mb-4" /><p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">{t.noFiles}</p></div> : (<div className="space-y-8"><div className="flex items-center gap-5"><div className={`p-5 rounded-xl bg-emerald-500 text-white shadow-lg`}><CheckCircle2 className="w-8 h-8" /></div><div><h4 className="text-xl font-black text-slate-800 tracking-tight">Ready</h4><p className="text-xs text-slate-500 font-bold mt-1 leading-tight">{t.allValid}</p></div></div><button onClick={runTransformation} disabled={isProcessing || batchFiles.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 rounded-2xl font-black flex items-center justify-center gap-4 shadow-xl shadow-indigo-100 transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:transform-none text-xl">{isProcessing ? <RefreshCw className="w-7 h-7 animate-spin" /> : <Sparkles className="w-7 h-7" />}{t.execute}</button></div>)}</div>
            </div>
          </div>
        </div>
      )}

      {step === 5 && results && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10 h-full"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch"><div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col justify-center"><p className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">{t.rowsProcessed}</p><h3 className={`text-2xl font-black tracking-tight text-slate-800`}>{results.rows.length.toLocaleString()} Rows</h3></div><div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col justify-center"><p className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest group-hover:text-red-400 transition-colors">{t.qualityIssues}</p><h3 className={`text-4xl font-black tracking-tight ${results.errors.length > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{results.errors.length.toLocaleString()}</h3></div><button onClick={() => setStep(6)} className="bg-indigo-600 hover:bg-indigo-700 text-white p-8 rounded-2xl shadow-xl shadow-indigo-100 transition-all transform hover:-translate-y-1 active:scale-95 flex flex-col justify-center items-center gap-3 group"><p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest group-hover:text-white transition-colors">{language === 'zh-CN' ? '下一步' : 'Next Step'}</p><h3 className="text-xl font-black text-center leading-tight">{t.gotoSave}</h3><ArrowRight className="w-6 h-6" /></button></div><div className="space-y-6"><h3 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight"><CheckCircle2 className="w-7 h-7 text-emerald-500" />{t.previewTitle}</h3><div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xl flex flex-col h-[600px]"><div className="flex-1 overflow-auto custom-scrollbar">{results.rows.length > 0 ? (<table className="w-full text-left text-xs border-collapse"><thead className="bg-slate-50 sticky top-0 z-10 border-b-2 border-slate-100"><tr><th className="px-6 py-5 font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-r border-slate-100 w-16 text-center">#</th>{selectedDef?.fields.map(f => <th key={f.id} className="px-6 py-5 font-black text-slate-800 uppercase tracking-widest whitespace-nowrap bg-slate-50">{f.name}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 font-bold">{results.rows.slice(0, 100).map((row, i) => (<tr key={i} className="hover:bg-slate-50/50 transition-colors"><td className="px-6 py-4 text-slate-300 font-black bg-slate-50/30 text-center border-r border-slate-50">{i + 1}</td>{selectedDef?.fields.map(f => <td key={f.id} className="px-6 py-4 text-slate-600 whitespace-nowrap">{row[f.name] !== null && row[f.name] !== undefined ? String(row[f.name]) : <span className="text-slate-200 font-black italic">NULL</span>}</td>)}</tr>))}</tbody></table>) : (<div className="p-40 text-center text-slate-200 font-black italic text-2xl opacity-50">{t.noDataPreview}</div>)}</div></div></div></div>
      )}

      {step === 6 && selectedDef && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10 max-w-[1500px] mx-auto"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5"><div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 flex flex-col hover:shadow-md transition-all"><div className="flex items-center gap-2 text-indigo-600 font-black uppercase tracking-widest text-[9px]"><Database className="w-3.5 h-3.5" />{t.summaryTarget}</div><div className="flex-1"><h4 className="text-xl font-black text-slate-800 leading-tight tracking-tight">{selectedDef.name}</h4></div></div><div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 flex flex-col hover:shadow-md transition-all"><div className="flex items-center gap-2 text-emerald-600 font-black uppercase tracking-widest text-[9px]"><Settings2 className="w-3.5 h-3.5" />{t.summarySource}</div><div className="space-y-3 flex-1">{[{ label: 'Sheet', val: selectedSheet }, { label: 'Header Row', val: appliedStartRow }, { label: 'Rows Found', val: results?.rows.length }].map((row, idx) => (<div key={idx} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0"><span className="text-slate-400 font-black text-[8px] uppercase tracking-widest">{row.label}</span><span className="font-black text-slate-800 text-xs truncate ml-2">{row.val}</span></div>))}</div></div>{appliedRowFilter && (<div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-5 flex flex-col hover:shadow-md transition-all"><div className="flex items-center gap-2 text-emerald-600 font-black uppercase tracking-widest text-[9px]"><Filter className="w-3.5 h-3.5" />{language === 'zh-CN' ? '清洗规则' : 'Cleansing'}</div><div className="space-y-3 flex-1"><div className="flex justify-between items-center py-1.5 border-b border-slate-50"><span className="text-slate-400 font-black text-[8px] uppercase tracking-widest">Col</span><span className="font-black text-slate-800 text-xs truncate ml-2">{appliedRowFilter.columnName}</span></div><div className="flex justify-between items-center py-1.5 border-b border-slate-50"><span className="text-slate-400 font-black text-[8px] uppercase tracking-widest">Rule</span><span className="font-black text-slate-800 text-xs truncate ml-2">{appliedRowFilter.operator}</span></div></div></div>)}</div><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="bg-indigo-900 p-10 rounded-2xl shadow-xl space-y-8 text-white flex flex-col justify-between group overflow-hidden relative"><div className="absolute -top-16 -right-16 w-48 h-48 bg-white/5 rounded-full group-hover:scale-125 transition-transform duration-1000" /><div className="space-y-6 relative z-10"><div className="flex items-center gap-5"><div className="bg-white/10 p-4 rounded-xl shadow-sm"><Bookmark className="w-8 h-8 text-white" /></div><div className="flex-1"><label className="block text-[10px] font-black text-indigo-300 uppercase tracking-[.2em] mb-2">{t.templateName}</label><input type="text" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="e.g. Pipeline Name" className="w-full bg-indigo-950/40 border border-white/10 px-6 py-5 rounded-xl text-xl font-black focus:ring-4 focus:ring-indigo-500/30 outline-none transition-all shadow-inner" /></div></div></div><div className="pt-6 relative z-10">{activeTemplate ? (<div className="grid grid-cols-2 gap-4"><button onClick={() => handleSaveTemplate(false)} className="w-full bg-indigo-600 border-2 border-white/20 text-white px-6 py-4 rounded-xl font-black shadow-lg hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 uppercase tracking-[.2em] text-[10px] transform hover:-translate-y-1"><Save className="w-5 h-5" />{t.saveUpdate}</button><button onClick={() => handleSaveTemplate(true)} className="w-full bg-white/10 border-2 border-white/20 text-white px-6 py-4 rounded-xl font-black shadow-lg hover:bg-white/20 transition-all flex items-center justify-center gap-3 uppercase tracking-[.2em] text-[10px] transform hover:-translate-y-1"><Copy className="w-5 h-5" />{t.saveAs}</button></div>) : (<button onClick={() => handleSaveTemplate(true)} disabled={!newTemplateName} className="w-full bg-indigo-600 border-2 border-white/20 text-white px-8 py-6 rounded-xl font-black shadow-lg hover:bg-indigo-500 transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-4 uppercase tracking-[.2em] text-lg"><Save className="w-6 h-6" />{t.saveFinish}</button>)}</div></div><div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-xl space-y-8 flex flex-col justify-between group overflow-hidden relative"><div className="absolute -top-16 -right-16 w-48 h-48 bg-indigo-50/30 rounded-full group-hover:scale-125 transition-transform duration-1000" /><div className="space-y-6 relative z-10"><div className="flex items-center gap-5"><div className="bg-indigo-50 p-4 rounded-xl shadow-sm"><Download className="w-8 h-8 text-indigo-600" /></div><div className="flex-1"><label className="block text-[10px] font-black text-slate-300 uppercase tracking-[.2em] mb-2">{language === 'zh-CN' ? '立即导出' : 'Export now'}</label><p className="text-slate-800 text-3xl font-black tracking-tighter leading-none">{language === 'zh-CN' ? '标准化结果已就绪' : 'Results Ready'}</p></div></div></div><div className="pt-6 relative z-10"><button onClick={handleExport} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 rounded-xl font-black shadow-lg shadow-indigo-100 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-4 uppercase tracking-[.2em] text-lg"><Download className="w-6 h-6" />{t.export}</button></div></div></div><div className="flex justify-start pt-4"><button onClick={() => setStep(5)} className="px-8 py-3 border-2 border-slate-200 text-slate-300 font-black rounded-xl hover:bg-white hover:text-slate-800 hover:border-slate-800 transition-all uppercase tracking-[.3em] text-[10px] flex items-center gap-3 group"><ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back</button></div></div>
      )}
    </div>
  );
};

export default TransformWizard;
