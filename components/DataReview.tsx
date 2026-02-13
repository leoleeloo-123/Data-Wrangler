
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
  FileDown
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

  return (
    <div className="p-12 max-w-[1600px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-slate-800 tracking-tighter">{t.sidebar.review}</h1>
          <p className="text-slate-500 font-bold mt-2 text-lg">
            {language === 'zh-CN' ? '查看并审计已导出的批处理结果快照。' : 'Review and audit exported snapshots of batch transformation results.'}
          </p>
        </div>
      </header>

      {!selectedEntry ? (
        <div className="grid grid-cols-1 gap-6">
          {entries.length > 0 ? (
            entries.map((entry) => (
              <div key={entry.id} className="bg-white p-6 md:p-8 rounded-[48px] border border-slate-200 shadow-sm hover:shadow-xl transition-all flex flex-col md:flex-row items-center gap-8 group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 text-slate-50 group-hover:text-indigo-50/50 transition-colors pointer-events-none">
                  <ClipboardCheck className="w-40 h-40" />
                </div>
                
                <div className="flex-shrink-0 bg-indigo-50 p-5 rounded-[28px] shadow-sm relative z-10">
                  <Layers className="w-10 h-10 text-indigo-600" />
                </div>

                <div className="flex-1 space-y-6 relative z-10 w-full min-w-0">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-4">
                      <h3 className="text-2xl font-black text-slate-800 truncate">{entry.batchName}</h3>
                      <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border ${
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
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" /> {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2.5">
                    {entry.tasks.map((task, idx) => (
                      <span key={idx} className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest shadow-sm">
                        {task.modelName} <span className="text-indigo-400 ml-1">({task.rowCount} ROWS)</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 relative z-10 w-full md:w-auto justify-end border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-8">
                  <button 
                    onClick={() => setSelectedEntry(entry)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all transform hover:-translate-y-0.5 active:scale-95"
                  >
                    <Eye className="w-5 h-5" /> {language === 'zh-CN' ? '查看详情' : 'Inspect'}
                  </button>
                  <button 
                    onClick={() => handleDownloadEntry(entry)}
                    title={language === 'zh-CN' ? '导出 Excel' : 'Download Excel'}
                    className="p-4 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-200 shadow-sm"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => onDeleteEntry(entry.id)}
                    title={language === 'zh-CN' ? '删除记录' : 'Delete Entry'}
                    className="p-4 text-slate-300 hover:text-red-500 bg-slate-50 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-red-100 shadow-sm"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-40 text-center border-2 border-dashed border-slate-200 rounded-[56px] bg-white/50 space-y-6">
              <ClipboardCheck className="w-24 h-24 text-slate-200 mx-auto opacity-30" />
              <p className="text-slate-400 font-black text-xl uppercase tracking-widest">
                {language === 'zh-CN' ? '尚无 Review 记录。' : 'No Data Review records available.'}
              </p>
              <p className="text-slate-300 font-bold max-w-md mx-auto leading-relaxed">
                {language === 'zh-CN' ? '在批量处理界面执行“导出到数据复核”即可在此查看快照。' : 'Export batch results to Review from the Batch Processor to see snapshots here.'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-12 animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedEntry(null)} className="text-indigo-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:underline">
               &larr; {language === 'zh-CN' ? '返回 Review 列表' : 'Back to List'}
            </button>
            <div className="flex gap-4">
              <button onClick={() => handleDownloadEntry(selectedEntry)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-emerald-100 transition-all">
                <Download className="w-5 h-5" /> Export Review (.xlsx)
              </button>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[56px] border border-slate-200 shadow-2xl space-y-10">
            <div className="flex items-center gap-10">
               <div className="bg-indigo-50 p-6 rounded-[32px] shadow-sm">
                  <ClipboardCheck className="w-12 h-12 text-indigo-600" />
               </div>
               <div>
                  <h2 className="text-4xl font-black text-slate-800 tracking-tighter">{selectedEntry.batchName}</h2>
                  <div className="flex items-center gap-4 mt-2">
                    <p className="text-slate-400 font-black uppercase tracking-widest text-sm">{selectedEntry.strategy === 'multi-sheet' ? 'Split Files' : 'Consolidated Sheet'} • Created {new Date(selectedEntry.timestamp).toLocaleString()}</p>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
               <div className="xl:col-span-3 space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">{language === 'zh-CN' ? '转换任务模型' : 'Transformation Tasks'}</h4>
                  <div className="space-y-2">
                    {selectedEntry.tasks.map((task, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setActiveTaskIdx(idx)}
                        className={`w-full p-6 rounded-[32px] text-left transition-all border-2 flex flex-col gap-1 ${activeTaskIdx === idx ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-indigo-300'}`}
                      >
                        <p className="font-black text-lg truncate leading-tight">{task.modelName}</p>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${activeTaskIdx === idx ? 'text-indigo-200' : 'text-slate-400'}`}>{task.rowCount} Rows • {task.sheetName}</p>
                      </button>
                    ))}
                  </div>
               </div>
               
               <div className="xl:col-span-9 space-y-8">
                  <div className="flex items-center justify-between">
                     <h3 className="text-2xl font-black text-slate-800 flex items-center gap-4"><TableIcon className="w-7 h-7 text-emerald-500" /> {selectedEntry.tasks[activeTaskIdx].modelName} Preview</h3>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-[48px] overflow-hidden shadow-inner h-[600px] flex flex-col">
                    <div className="flex-1 overflow-auto custom-scrollbar">
                       {selectedEntry.tasks[activeTaskIdx].rows.length > 0 ? (
                         <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="bg-white sticky top-0 z-10 shadow-sm">
                               <tr>
                                  {Object.keys(selectedEntry.tasks[activeTaskIdx].rows[0]).map((key, i) => (
                                    <th key={i} className="px-6 py-4 font-black text-slate-800 uppercase tracking-widest border-b-2 border-slate-100 whitespace-nowrap">{key}</th>
                                  ))}
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                               {selectedEntry.tasks[activeTaskIdx].rows.slice(0, 100).map((row, rIdx) => (
                                 <tr key={rIdx} className="hover:bg-indigo-50/20 transition-colors">
                                    {Object.values(row).map((val, cIdx) => (
                                      <td key={cIdx} className="px-6 py-4 whitespace-nowrap font-bold text-slate-500">{String(val || '')}</td>
                                    ))}
                                 </tr>
                               ))}
                            </tbody>
                         </table>
                       ) : (
                         <div className="h-full flex items-center justify-center text-slate-300 italic font-bold">No data to display</div>
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
