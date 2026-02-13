
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
import { extractSheetData } from '../services/excelService';

declare const XLSX: any;

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

  /**
   * Optimized validation for Batch Processor.
   * Only reads the header row.
   */
  const validateFileForTask = async (file: File, template: TransformationTemplate): Promise<{fileName: string, isValid: boolean, error?: string}> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          
          // Performance Critical: Read ONLY enough rows for the header.
          const workbook = XLSX.read(data, { 
            type: 'array', 
            sheetRows: Math.max(1, template.startRow + 1) 
          });
          
          let worksheet = workbook.Sheets[template.sheetName];
          if (!worksheet && workbook.SheetNames.length > 0) {
            worksheet = workbook.Sheets[workbook.SheetNames[0]];
          }

          if (!worksheet) {
            return resolve({ fileName: file.name, isValid: false, error: 'Target sheet not found' });
          }

          const headerRows = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            range: template.startRow, 
            defval: "" 
          }) as any[][];

          const fileHeaders = (headerRows[0] || []).map(h => String(h).trim()).filter(h => h !== "");
          const missing = (template.expectedHeaders || []).filter(h => !fileHeaders.includes(h));
          
          if (missing.length > 0) {
            return resolve({ 
              fileName: file.name, 
              isValid: false, 
              error: language === 'zh-CN' ? `缺失列: ${missing.join(', ')}` : `Missing columns: ${missing.join(', ')}` 
            });
          }

          resolve({ fileName: file.name, isValid: true });
        } catch (err) {
          resolve({ fileName: file.name, isValid: false, error: 'Parse Error' });
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileChange = async (taskId: string, files: FileList | null) => {
    if (!files || !currentBatch) return;
    const fileList = Array.from(files);
    
    const task = currentBatch.tasks.find(t => t.id === taskId);
    const template = templates.find(tpl => tpl.id === task?.templateId);
    
    if (task && template) {
      // Validate sequentially and yield to keep UI responsive
      const validationResults: any[] = [];
      for (let i = 0; i < fileList.length; i++) {
        validationResults.push(await validateFileForTask(fileList[i], template));
        if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
      }
      
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
          const data = await extractSheetData(file, template.sheetName, template.startRow, template.endRow);
          
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
          // Yield after each file to keep UI responsive
          await new Promise(r => setTimeout(r, 0));
        } catch (err: any) {
          console.error(`Error processing file ${file.name} in task ${task.id}`, err);
          taskHasFailure = true;
          allErrors.push({
            row: 0,
            field: 'FILE_SYSTEM',
            value: file.name,
            message: err.message || "Unknown error parsing file",
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
    if (!currentBatch) return;

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
               <div className="pt-6 border-t border-slate-100 flex items-center justify-between mt-auto">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{batch.tasks.length} Models Bundled</span>
                  <button onClick={() => handleEditBatch(batch)} className="text-indigo-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 group-hover:underline">
                    Execute <ArrowRight className="w-3.5 h-3.5" />
                  </button>
               </div>
            </div>
          ))}
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
                        className="w-full bg-slate-50 border border-slate-200 px-6 py-4 rounded-xl text-2xl font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                      />
                   </div>
                </div>
                <div className="w-full lg:w-96 space-y-6 bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-inner">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{bt.strategy}</h4>
                   <div className="space-y-4">
                      <button 
                        onClick={() => setCurrentBatch(prev => prev ? {...prev, exportStrategy: 'multi-sheet'} : null)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${currentBatch?.exportStrategy === 'multi-sheet' ? 'bg-white border-indigo-600 shadow-lg scale-105' : 'bg-transparent border-slate-200 grayscale opacity-50'}`}
                      >
                        <Files className="w-6 h-6 text-indigo-600" />
                        <div>
                            <p className="font-black text-slate-800 leading-none mb-1 text-sm">{bt.multiSheet}</p>
                        </div>
                      </button>
                      <button 
                        onClick={() => setCurrentBatch(prev => prev ? {...prev, exportStrategy: 'consolidated'} : null)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${currentBatch?.exportStrategy === 'consolidated' ? 'bg-white border-indigo-600 shadow-lg scale-105' : 'bg-transparent border-slate-200 grayscale opacity-50'}`}
                      >
                        <FileDown className="w-6 h-6 text-indigo-600" />
                        <div>
                            <p className="font-black text-slate-800 leading-none mb-1 text-sm">{bt.consolidated}</p>
                        </div>
                      </button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchProcessor;
