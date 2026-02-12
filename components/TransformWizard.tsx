
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
  ChevronUp
} from 'lucide-react';
import { DataDefinition, Mapping, ValidationError, ProcessedData, FieldType } from '../types';
import { parseExcelMetadata, extractSheetData, ExcelSheetInfo } from '../services/excelService';
import { suggestMappings } from '../services/geminiService';
import { translations } from '../translations';

// Excel utility usually provided globally in index.html
declare const XLSX: any;

interface TransformWizardProps {
  definitions: DataDefinition[];
  language: 'en-US' | 'zh-CN';
}

const TransformWizard: React.FC<TransformWizardProps> = ({ definitions, language }) => {
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
  
  // Real-time raw preview data
  const [rawPreview, setRawPreview] = useState<any[][]>([]);
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  const [showSkippedRows, setShowSkippedRows] = useState(false);

  // Load raw preview and headers whenever files, sheet, or startRow changes
  useEffect(() => {
    if (files.length > 0 && selectedSheet) {
      loadDataAndHeaders();
    }
  }, [files, selectedSheet, startRow]);

  const loadDataAndHeaders = async () => {
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[selectedSheet];
        if (worksheet) {
          // Get raw rows for preview (starting from 0 to show context)
          const raw = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            range: 0, 
            defval: "" 
          }) as any[][];
          setRawPreview(raw.slice(0, 30));

          // Extract headers specifically from the selected startRow
          const headerJson = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            range: startRow, 
            defval: "" 
          }) as any[][];
          
          if (headerJson.length > 0) {
            const extractedHeaders = (headerJson[0] || [])
              .map(h => String(h).trim())
              .filter(h => h !== "");
            setAvailableHeaders(extractedHeaders);
          } else {
            setAvailableHeaders([]);
          }
        }
      } catch (err) {
        console.error("Data loading error", err);
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
          if (metadata.length > 0) {
            setSelectedSheet(metadata[0].name);
          }
        }
      } catch (err) {
        console.error("Error parsing file metadata", err);
      }
    }
  };

  const autoMap = async () => {
    if (!selectedDef || availableHeaders.length === 0) return;
    
    setIsProcessing(true);
    const suggestions = await suggestMappings(selectedDef.fields, availableHeaders);
    setMapping(suggestions);
    setIsProcessing(false);
  };

  const runTransformation = async () => {
    if (!selectedDef || !selectedSheet) return;
    setIsProcessing(true);
    setResults(null);
    
    try {
      const allRows: any[] = [];
      const allErrors: ValidationError[] = [];

      for (let i = 0; i < files.length; i++) {
        const data = await extractSheetData(files[i], selectedSheet, startRow);
        
        data.forEach((rawRow, rowIdx) => {
          const processedRow: any = {};
          
          selectedDef.fields.forEach(field => {
            const sourceColName = mapping[field.id];
            const rawValue = sourceColName ? rawRow[sourceColName] : null;

            let transformedValue = rawValue;

            if (field.required && (rawValue === null || rawValue === undefined || rawValue === "")) {
              allErrors.push({
                row: rowIdx + (startRow + 1),
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
                  row: rowIdx + (startRow + 1),
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
    } finally {
      setIsProcessing(false);
    }
  };

  const steps = [
    { num: 1, label: language === 'zh-CN' ? '选择定义' : 'Choose Definition' },
    { num: 2, label: language === 'zh-CN' ? '上传配置' : 'Upload & Config' },
    { num: 3, label: language === 'zh-CN' ? '映射列名' : 'Map Columns' },
    { num: 4, label: language === 'zh-CN' ? '转换结果' : 'Results' }
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto pb-24 h-full">
      {/* Stepper Header */}
      <div className="flex items-center justify-between mb-12 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm sticky top-4 z-10">
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
            {s.num < 4 && <div className="h-[1px] bg-slate-100 flex-1 mx-4 hidden lg:block" />}
          </div>
        ))}
      </div>

      {/* Step 1: Definition Selection */}
      {step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-slate-800">{t.title}</h2>
            <p className="text-slate-500 mt-2 font-medium">{t.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {definitions.map((def) => (
              <button
                key={def.id}
                onClick={() => { setSelectedDef(def); setStep(2); }}
                className={`p-6 rounded-3xl border-2 transition-all text-left flex flex-col h-full ${
                  selectedDef?.id === def.id 
                    ? 'border-indigo-600 bg-indigo-50/30 ring-4 ring-indigo-100' 
                    : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md'
                }`}
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
                  {def.fields.length > 3 && <span className="text-[9px] text-slate-400 font-bold self-center">+{def.fields.length - 3}</span>}
                </div>
              </button>
            ))}
          </div>
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
            <h3 className="text-2xl font-black text-slate-800">{t.uploadTitle}</h3>
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
              {/* Settings Card */}
              <div className="lg:col-span-4 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8 h-fit sticky top-32">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                  <Settings2 className="w-6 h-6 text-indigo-600" />
                  {t.configTitle}
                </h3>
                
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.targetSheet}</label>
                    <select 
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                      className="w-full px-5 py-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 bg-white outline-none transition-all font-bold text-slate-700 shadow-sm"
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
                    <p className="text-xs text-slate-400 font-bold italic">
                      {language === 'zh-CN' ? '指示表头所在的Excel行数 (0开始计数)' : 'Indicates which row contains the actual headers (0-indexed).'}
                    </p>
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

              {/* Real-time Preview Card */}
              <div className="lg:col-span-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                    <Eye className="w-6 h-6 text-emerald-500" />
                    {t.previewTitle}
                  </h3>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setShowSkippedRows(!showSkippedRows)}
                      className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${
                        showSkippedRows 
                          ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-800'
                      }`}
                    >
                      {showSkippedRows ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {language === 'zh-CN' ? (showSkippedRows ? '显示顶部行' : '隐藏顶部行') : (showSkippedRows ? 'Show Skipped' : 'Hide Skipped')}
                    </button>
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full uppercase tracking-widest">
                      {language === 'zh-CN' ? '文件: ' : 'File: '} {files[0]?.name}
                    </span>
                  </div>
                </div>
                
                <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-500">
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
                        {/* Compression logic: If not showSkippedRows and startRow > 0, show a summary row */}
                        {!showSkippedRows && startRow > 0 && (
                          <tr className="bg-slate-50/30 group">
                            <td 
                              colSpan={(rawPreview[0]?.length || 0) + 1} 
                              className="px-6 py-6 text-center text-slate-400 italic cursor-pointer hover:bg-slate-100 transition-colors"
                              onClick={() => setShowSkippedRows(true)}
                            >
                              <div className="flex flex-col items-center justify-center gap-2">
                                <ChevronDown className="w-5 h-5 animate-bounce" />
                                <span className="font-black uppercase tracking-widest text-[10px]">
                                  {language === 'zh-CN' ? `已收起上方 ${startRow} 行配置外数据 (点击展开查看详情)` : `${startRow} leading rows compressed (click to expand)`}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}

                        {rawPreview.map((row, rIdx) => {
                          const isHeader = rIdx === startRow;
                          const isSkipped = rIdx < startRow;
                          
                          // Hide rows if they are before startRow and we aren't showing skipped rows
                          if (isSkipped && !showSkippedRows) return null;

                          return (
                            <tr key={rIdx} className={`transition-all duration-300 ${isHeader ? 'bg-indigo-50/50' : isSkipped ? 'opacity-40 grayscale bg-slate-50/30' : 'hover:bg-slate-50'}`}>
                              <td className={`px-4 py-3 text-center border-r border-slate-100 font-black ${isHeader ? 'text-indigo-600' : 'text-slate-400'}`}>
                                {rIdx}
                                {isHeader && <div className="text-[8px] uppercase tracking-tighter text-indigo-400 mt-0.5">Header</div>}
                              </td>
                              {row.map((cell: any, cIdx: number) => (
                                <td key={cIdx} className={`px-6 py-3 whitespace-nowrap truncate max-w-[200px] ${isHeader ? 'font-black text-indigo-900 bg-indigo-50/30' : 'text-slate-600'}`}>
                                  {cell !== null && cell !== "" ? String(cell) : <span className="text-slate-300 italic opacity-40">-</span>}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                        {rawPreview.length === 0 && (
                          <tr>
                            <td colSpan={20} className="px-10 py-32 text-center text-slate-300">
                              <TableIcon className="w-12 h-12 mx-auto mb-4 opacity-10" />
                              <p className="font-bold">No preview available for the selected sheet.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Info className="w-3.5 h-3.5" />
                      {language === 'zh-CN' ? '预览中深蓝色高亮的行为提取的表头' : 'Darker rows highlight the selected header row.'}
                    </p>
                    {startRow > 0 && !showSkippedRows && (
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.15em] italic">
                        {language === 'zh-CN' ? '顶部冗余行已自动折叠以聚焦关键数据' : 'Leading rows automatically collapsed for focus.'}
                      </p>
                    )}
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
                        className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 bg-white shadow-sm appearance-none outline-none font-bold text-slate-700 transition-all"
                      >
                        <option value="">{t.unmapped}</option>
                        {availableHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      {availableHeaders.length === 0 && (
                        <p className="text-[10px] text-red-400 mt-2 font-black uppercase flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {language === 'zh-CN' ? '未找到列名，请返回确认表头索引' : 'No headers found, check header index.'}
                        </p>
                      )}
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
              className="text-slate-400 hover:text-slate-800 font-black px-6 py-3 transition-colors uppercase tracking-widest text-sm"
            >
              &larr; {language === 'zh-CN' ? '返回配置' : 'Back to Config'}
            </button>
            <button 
              onClick={runTransformation}
              disabled={isProcessing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-[28px] font-black flex items-center gap-4 shadow-2xl shadow-indigo-200 transition-all transform hover:-translate-y-2 active:translate-y-0"
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
            <div className="bg-indigo-600 p-8 rounded-[40px] shadow-2xl shadow-indigo-100 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-indigo-700 transition-all transform hover:-translate-y-1 group">
              <Download className="w-10 h-10 text-white/90 mb-3 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-black text-white uppercase tracking-widest mb-1">{t.export}</p>
              <p className="text-xs text-white/60 font-medium">{t.readyERP}</p>
            </div>
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

          <div className="flex justify-center pt-8">
            <button 
              onClick={() => { setStep(1); setResults(null); }}
              className="px-10 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-[28px] font-black hover:border-indigo-300 hover:text-indigo-600 transition-all transform hover:-translate-y-1"
            >
              {t.initNew}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransformWizard;
