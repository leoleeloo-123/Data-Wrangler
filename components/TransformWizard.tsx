
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
  FileOutput
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
          setRawPreview(raw.slice(0, 30));

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
      
      for (const file of newFiles) {
        const res = await validateFileSchema(file);
        validationResults.push(res);
      }
      
      setBatchFiles(prev => [...prev, ...validationResults]);
      setIsProcessing(false);
    }
  };

  const removeBatchFile = (index: number) => {
    setBatchFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeAllValid = () => {
    setBatchFiles(prev => prev.filter(f => !f.isValid));
  };

  const applyTemplate = (tpl: TransformationTemplate) => {
    const def = definitions.find(d => d.id === tpl.definitionId);
    if (!def) return;

    setSelectedDef(def);
    setActiveTemplate(tpl);
    setSelectedSheet(tpl.sheetName);
    setStartRow(tpl.startRow);
    setMapping(tpl.mapping);
    setAvailableHeaders(tpl.expectedHeaders || []);
    setExportFileName(tpl.exportFileName);
    setExportSheetName(tpl.exportSheetName);
    
    // Skip Step 2 & 3, go straight to Batch Upload
    setStep(4); 
  };

  const handleSaveTemplate = () => {
    if (!selectedDef || !newTemplateName) return;
    const template: TransformationTemplate = {
      id: crypto.randomUUID(),
      name: newTemplateName,
      definitionId: selectedDef.id,
      sheetName: selectedSheet,
      startRow,
      mapping,
      expectedHeaders: availableHeaders,
      exportFileName,
      exportSheetName,
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
    
    const validFiles = batchFiles.filter(f => f.isValid).map(f => f.file);
    
    try {
      const allRows: any[] = [];
      const allErrors: ValidationError[] = [];

      for (const file of validFiles) {
        const data = await extractSheetData(file, selectedSheet, Number(startRow));
        
        data.forEach((rawRow, rowIdx) => {
          const processedRow: any = {};
          
          selectedDef.fields.forEach(field => {
            const sourceColName = mapping[field.id];
            const rawValue = sourceColName ? rawRow[sourceColName] : null;

            let transformedValue = rawValue;

            if (field.required && (rawValue === null || rawValue === undefined || rawValue === "")) {
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

            processedRow[field.name] = transformedValue;
          });
          
          allRows.push(processedRow);
        });
      }

      setResults({ rows: allRows, errors: allErrors });
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
      const worksheet = XLSX.utils.json_to_sheet(results.rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, exportSheetName || 'Sheet1');
      XLSX.writeFile(workbook, `${exportFileName || 'Standardized_Data'}.xlsx`);
    } catch (err) {
      console.error("Export failed", err);
      alert(language === 'zh-CN' ? '导出失败，请检查设置' : 'Export failed, check settings');
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

  const validBatchFiles = batchFiles.filter(f => f.isValid);
  const invalidBatchFiles = batchFiles.filter(f => !f.isValid);
  
  const validCount = validBatchFiles.length;
  const invalidCount = invalidBatchFiles.length;
  const allBatchFilesValid = batchFiles.length > 0 && invalidCount === 0;

  const getValidFilesString = () => {
    if (validCount === 0) return '';
    const names = validBatchFiles.map(f => f.fileName);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')}${language === 'zh-CN' ? ` 等 ${names.length} 个文件` : ` and ${names.length - 2} other files`}`;
  };

  const relevantTemplates = selectedDef ? templates.filter(t => t.definitionId === selectedDef.id) : [];

  return (
    <div className="p-8 max-w-[1600px] mx-auto pb-24 h-full relative">
      <div className="flex items-center justify-between mb-12 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm sticky top-4 z-40">
        {steps.map((s) => {
          const isAccessible = canJumpToStep(s.num);
          const isActive = step === s.num;
          return (
            <div 
              key={s.num} 
              onClick={() => handleStepClick(s.num)}
              className={`flex items-center gap-4 px-4 flex-1 justify-center last:flex-none transition-all duration-300 ${isAccessible ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed grayscale opacity-30'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                step >= s.num ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'
              } ${isActive ? 'ring-4 ring-indigo-100' : ''}`}>
                {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
              </div>
              <span className={`text-sm font-bold hidden lg:inline transition-colors duration-300 ${step >= s.num ? 'text-indigo-900' : 'text-slate-400'} ${isActive ? 'underline decoration-indigo-300 underline-offset-4' : ''}`}>
                {s.label}
              </span>
              {s.num < 6 && <div className="h-[1px] bg-slate-100 flex-1 mx-4 hidden lg:block" />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">{selectedDef ? t.template : t.title}</h2>
            <p className="text-slate-500 mt-2 font-medium">{t.subtitle}</p>
          </div>
          {!selectedDef ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {definitions.map((def) => {
                const defTemplates = templates.filter(tpl => tpl.definitionId === def.id);
                return (
                  <div
                    key={def.id}
                    className="flex flex-col h-full bg-white rounded-3xl border-2 border-slate-200 hover:border-indigo-300 transition-all shadow-sm overflow-hidden"
                  >
                    <button
                      onClick={() => { setSelectedDef(def); }}
                      className="p-6 text-left flex-1"
                    >
                      <div className="bg-indigo-50 p-3 rounded-xl shadow-sm border border-slate-100 self-start mb-4 inline-block">
                        <Database className="w-6 h-6 text-indigo-600" />
                      </div>
                      <h3 className="font-black text-slate-800 text-lg mb-2">{def.name}</h3>
                      <p className="text-slate-500 text-sm mb-6 line-clamp-3 font-medium">{def.description}</p>
                    </button>
                    
                    {defTemplates.length > 0 && (
                      <div className="bg-slate-50 px-6 py-4 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Bookmark className="w-3 h-3" />
                          {language === 'zh-CN' ? '保存的解析逻辑' : 'Saved Logics'}
                        </p>
                        <div className="flex flex-col gap-2">
                          {defTemplates.slice(0, 3).map(tpl => (
                            <button
                              key={tpl.id}
                              onClick={() => applyTemplate(tpl)}
                              className="w-full flex items-center justify-between text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                            >
                              <span className="text-xs font-bold text-slate-600 group-hover:text-indigo-700 truncate">{tpl.name}</span>
                              <ChevronRightIcon className="w-3 h-3 text-slate-300 group-hover:text-indigo-400" />
                            </button>
                          ))}
                          {defTemplates.length > 3 && (
                            <button 
                              onClick={() => setSelectedDef(def)}
                              className="text-[10px] font-black text-indigo-600 hover:underline text-center mt-1"
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
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="bg-indigo-50 p-4 rounded-2xl"><Database className="w-8 h-8 text-indigo-600" /></div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">{selectedDef.name}</h3>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">{selectedDef.fields.length} Fields Configured</p>
                  </div>
                </div>
                <button onClick={() => setSelectedDef(null)} className="p-3 text-slate-400 hover:text-slate-800 transition-colors"><X className="w-6 h-6" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <button onClick={() => setStep(2)} className="group bg-white p-10 rounded-[40px] border-2 border-dashed border-slate-200 hover:border-indigo-600 hover:bg-indigo-50/30 transition-all text-center space-y-4">
                  <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto group-hover:bg-indigo-600 transition-colors"><ArrowRight className="w-8 h-8 text-slate-400 group-hover:text-white" /></div>
                  <h4 className="text-xl font-black text-slate-800 tracking-tight">{t.startFresh}</h4>
                  <p className="text-slate-400 font-medium">{language === 'zh-CN' ? '从头开始配置新文件结构的解析逻辑。' : 'Configure parsing logic from scratch for new file structures.'}</p>
                </button>
                <div className="space-y-6">
                  <h4 className="text-lg font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Bookmark className="w-5 h-5 text-amber-500" />{t.useTemplate}</h4>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {relevantTemplates.map(tpl => (
                      <div key={tpl.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between group hover:border-indigo-600 transition-all">
                        <button onClick={() => applyTemplate(tpl)} className="flex-1 text-left">
                          <p className="font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{tpl.name}</p>
                          <p className="text-xs text-slate-400 font-bold mt-1">Updated {new Date(tpl.updatedAt).toLocaleDateString()} • {Object.keys(tpl.mapping).length} fields mapped</p>
                        </button>
                        <button onClick={() => onDeleteTemplate(tpl.id)} className="p-2 text-slate-200 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                    {relevantTemplates.length === 0 && <div className="text-center py-10 text-slate-400 italic">No saved templates for this module.</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10">
          <div className={`bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-12 text-center transition-all hover:border-indigo-300 relative group ${templateFile ? 'border-emerald-200 bg-emerald-50/10' : ''}`}>
            {!templateFile ? (
              <>
                <input type="file" onChange={handleTemplateFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept=".xlsx, .xls" />
                <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform"><Upload className="w-10 h-10 text-indigo-600" /></div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">{t.uploadTitle}</h3>
                <p className="text-slate-500 mt-2 font-medium">{t.uploadSubtitle}</p>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mb-6"><CheckCircle2 className="w-10 h-10 text-emerald-600" /></div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">{templateFile.name}</h3>
                <button onClick={() => { setTemplateFile(null); setRawPreview([]); }} className="mt-6 text-slate-400 hover:text-red-500 font-black text-xs uppercase tracking-widest flex items-center gap-2"><Trash2 className="w-4 h-4" /> Change Template</button>
              </div>
            )}
          </div>
          {templateFile && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-4 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8 h-fit sticky top-32">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><Settings2 className="w-6 h-6 text-indigo-600" />{t.configTitle}</h3>
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-slate-700">{t.targetSheet}</label>
                    <select value={selectedSheet} onChange={(e) => setSelectedSheet(e.target.value)} className="w-full px-5 py-4 border border-slate-200 rounded-2xl bg-white font-bold text-slate-700 shadow-sm outline-none">
                      {sheetMetadata.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-slate-700">{t.headerIndex}</label>
                    <input type="number" min="0" value={startRow} onChange={(e) => setStartRow(parseInt(e.target.value) || 0)} className="w-full px-5 py-4 border border-slate-200 rounded-2xl font-black text-center text-2xl shadow-sm text-indigo-600 outline-none" />
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <button onClick={() => setStep(3)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-[28px] font-black flex items-center justify-center gap-3 shadow-2xl transition-all">{t.continueMapping}<ArrowRight className="w-6 h-6" /></button>
                </div>
              </div>
              <div className="lg:col-span-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><Eye className="w-6 h-6 text-emerald-500" />{t.previewTitle}</h3>
                  <button onClick={() => setShowSkippedRows(!showSkippedRows)} className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all ${showSkippedRows ? 'bg-slate-800 text-white' : 'bg-white text-slate-500'}`}>
                    {showSkippedRows ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {language === 'zh-CN' ? (showSkippedRows ? '显示顶部' : '隐藏顶部') : (showSkippedRows ? 'Show Header' : 'Hide Header')}
                  </button>
                </div>
                <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-auto custom-scrollbar max-h-[600px]">
                  {rawPreview.length > 0 ? (
                    <table className="w-full text-left text-[11px] border-separate border-spacing-0">
                      <thead className="bg-slate-50 sticky top-0 z-20">
                        <tr>
                          <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100 w-16 text-center">Row</th>
                          {(rawPreview[startRow] || []).map((_, i) => <th key={i} className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100 whitespace-nowrap">Col {String.fromCharCode(65 + i)}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium transition-all">
                        {rawPreview.map((row, rIdx) => {
                          const isHeader = rIdx === startRow;
                          if (rIdx < startRow && !showSkippedRows) return null;
                          return (
                            <tr key={rIdx} className={`transition-all ${isHeader ? 'bg-indigo-50/50' : rIdx < startRow ? 'opacity-40' : 'hover:bg-slate-50'}`}>
                              <td className={`px-4 py-3 text-center border-r border-slate-100 font-black ${isHeader ? 'text-indigo-600' : 'text-slate-400'}`}>{rIdx}</td>
                              {row.map((cell: any, cIdx: number) => <td key={cIdx} className={`px-6 py-3 whitespace-nowrap truncate max-w-[200px] ${isHeader ? 'font-black text-indigo-900 bg-indigo-50/30' : 'text-slate-600'}`}>{cell}</td>)}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-20 text-center text-slate-400 font-bold">{t.noDataPreview}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10">
          <div className="flex items-center justify-between mb-4">
            <div><h2 className="text-3xl font-black text-slate-800 tracking-tight">{language === 'zh-CN' ? '字段映射架构' : t.mappingTitle}</h2><p className="text-slate-500 font-medium">{t.mappingSubtitle}</p></div>
            <button onClick={autoMap} disabled={isProcessing || availableHeaders.length === 0} className="bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 px-8 py-3.5 rounded-2xl font-black flex items-center gap-3 transition-all shadow-sm">{isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}{t.autoMap}</button>
          </div>
          <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead><tr className="bg-slate-50 border-b border-slate-100"><th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Target Field</th><th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Source Template Column</th><th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Constraint</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {selectedDef?.fields.map((field) => (
                  <tr key={field.id} className="hover:bg-indigo-50/20 transition-colors">
                    <td className="px-10 py-8"><div className="flex items-center gap-4"><div className="bg-white border border-slate-100 p-2.5 rounded-xl shadow-sm"><Database className="w-5 h-5 text-indigo-500" /></div><div><p className="font-bold text-slate-800">{field.name}</p><p className="text-[10px] text-slate-400 font-black mt-1 uppercase tracking-widest">{field.type}</p></div></div></td>
                    <td className="px-10 py-8"><select value={mapping[field.id] || ''} onChange={(e) => setMapping(prev => ({ ...prev, [field.id]: e.target.value }))} className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl bg-white shadow-sm outline-none font-bold text-slate-700">{<option value="">{t.unmapped}</option>}{availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}</select></td>
                    <td className="px-10 py-8 text-center">{field.required ? <span className="inline-flex px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-700 shadow-sm">Strict</span> : <span className="inline-flex px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">Optional</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center pt-8"><button onClick={() => setStep(2)} className="text-slate-400 hover:text-slate-800 font-black px-6 py-3 transition-colors uppercase tracking-widest text-sm flex items-center gap-2">&larr; Back</button><button onClick={() => setStep(4)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-[28px] font-black flex items-center gap-4 shadow-2xl transition-all">{t.uploadSources}<ArrowRight className="w-6 h-6" /></button></div>
        </div>
      )}

      {step === 4 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10">
          <div className="text-center mb-8"><h2 className="text-3xl font-black text-slate-800 tracking-tight">{t.batchTitle}</h2><p className="text-slate-500 mt-2 font-medium">{t.batchSubtitle}</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-16 text-center transition-all hover:border-indigo-300 relative min-h-[400px] flex flex-col items-center justify-center">
                <input type="file" multiple onChange={handleBatchFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept=".xlsx, .xls" />
                <div className="bg-indigo-50 w-24 h-24 rounded-full flex items-center justify-center mb-8"><Files className="w-12 h-12 text-indigo-600" /></div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">{t.batchUpload}</h3>
              </div>
              {batchFiles.length > 0 && (
                <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Files className="w-4 h-4 text-indigo-500" />{t.validationTitle}</h3>
                    <div className="flex gap-4">
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">{validCount} {t.validFiles}</span>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${invalidCount > 0 ? 'text-red-600 bg-red-50 border-red-100' : 'text-slate-400 bg-white border-slate-100'}`}>{invalidCount} {t.invalidFiles}</span>
                    </div>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto custom-scrollbar divide-y divide-slate-50">
                    {/* Summary for Valid Files */}
                    {validCount > 0 && (
                      <div className="p-6 flex items-start justify-between bg-emerald-50/30 group transition-colors hover:bg-emerald-50/50">
                        <div className="flex items-start gap-6">
                          <div className="p-3 rounded-2xl bg-emerald-50">
                            <Check className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-black text-slate-800">{t.validationSuccess}</p>
                            <p className="text-[11px] font-bold text-emerald-600 mt-1 max-w-full">
                              {getValidFilesString()}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={removeAllValid}
                          className="p-3 text-slate-200 hover:text-red-500 transition-colors"
                          title={language === 'zh-CN' ? '移除所有有效文件' : 'Remove all valid files'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    
                    {/* Detailed List for Invalid Files */}
                    {invalidBatchFiles.map((res, i) => (
                      <div key={res.fileName + i} className="p-6 flex items-center justify-between hover:bg-slate-50/30 transition-colors">
                        <div className="flex items-center gap-6 overflow-hidden">
                          <div className="p-3 rounded-2xl bg-red-50">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-black truncate text-red-900">{res.fileName}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest mt-1 text-red-400">{res.error}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            // Find actual index in batchFiles
                            const actualIdx = batchFiles.findIndex(f => f.fileName === res.fileName && f.file === res.file);
                            if (actualIdx > -1) removeBatchFile(actualIdx);
                          }} 
                          className="p-3 text-slate-200 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="lg:col-span-4 space-y-8">
              <div className={`bg-white p-10 rounded-[40px] border shadow-2xl transition-all ${batchFiles.length === 0 ? 'opacity-60' : allBatchFilesValid ? 'border-emerald-200 bg-emerald-50/20' : 'border-amber-100 bg-amber-50/20'}`}>
                {batchFiles.length === 0 ? <div className="text-center py-10"><Info className="w-12 h-12 text-slate-200 mx-auto mb-4" /><p className="text-slate-400 font-bold text-sm">{t.noFiles}</p></div> : 
                  <div className="space-y-8">
                    <div className="flex items-center gap-4"><div className={`p-4 rounded-3xl ${allBatchFilesValid ? 'bg-emerald-500' : 'bg-amber-500'} text-white`}>{allBatchFilesValid ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}</div><div><h4 className="text-xl font-black text-slate-800 tracking-tight">{allBatchFilesValid ? 'Ready' : 'Issues Detected'}</h4><p className="text-xs text-slate-500 font-medium mt-1">{allBatchFilesValid ? t.allValid : t.someInvalid}</p></div></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/50 rounded-2xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.validFiles}</p><p className="text-xl font-black text-emerald-600">{validCount}</p></div>
                      <div className="p-4 bg-white/50 rounded-2xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.invalidFiles}</p><p className={`text-xl font-black ${invalidCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>{invalidCount}</p></div>
                    </div>
                    <button onClick={runTransformation} disabled={isProcessing || batchFiles.length === 0 || !batchFiles.some(f => f.isValid)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-6 rounded-[32px] font-black flex items-center justify-center gap-4 shadow-2xl transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:transform-none">{isProcessing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}{t.execute}</button>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 5 && results && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-12 h-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm"><p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">{t.rowsProcessed}</p><h3 className="text-4xl font-black text-slate-800 tracking-tight">{results.rows.length.toLocaleString()} <span className="text-xl font-bold text-slate-400">{language === 'zh-CN' ? '行' : 'Rows'}</span></h3></div>
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm"><p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">{t.qualityIssues}</p><h3 className={`text-4xl font-black ${results.errors.length > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{results.errors.length.toLocaleString()}</h3></div>
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm"><p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">{t.healthScore}</p><h3 className="text-4xl font-black text-indigo-600 tracking-tight">{Math.max(0, 100 - (results.errors.length / (results.rows.length * (selectedDef?.fields.length || 1)) * 100)).toFixed(1)}%</h3></div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            <div className="xl:col-span-12 space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight"><CheckCircle2 className="w-6 h-6 text-emerald-500" />{t.previewTitle}</h3>
              <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[500px]">
                <div className="flex-1 overflow-auto custom-scrollbar">
                  {results.rows.length > 0 ? (
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest bg-slate-50">#</th>
                          {selectedDef?.fields.map(f => <th key={f.id} className="px-6 py-4 font-black text-slate-800 uppercase tracking-widest whitespace-nowrap bg-slate-50">{f.name}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold">
                        {results.rows.slice(0, 100).map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-3 text-slate-400 bg-slate-50/50">{i + 1}</td>
                            {selectedDef?.fields.map(f => <td key={f.id} className="px-6 py-3 text-slate-600 whitespace-nowrap">{row[f.name] !== null && row[f.name] !== undefined ? String(row[f.name]) : <span className="text-slate-300 italic">null</span>}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-40 text-center text-slate-300 font-bold italic">{t.noDataPreview}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-between pt-8"><button onClick={() => { setStep(1); resetState(); }} className="px-10 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-[28px] font-black hover:border-indigo-300 transition-all">{t.initNew}</button><button onClick={() => setStep(6)} className="px-10 py-4 bg-indigo-600 text-white rounded-[28px] font-black hover:bg-indigo-700 transition-all shadow-xl flex items-center gap-3">{t.gotoSave}<ArrowRight className="w-5 h-5" /></button></div>
        </div>
      )}

      {step === 6 && selectedDef && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-12 max-w-[1400px] mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-black text-slate-800 tracking-tight">{t.reviewTitle}</h2>
            <p className="text-slate-500 mt-2 font-black text-lg">{t.reviewSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6 flex flex-col">
              <div className="flex items-center gap-3 text-indigo-600 font-black uppercase tracking-widest text-[10px]">
                <Database className="w-4 h-4" />
                {t.summaryTarget}
              </div>
              <div className="flex-1">
                <h4 className="text-2xl font-black text-slate-800 leading-tight">{selectedDef.name}</h4>
                <p className="text-sm text-slate-500 mt-2 font-medium line-clamp-3">{selectedDef.description}</p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6 flex flex-col">
              <div className="flex items-center gap-3 text-emerald-600 font-black uppercase tracking-widest text-[10px]">
                <Settings2 className="w-4 h-4" />
                {t.summarySource}
              </div>
              <div className="space-y-4 flex-1">
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-slate-400 font-bold text-xs">Sheet</span>
                  <span className="font-black text-slate-700">{selectedSheet}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-slate-400 font-bold text-xs">Header Row</span>
                  <span className="font-black text-slate-700">{startRow}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-slate-400 font-bold text-xs">Batch Files</span>
                  <span className="font-black text-slate-700">{batchFiles.filter(f => f.isValid).length} Valid</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6 flex flex-col h-full">
              <div className="flex items-center gap-3 text-amber-500 font-black uppercase tracking-widest text-[10px]">
                <Map className="w-4 h-4" />
                {t.summaryMapping}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {selectedDef.fields.map(f => (
                  <div key={f.id} className="flex items-center justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
                    <span className="text-xs font-bold text-slate-600 truncate flex-shrink-0">{f.name}</span>
                    <ArrowRight className="w-3 h-3 text-slate-300" />
                    <span className="text-xs font-black text-indigo-600 truncate text-right">
                      {mapping[f.id] || (language === 'zh-CN' ? '未映射' : 'Not Mapped')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6 flex flex-col">
              <div className="flex items-center gap-3 text-pink-500 font-black uppercase tracking-widest text-[10px]">
                <FileOutput className="w-4 h-4" />
                {language === 'zh-CN' ? '输出配置' : 'Output Config'}
              </div>
              <div className="space-y-4 flex-1">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{language === 'zh-CN' ? '文件名 (.xlsx)' : 'File Name (.xlsx)'}</label>
                  <input 
                    type="text" 
                    value={exportFileName} 
                    onChange={(e) => setExportFileName(e.target.value)} 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{language === 'zh-CN' ? '工作表名称' : 'Sheet Name'}</label>
                  <input 
                    type="text" 
                    value={exportSheetName} 
                    onChange={(e) => setExportSheetName(e.target.value)} 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Template Save Section */}
            <div className="bg-indigo-900 p-10 rounded-[48px] shadow-2xl space-y-8 text-white flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 p-4 rounded-3xl">
                    <Bookmark className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2">
                      {t.templateName}
                    </label>
                    <input 
                      type="text" 
                      value={newTemplateName} 
                      onChange={(e) => setNewTemplateName(e.target.value)} 
                      placeholder="e.g. EMEA Monthly VAT Pipeline" 
                      className="w-full bg-indigo-950/50 border border-white/10 px-8 py-5 rounded-[28px] text-xl font-black focus:ring-8 focus:ring-indigo-500/30 outline-none transition-all" 
                    />
                  </div>
                </div>
                <p className="text-indigo-300 font-bold text-sm leading-relaxed px-2">
                  {language === 'zh-CN' ? '将当前的解析逻辑保存为模板，以便将来在控制台中一键应用。' : 'Save the current parsing logic as a template to apply it with one click from the dashboard in the future.'}
                </p>
              </div>
              <div className="pt-4">
                <button 
                  onClick={handleSaveTemplate} 
                  disabled={!newTemplateName} 
                  className="w-full bg-indigo-600 border-2 border-white/20 text-white px-10 py-6 rounded-[32px] font-black shadow-2xl hover:bg-indigo-500 transition-all transform hover:-translate-y-2 disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-3 uppercase tracking-widest"
                >
                  <Save className="w-6 h-6" />
                  {t.saveFinish}
                </button>
              </div>
            </div>

            {/* Export Section */}
            <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-xl space-y-8 flex flex-col justify-between">
              <div className="space-y-6">
                 <div className="flex items-center gap-4">
                  <div className="bg-indigo-50 p-4 rounded-3xl">
                    <Download className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      {language === 'zh-CN' ? '立即导出' : 'Export results now'}
                    </label>
                    <p className="text-slate-800 text-2xl font-black tracking-tight leading-tight">
                      {language === 'zh-CN' ? '标准化结果已就绪' : 'Standardized results ready'}
                    </p>
                  </div>
                </div>
                <p className="text-slate-500 font-bold text-sm leading-relaxed px-2">
                  {language === 'zh-CN' ? '将标准化后的数据保存为 Excel 文件，符合 ERP 导入格式要求。' : 'Save the standardized data as an Excel file, compliant with ERP import format requirements.'}
                </p>
              </div>
              <div className="pt-4">
                <button 
                  onClick={handleExport}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-6 rounded-[32px] font-black shadow-2xl transition-all transform hover:-translate-y-1 flex items-center justify-center gap-4 uppercase tracking-widest"
                >
                  <Download className="w-6 h-6" />
                  {t.export}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-start pt-4">
            <button 
              onClick={() => setStep(5)} 
              className="px-10 py-4 border-2 border-slate-200 text-slate-500 font-black rounded-[28px] hover:bg-slate-50 hover:text-slate-800 transition-all uppercase tracking-widest text-xs flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransformWizard;
