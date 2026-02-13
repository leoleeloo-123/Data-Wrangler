
import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Trash2, 
  FileSpreadsheet, 
  ArrowRight, 
  Eye, 
  Download,
  Database,
  Search,
  Calendar,
  Layers,
  Table as TableIcon,
  X,
  Clock,
  Files,
  FileDown,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { DataReviewEntry } from '../types';
import { translations } from '../translations';

declare const XLSX: any;

interface DataReviewProps {
  entries: DataReviewEntry[];
  onDeleteEntry: (id: string) => void;
  language: 'en-US' | 'zh-CN';
}

const DataReview: React.FC<DataReviewProps> = ({ entries, onDeleteEntry, language }) => {
  const t = translations[language];
  const tr = t.transform;
  const [selectedEntry, setSelectedEntry] = useState<DataReviewEntry | null>(null);
  const [activeTaskIdx, setActiveTaskIdx] = useState(0);

  const handleDownloadEntry = (entry: DataReviewEntry) => {
    const wb = XLSX.utils.book_new();
    entry.tasks.forEach(task => {
      const ws = XLSX.utils.json_to_sheet(task.rows);
      XLSX.utils.book_append_sheet(wb, ws, task.sheetName.substring(0, 31));
    });
    XLSX.writeFile(wb, `${entry.batchName}_Review.xlsx`);
  };

  const calculateHealthScore = (rows: number, errors: number, fieldCount: number) => {
    if (rows === 0) return "100.0";
    const totalPotentialChecks = rows * fieldCount;
    return Math.max(0, 100 - (errors / totalPotentialChecks * 100)).toFixed(1);
  };

  return (
    <div className="px-8 py-10 max-w-[1800px] mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-slate-800 tracking-tighter">{t.sidebar.review}</h1>
          <p className="text-slate-500 font-bold mt-2 text-lg">
            {language === 'zh-CN' ? '查看并审计已导出的批处理结果快照。' : 'Review and audit exported snapshots of batch transformation results.'}
          </p>
        </div>
      </header>

      {!selectedEntry ? (
        <div className="grid grid-cols-1 gap-5">
          {entries.length > 0 ? (
            entries.map((entry) => (
              <div key={entry.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-6 group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 text-slate-50 group-hover:text-indigo-50/50 transition-colors pointer-events-none">
                  <ClipboardCheck className="w-32 h-32" />
                </div>
                
                <div className="flex-shrink-0 bg-indigo-50 p-4 rounded-xl shadow-sm relative z-10">
                  <Layers className="w-8 h-8 text-indigo-600" />
                </div>

                <div className="flex-1 space-y-4 relative z-10 w-full min-w-0">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black text-slate-800 truncate">{entry.batchName}</h3>
                      <div className={`px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border ${
                        entry.strategy === 'consolidated' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-blue-50 text-blue-600 border-blue-100'
                      }`}>
                        {entry.strategy === 'consolidated' ? <FileDown className="w-3 h-3" /> : <Files className="w-3 h-3" />}
                        {entry.strategy === 'consolidated' 
                          ? (language === 'zh-CN' ? '统一输出' : 'Consolidated') 
                          : (language === 'zh-CN' ? '分拆输出' : 'Multi-sheet')}
                      </div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-3 h-3" /> {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {entry.tasks.map((task, idx) => (
                      <span key={idx} className="bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest shadow-sm">
                        {task.modelName} <span className="text-indigo-400 ml-1">({task.rowCount} ROWS)</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 relative z-10 w-full md:w-auto justify-end border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                  <button 
                    onClick={() => { setSelectedEntry(entry); setActiveTaskIdx(0); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all transform hover:-translate-y-0.5 active:scale-95"
                  >
                    <Eye className="w-4 h-4" /> {language === 'zh-CN' ? '查看详情' : 'Inspect'}
                  </button>
                  <button 
                    onClick={() => handleDownloadEntry(entry)}
                    className="p-3 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onDeleteEntry(entry.id)}
                    className="p-3 text-slate-300 hover:text-red-500 bg-slate-50 hover:bg-white rounded-xl transition-all border border-transparent hover:border-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-32 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 space-y-4">
              <ClipboardCheck className="w-16 h-16 text-slate-200 mx-auto opacity-30" />
              <p className="text-slate-400 font-black text-lg uppercase tracking-widest">
                {language === 'zh-CN' ? '尚无 Review 记录。' : 'No Data Review records.'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedEntry(null)} className="text-indigo-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:underline">
               &larr; {language === 'zh-CN' ? '返回列表' : 'Back to List'}
            </button>
            <div className="flex gap-3">
              <button onClick={() => handleDownloadEntry(selectedEntry)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all transform hover:-translate-y-0.5">
                <Download className="w-4 h-4" /> {language === 'zh-CN' ? '导出报告 (.xlsx)' : 'Export Review (.xlsx)'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col justify-center">
              <p className="text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest">{tr.rowsProcessed}</p>
              <h3 className={`text-xl font-black tracking-tight text-slate-800`}>
                {language === 'zh-CN' ? `${selectedEntry.tasks.length}模型 ${selectedEntry.totalRows}行` : `${selectedEntry.tasks.length} task(s), ${selectedEntry.totalRows} row(s)`}
              </h3>
            </div>
            
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col justify-center">
              <p className="text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest">{tr.qualityIssues}</p>
              <h3 className={`text-3xl font-black tracking-tight ${selectedEntry.totalErrors > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {selectedEntry.totalErrors.toLocaleString()}
              </h3>
            </div>

            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col justify-center">
              <p className="text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest">{tr.healthScore}</p>
              <h3 className={`text-3xl font-black tracking-tight text-indigo-600`}>
                {calculateHealthScore(selectedEntry.totalRows, selectedEntry.totalErrors, selectedEntry.tasks[0]?.fieldMetadata.length || 1)}%
              </h3>
            </div>

            <div className="bg-indigo-600 text-white p-8 rounded-xl shadow-xl shadow-indigo-100 flex flex-col justify-center items-center gap-3">
              <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">Snapshot</p>
              <h3 className="text-xl font-black text-center leading-tight">
                {language === 'zh-CN' ? '数据快照已就绪' : 'Audit Ready'}
              </h3>
              <CheckCircle2 className="w-6 h-6 text-indigo-200" />
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl space-y-8">
            <div className="flex items-center gap-8">
               <div className="bg-indigo-50 p-5 rounded-xl shadow-sm">
                  <ClipboardCheck className="w-10 h-10 text-indigo-600" />
               </div>
               <div>
                  <h2 className="text-3xl font-black text-slate-800 tracking-tighter">{selectedEntry.batchName}</h2>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">
                      {selectedEntry.strategy === 'multi-sheet' ? 'Split' : 'Unified'} • {new Date(selectedEntry.timestamp).toLocaleString()}
                    </p>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
               <div className="xl:col-span-3 space-y-3">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">{language === 'zh-CN' ? '转换任务模型' : 'Tasks'}</h4>
                  <div className="space-y-2">
                    {selectedEntry.tasks.map((task, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setActiveTaskIdx(idx)}
                        className={`w-full p-5 rounded-xl text-left transition-all border-2 flex flex-col gap-1 ${activeTaskIdx === idx ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-indigo-300'}`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <p className="font-black text-base truncate leading-tight flex-1">{task.modelName}</p>
                          {task.errorCount > 0 && <AlertCircle className={`w-3.5 h-3.5 flex-shrink-0 ml-2 ${activeTaskIdx === idx ? 'text-red-300' : 'text-red-500'}`} />}
                        </div>
                        <p className={`text-[9px] font-bold uppercase tracking-widest ${activeTaskIdx === idx ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {task.rowCount} Rows • {task.errorCount} Issues
                        </p>
                      </button>
                    ))}
                  </div>
               </div>
               
               <div className="xl:col-span-9 space-y-6">
                  <div className="flex items-center justify-between">
                     <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><TableIcon className="w-6 h-6 text-emerald-500" /> {selectedEntry.tasks[activeTaskIdx].modelName} Preview</h3>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-inner h-[550px] flex flex-col">
                    <div className="flex-1 overflow-auto custom-scrollbar">
                       {selectedEntry.tasks[activeTaskIdx].rows.length > 0 ? (
                         <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="bg-white sticky top-0 z-10 shadow-sm border-b-2 border-slate-100">
                               <tr>
                                  <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-r border-slate-100 w-12 text-center">#</th>
                                  <th className="px-6 py-4 font-black text-slate-800 uppercase tracking-widest bg-slate-50 border-r border-slate-100 min-w-[180px]">{tr.fileNameColumn}</th>
                                  {selectedEntry.tasks[activeTaskIdx].fieldMetadata.map((f, i) => (
                                    <th key={i} className="px-6 py-4 font-black text-slate-800 uppercase tracking-widest bg-slate-50 whitespace-nowrap">
                                      {f.name}
                                      <span className={`ml-2 text-[9px] font-black px-1.5 py-0.5 rounded-full ${f.mismatchCount > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                                        ({f.type[0].toUpperCase()} | {f.mismatchCount})
                                      </span>
                                    </th>
                                  ))}
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                               {selectedEntry.tasks[activeTaskIdx].rows.slice(0, 100).map((row, rIdx) => {
                                 const { __source_file__, __source_sheet__, ...dataFields } = row;
                                 const fileNameStr = (row[tr.fileNameColumn] as string) || `${__source_file__ || '?'}_${__source_sheet__ || '?'}`;
                                 return (
                                   <tr key={rIdx} className="hover:bg-indigo-50/20 transition-colors">
                                      <td className="px-6 py-3 text-slate-300 font-black bg-slate-50/30 text-center border-r border-slate-50">{rIdx + 1}</td>
                                      <td className="px-6 py-3 text-slate-400 font-black italic border-r border-slate-50 truncate max-w-[180px]">
                                        {fileNameStr}
                                      </td>
                                      {selectedEntry.tasks[activeTaskIdx].fieldMetadata.map((f, cIdx) => (
                                        <td key={cIdx} className="px-6 py-3 whitespace-nowrap font-bold text-slate-500">
                                          {row[f.name] !== undefined && row[f.name] !== null ? String(row[f.name]) : <span className="text-slate-200 italic font-black">NULL</span>}
                                        </td>
                                      ))}
                                   </tr>
                                 );
                               })}
                            </tbody>
                         </table>
                       ) : (
                         <div className="h-full flex items-center justify-center text-slate-300 italic font-bold">No data</div>
                       )}
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataReview;
