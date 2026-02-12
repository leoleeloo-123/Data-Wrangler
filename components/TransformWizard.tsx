
import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  ArrowRight, 
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
  FileText
} from 'lucide-react';
import { DataDefinition, Mapping, ValidationError, ProcessedData, FieldType, TransformationTemplate } from '../types';
import { parseExcelMetadata, extractSheetData, ExcelSheetInfo } from '../services/excelService';
import { suggestMappings } from '../services/geminiService';
import { translations } from '../translations';

// Excel utility provided globally in index.html
declare const XLSX: any;

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
  const [files, setFiles] = useState<File[]>([]);
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

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState('Standardized_Tax_Data');
  const [exportSheetName, setExportSheetName] = useState('StandardizedData');

  // Template State
  const [newTemplateName, setNewTemplateName] = useState('');

  // Sync state between steps
  useEffect(() => {
    if (files.length > 0 && selectedSheet) {
      loadDataAndHeaders();
    }
  }, [files, selectedSheet, startRow]);

  const loadDataAndHeaders = async () => {
    const file = files[0];
    if (!file) return;

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
            range: Number(startRow), 
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
        console.error("Data preview loading error", err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = e.target.files;
      const selectedFiles = Array.from(fileList);
      setFiles(selectedFiles);
      
      const firstFile = fileList[0];
      try {
        if (firstFile) {
          const metadata = await parseExcelMetadata(firstFile);
          setSheetMetadata(metadata);
          if (metadata.length > 0 && !selectedSheet) {
            setSelectedSheet(metadata[0].name);
            setExportSheetName(metadata[0].name + '_Standardized');
          }
        }
      } catch (err) {
        console.error("Error parsing file metadata", err);
      }
    }
  };

  const applyTemplate = (tpl: TransformationTemplate) => {
    setSelectedSheet(tpl.sheetName);
    setStartRow(tpl.startRow);
    setMapping(tpl.mapping);
    setExportFileName(tpl.exportFileName);
    setExportSheetName(tpl.exportSheetName);
    setStep(2); // Jump to upload with loaded settings
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
      exportFileName,
      exportSheetName,
      updatedAt: new Date().toISOString()
    };
    onSaveTemplate(template);
    setNewTemplateName('');
    setStep(1);
    setResults(null);
    setSelectedDef(null);
    alert(t.templateSaved);
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
    if (!selectedDef || !selectedSheet) return;
    setIsProcessing(true);
    setResults(null);
    
    try {
      const allRows: any[] = [];
      const allErrors: ValidationError[] = [];

      for (let i = 0; i < files.length; i++) {
        const data = await extractSheetData(files[i], selectedSheet, Number(startRow));
        
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
                message: `Required field missing in file ${files[i].name}`,
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
                  message: `Non-numeric value in numeric field in file ${files[i].name}`,
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
      setStep(4);
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
      setIsExportModalOpen(false);
    } catch (err) {
      console.error("Export failed", err);
      alert(language === 'zh-CN' ? '导出失败，请检查设置' : 'Export failed, check settings');
    }
  };

  const relevantTemplates = selectedDef ? templates.filter(t => t.definitionId === selectedDef.id) : [];

  const steps = [
    { num: 1, label: language === 'zh-CN' ? '选择定义' : 'Choose Definition' },
    { num: 2, label: language === 'zh-CN' ? '上传配置' : 'Upload & Config' },
    { num: 3, label: language === 'zh-CN' ? '映射列名' : 'Map Columns' },
    { num: 4, label: language === 'zh-CN' ? '转换结果' : 'Results' },
    { num: 5, label: language === 'zh-CN' ? '保存逻辑' : 'Save Logic' }
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto pb-24 h-full relative">
      {/* Stepper Header */}
      <div className="flex items-center justify-between mb-12 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm sticky top-4 z-40">
        {steps.map((s) => (
          <div key={s.num} className="flex items-center gap-4 px-4 flex-1 justify-center last:flex-none">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
              step >= s.num ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'
            }`}>
              {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
            </div>
            <span className={`text-sm font-bold hidden lg:inline ${step >= s.num ? 'text-indigo-900' : 'text-slate-400'}`}>
              {s.label}
            </span>
            {s.num < 5 && <div className="h-[1px] bg-slate-100 flex-1 mx-4 hidden lg:block" />}
          </div>
        ))}
      </div>

      {/* Step 1: Definition Selection & Template Pick */}
      {step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">{selectedDef ? t.template : t.title}</h2>
            <p className="text-slate-500 mt-2 font-medium">{t.subtitle}</p>
          </div>

          {!selectedDef ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {definitions.map((def) => (
                <button
                  key={def.id}
                  onClick={() => { setSelectedDef(def); }}
                  className="p-6 rounded-3xl border-2 border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all text-left flex flex-col h-full"
                >
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 self-start mb-4">
                    <Database className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg mb-2">{def.name}</h3>
                  <p className="text-slate-500 text-sm mb-6 line-clamp-3 flex-1">{def.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-auto">
                    {def.fields.slice(0, 3).map(f => (
                      <span key={f.id} className="text-[9px] font-black uppercase tracking-widest bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                        {f.name}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="bg-indigo-50 p-4 rounded-2xl">
                    <Database className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">{selectedDef.name}</h3>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">{selectedDef.fields.length} Fields Configured</p>
                  </div>
                </div>
                <button onClick={() => setSelectedDef(null)} className="p-3 text-slate-400 hover:text-slate-800 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Start Fresh Option */}
                <button 
                  onClick={() => setStep(2)}
                  className="group bg-white p-10 rounded-[40px] border-2 border-dashed border-slate-200 hover:border-indigo-600 hover:bg-indigo-50/30 transition-all text-center space-y-4"
                >
                  <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto group-hover:bg-indigo-600 transition-colors">
                    <ArrowRight className="w-8 h-8 text-slate-400 group-hover:text-white transition-colors" />
                  </div>
                  <h4 className="text-xl font-black text-slate-800 tracking-tight">{t.startFresh}</h4>
                  <p className="text-slate-400 font-medium">Configure parsing logic from scratch for new file structures.</p>
                </button>

                {/* Templates Section */}
                <div className="space-y-6">
                  <h4 className="text-lg font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <Bookmark className="w-5 h-5 text-amber-500" />
                    {t.useTemplate}
                  </h4>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {relevantTemplates.map(tpl => (
                      <div key={tpl.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between group hover:border-indigo-600 transition-all">
                        <button 
                          onClick={() => applyTemplate(tpl)}
                          className="flex-1 text-left"
                        >
                          <p className="font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{tpl.name}</p>
                          <p className="text-xs text-slate-400 font-bold mt-1">
                            Updated {new Date(tpl.updatedAt).toLocaleDateString()} • {Object.keys(tpl.mapping).length} fields mapped
                          </p>
                        </button>
                        <button 
                          onClick={() => onDeleteTemplate(tpl.id)}
                          className="p-2 text-slate-200 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {relevantTemplates.length === 0 && (
                      <div className="text-center py-10 text-slate-400 italic">
                        No saved templates for this module.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Upload & Config */}
      {step === 2 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10">
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-12 text-center transition-all hover:border-indigo-300 relative group">
            <input 
              type="file" 
              multiple 
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
              <Upload className="w-10 h-10 text-indigo-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{t.uploadTitle}</h3>
            <p className="text-slate-500 mt-2 font-medium">{t.uploadSubtitle}</p>
            {files.length > 0 && (
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {files.map((f, i) => (
                  <span key={i} className="bg-indigo-50 text-indigo-700 text-xs px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-sm border border-indigo-100 animate-in fade-in zoom-in-95">
                    <FileSpreadsheet className="w-4 h-4" />
                    {f.name}
                    <X className="w-3 h-3 ml-1 cursor-pointer hover:text-red-500" onClick={(e) => {
                      e.stopPropagation();
                      setFiles(prev => prev.filter((_, idx) => idx !== i));
                    }} />
                  </span>
                ))}
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-4 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8 h-fit sticky top-32">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                    <Settings2 className="w-6 h-6 text-indigo-600" />
                    {t.configTitle}
                  </h3>
                </div>
                
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.targetSheet}</label>
                    <select 
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                      className="w-full px-5 py-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 bg-white outline-none transition-all font-bold text-slate-700 shadow-sm cursor-pointer"
                    >
                      {sheetMetadata.map(s => (
                        <option key={s.name} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.headerIndex}</label>
                    <div className="flex items-center gap-6">
                      <input 
                        type="number" 
                        min="0"
                        value={startRow}
                        onChange={(e) => setStartRow(parseInt(e.target.value) || 0)}
                        className="w-full px-5 py-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 bg-white outline-none transition-all font-black text-center text-2xl shadow-sm text-indigo-600"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => setStep(3)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-[28px] font-black flex items-center justify-center gap-3 shadow-2xl shadow-indigo-100 transition-all transform hover:-translate-y-1"
                  >
                    {language === 'zh-CN' ? '继续映射' : 'Proceed to Mapping'}
                    <ArrowRight className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                    <Eye className="w-6 h-6 text-emerald-500" />
                    {t.previewTitle}
                  </h3>
                  <button 
                    onClick={() => setShowSkippedRows(!showSkippedRows)}
                    disabled={startRow === 0}
                    className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all flex items-center gap-2 shadow-sm disabled:opacity-30 ${
                      showSkippedRows ? 'bg-slate-800 text-white' : 'bg-white text-slate-500'
                    }`}
                  >
                    {showSkippedRows ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {language === 'zh-CN' ? (showSkippedRows ? '显示顶部行' : '隐藏顶部行') : (showSkippedRows ? 'Show Skipped' : 'Hide Skipped')}
                  </button>
                </div>
                
                <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-500 relative">
                  <div className="overflow-auto custom-scrollbar max-h-[600px]">
                    <table className="w-full text-left text-[11px] border-separate border-spacing-0">
                      <thead className="bg-slate-50 sticky top-0 z-20">
                        <tr>
                          <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100 w-16 text-center">Row</th>
                          {rawPreview[startRow]?.map((_, i) => (
                            <th key={i} className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100 whitespace-nowrap">
                              Col {String.fromCharCode(65 + i)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium transition-all">
                        {!showSkippedRows && startRow > 0 && (
                          <tr className="bg-slate-50/30 group">
                            <td 
                              colSpan={(rawPreview[0]?.length || 0) + 1} 
                              className="px-6 py-8 text-center text-slate-400 italic cursor-pointer hover:bg-slate-100 transition-colors"
                              onClick={() => setShowSkippedRows(true)}
                            >
                              <ChevronDown className="w-5 h-5 animate-bounce text-indigo-400 mx-auto" />
                              <span className="font-black uppercase tracking-widest text-[10px] mt-2 block">
                                {language === 'zh-CN' ? `已收起上方 ${startRow} 行冗余数据` : `${startRow} leading rows compressed`}
                              </span>
                            </td>
                          </tr>
                        )}
                        {rawPreview.map((row, rIdx) => {
                          const isHeader = rIdx === startRow;
                          if (rIdx < startRow && !showSkippedRows) return null;
                          return (
                            <tr key={rIdx} className={`transition-all duration-300 ${isHeader ? 'bg-indigo-50/50' : rIdx < startRow ? 'opacity-40 grayscale' : 'hover:bg-slate-50'}`}>
                              <td className={`px-4 py-3 text-center border-r border-slate-100 font-black ${isHeader ? 'text-indigo-600' : 'text-slate-400'}`}>{rIdx}</td>
                              {row.map((cell: any, cIdx: number) => (
                                <td key={cIdx} className={`px-6 py-3 whitespace-nowrap truncate max-w-[200px] ${isHeader ? 'font-black text-indigo-900 bg-indigo-50/30' : 'text-slate-600'}`}>{cell}</td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Visual Mapping */}
      {step === 3 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">{language === 'zh-CN' ? '字段映射架构' : t.mappingTitle}</h2>
              <p className="text-slate-500 font-medium">{t.mappingSubtitle}</p>
            </div>
            <button 
              onClick={autoMap}
              disabled={isProcessing || availableHeaders.length === 0}
              className="bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 px-8 py-3.5 rounded-2xl font-black flex items-center gap-3 transition-all disabled:opacity-50 shadow-sm"
            >
              {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {t.autoMap}
            </button>
          </div>

          <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">{language === 'zh-CN' ? '目标标准化字段' : 'Target Standard Field'}</th>
                  <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">{language === 'zh-CN' ? '源文件对应列' : 'Source Column Reference'}</th>
                  <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">{language === 'zh-CN' ? '约束' : 'Constraint'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {selectedDef?.fields.map((field) => (
                  <tr key={field.id} className="hover:bg-indigo-50/20 transition-colors group">
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-4">
                        <div className="bg-white border border-slate-100 p-2.5 rounded-xl shadow-sm group-hover:border-indigo-200 transition-all">
                          <Database className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-base">{field.name}</p>
                          <p className="text-[10px] text-slate-400 font-black mt-1 uppercase tracking-widest">{field.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <select 
                        value={mapping[field.id] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 bg-white shadow-sm appearance-none outline-none font-bold text-slate-700 transition-all cursor-pointer"
                      >
                        <option value="">{t.unmapped}</option>
                        {availableHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-10 py-8 text-center">
                      {field.required ? (
                        <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-700 shadow-sm">{language === 'zh-CN' ? '严格' : 'Strict'}</span>
                      ) : (
                        <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">{language === 'zh-CN' ? '可选' : 'Optional'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-8">
            <button 
              onClick={() => setStep(2)}
              className="text-slate-400 hover:text-slate-800 font-black px-6 py-3 transition-colors uppercase tracking-widest text-sm flex items-center gap-2"
            >
              &larr; {language === 'zh-CN' ? '返回配置' : 'Back to Config'}
            </button>
            <button 
              onClick={runTransformation}
              disabled={isProcessing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-[28px] font-black flex items-center gap-4 shadow-2xl shadow-indigo-100 transition-all transform hover:-translate-y-2 active:translate-y-0"
            >
              {isProcessing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
              {language === 'zh-CN' ? '执行标准清洗' : t.execute}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Results */}
      {step === 4 && results && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-12 h-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">{t.rowsProcessed}</p>
              <h3 className="text-4xl font-black text-slate-800 tracking-tight">{results.rows.length.toLocaleString()} <span className="text-xl font-bold text-slate-400">{language === 'zh-CN' ? '行' : 'Rows'}</span></h3>
            </div>
            <div className={`bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm transition-all ${results.errors.length > 0 ? 'border-red-200 bg-red-50/20' : ''}`}>
              <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">{t.qualityIssues}</p>
              <h3 className={`text-4xl font-black tracking-tight ${results.errors.length > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {results.errors.length.toLocaleString()} <span className="text-xl font-bold opacity-50">{language === 'zh-CN' ? '标志' : 'Flags'}</span>
              </h3>
            </div>
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">{t.healthScore}</p>
              <h3 className="text-4xl font-black text-indigo-600 tracking-tight">
                {Math.max(0, 100 - (results.errors.length / (results.rows.length * (selectedDef?.fields.length || 1)) * 100)).toFixed(1)}%
              </h3>
            </div>
            <button 
              onClick={() => setIsExportModalOpen(true)}
              className="bg-indigo-600 p-8 rounded-[40px] shadow-2xl shadow-indigo-100 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-indigo-700 transition-all transform hover:-translate-y-1 group active:scale-95"
            >
              <Download className="w-10 h-10 text-white/90 mb-3 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-black text-white uppercase tracking-widest mb-1">{language === 'zh-CN' ? '导出清洗后的数据' : t.export}</p>
              <p className="text-xs text-white/60 font-medium">{t.readyERP}</p>
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            <div className="xl:col-span-4 space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                <AlertCircle className="w-6 h-6 text-red-500" />
                {t.exceptionsTitle}
              </h3>
              <div className="bg-white rounded-[40px] border border-red-100 overflow-hidden shadow-sm flex flex-col h-[500px]">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-red-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4 font-black text-red-800 uppercase tracking-widest">{language === 'zh-CN' ? '参考' : 'Ref'}</th>
                        <th className="px-6 py-4 font-black text-red-800 uppercase tracking-widest">{language === 'zh-CN' ? '字段' : 'Field'}</th>
                        <th className="px-6 py-4 font-black text-red-800 uppercase tracking-widest">{language === 'zh-CN' ? '问题' : 'Issue'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50 font-medium">
                      {results.errors.map((err, i) => (
                        <tr key={i} className="hover:bg-red-50/30 transition-colors">
                          <td className="px-6 py-4 text-slate-500">Row {err.row}</td>
                          <td className="px-6 py-4 font-bold text-slate-800">{err.field}</td>
                          <td className="px-6 py-4 text-red-600 italic">{err.message}</td>
                        </tr>
                      ))}
                      {results.errors.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-16 text-center text-emerald-500 font-bold">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-3" />
                            Zero discrepancies detected.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="xl:col-span-8 space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                {t.previewTitle}
              </h3>
              <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[500px]">
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest bg-slate-50">{language === 'zh-CN' ? '行' : 'Row'}</th>
                        {selectedDef?.fields.map(f => (
                          <th key={f.id} className="px-6 py-4 font-black text-slate-800 uppercase tracking-widest whitespace-nowrap bg-slate-50">{f.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold">
                      {results.rows.slice(0, 100).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3 text-slate-400 bg-slate-50/50">{i + 1}</td>
                          {selectedDef?.fields.map(f => (
                            <td key={f.id} className="px-6 py-3 text-slate-600 whitespace-nowrap">
                              {row[f.name] !== null && row[f.name] !== undefined ? String(row[f.name]) : <span className="text-slate-300 italic">null</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-8">
            <button 
              onClick={() => { setStep(1); setResults(null); setSelectedDef(null); }}
              className="px-10 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-[28px] font-black hover:border-indigo-300 hover:text-indigo-600 transition-all transform hover:-translate-y-1"
            >
              {t.initNew}
            </button>
            <button 
              onClick={() => setStep(5)}
              className="px-10 py-4 bg-indigo-600 text-white rounded-[28px] font-black hover:bg-indigo-700 transition-all transform hover:-translate-y-1 flex items-center gap-3 shadow-xl"
            >
              {t.gotoSave}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Review & Save Template */}
      {step === 5 && selectedDef && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10 max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-black text-slate-800 tracking-tight">{t.reviewTitle}</h2>
            <p className="text-slate-500 mt-2 font-bold text-lg">{t.reviewSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Target Module Summary */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-500" />
                {t.summaryTarget}
              </h3>
              <div>
                <p className="text-2xl font-black text-slate-800">{selectedDef.name}</p>
                <p className="text-sm text-slate-500 font-medium mt-1">{selectedDef.description}</p>
              </div>
            </div>

            {/* Source Configuration Summary */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                {t.summarySource}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sheet Name</p>
                  <p className="font-bold text-slate-800">{selectedSheet}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Header Row Index</p>
                  <p className="font-bold text-slate-800">{startRow}</p>
                </div>
              </div>
            </div>

            {/* Field Mapping Summary */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-4 lg:col-span-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Map className="w-4 h-4 text-amber-500" />
                {t.summaryMapping}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {selectedDef.fields.map(f => {
                  const source = mapping[f.id];
                  return (
                    <div key={f.id} className={`p-4 rounded-2xl border transition-all ${source ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-100 grayscale opacity-60'}`}>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{f.name}</p>
                      <p className={`font-black mt-1 truncate ${source ? 'text-indigo-900' : 'text-slate-400 italic text-xs'}`}>
                        {source || 'Not Mapped'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Export Defaults Summary */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-4 lg:col-span-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-indigo-500" />
                {t.summaryExport}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Default File Name</label>
                  <input 
                    type="text" 
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    className="w-full px-5 py-3 border border-slate-100 rounded-2xl bg-slate-50 focus:ring-4 focus:ring-indigo-100 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Default Sheet Name</label>
                  <input 
                    type="text" 
                    value={exportSheetName}
                    onChange={(e) => setExportSheetName(e.target.value)}
                    className="w-full px-5 py-3 border border-slate-100 rounded-2xl bg-slate-50 focus:ring-4 focus:ring-indigo-100 outline-none font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-900 p-10 rounded-[48px] shadow-2xl space-y-6 text-white">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 p-4 rounded-3xl">
                <Bookmark className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-2">{t.templateName}</label>
                <input 
                  type="text" 
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g. EMEA Monthly VAT Pipeline"
                  className="w-full bg-indigo-950/50 border border-white/10 px-8 py-5 rounded-[28px] text-xl font-black focus:ring-8 focus:ring-indigo-500/30 outline-none transition-all placeholder:text-indigo-800"
                />
              </div>
            </div>
            
            <div className="flex gap-4 pt-4">
               <button 
                onClick={() => setStep(4)}
                className="flex-1 px-10 py-5 border-2 border-white/10 text-white font-black rounded-[32px] hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
              >
                &larr; Back to Results
              </button>
              <button 
                onClick={handleSaveTemplate}
                disabled={!newTemplateName}
                className="flex-[2] bg-white text-indigo-900 px-10 py-5 rounded-[32px] font-black shadow-2xl hover:bg-indigo-50 transition-all transform hover:-translate-y-2 disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-3 uppercase tracking-widest"
              >
                <Save className="w-6 h-6" />
                {t.saveFinish}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Settings Modal - Only triggered from Results step */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300 backdrop-blur-md bg-slate-900/60">
          <div className="bg-white w-full max-w-lg rounded-[48px] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-3 rounded-2xl">
                  <Save className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{language === 'zh-CN' ? '导出配置' : 'Export Configuration'}</h2>
              </div>
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="p-3 text-slate-400 hover:text-slate-800 bg-white border border-slate-100 rounded-2xl transition-all shadow-sm"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-10 space-y-10">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{language === 'zh-CN' ? '文件名 (.xlsx)' : 'File Name (.xlsx)'}</label>
                <div className="relative group">
                  <FileJson className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input 
                    type="text" 
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    className="w-full pl-14 pr-6 py-5 border border-slate-200 rounded-3xl focus:ring-8 focus:ring-indigo-100 outline-none transition-all font-black text-lg text-slate-700 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{language === 'zh-CN' ? '工作表名称' : 'Sheet Name'}</label>
                <div className="relative group">
                  <LayoutIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input 
                    type="text" 
                    value={exportSheetName}
                    onChange={(e) => setExportSheetName(e.target.value)}
                    className="w-full pl-14 pr-6 py-5 border border-slate-200 rounded-3xl focus:ring-8 focus:ring-indigo-100 outline-none transition-all font-black text-lg text-slate-700 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-5">
                <button onClick={() => setIsExportModalOpen(false)} className="flex-1 px-8 py-5 border-2 border-slate-100 text-slate-400 rounded-[32px] font-black hover:bg-slate-50 uppercase tracking-widest text-xs">
                  {language === 'zh-CN' ? '取消' : 'Cancel'}
                </button>
                <button onClick={handleExport} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-[32px] shadow-2xl transition-all flex items-center justify-center gap-4 transform hover:-translate-y-1 uppercase tracking-widest text-xs">
                  <Download className="w-5 h-5" />
                  {language === 'zh-CN' ? '立即导出' : 'Download Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransformWizard;
