
import React, { useState, useCallback } from 'react';
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
  X
} from 'lucide-react';
import { DataDefinition, Mapping, ValidationError, ProcessedData, FieldType } from '../types';
import { parseExcelMetadata, extractSheetData, ExcelSheetInfo } from '../services/excelService';
import { suggestMappings } from '../services/geminiService';
import { translations } from '../translations';

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
          if (metadata.length > 0) setSelectedSheet(metadata[0].name);
        }
      } catch (err) {
        console.error("Error parsing file", err);
      }
    }
  };

  const autoMap = async () => {
    if (!selectedDef || sheetMetadata.length === 0) return;
    const currentSheet = sheetMetadata.find(s => s.name === selectedSheet);
    if (!currentSheet) return;
    
    setIsProcessing(true);
    const suggestions = await suggestMappings(selectedDef.fields, currentSheet.headers);
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
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-16 text-center transition-all hover:border-indigo-300 relative group">
            <input 
              type="file" 
              multiple 
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="bg-indigo-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-300">
              <Upload className="w-12 h-12 text-indigo-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-800">{t.uploadTitle}</h3>
            <p className="text-slate-500 mt-2 font-medium">{t.uploadSubtitle}</p>
            {files.length > 0 && (
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {files.map((f, i) => (
                  <span key={i} className="bg-indigo-50 text-indigo-700 text-xs px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-sm border border-indigo-100">
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
            <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm space-y-10">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <Settings2 className="w-6 h-6 text-indigo-600" />
                {t.configTitle}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest">{t.targetSheet}</label>
                  <select 
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    className="w-full px-5 py-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 bg-white outline-none transition-all font-semibold"
                  >
                    {sheetMetadata.map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest">{t.headerIndex}</label>
                  <div className="flex items-center gap-6">
                    <input 
                      type="number" 
                      min="0"
                      value={startRow}
                      onChange={(e) => setStartRow(parseInt(e.target.value) || 0)}
                      className="w-32 px-5 py-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 bg-white outline-none transition-all font-bold text-center text-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button 
                  onClick={() => setStep(3)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black flex items-center gap-3 shadow-2xl shadow-indigo-200 transition-all transform hover:-translate-y-1"
                >
                  {language === 'zh-CN' ? '继续映射' : 'Proceed to Mapping'}
                  <ArrowRight className="w-6 h-6" />
                </button>
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
              <h2 className="text-3xl font-black text-slate-800">{t.mappingTitle}</h2>
              <p className="text-slate-500 font-medium">{t.mappingSubtitle}</p>
            </div>
            <button 
              onClick={autoMap}
              disabled={isProcessing}
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
                  <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">{t.mappingTitle} (Target)</th>
                  <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">{t.mappingTitle} (Source)</th>
                  <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">{language === 'zh-CN' ? '限制' : 'Constraint'}</th>
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
                        {sheetMetadata.find(s => s.name === selectedSheet)?.headers.map(h => (
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
              {t.execute}
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
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
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
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="xl:col-span-8 space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
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
