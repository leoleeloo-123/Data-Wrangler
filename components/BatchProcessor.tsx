
import React, { useState } from 'react';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Download,
  FileSpreadsheet,
  ArrowRight,
  Database,
  Info,
  ChevronRight,
  PlusCircle,
  FileText,
  Files,
  X,
  FileOutput,
  Edit2,
  Upload as UploadIcon,
  TableProperties,
  FileDown,
  ClipboardCheck
} from 'lucide-react';
import { DataDefinition, TransformationTemplate, BatchConfiguration, BatchTask, ProcessedData, ValidationError, FieldType, DataReviewEntry } from '../types';
import { translations } from '../translations';
import { extractSheetData, getSheetHeaders } from '../services/excelService';

// Fix: Declare global XLSX variable to resolve 'Cannot find name XLSX' errors
declare const XLSX: any;

// Fix: Define missing BatchProcessorProps interface to resolve 'Cannot find name BatchProcessorProps' error
interface BatchProcessorProps {
  templates: TransformationTemplate[];
  definitions: DataDefinition[];
  batches: BatchConfiguration[];
  onSaveBatch: (batch: BatchConfiguration) => void;
  onDeleteBatch: (id: string) => void;
  onExportToReview: (entry: DataReviewEntry) => void;
  language: 'en-US' | 'zh-CN';
}

const BatchProcessor: React.FC<BatchProcessorProps> = ({ 
  templates, 
  definitions, 
  batches,
  onSaveBatch,
  onDeleteBatch,
  onExportToReview,
  language 
}) => {
  const t = translations[language];
  const bt = t.batch;
  
  const [isCreating, setIsCreating] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<BatchConfiguration | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTaskFiles, setActiveTaskFiles] = useState<Record<string, File[]>>({});

  const startNewBatch = () => {
    setCurrentBatch({
      id: crypto.randomUUID(),
      name: '',
      description: '',
      tasks: [],
      createdAt: new Date().toISOString(),
      exportStrategy: 'multi-sheet',
      globalSheetName: 'Sheet1',
      globalFileName: 'Consolidated File'
    });
    setIsCreating(true);
    setActiveTaskFiles({});
  };

  const handleEditBatch = (batch: BatchConfiguration) => {
    setCurrentBatch(JSON.parse(JSON.stringify(batch)));
    setIsCreating(true);
  };

  const addTask = (templateId: string) => {
    if (!currentBatch) return;
    const template = templates.find(tpl => tpl.id === templateId);
    const newTask: BatchTask = {
      id: crypto.randomUUID(),
      templateId,
      files: [],
      status: 'pending',
      customOutputSheetName: template ? template.name : 'Sheet',
      customOutputFileName: template ? template.name : 'DataOutput'
    };
    setCurrentBatch({ ...currentBatch, tasks: [...currentBatch.tasks, newTask] });
  };

  const removeTask = (taskId: string) => {
    if (!currentBatch) return;
    setCurrentBatch({ ...currentBatch, tasks: currentBatch.tasks.filter(t => t.id !== taskId) });
    const newFiles = { ...activeTaskFiles };
    delete newFiles[taskId];
    setActiveTaskFiles(newFiles);
  };

  const validateFileForTask = async (file: File, template: TransformationTemplate): Promise<{fileName: string, isValid: boolean, error?: string}> => {
    try {
      // UNIFIED PARSING: Use getSheetHeaders with minCols hint from template
      const fileHeaders = await getSheetHeaders(file, template.sheetName, template.startRow, (template.expectedHeaders || []).length);
      
      const missing = (template.expectedHeaders || []).filter(h => !fileHeaders.includes(h));
      
      if (missing.length > 0) {
        // Log validation info consistent with Wizard for troubleshooting
        console.warn(`[Batch Validation Failed] File: ${file.name}\nSheet: ${template.sheetName}\nTemplate Headers: ${template.expectedHeaders.length}\nFile Headers Found: ${fileHeaders.length}\nMissing:`, missing.slice(0, 20));
        
        return { 
          fileName: file.name, 
          isValid: false, 
          error: language === 'zh-CN' ? `缺失列 (检测到 ${fileHeaders.length} 列): ${missing.slice(0, 3).join(', ')}...` : `Missing columns (found ${fileHeaders.length}): ${missing.slice(0, 3).join(', ')}...` 
        };
      }

      return { fileName: file.name, isValid: true };
    } catch (err: any) {
      console.error(`[Batch] Validation failed for ${file.name}:`, err);
      return { 
        fileName: file.name, 
        isValid: false, 
        error: err.message || 'File validation error' 
      };
    }
  };

  const handleFileChange = async (taskId: string, files: FileList | null) => {
    if (!files || !currentBatch) return;
    const fileList = Array.from(files);
    const task = currentBatch.tasks.find(t => t.id === taskId);
    const template = templates.find(tpl => tpl.id === task?.templateId);
    
    if (task && template) {
      const validationResults = await Promise.all(fileList.map(f => validateFileForTask(f, template)));
      
      setCurrentBatch(prev => {
        if (!prev) return null;
        return {
          ...prev,
          tasks: prev.tasks.map(t => t.id === taskId ? { ...t, validationResults } : t)
        };
      });
    }

    setActiveTaskFiles(prev => ({ ...prev, [taskId]: fileList }));
  };

  const updateTaskSheetName = (taskId: string, name: string) => {
    if (!currentBatch) return;
    setCurrentBatch({
      ...currentBatch,
      tasks: currentBatch.tasks.map(t => t.id === taskId ? { ...t, customOutputSheetName: name } : t)
    });
  };

  const updateTaskFileName = (taskId: string, name: string) => {
    if (!currentBatch) return;
    setCurrentBatch({
      ...currentBatch,
      tasks: currentBatch.tasks.map(t => t.id === taskId ? { ...t, customOutputFileName: name } : t)
    });
  };

  const runBatch = async () => {
    if (!currentBatch) return;
    setIsProcessing(true);

    const updatedTasks = JSON.parse(JSON.stringify(currentBatch.tasks));
    
    for (let i = 0; i < updatedTasks.length; i++) {
      const task = updatedTasks[i];
      const template = templates.find(tpl => tpl.id === task.templateId);
      const def = definitions.find(d => d.id === template?.definitionId);
      const files = activeTaskFiles[task.id] || [];

      if (!template || !def || files.length === 0) {
        updatedTasks[i].status = files.length === 0 ? 'pending' : 'error';
        continue;
      }

      updatedTasks[i].status = 'processing';
      setCurrentBatch(prev => prev ? { ...prev, tasks: [...updatedTasks] } : null);

      const allRows: any[] = [];
      const allErrors: ValidationError[] = [];
      const fieldStats: Record<string, { mismatchCount: number }> = {};
      def.fields.forEach(f => fieldStats[f.name] = { mismatchCount: 0 });

      let taskHasFailure = false;

      for (const file of files) {
        try {
          // UNIFIED PARSING: Use extractSheetData with template params (startRow, endRow, rowFilter)
          const data = await extractSheetData(
            file, 
            template.sheetName, 
            template.startRow, 
            template.endRow, 
            (template as any).rowFilter
          );
          
          data.forEach((rawRow, rowIdx) => {
            const processedRow: any = {
              __source_file__: file.name,
              __source_sheet__: template.sheetName
            };
            
            def.fields.forEach(field => {
              const sourceColName = template.mapping[field.id];
              const rawValue = sourceColName ? rawRow[sourceColName] : null;

              let transformedValue = rawValue;
              let hasError = false;

              if (field.required && (rawValue === null || rawValue === undefined || rawValue === "")) {
                hasError = true;
                allErrors.push({
                  row: rowIdx + (template.startRow + 2),
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
                    row: rowIdx + (template.startRow + 2),
                    field: field.name,
                    value: rawValue,
                    message: `Non-numeric value`,
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
        } catch (err: any) {
          console.error(`[Batch] Task processing error for ${file.name}:`, err);
          taskHasFailure = true;
          allErrors.push({
            row: 0,
            field: 'FILE_SYSTEM',
            value: file.name,
            message: err.message || "Failed to process file",
            severity: 'error'
          });
        }
      }

      updatedTasks[i].status = taskHasFailure ? 'error' : 'completed';
      updatedTasks[i].results = {
        rows: allRows,
        errors: allErrors,
        fileCount: files.length,
        fieldStats
      };
      
      setCurrentBatch(prev => prev ? { ...prev, tasks: [...updatedTasks] } : null);
    }

    setIsProcessing(false);
    const someInvalid = updatedTasks.some((t: any) => t.status === 'error');
    if (!someInvalid) {
      alert(bt.success);
    } else {
      alert(language === 'zh-CN' ? '批处理结束，部分任务存在错误，请检查提示。' : 'Batch run finished. Some tasks had errors, please check the status.');
    }
  };

  const getCleanRowsForTask = (task: BatchTask, template: TransformationTemplate, def: DataDefinition) => {
     if (!task.results) return [];
     return task.results.rows.map(row => {
        const { __source_file__, __source_sheet__, ...dataFields } = row;
        const fileNameHeader = translations[language].transform.fileNameColumn;
        const infoStr = `${__source_file__}_${__source_sheet__}`;
        
        const orderedRow: any = {};
        if (template.includeFileName && template.fileNamePosition === 'front') {
          orderedRow[fileNameHeader] = infoStr;
        }
        def.fields.forEach(f => {
          orderedRow[f.name] = dataFields[f.name] !== undefined ? dataFields[f.name] : null;
        });
        if (template.includeFileName && template.fileNamePosition === 'back') {
          orderedRow[fileNameHeader] = infoStr;
        }
        return orderedRow;
      });
  };

  const exportToReview = () => {
    if (!currentBatch) return;
    let totalBatchRows = 0;
    let totalBatchErrors = 0;

    const tasksForReview = currentBatch.tasks.filter(t => t.status === 'completed').map(task => {
        const template = templates.find(tpl => tpl.id === task.templateId)!;
        const def = definitions.find(d => d.id === template.definitionId)!;
        
        totalBatchRows += task.results?.rows.length || 0;
        totalBatchErrors += task.results?.errors.length || 0;

        return {
           modelName: template.name,
           rowCount: task.results?.rows.length || 0,
           sheetName: task.customOutputSheetName,
           fileName: task.customOutputFileName,
           rows: getCleanRowsForTask(task, template, def),
           errorCount: task.results?.errors.length || 0,
           fieldMetadata: def.fields.map(f => ({
             name: f.name,
             type: f.type,
             mismatchCount: task.results?.fieldStats[f.name]?.mismatchCount || 0
           }))
        };
    });

    if (tasksForReview.length === 0) {
      alert(language === 'zh-CN' ? '没有已完成的任务可供复核。' : 'No completed tasks available for review.');
      return;
    }

    const reviewEntry: DataReviewEntry = {
       id: crypto.randomUUID(),
       batchName: currentBatch.name || 'Unnamed Batch',
       timestamp: new Date().toISOString(),
       strategy: currentBatch.exportStrategy,
       totalRows: totalBatchRows,
       totalErrors: totalBatchErrors,
       tasks: tasksForReview
    };

    onExportToReview(reviewEntry);
    alert(language === 'zh-CN' ? '已成功导出到数据复核！' : 'Successfully exported to Data Review!');
  };

  const exportBatch = () => {
    // Note: The global XLSX is expected here as defined in index.html
    if (!currentBatch || typeof XLSX === 'undefined') return;

    if (currentBatch.exportStrategy === 'multi-sheet') {
      currentBatch.tasks.forEach(task => {
        const template = templates.find(tpl => tpl.id === task.templateId);
        const def = definitions.find(d => d.id === template?.definitionId);

        if (task.results && task.results.rows.length > 0 && template && def) {
          const wb = XLSX.utils.book_new();
          const unifiedSheetName = (currentBatch.globalSheetName || 'Sheet1').substring(0, 31).replace(/[\[\]\*\?\/\\]/g, '_');
          const outputFileName = (task.customOutputFileName || 'Task_Output').replace(/[\[\]\*\?\/\\]/g, '_');
          
          const cleanRows = getCleanRowsForTask(task, template, def);

          const ws = XLSX.utils.json_to_sheet(cleanRows);
          XLSX.utils.book_append_sheet(wb, ws, unifiedSheetName);
          XLSX.writeFile(wb, `${outputFileName}.xlsx`);
        }
      });
    } else {
      const wb = XLSX.utils.book_new();
      const outputFileName = (currentBatch.globalFileName || 'Consolidated_Batch').replace(/[\[\]\*\?\/\\]/g, '_');
      
      currentBatch.tasks.forEach(task => {
        const template = templates.find(tpl => tpl.id === task.templateId);
        const def = definitions.find(d => d.id === template?.definitionId);

        if (task.results && task.results.rows.length > 0 && template && def) {
          const taskSheetName = (task.customOutputSheetName || 'Model_Sheet').substring(0, 31).replace(/[\[\]\*\?\/\\]/g, '_');
          const cleanRows = getCleanRowsForTask(task, template, def);

          const ws = XLSX.utils.json_to_sheet(cleanRows);
          XLSX.utils.book_append_sheet(wb, ws, taskSheetName);
        }
      });

      if (wb.SheetNames.length > 0) {
        XLSX.writeFile(wb, `${outputFileName}.xlsx`);
      }
    }
  };

  return (
    <div className="px-8 py-10 max-w-[1800px] mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-slate-800 tracking-tighter">{bt.title}</h1>
          <p className="text-slate-500 font-bold mt-2 text-lg">{bt.subtitle}</p>
        </div>
        {!isCreating && (
          <button 
            onClick={startNewBatch}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-2xl flex items-center gap-4 shadow-xl shadow-indigo-100 transition-all font-black text-lg transform hover:-translate-y-1 active:scale-95"
          >
            <Plus className="w-6 h-6" />
            {bt.createBatch}
          </button>
        )}
      </header>

      {!isCreating ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batches.map((batch) => (
            <div key={batch.id} className="bg-white p-8 rounded-2xl border border-slate-200 hover:border-indigo-200 shadow-sm transition-all group flex flex-col hover:shadow-md">
               <div className="flex justify-between items-start mb-6">
                  <div className="bg-indigo-50 p-4 rounded-xl shadow-sm">
                    <Layers className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                     <button onClick={() => handleEditBatch(batch)} className="p-3 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-xl transition-colors"><Edit2 className="w-4 h-4" /></button>
                     <button onClick={() => onDeleteBatch(batch.id)} className="p-3 text-slate-400 hover:text-red-500 bg-slate-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
               </div>
               <h3 className="text-xl font-black text-slate-800 mb-2">{batch.name || 'Unnamed Batch'}</h3>
               <p className="text-slate-500 font-bold mb-8 leading-relaxed text-sm line-clamp-2">{batch.description || '...'}</p>
               
               <div className="space-y-2.5 mb-8 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{bt.tasks}</p>
                  {batch.tasks.map((task, idx) => {
                    const template = templates.find(tpl => tpl.id === task.templateId);
                    return (
                      <div key={idx} className="flex items-center gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                         <span className="text-xs font-black text-slate-700 truncate">{template?.name || 'Missing Model'}</span>
                      </div>
                    );
                  })}
               </div>

               <div className="pt-6 border-t border-slate-100 flex items-center justify-between mt-auto">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{batch.tasks.length} Models Bundled</span>
                  <button onClick={() => handleEditBatch(batch)} className="text-indigo-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 group-hover:underline">
                    Execute <ArrowRight className="w-3.5 h-3.5" />
                  </button>
               </div>
            </div>
          ))}
          {batches.length === 0 && (
            <div className="col-span-full py-40 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 space-y-4">
              <Layers className="w-16 h-16 text-slate-200 mx-auto opacity-30" />
              <p className="text-slate-400 font-bold text-lg">{language === 'zh-CN' ? '尚未创建任何批处理编排。' : 'No batch orchestrations created yet.'}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-500">
          <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-2xl space-y-8 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-10 text-indigo-50/30 -mr-8 -mt-8">
               <Layers className="w-48 h-48" />
             </div>
             <div className="relative z-10 flex flex-col lg:flex-row gap-8">
                <div className="flex-1 space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{bt.name}</label>
                      <input 
                        type="text" 
                        value={currentBatch?.name}
                        onChange={(e) => setCurrentBatch(prev => prev ? {...prev, name: e.target.value} : null)}
                        placeholder="e.g. Consolidated Cleanse"
                        className="w-full bg-slate-50 border border-slate-200 px-6 py-4 rounded-xl text-2xl font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{bt.desc}</label>
                      <input 
                        type="text" 
                        value={currentBatch?.description}
                        onChange={(e) => setCurrentBatch(prev => prev ? {...prev, description: e.target.value} : null)}
                        placeholder="Purpose of this batch run..."
                        className="w-full bg-slate-50 border border-slate-200 px-6 py-4 rounded-xl font-bold text-slate-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                      />
                   </div>
                </div>
                <div className="w-full lg:w-96 space-y-6 bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-inner">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{bt.strategy}</h4>
                   <div className="space-y-4">
                      <div className="flex flex-col gap-3">
                        <button 
                          onClick={() => setCurrentBatch(prev => prev ? {...prev, exportStrategy: 'multi-sheet'} : null)}
                          className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${currentBatch?.exportStrategy === 'multi-sheet' ? 'bg-white border-indigo-600 shadow-lg scale-105' : 'bg-transparent border-slate-200 grayscale opacity-50'}`}
                        >
                          <Files className="w-6 h-6 text-indigo-600" />
                          <div>
                              <p className="font-black text-slate-800 leading-none mb-1 text-sm">{bt.multiSheet}</p>
                              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Files by Task</p>
                          </div>
                        </button>
                        {currentBatch?.exportStrategy === 'multi-sheet' && (
                          <div className="px-2 py-1 space-y-1.5 animate-in slide-in-from-top-2">
                             <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{bt.globalSheetName}</label>
                             <input 
                                type="text"
                                value={currentBatch.globalSheetName}
                                onChange={(e) => setCurrentBatch(prev => prev ? {...prev, globalSheetName: e.target.value} : null)}
                                className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-50 text-[11px]"
                             />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3">
                        <button 
                          onClick={() => setCurrentBatch(prev => prev ? {...prev, exportStrategy: 'consolidated'} : null)}
                          className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${currentBatch?.exportStrategy === 'consolidated' ? 'bg-white border-indigo-600 shadow-lg scale-105' : 'bg-transparent border-slate-200 grayscale opacity-50'}`}
                        >
                          <FileDown className="w-6 h-6 text-indigo-600" />
                          <div>
                              <p className="font-black text-slate-800 leading-none mb-1 text-sm">{bt.consolidated}</p>
                              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Combined File</p>
                          </div>
                        </button>
                        {currentBatch?.exportStrategy === 'consolidated' && (
                          <div className="px-2 py-1 space-y-1.5 animate-in slide-in-from-top-2">
                             <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{bt.globalFileName}</label>
                             <input 
                                type="text"
                                value={currentBatch.globalFileName}
                                onChange={(e) => setCurrentBatch(prev => prev ? {...prev, globalFileName: e.target.value} : null)}
                                className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-50 text-[11px]"
                             />
                          </div>
                        )}
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-8 space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight"><CheckCircle2 className="w-8 h-8 text-indigo-500" />{bt.tasks}</h3>
                  <div className="flex gap-3">
                     <button onClick={() => { if(currentBatch) onSaveBatch(currentBatch); setIsCreating(false); }} className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all">{t.definitions.cancel}</button>
                     <button onClick={runBatch} disabled={isProcessing || currentBatch?.tasks.length === 0} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none flex items-center gap-2">{isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}{bt.run}</button>
                  </div>
               </div>

               <div className="space-y-6">
                  {currentBatch?.tasks.map((task) => {
                    const template = templates.find(tpl => tpl.id === task.templateId);
                    const files = activeTaskFiles[task.id] || [];
                    const someInvalid = task.validationResults?.some(v => !v.isValid) ?? false;

                    return (
                      <div key={task.id} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-stretch gap-6 hover:shadow-md transition-all relative group overflow-hidden">
                         <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
                            <div className="flex-1 w-full space-y-6">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                     <div className="bg-indigo-50 p-3 rounded-xl shadow-sm"><Database className="w-6 h-6 text-indigo-600" /></div>
                                     <div>
                                        <h4 className="text-lg font-black text-slate-800">{template?.name || 'Unknown Model'}</h4>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{template?.sheetName} • Header {template?.startRow}</p>
                                     </div>
                                  </div>
                                  <div className="space-y-1 text-right">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                                      {currentBatch.exportStrategy === 'multi-sheet' ? bt.taskOutputFileName : bt.taskOutputSheetName}
                                    </label>
                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-50 transition-all">
                                      {currentBatch.exportStrategy === 'multi-sheet' ? <FileOutput className="w-3.5 h-3.5 text-slate-400" /> : <TableProperties className="w-3.5 h-3.5 text-slate-400" />}
                                      <input 
                                        type="text" 
                                        value={currentBatch.exportStrategy === 'multi-sheet' ? task.customOutputFileName : task.customOutputSheetName}
                                        onChange={(e) => {
                                          if (currentBatch.exportStrategy === 'multi-sheet') {
                                            updateTaskFileName(task.id, e.target.value);
                                          } else {
                                            updateTaskSheetName(task.id, e.target.value);
                                          }
                                        }}
                                        className="bg-transparent font-black text-slate-700 outline-none text-[11px] w-32"
                                        placeholder="Name..."
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-200 hover:border-indigo-400 transition-all relative text-center group/upload overflow-hidden">
                                   <input type="file" multiple onChange={(e) => handleFileChange(task.id, e.target.files)} className="absolute inset-0 opacity-0 cursor-pointer z-10" accept=".xlsx, .xls" />
                                   <div className="space-y-2 relative z-0">
                                      {files.length > 0 ? (
                                        <div className="flex items-center justify-center gap-4">
                                          <div className={`p-3 rounded-full ${someInvalid ? 'bg-amber-100' : 'bg-emerald-100'} animate-in zoom-in`}>
                                            {someInvalid ? <AlertCircle className="w-6 h-6 text-amber-600" /> : <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
                                          </div>
                                          <div className="text-left">
                                             <p className={`text-sm font-black ${someInvalid ? 'text-amber-600' : 'text-emerald-600'}`}>
                                               {files.length} {language === 'zh-CN' ? `个文件 (${someInvalid ? '架构错误' : '验证通过'})` : `Files (${someInvalid ? 'Schema Error' : 'Validated'})`}
                                             </p>
                                             <p className="text-[10px] font-bold text-slate-400 truncate max-w-[200px]">{files.map(f => f.name).join(', ')}</p>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <UploadIcon className="w-8 h-8 text-slate-300 mx-auto group-hover/upload:text-indigo-500 transition-colors" />
                                          <p className="text-xs font-black text-slate-400">{bt.uploadFor.replace('{0}', template?.name || '')}</p>
                                        </>
                                      )}
                                   </div>
                                </div>
                            </div>

                            <div className="w-full md:w-56 flex flex-col gap-3">
                               <div className={`p-5 rounded-xl text-center border-2 transition-all ${
                                  task.status === 'completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                                  task.status === 'processing' ? 'bg-indigo-50 border-indigo-100 text-indigo-600 animate-pulse' :
                                  task.status === 'error' ? 'bg-red-50 border-red-100 text-red-600' :
                                  'bg-slate-50 border-slate-100 text-slate-400'
                               }`}>
                                  <span className="text-[9px] font-black uppercase tracking-widest">{bt[task.status]}</span>
                                  {task.results && <p className="text-xl font-black mt-1.5">{task.results.rows.length.toLocaleString()} Rows</p>}
                               </div>
                               <button 
                                 onClick={() => removeTask(task.id)}
                                 className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-300 hover:text-red-500 hover:border-red-100 transition-all font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2"
                               >
                                  <Trash2 className="w-3.5 h-3.5" /> {bt.deleteTask}
                                </button>
                            </div>
                         </div>
                      </div>
                    );
                  })}
                  {currentBatch?.tasks.length === 0 && (
                    <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-4">
                      <PlusCircle className="w-12 h-12 text-slate-200 mx-auto" />
                      <p className="text-slate-400 font-bold text-sm">{bt.noModels}</p>
                    </div>
                  )}
               </div>
            </div>

            <div className="xl:col-span-4 space-y-6">
               <div className="bg-slate-800 p-8 rounded-2xl text-white shadow-xl space-y-8">
                  <div>
                    <h3 className="text-xl font-black tracking-tight">{language === 'zh-CN' ? '可用转换模型' : bt.addModel}</h3>
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-1">Select logic template</p>
                  </div>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                     {templates.map(tpl => {
                        const isAdded = currentBatch?.tasks.some(t => t.templateId === tpl.id);
                        return (
                          <button 
                            key={tpl.id}
                            onClick={() => addTask(tpl.id)}
                            className={`w-full p-4 rounded-xl text-left transition-all border-2 flex items-center justify-between group ${
                               isAdded ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 bg-white/5 hover:border-indigo-400 hover:bg-white/10'
                            }`}
                          >
                             <div className="overflow-hidden">
                                <p className="font-black text-base truncate mb-0.5">{tpl.name}</p>
                                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{tpl.sheetName}</p>
                             </div>
                             {isAdded ? (
                               <div className="bg-emerald-500 p-1.5 rounded-full shadow-lg"><CheckCircle2 className="w-3 h-3" /></div>
                             ) : (
                               <div className="bg-white/10 p-1.5 rounded-full group-hover:bg-indigo-500 group-hover:scale-105 transition-all"><Plus className="w-3 h-3" /></div>
                             )}
                          </button>
                        );
                     })}
                  </div>
               </div>

               <div className={`bg-white p-8 rounded-2xl border shadow-xl transition-all space-y-6 ${currentBatch?.tasks.every(t => t.status === 'completed') && currentBatch.tasks.length > 0 ? 'border-emerald-200 bg-emerald-50/20' : 'opacity-50 grayscale'}`}>
                  <div className="flex items-center gap-4">
                     <div className="bg-emerald-500 p-4 rounded-xl text-white shadow-lg">
                        <Download className="w-6 h-6" />
                     </div>
                     <div>
                        <h4 className="text-xl font-black text-slate-800 tracking-tight">{bt.export}</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Ready for output</p>
                     </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button 
                      disabled={!currentBatch?.tasks.every(t => t.status === 'completed') || currentBatch.tasks.length === 0}
                      onClick={exportBatch}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl font-black flex items-center justify-center gap-3 shadow-lg shadow-emerald-100 transition-all transform hover:-translate-y-1 active:scale-95 text-xs uppercase tracking-widest disabled:transform-none disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" /> {bt.export}
                    </button>
                    <button 
                      disabled={!currentBatch?.tasks.some(t => t.status === 'completed')}
                      onClick={exportToReview}
                      className="w-full bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 p-4 rounded-xl font-black flex items-center justify-center gap-3 shadow-lg shadow-indigo-100 transition-all transform hover:-translate-y-1 active:scale-95 text-xs uppercase tracking-widest disabled:transform-none disabled:opacity-50"
                    >
                      <ClipboardCheck className="w-4 h-4" /> {bt.exportReview}
                    </button>
                  </div>
               </div>
            </div>
          </div>
          
          <div className="flex justify-start items-center pt-6">
            <button 
              onClick={() => { if(currentBatch) onSaveBatch(currentBatch); setIsCreating(false); }} 
              className="px-10 py-4 bg-slate-800 text-white rounded-xl font-black hover:bg-slate-900 transition-all shadow-xl uppercase tracking-widest text-[10px] flex items-center gap-3"
            >
              <CheckCircle2 className="w-4 h-4" /> {language === 'zh-CN' ? '保存编排任务并返回' : 'Save Batch & Return'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchProcessor;
