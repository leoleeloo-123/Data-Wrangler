
import React, { useState, useEffect, useRef } from 'react';
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
  CopyX
} from 'lucide-react';
import { DataDefinition, Mapping, ValidationError, ProcessedData, FieldType, TransformationTemplate } from '../types';
import { parseExcelMetadata, extractSheetData, ExcelSheetInfo } from '../services/excelService';
import { suggestMappings } from '../services/geminiService';
import { translations } from '../translations';

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
  const [startRow, setStartRow] = useState<number>(0);
  const [endRow, setEndRow] = useState<number | ''>('');
  const [mapping, setMapping] = useState<Mapping>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessedData | null>(null);
  
  // Real-time raw preview data and header parsing
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

  const folderInputRef = useRef<HTMLInputElement>(null);

  // Sync state for template preview
  useEffect(() => {
    if (templateFile && selectedSheet) {
      loadTemplatePreview();
    }
  }, [templateFile, selectedSheet, startRow]);

  const loadTemplatePreview = async () => {
    if (!templateFile || !selectedSheet) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[selectedSheet];
        if (worksheet) {
          const raw = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            range: 0, 
            defval: "" 
          }) as any[][];
          setRawPreview(raw.slice(0, 50));

          const headerRows = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            range: Math.max(0, Number(startRow)), 
            defval: "" 
          }) as any[][];
          
          if (headerRows && headerRows.length > 0) {
            const extractedHeaders = (headerRows[0] || [])
              .map(h => String(h).trim())
              .filter(h => h !== "");
            setAvailableHeaders(extractedHeaders);
          } else {
            setAvailableHeaders([]);
          }
        }
      } catch (err) {
        console.error("Template preview loading error", err);
        setRawPreview([]);
      }
    };
    reader.readAsArrayBuffer(templateFile);
  };

  const handleTemplateFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setTemplateFile(file);
      
      try {
        const metadata = await parseExcelMetadata(file);
        setSheetMetadata(metadata);
        if (metadata.length > 0) {
          setSelectedSheet(metadata[0].name);
          setExportSheetName(metadata[0].name + '_Standardized');
        }
      } catch (err) {
        console.error("Error parsing file metadata", err);
      }
    }
  };

  const validateFileSchema = async (file: File): Promise<FileValidationResult> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[selectedSheet];
          
          if (!worksheet) {
            return resolve({
              fileName: file.name,
              isValid: false,
              error: language === 'zh-CN' ? `找不到工作表 "${selectedSheet}"` : `Sheet "${selectedSheet}" not found.`,
              file
            });
          }

          const headerRows = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            range: Math.max(0, Number(startRow)), 
            defval: "" 
          }) as any[][];

          const fileHeaders = (headerRows[0] || [])
            .map(h => String(h).trim())
            .filter(h => h !== "");

          // Check if all template headers exist in this file
          const missing = availableHeaders.filter(h => !fileHeaders.includes(h));
          
          if (missing.length > 0) {
            return resolve({
              fileName: file.name,
              isValid: false,
              error: language === 'zh-CN' ? `缺少列: ${missing.join(', ')}` : `Missing columns: ${missing.join(', ')}`,
              file
            });
          }

          resolve({ fileName: file.name, isValid: true, file });
        } catch (err) {
          resolve({
            fileName: file.name,
            isValid: false,
            error: language === 'zh-CN' ? "读取文件失败。" : "Failed to read file.",
            file
          });
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleBatchFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessing(true);
      const newFiles = Array.from(e.target.files) as File[];
      const validationResults: FileValidationResult[] = [];
      
      // Use existing files for duplicate check (matching by name and size)
      const currentFilesInfo = batchFiles.map(f => `${f.fileName}_${f.file.size}`);

      for (const file of newFiles) {
        const fileKey = `${file.name}_${file.size}`;
        const isDuplicate = currentFilesInfo.includes(fileKey);
        
        // Add to tracking to detect duplicates within the current selection batch too
        if (!isDuplicate) currentFilesInfo.push(fileKey);

        const res = await validateFileSchema(file);
        validationResults.push({
          ...res,
          isDuplicate,
          // If it's a duplicate, we mark it invalid for processing purposes or just flag it
          isValid: isDuplicate ? false : res.isValid
        });
      }
      
      setBatchFiles(prev => [...prev, ...validationResults]);
      setIsProcessing(false);
    }
  };

  const removeBatchFile = (index: number) => {
    setBatchFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeAllValid = () => {
    setBatchFiles(prev => prev.filter(f => !f.isValid && !f.isDuplicate));
  };

  const removeAllDuplicates = () => {
    setBatchFiles(prev => prev.filter(f => !f.isDuplicate));
  };

  const applyTemplate = (tpl: TransformationTemplate) => {
    const def = definitions.find(d => d.id === tpl.definitionId);
    if (!def) return;

    setSelectedDef(def);
    setActiveTemplate(tpl);
    setNewTemplateName(tpl.name);
    setSelectedSheet(tpl.sheetName);
    setStartRow(tpl.startRow);
    setEndRow(tpl.endRow ?? '');
    setMapping(tpl.mapping);
    setAvailableHeaders(tpl.expectedHeaders || []);
    setExportFileName(tpl.exportFileName);
    setExportSheetName(tpl.exportSheetName);
    setIncludeFileName(tpl.includeFileName ?? true);
    setFileNamePosition(tpl.fileNamePosition || 'front');
    
    // Skip Step 2 & 3, go straight to Batch Upload
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
      startRow,
      endRow: endRow === '' ? undefined : Number(endRow),
      mapping,
      expectedHeaders: availableHeaders,
      exportFileName,
      exportSheetName,
      includeFileName,
      fileNamePosition,
      updatedAt: new Date().toISOString()
    };
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
      console.error("Auto-mapping failed", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const runTransformation = async () => {
    if (!selectedDef || !selectedSheet || batchFiles.length === 0) return;
    setIsProcessing(true);
    setResults(null);
    
    // Only process valid and non-duplicate files
    const validFiles = batchFiles.filter(f => f.isValid && !f.isDuplicate).map(f => f.file);
    const endRowLimit = endRow === '' ? undefined : Number(endRow);

    try {
      const allRows: any[] = [];
      const allErrors: ValidationError[] = [];
      const fieldStats: Record<string, { mismatchCount: number }> = {};
      
      // Initialize stats
      selectedDef.fields.forEach(f => {
        fieldStats[f.name] = { mismatchCount: 0 };
      });

      for (const file of validFiles) {
        const data = await extractSheetData(file, selectedSheet, Number(startRow), endRowLimit);
        
        data.forEach((rawRow, rowIdx) => {
          const processedRow: any = {
            __source_file__: file.name,
            __source_sheet__: selectedSheet
          };
          
          selectedDef.fields.forEach(field => {
            const sourceColName = mapping[field.id];
            const rawValue = sourceColName ? rawRow[sourceColName] : null;

            let transformedValue = rawValue;
            let hasError = false;

            if (field.required && (rawValue === null || rawValue === undefined || rawValue === "")) {
              hasError = true;
              allErrors.push({
                row: rowIdx + (Number(startRow) + 2),
                field: field.name,
                value: rawValue,
                message: `Required field missing in file ${file.name}`,
                severity: 'error'
              });
            }

            if (field.type === FieldType.NUMBER && rawValue !== null && rawValue !== "") {
              const numValue = Number(rawValue);
              if (isNaN(numValue)) {
                hasError = true;
                allErrors.push({
                  row: rowIdx + (Number(startRow) + 2),
                  field: field.name,
                  value: rawValue,
                  message: `Non-numeric value in numeric field in file ${file.name}`,
                  severity: 'error'
                });
              } else {
                transformedValue = numValue;
              }
            }

            if (hasError) {
              fieldStats[field.name].mismatchCount += 1;
            }

            processedRow[field.name] = transformedValue;
          });
          
          allRows.push(processedRow);
        });
      }

      setResults({ 
        rows: allRows, 
        errors: allErrors, 
        fileCount: validFiles.length,
        fieldStats
      });
      setStep(5); // Jump to Results
    } catch (err) {
      console.error("Transformation Error", err);
      alert(language === 'zh-CN' ? '转换过程中发生错误' : 'An error occurred during transformation');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    if (!results) return;
    try {
      // Reconstruct rows based on table config
      const exportRows = results.rows.map(row => {
        const infoStr = `${row.__source_file__}_${row.__source_sheet__}`;
        const { __source_file__, __source_sheet__, ...dataFields } = row;
        
        const finalRow: any = {};
        const fileNameHeader = t.fileNameColumn;

        if (includeFileName && fileNamePosition === 'front') {
          finalRow[fileNameHeader] = infoStr;
        }

        Object.assign(finalRow, dataFields);

        if (includeFileName && fileNamePosition === 'back') {
          finalRow[fileNameHeader] = infoStr;
        }

        return finalRow;
      });
      
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, exportSheetName || 'Sheet1');
      XLSX.writeFile(workbook, `${exportFileName || 'Standardized_Tax_Data'}.xlsx`);
    } catch (err) {
      console.error("Export failed", err);
      alert(language === 'zh-CN' ? '导出失败，请检查设置' : 'Export failed, check settings');
    }
  };

  const getUnmappedCount = (tpl: TransformationTemplate) => {
    const def = definitions.find(d => d.id === tpl.definitionId);
    if (!def) return 0;
    // Count fields in the definition that are NOT in the template's mapping object
    return def.fields.filter(f => !tpl.mapping[f.id]).length;
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

  const handleStepClick = (num: number) => {
    if (canJumpToStep(num)) {
      setStep(num);
    } else {
      const messages = {
        'zh-CN': [
          '请先选择一个数据定义',
          '请先上传解析模板或选择已存逻辑',
          '请先完成字段映射',
          '请先上传并验证源文件',
          '请先执行转换以查看结果'
        ],
        'en-US': [
          'Please select a data definition first',
          'Please upload a template or select a saved logic first',
          'Please complete field mapping first',
          'Please upload and validate source files first',
          'Please execute transformation to see results first'
        ]
      };
      const msgList = language === 'zh-CN' ? messages['zh-CN'] : messages['en-US'];
      if (num > 1) alert(msgList[num - 2] || 'Step unavailable');
    }
  };

  const validBatchFiles = batchFiles.filter(f => f.isValid && !f.isDuplicate);
  const invalidBatchFiles = batchFiles.filter(f => !f.isValid && !f.isDuplicate);
  const duplicateBatchFiles = batchFiles.filter(f => f.isDuplicate);
  
  const validCount = validBatchFiles.length;
  const invalidCount = invalidBatchFiles.length;
  const duplicateCount = duplicateBatchFiles.length;
  const hasIssues = invalidCount > 0 || duplicateCount > 0;
  const allBatchFilesValid = batchFiles.length > 0 && !hasIssues;

  const getValidFilesString = () => {
    if (validCount === 0) return '';
    const names = validBatchFiles.map(f => f.fileName);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')}${language === 'zh-CN' ? ` 等 ${names.length} 个文件` : ` and ${names.length - 2} other files`}`;
  };

  const relevantTemplates = selectedDef ? templates.filter(t => t.definitionId === selectedDef.id) : [];

  return (
    <div className="p-12 max-w-[1600px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4">
      {/* Consistent Page Header */}
      <header>
        <h1 className="text-5xl font-black text-slate-800 tracking-tighter">{t.title}</h1>
        <p className="text-slate-500 font-bold mt-2 text-lg">{t.subtitle}</p>
      </header>

      {/* Progress Bar moved below Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm sticky top-4 z-40 transition-all hover:shadow-lg">
        {steps.map((s) => {
          const isAccessible = canJumpToStep(s.num);
          const isActive = step === s.num;
          return (
            <div 
              key={s.num} 
              onClick={() => handleStepClick(s.num)}
              className={`flex items-center gap-4 px-4 flex-1 justify-center last:flex-none transition-all duration-300 ${isAccessible ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60'}`}
            >
              <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-base transition-all duration-300 ${
                step >= s.num ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-300'
              } ${isActive ? 'ring-8 ring-indigo-50' : ''}`}>
                {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
              </div>
              <span className={`text-[13px] font-black uppercase tracking-widest hidden lg:inline transition-colors duration-300 ${step >= s.num ? 'text-indigo-900' : 'text-slate-300'} ${isActive ? 'underline decoration-indigo-300 underline-offset-8' : ''}`}>
                {s.label}
              </span>
              {s.num < 6 && <div className="h-[2px] bg-slate-50 flex-1 mx-4 hidden lg:block" />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10">
          {!selectedDef ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {definitions.map((def) => {
                const defTemplates = templates.filter(tpl => tpl.definitionId === def.id);
                return (
                  <div
                    key={def.id}
                    className="flex flex-col h-full bg-white rounded-[40px] border-2 border-slate-200 hover:border-indigo-300 transition-all shadow-sm overflow-hidden"
                  >
                    <button
                      onClick={() => { setSelectedDef(def); }}
                      className="p-8 text-left flex-1"
                    >
                      <div className="bg-indigo-50 p-4 rounded-2xl shadow-sm border border-slate-100 self-start mb-6 inline-block">
                        <Database className="w-8 h-8 text-indigo-600" />
                      </div>
                      <h3 className="font-black text-slate-800 text-xl mb-3">{def.name}</h3>
                      <p className="text-slate-500 font-bold text-sm mb-6 line-clamp-3 leading-relaxed">{def.description}</p>
                    </button>
                    
                    {defTemplates.length > 0 && (
                      <div className="bg-slate-50 px-8 py-6 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Bookmark className="w-3.5 h-3.5" />
                          {language === 'zh-CN' ? '保存的解析逻辑' : 'Saved Logics'}
                        </p>
                        <div className="flex flex-col gap-3">
                          {defTemplates.slice(0, 3).map(tpl => {
                            const unmapped = getUnmappedCount(tpl);
                            return (
                              <button
                                key={tpl.id}
                                onClick={() => applyTemplate(tpl)}
                                className="w-full flex items-center justify-between text-left p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-600 hover:bg-indigo-50 transition-all group shadow-sm"
                              >
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-black text-slate-600 group-hover:text-indigo-700 truncate">{tpl.name}</span>
                                  {unmapped > 0 && (
                                    <span className="text-[9px] font-black text-amber-600 flex items-center gap-1 mt-1">
                                      <AlertCircle className="w-2.5 h-2.5" />
                                      {unmapped}{t.unmappedFields}
                                    </span>
                                  )}
                                </div>
                                <ChevronRightIcon className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 flex-shrink-0" />
                              </button>
                            );
                          })}
                          {defTemplates.length > 3 && (
                            <button 
                              onClick={() => setSelectedDef(def)}
                              className="text-[10px] font-black text-indigo-600 hover:underline text-center mt-2 uppercase tracking-widest"
                            >
                              {language === 'zh-CN' ? `查看更多 (${defTemplates.length})` : `View all (${defTemplates.length})`}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-10">
              <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <div className="bg-indigo-50 p-5 rounded-[24px] shadow-sm"><Database className="w-10 h-10 text-indigo-600" /></div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-800 tracking-tight">{selectedDef.name}</h3>
                    <p className="text-slate-400 font-black uppercase tracking-widest text-xs mt-2">{selectedDef.fields.length} Fields Configured</p>
                  </div>
                </div>
                <button onClick={() => setSelectedDef(null)} className="p-4 text-slate-300 hover:text-slate-800 transition-colors bg-slate-50 rounded-2xl"><X className="w-8 h-8" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <button onClick={() => setStep(2)} className="group bg-white p-12 rounded-[56px] border-2 border-dashed border-slate-200 hover:border-indigo-600 hover:bg-indigo-50/30 transition-all text-center space-y-6">
                  <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto group-hover:bg-indigo-600 transition-colors shadow-inner"><ArrowRight className="w-10 h-10 text-slate-300 group-hover:text-white" /></div>
                  <h4 className="text-2xl font-black text-slate-800 tracking-tight">{t.startFresh}</h4>
                  <p className="text-slate-500 font-bold leading-relaxed">{language === 'zh-CN' ? '从头开始配置新文件结构的解析逻辑。' : 'Configure parsing logic from scratch for new file structures.'}</p>
                </button>
                <div className="space-y-8">
                  <h4 className="text-lg font-black text-slate-800 uppercase tracking-widest flex items-center gap-3"><Bookmark className="w-6 h-6 text-amber-500" />{t.useTemplate}</h4>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-4">
                    {relevantTemplates.map(tpl => {
                      const unmapped = getUnmappedCount(tpl);
                      return (
                        <div key={tpl.id} className="bg-white p-8 rounded-[36px] border border-slate-200 flex items-center justify-between group hover:border-indigo-600 transition-all shadow-sm">
                          <button onClick={() => applyTemplate(tpl)} className="flex-1 text-left min-w-0">
                            <div className="flex items-center gap-4">
                              <p className="text-lg font-black text-slate-800 group-hover:text-indigo-600 transition-colors truncate">{tpl.name}</p>
                              {unmapped > 0 && (
                                <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 flex-shrink-0">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  {unmapped} {t.unmappedFields}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-400 font-bold mt-2">Updated {new Date(tpl.updatedAt).toLocaleDateString()} • {Object.keys(tpl.mapping).length} fields mapped</p>
                          </button>
                          <button onClick={() => onDeleteTemplate(tpl.id)} className="p-3 text-slate-200 hover:text-red-500 transition-all"><Trash2 className="w-5 h-5" /></button>
                        </div>
                      );
                    })}
                    {relevantTemplates.length === 0 && <div className="text-center py-16 text-slate-300 font-bold italic opacity-50">No saved templates for this module.</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-12">
          <div className={`bg-white border-4 border-dashed border-slate-200 rounded-[56px] p-20 text-center transition-all hover:border-indigo-300 relative group shadow-inner ${templateFile ? 'border-emerald-200 bg-emerald-50/10' : ''}`}>
            {!templateFile ? (
              <>
                <input type="file" onChange={handleTemplateFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept=".xlsx, .xls" />
                <div className="bg-indigo-50 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-10 group-hover:scale-110 shadow-sm transition-transform"><Upload className="w-12 h-12 text-indigo-600" /></div>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">{t.uploadTitle}</h3>
                <p className="text-slate-500 mt-4 font-bold text-lg">{t.uploadSubtitle}</p>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <div className="bg-emerald-100 w-28 h-28 rounded-full flex items-center justify-center mb-10 shadow-emerald-50 shadow-lg"><CheckCircle2 className="w-14 h-14 text-emerald-600" /></div>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">{templateFile.name}</h3>
                <button onClick={() => { setTemplateFile(null); setRawPreview([]); }} className="mt-10 bg-white border border-slate-200 px-8 py-3 rounded-2xl text-slate-400 hover:text-red-500 hover:border-red-100 font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all shadow-sm"><Trash2 className="w-5 h-5" /> Change Template</button>
              </div>
            )}
          </div>
          {templateFile && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-4 bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm space-y-10 h-fit sticky top-32">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-4"><Settings2 className="w-8 h-8 text-indigo-600" />{t.configTitle}</h3>
                <div className="space-y-10">
                  <div className="space-y-4">
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest">{t.targetSheet}</label>
                    <div className="relative">
                      <select value={selectedSheet} onChange={(e) => setSelectedSheet(e.target.value)} className="w-full px-6 py-5 border border-slate-200 rounded-3xl bg-slate-50/50 font-bold text-slate-700 shadow-sm outline-none focus:ring-8 focus:ring-indigo-50 transition-all appearance-none pr-12">
                        {sheetMetadata.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <label className="block text-sm font-black text-slate-400 uppercase tracking-widest">{t.headerIndex}</label>
                      <input type="number" min="0" value={startRow} onChange={(e) => setStartRow(parseInt(e.target.value) || 0)} className="w-full px-6 py-6 border border-slate-200 rounded-3xl font-black text-center text-4xl shadow-sm text-indigo-600 outline-none bg-slate-50/50 focus:ring-8 focus:ring-indigo-50 transition-all" />
                    </div>
                    <div className="space-y-4">
                      <label className="block text-sm font-black text-slate-400 uppercase tracking-widest">{t.endRowIndex}</label>
                      <input type="number" min="0" value={endRow} placeholder={t.endRowPlaceholder} onChange={(e) => setEndRow(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full px-6 py-6 border border-slate-200 rounded-3xl font-black text-center text-4xl shadow-sm text-slate-400 outline-none bg-slate-50/50 focus:ring-8 focus:ring-indigo-50 transition-all focus:text-indigo-600" />
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100">
                  <button onClick={() => setStep(3)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-6 rounded-[32px] font-black flex items-center justify-center gap-4 shadow-2xl shadow-indigo-100 transition-all transform hover:-translate-y-1 active:scale-95 text-lg">{t.continueMapping}<ArrowRight className="w-7 h-7" /></button>
                </div>
              </div>
              <div className="lg:col-span-8 space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-slate-800 flex items-center gap-4 tracking-tight"><Eye className="w-8 h-8 text-emerald-500" />{t.previewTitle}</h3>
                  <button onClick={() => setShowSkippedRows(!showSkippedRows)} className={`text-[11px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl border-2 transition-all shadow-sm flex items-center gap-3 ${showSkippedRows ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                    {showSkippedRows ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {language === 'zh-CN' ? (showSkippedRows ? '显示顶部' : '隐藏顶部') : (showSkippedRows ? 'Show Header' : 'Hide Header')}
                  </button>
                </div>
                <div className="bg-white rounded-[48px] border border-slate-200 shadow-xl overflow-auto custom-scrollbar max-h-[700px]">
                  {rawPreview.length > 0 ? (
                    <table className="w-full text-left text-xs border-separate border-spacing-0">
                      <thead className="bg-slate-50 sticky top-0 z-20">
                        <tr>
                          <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b-2 border-slate-100 w-20 text-center">Row</th>
                          {(rawPreview[startRow] || []).map((_, i) => <th key={i} className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b-2 border-slate-100 whitespace-nowrap">Col {String.fromCharCode(65 + i)}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold transition-all">
                        {rawPreview.map((row, rIdx) => {
                          const isHeader = rIdx === startRow;
                          if (rIdx < startRow && !showSkippedRows) return null;
                          // Optional end row preview logic
                          const endRowLimit = endRow === '' ? Infinity : Number(endRow);
                          if (rIdx > endRowLimit) return null;

                          return (
                            <tr key={rIdx} className={`transition-all ${isHeader ? 'bg-indigo-50/50' : rIdx < startRow ? 'opacity-30' : 'hover:bg-slate-50/50'}`}>
                              <td className={`px-6 py-5 text-center border-r-2 border-slate-50 font-black ${isHeader ? 'text-indigo-600' : 'text-slate-300'}`}>{rIdx}</td>
                              {row.map((cell: any, cIdx: number) => <td key={cIdx} className={`px-8 py-5 whitespace-nowrap truncate max-w-[250px] ${isHeader ? 'font-black text-indigo-900 bg-indigo-50/30' : 'text-slate-600'}`}>{cell}</td>)}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-40 text-center text-slate-300 font-black italic text-xl opacity-50">{t.noDataPreview}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-12">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-black text-slate-800 tracking-tight">{language === 'zh-CN' ? '字段映射架构' : t.mappingTitle}</h2>
              <p className="text-slate-500 font-bold text-lg mt-2">{t.mappingSubtitle}</p>
            </div>
            <button onClick={autoMap} disabled={isProcessing || availableHeaders.length === 0} className="bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 px-10 py-5 rounded-3xl font-black flex items-center gap-4 transition-all shadow-2xl shadow-indigo-50 disabled:opacity-50 text-lg">{isProcessing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}{t.autoMap}</button>
          </div>
          <div className="bg-white rounded-[48px] border border-slate-200 shadow-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead><tr className="bg-slate-50 border-b-2 border-slate-100"><th className="px-12 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest">Target Field</th><th className="px-12 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest">Source Template Column</th><th className="px-12 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Constraint</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {selectedDef?.fields.map((field) => (
                  <tr key={field.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-12 py-10">
                      <div className="flex items-center gap-6">
                        <div className="bg-indigo-50 p-4 rounded-2xl shadow-sm border border-indigo-100">
                          <Database className="w-6 h-6 text-indigo-500" />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-lg">{field.name}</p>
                          <p className="text-[10px] text-slate-400 font-black mt-2 uppercase tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300" />{field.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-12 py-10">
                      <div className="relative">
                        <select 
                          value={mapping[field.id] || ''} 
                          onChange={(e) => setMapping(prev => ({ ...prev, [field.id]: e.target.value }))} 
                          className="w-full px-6 py-4.5 border border-slate-200 rounded-3xl bg-slate-50/50 shadow-sm outline-none font-bold text-slate-700 transition-all focus:ring-8 focus:ring-indigo-50 appearance-none pr-12"
                        >
                          {<option value="">{t.unmapped}</option>}
                          {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-12 py-10 text-center">
                      {field.required ? 
                        <span className="inline-flex px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-700 shadow-sm border border-red-200">Strict</span> : 
                        <span className="inline-flex px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 shadow-sm border border-slate-200">Optional</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center pt-10"><button onClick={() => setStep(2)} className="text-slate-400 hover:text-slate-800 font-black px-10 py-5 transition-all uppercase tracking-[.3em] text-xs flex items-center gap-3 hover:bg-white rounded-3xl border border-transparent hover:border-slate-200">&larr; Back</button><button onClick={() => setStep(4)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-14 py-6 rounded-[36px] font-black flex items-center gap-5 shadow-2xl shadow-indigo-100 transition-all transform hover:-translate-y-1 text-lg">{t.uploadSources}<ArrowRight className="w-7 h-7" /></button></div>
        </div>
      )}

      {step === 4 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-white border-4 border-dashed border-slate-200 rounded-[56px] p-24 text-center transition-all hover:border-indigo-300 relative min-h-[500px] flex flex-col items-center justify-center group shadow-inner">
                <input type="file" multiple onChange={handleBatchFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept=".xlsx, .xls" />
                <div className="bg-indigo-50 w-32 h-32 rounded-full flex items-center justify-center mb-10 group-hover:scale-110 shadow-sm transition-transform"><Files className="w-14 h-14 text-indigo-600" /></div>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">{t.batchUpload}</h3>
                <p className="text-slate-400 font-bold mt-4 text-lg">{language === 'zh-CN' ? '支持批量拖拽多文件及文件夹' : 'Supports multi-file dynamic drag & drop and folder uploads'}</p>
              </div>
              {batchFiles.length > 0 && (
                <div className="bg-white rounded-[48px] border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in">
                  <div className="p-8 border-b-2 border-slate-50 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3"><Files className="w-5 h-5 text-indigo-500" />{t.validationTitle}</h3>
                    <div className="flex gap-4">
                      <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-5 py-2 rounded-full border border-emerald-100 shadow-sm">{validCount} {t.validFiles}</span>
                      <span className={`text-[11px] font-black px-5 py-2 rounded-full border shadow-sm ${invalidCount > 0 ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-slate-300 bg-white border-slate-100'}`}>{invalidCount} {t.invalidFiles}</span>
                      {duplicateCount > 0 && <span className="text-[11px] font-black text-red-600 bg-red-50 px-5 py-2 rounded-full border border-red-100 shadow-sm">{duplicateCount} {t.duplicatedFiles}</span>}
                    </div>
                  </div>
                  <div className="max-h-[600px] overflow-y-auto custom-scrollbar divide-y-2 divide-slate-50">
                    {validCount > 0 && (
                      <div className="p-8 flex items-start justify-between bg-emerald-50/20 group transition-colors hover:bg-emerald-50/40">
                        <div className="flex items-start gap-8">
                          <div className="p-4 rounded-2xl bg-white shadow-sm">
                            <Check className="w-6 h-6 text-emerald-600" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-black text-slate-800 text-lg">{t.validationSuccess}</p>
                            <p className="text-sm font-bold text-emerald-600 mt-2 max-w-full leading-relaxed">
                              {getValidFilesString()}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={removeAllValid}
                          className="p-4 text-slate-200 hover:text-red-500 transition-all hover:bg-white rounded-2xl shadow-sm"
                          title={language === 'zh-CN' ? '移除所有有效文件' : 'Remove all valid files'}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}

                    {duplicateCount > 0 && (
                      <div className="p-8 flex items-start justify-between bg-red-50/20 group transition-colors hover:bg-red-50/40 border-b border-red-100">
                        <div className="flex items-start gap-8">
                          <div className="p-4 rounded-2xl bg-white shadow-sm ring-2 ring-red-100">
                            <CopyX className="w-6 h-6 text-red-600" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-black text-red-900 text-lg">{t.duplicatedFiles}</p>
                            <p className="text-sm font-bold text-red-600 mt-2 leading-relaxed">
                              {duplicateBatchFiles.map(f => f.fileName).join(', ')}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={removeAllDuplicates}
                          className="p-4 text-red-300 hover:text-red-600 transition-all hover:bg-white rounded-2xl shadow-sm"
                          title={language === 'zh-CN' ? '移除所有重复文件' : 'Remove all duplicates'}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    
                    {invalidBatchFiles.map((res, i) => (
                      <div key={res.fileName + i} className="p-8 flex items-center justify-between hover:bg-amber-50/10 transition-colors">
                        <div className="flex items-center gap-8 overflow-hidden">
                          <div className="p-4 rounded-2xl bg-white shadow-sm">
                            <AlertCircle className="w-6 h-6 text-amber-500" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-black truncate text-slate-800 text-lg">{res.fileName}</p>
                            <p className="text-xs font-bold uppercase tracking-widest mt-2 text-amber-600 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-200" />{res.error}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            const actualIdx = batchFiles.findIndex(f => f.fileName === res.fileName && f.file === res.file);
                            if (actualIdx > -1) removeBatchFile(actualIdx);
                          }} 
                          className="p-4 text-slate-200 hover:text-red-500 transition-all hover:bg-white rounded-2xl shadow-sm"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="lg:col-span-4 space-y-8">
              <div className={`bg-white p-12 rounded-[56px] border shadow-2xl transition-all h-fit ${batchFiles.length === 0 ? 'opacity-40' : allBatchFilesValid ? 'border-emerald-200 bg-emerald-50/30' : (duplicateCount > 0 ? 'border-red-200 bg-red-50/30' : 'border-amber-100 bg-amber-50/30')}`}>
                {batchFiles.length === 0 ? <div className="text-center py-20"><Info className="w-20 h-20 text-slate-100 mx-auto mb-6" /><p className="text-slate-400 font-black uppercase tracking-widest text-xs">{t.noFiles}</p></div> : 
                  <div className="space-y-10">
                    <div className="flex items-center gap-6">
                      <div className={`p-6 rounded-[32px] ${allBatchFilesValid ? 'bg-emerald-500' : (duplicateCount > 0 ? 'bg-red-500' : 'bg-amber-500')} text-white shadow-lg`}>
                        {allBatchFilesValid ? <CheckCircle2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-slate-800 tracking-tight">{allBatchFilesValid ? 'Ready' : 'Issues Detected'}</h4>
                        <p className="text-sm text-slate-500 font-bold mt-2 leading-tight">{allBatchFilesValid ? t.allValid : t.someInvalid}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="p-6 bg-white rounded-3xl border border-slate-50 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t.validFiles}</p><p className="text-3xl font-black text-emerald-600">{validCount}</p></div>
                      <div className="p-6 bg-white rounded-3xl border border-slate-50 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t.invalidFiles}</p><p className={`text-3xl font-black ${invalidCount > 0 ? 'text-amber-500' : 'text-slate-300'}`}>{invalidCount}</p></div>
                      {duplicateCount > 0 && (
                        <div className="p-6 bg-white rounded-3xl border border-red-100 shadow-sm col-span-2"><p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2">{t.duplicatedFiles}</p><p className="text-3xl font-black text-red-600">{duplicateCount}</p></div>
                      )}
                    </div>
                    <button onClick={runTransformation} disabled={isProcessing || batchFiles.length === 0 || !batchFiles.some(f => f.isValid && !f.isDuplicate)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-8 rounded-[40px] font-black flex items-center justify-center gap-5 shadow-2xl shadow-indigo-100 transition-all transform hover:-translate-y-2 active:scale-95 disabled:opacity-50 disabled:transform-none text-xl">{isProcessing ? <RefreshCw className="w-8 h-8 animate-spin" /> : <Sparkles className="w-8 h-8" />}{t.execute}</button>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 5 && results && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-12 h-full">
          {/* Summary Row with Next Step button on the far right */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 items-stretch">
            <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-center">
              <p className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">{t.rowsProcessed}</p>
              <h3 className={`text-3xl font-black tracking-tight text-slate-800`}>
                {t.rowsProcessedSummary.replace('{0}', results.fileCount.toString()).replace('{1}', results.rows.length.toLocaleString())}
              </h3>
            </div>
            
            <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-center">
              <p className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest group-hover:text-red-400 transition-colors">{t.qualityIssues}</p>
              <h3 className={`text-5xl font-black tracking-tight ${results.errors.length > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {results.errors.length.toLocaleString()}
              </h3>
            </div>

            <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-center">
              <p className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">{t.healthScore}</p>
              <h3 className={`text-5xl font-black tracking-tight text-indigo-600`}>
                {Math.max(0, 100 - (results.errors.length / (results.rows.length * (selectedDef?.fields.length || 1)) * 100)).toFixed(1)}%
              </h3>
            </div>

            {/* Rapid Workflow Access: Next step on the same row */}
            <button 
              onClick={() => setStep(6)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-10 rounded-[48px] shadow-2xl shadow-indigo-100 transition-all transform hover:-translate-y-2 active:scale-95 flex flex-col justify-center items-center gap-4 group"
            >
              <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest group-hover:text-white transition-colors">
                 {language === 'zh-CN' ? '下一步' : 'Next Step'}
              </p>
              <h3 className="text-2xl font-black text-center leading-tight">
                {t.gotoSave}
              </h3>
              <ArrowRight className="w-8 h-8" />
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            <div className="xl:col-span-12 space-y-8">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-4 tracking-tight"><CheckCircle2 className="w-8 h-8 text-emerald-500" />{t.previewTitle}</h3>
              <div className="bg-white rounded-[56px] border border-slate-200 overflow-hidden shadow-2xl flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto custom-scrollbar">
                  {results.rows.length > 0 ? (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 sticky top-0 z-10 border-b-2 border-slate-100">
                        <tr>
                          <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-r border-slate-100 w-16 text-center">#</th>
                          <th className="px-8 py-6 font-black text-slate-800 uppercase tracking-widest bg-slate-50 border-r border-slate-100 min-w-[200px]">{t.fileNameColumn}</th>
                          {selectedDef?.fields.map(f => {
                            const stats = results.fieldStats[f.name];
                            return (
                              <th key={f.id} className="px-8 py-6 font-black text-slate-800 uppercase tracking-widest whitespace-nowrap bg-slate-50">
                                {f.name} 
                                <span className={`ml-2 text-[10px] font-black px-2 py-0.5 rounded-full ${stats.mismatchCount > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                                  ({f.type} | {stats.mismatchCount})
                                </span>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold">
                        {results.rows.slice(0, 100).map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-4 text-slate-300 font-black bg-slate-50/30 text-center border-r border-slate-50">{i + 1}</td>
                            <td className="px-8 py-4 text-slate-400 font-black italic border-r border-slate-50">
                              {row.__source_file__}_{row.__source_sheet__}
                            </td>
                            {selectedDef?.fields.map(f => (
                              <td key={f.id} className="px-8 py-4 text-slate-600 whitespace-nowrap">
                                {row[f.name] !== null && row[f.name] !== undefined ? String(row[f.name]) : <span className="text-slate-200 font-black italic">NULL</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-40 text-center text-slate-200 font-black italic text-2xl opacity-50">{t.noDataPreview}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-start items-center pt-10">
            <button 
              onClick={() => { setStep(1); resetState(); }} 
              className="px-12 py-6 bg-white border-2 border-slate-200 text-slate-500 rounded-[40px] font-black hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm uppercase tracking-widest text-xs"
            >
              {t.initNew}
            </button>
          </div>
        </div>
      )}

      {step === 6 && selectedDef && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-12 max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6 flex flex-col hover:shadow-xl transition-all">
              <div className="flex items-center gap-3 text-indigo-600 font-black uppercase tracking-widest text-[10px]">
                <Database className="w-4 h-4" />
                {t.summaryTarget}
              </div>
              <div className="flex-1">
                <h4 className="text-2xl font-black text-slate-800 leading-tight tracking-tight">{selectedDef.name}</h4>
                <p className="text-xs text-slate-500 mt-2 font-bold leading-relaxed line-clamp-3">{selectedDef.description}</p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8 flex flex-col hover:shadow-xl transition-all">
              <div className="flex items-center gap-3 text-emerald-600 font-black uppercase tracking-widest text-[10px]">
                <Settings2 className="w-4 h-4" />
                {t.summarySource}
              </div>
              <div className="space-y-4 flex-1">
                {[
                  { label: 'Sheet', val: selectedSheet },
                  { label: 'Header Row', val: startRow },
                  { label: 'End Row', val: endRow === '' ? 'All' : endRow },
                  { label: 'Batch Files', val: `${batchFiles.filter(f => f.isValid).length} Valid` }
                ].map((row, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                    <span className="text-slate-400 font-black text-[9px] uppercase tracking-widest">{row.label}</span>
                    <span className="font-black text-slate-800 text-sm truncate ml-2">{row.val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6 flex flex-col h-full hover:shadow-xl transition-all">
              <div className="flex items-center gap-3 text-amber-500 font-black uppercase tracking-widest text-[10px]">
                <Map className="w-4 h-4" />
                {t.summaryMapping}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {selectedDef.fields.map(f => (
                  <div key={f.id} className="flex items-center justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
                    <span className="text-[10px] font-black text-slate-500 truncate flex-shrink-0 uppercase tracking-wider">{f.name}</span>
                    <ArrowRight className="w-3 h-3 text-slate-200" />
                    <span className="text-[10px] font-black text-indigo-600 truncate text-right">
                      {mapping[f.id] || (language === 'zh-CN' ? '未映射' : 'Not Mapped')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6 flex flex-col hover:shadow-xl transition-all">
              <div className="flex items-center gap-3 text-pink-500 font-black uppercase tracking-widest text-[10px]">
                <FileOutput className="w-4 h-4" />
                {language === 'zh-CN' ? '输出配置' : 'Output Config'}
              </div>
              <div className="space-y-4 flex-1">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{language === 'zh-CN' ? '文件名 (.xlsx)' : 'File Name (.xlsx)'}</label>
                  <input 
                    type="text" 
                    value={exportFileName} 
                    onChange={(e) => setExportFileName(e.target.value)} 
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl font-black text-slate-700 bg-slate-50/50 outline-none focus:ring-4 focus:ring-pink-50 transition-all text-[11px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{language === 'zh-CN' ? '工作表名称' : 'Sheet Name'}</label>
                  <input 
                    type="text" 
                    value={exportSheetName} 
                    onChange={(e) => setExportSheetName(e.target.value)} 
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl font-black text-slate-700 bg-slate-50/50 outline-none focus:ring-4 focus:ring-pink-50 transition-all text-[11px]"
                  />
                </div>
              </div>
            </div>

            {/* Table Config Card */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6 flex flex-col hover:shadow-xl transition-all">
              <div className="flex items-center gap-3 text-cyan-500 font-black uppercase tracking-widest text-[10px]">
                <TableProperties className="w-4 h-4" />
                {t.tableConfig}
              </div>
              <div className="space-y-6 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.showFileName}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={includeFileName} onChange={(e) => setIncludeFileName(e.target.checked)} />
                    <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 shadow-inner"></div>
                  </label>
                </div>
                {includeFileName && (
                  <div className="space-y-3 pt-2 border-t border-slate-50">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.colPosition}</label>
                    <div className="flex bg-slate-50 p-1 rounded-xl">
                      <button 
                        onClick={() => setFileNamePosition('front')}
                        className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${fileNamePosition === 'front' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {t.posFront}
                      </button>
                      <button 
                        onClick={() => setFileNamePosition('back')}
                        className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${fileNamePosition === 'back' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {t.posBack}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="bg-indigo-900 p-12 rounded-[64px] shadow-2xl space-y-10 text-white flex flex-col justify-between group overflow-hidden relative">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full group-hover:scale-150 transition-transform duration-1000" />
              <div className="space-y-8 relative z-10">
                <div className="flex items-center gap-6">
                  <div className="bg-white/10 p-5 rounded-[32px] shadow-sm">
                    <Bookmark className="w-10 h-10 text-white" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-black text-indigo-300 uppercase tracking-[.3em] mb-3">
                      {t.templateName}
                    </label>
                    <input 
                      type="text" 
                      value={newTemplateName} 
                      onChange={(e) => setNewTemplateName(e.target.value)} 
                      placeholder="e.g. EMEA Monthly VAT Pipeline" 
                      className="w-full bg-indigo-950/40 border border-white/10 px-8 py-6 rounded-[32px] text-2xl font-black focus:ring-8 focus:ring-indigo-500/30 outline-none transition-all shadow-inner" 
                    />
                  </div>
                </div>
                <p className="text-indigo-200 font-bold text-lg leading-relaxed px-4">
                  {language === 'zh-CN' ? '将当前的解析逻辑保存为模板，以便将来在控制台中一键应用。' : 'Save the current parsing logic as a template to apply it with one click from the dashboard in the future.'}
                </p>
              </div>
              <div className="pt-8 relative z-10">
                {activeTemplate ? (
                  <div className="grid grid-cols-2 gap-6">
                    <button 
                      onClick={() => handleSaveTemplate(false)} 
                      className="w-full bg-indigo-600 border-2 border-white/20 text-white px-8 py-6 rounded-[36px] font-black shadow-2xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-4 uppercase tracking-[.2em] text-[11px] transform hover:-translate-y-1"
                    >
                      <Save className="w-6 h-6" />
                      {t.saveUpdate}
                    </button>
                    <button 
                      onClick={() => handleSaveTemplate(true)} 
                      className="w-full bg-white/10 border-2 border-white/20 text-white px-8 py-6 rounded-[36px] font-black shadow-2xl hover:bg-white/20 transition-all flex items-center justify-center gap-4 uppercase tracking-[.2em] text-[11px] transform hover:-translate-y-1"
                    >
                      <Copy className="w-6 h-6" />
                      {t.saveAs}
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => handleSaveTemplate(true)} 
                    disabled={!newTemplateName} 
                    className="w-full bg-indigo-600 border-2 border-white/20 text-white px-10 py-8 rounded-[40px] font-black shadow-2xl hover:bg-indigo-500 transition-all transform hover:-translate-y-2 disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-5 uppercase tracking-[.3em] text-lg"
                  >
                    <Save className="w-8 h-8" />
                    {t.saveFinish}
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white p-12 rounded-[64px] border border-slate-200 shadow-2xl space-y-10 flex flex-col justify-between group overflow-hidden relative">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-50/30 rounded-full group-hover:scale-150 transition-transform duration-1000" />
              <div className="space-y-8 relative z-10">
                 <div className="flex items-center gap-6">
                  <div className="bg-indigo-50 p-5 rounded-[32px] shadow-sm">
                    <Download className="w-10 h-10 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-black text-slate-300 uppercase tracking-[.3em] mb-3">
                      {language === 'zh-CN' ? '立即导出' : 'Export results now'}
                    </label>
                    <p className="text-slate-800 text-4xl font-black tracking-tighter leading-none">
                      {language === 'zh-CN' ? '标准化结果已就绪' : 'Standardized results ready'}
                    </p>
                  </div>
                </div>
                <p className="text-slate-500 font-bold text-lg leading-relaxed px-4">
                  {language === 'zh-CN' ? '将标准化后的数据保存为 Excel 文件，符合 ERP 导入格式要求。' : 'Save the standardized data as an Excel file, compliant with ERP import format requirements.'}
                </p>
              </div>
              <div className="pt-8 relative z-10">
                <button 
                  onClick={handleExport}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-8 rounded-[40px] font-black shadow-2xl shadow-indigo-100 transition-all transform hover:-translate-y-2 flex items-center justify-center gap-5 uppercase tracking-[.3em] text-lg"
                >
                  <Download className="w-8 h-8" />
                  {t.export}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-start pt-6">
            <button 
              onClick={() => setStep(5)} 
              className="px-12 py-5 border-2 border-slate-200 text-slate-300 font-black rounded-[32px] hover:bg-white hover:text-slate-800 hover:border-slate-800 transition-all uppercase tracking-[.4em] text-[10px] flex items-center gap-4 group"
            >
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransformWizard;
