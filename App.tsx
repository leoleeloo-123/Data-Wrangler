
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import DefinitionManager from './components/DefinitionManager';
import TransformWizard from './components/TransformWizard';
import BatchProcessor from './components/BatchProcessor';
import { DataDefinition, FieldType, TransformationTemplate, BatchConfiguration, BatchTask } from './types';
import { translations } from './translations';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  X,
  Volume2,
  Globe,
  Database,
  ArrowRight,
  Info,
  Settings,
  Share2,
  Download,
  Upload as UploadIcon,
  Layers,
  FileJson,
  PlusCircle,
  User as UserIcon,
  Building as BuildingIcon
} from 'lucide-react';

declare const XLSX: any;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [definitions, setDefinitions] = useState<DataDefinition[]>([]);
  const [templates, setTemplates] = useState<TransformationTemplate[]>([]);
  const [batches, setBatches] = useState<BatchConfiguration[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  
  // User & Company Context
  const [userName, setUserName] = useState(localStorage.getItem('tax-user-name') || '');
  const [companyName, setCompanyName] = useState(localStorage.getItem('tax-company-name') || '');
  
  // System Config State
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [language, setLanguage] = useState<'en-US' | 'zh-CN'>('zh-CN');

  const t = translations[language];

  // Sync Profile to LocalStorage
  useEffect(() => {
    localStorage.setItem('tax-user-name', userName);
  }, [userName]);

  useEffect(() => {
    localStorage.setItem('tax-company-name', companyName);
  }, [companyName]);

  // Initialize data
  useEffect(() => {
    try {
      const savedDefs = localStorage.getItem('tax-definitions');
      if (savedDefs) {
        setDefinitions(JSON.parse(savedDefs));
      } else {
        const initial: DataDefinition[] = [
          {
            id: 'def-1',
            name: 'VAT Monthly Sales (Standard)',
            description: 'Global standardized template for collecting monthly output VAT data from EMEA, APAC, and LATAM regions.',
            createdAt: new Date().toISOString(),
            fields: [
              { id: 'f1', name: 'InvoiceDate', type: FieldType.DATE, required: true, description: 'Date of supply' },
              { id: 'f2', name: 'CustomerName', type: FieldType.STRING, required: true, description: 'B2B/B2C Legal Entity' },
              { id: 'f3', name: 'GrossAmount', type: FieldType.NUMBER, required: true, description: 'Total value including tax' },
              { id: 'f4', name: 'VATRate', type: FieldType.NUMBER, required: false, description: 'Applicable percentage' }
            ]
          }
        ];
        setDefinitions(initial);
        localStorage.setItem('tax-definitions', JSON.stringify(initial));
      }

      const savedTemplates = localStorage.getItem('tax-transformation-templates');
      if (savedTemplates) {
        setTemplates(JSON.parse(savedTemplates));
      }

      const savedBatches = localStorage.getItem('tax-batch-configs');
      if (savedBatches) {
        setBatches(JSON.parse(savedBatches));
      }
    } catch (e) {
      console.error("Failed to initialize data from localStorage", e);
    }
  }, []);

  const saveDefinition = (def: DataDefinition) => {
    const exists = definitions.find(d => d.id === def.id);
    let updated;
    if (exists) {
      updated = definitions.map(d => d.id === def.id ? def : d);
    } else {
      updated = [...definitions, def];
    }
    setDefinitions(updated);
    localStorage.setItem('tax-definitions', JSON.stringify(updated));
  };

  const deleteDefinition = (id: string) => {
    const updated = definitions.filter(d => d.id !== id);
    setDefinitions(updated);
    localStorage.setItem('tax-definitions', JSON.stringify(updated));
  };

  const saveTemplate = (template: TransformationTemplate) => {
    const exists = templates.find(t => t.id === template.id);
    let updated;
    if (exists) {
      updated = templates.map(t => t.id === template.id ? template : t);
    } else {
      updated = [...templates, template];
    }
    setTemplates(updated);
    localStorage.setItem('tax-transformation-templates', JSON.stringify(updated));
  };

  const deleteTemplate = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    localStorage.setItem('tax-transformation-templates', JSON.stringify(updated));
  };

  const saveBatch = (batch: BatchConfiguration) => {
    const exists = batches.find(b => b.id === batch.id);
    let updated;
    if (exists) {
      updated = batches.map(b => b.id === batch.id ? batch : b);
    } else {
      updated = [...batches, batch];
    }
    setBatches(updated);
    localStorage.setItem('tax-batch-configs', JSON.stringify(updated));
  };

  const deleteBatch = (id: string) => {
    const updated = batches.filter(b => b.id !== id);
    setBatches(updated);
    localStorage.setItem('tax-batch-configs', JSON.stringify(updated));
  };

  // Export Logic
  const exportConfig = () => {
    const wb = XLSX.utils.book_new();
    
    // Process Definitions
    const defData = definitions.map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      createdAt: d.createdAt,
      fields: JSON.stringify(d.fields)
    }));
    const defSheet = XLSX.utils.json_to_sheet(defData);
    XLSX.utils.book_append_sheet(wb, defSheet, "Definitions");

    // Process Templates
    const templateData = templates.map(tpl => ({
      id: tpl.id,
      name: tpl.name,
      definitionId: tpl.definitionId,
      sheetName: tpl.sheetName,
      startRow: tpl.startRow,
      endRow: tpl.endRow ?? '',
      exportFileName: tpl.exportFileName,
      exportSheetName: tpl.exportSheetName,
      updatedAt: tpl.updatedAt,
      mapping: JSON.stringify(tpl.mapping),
      expectedHeaders: JSON.stringify(tpl.expectedHeaders || []),
      includeFileName: tpl.includeFileName ? 1 : 0,
      fileNamePosition: tpl.fileNamePosition
    }));
    const templateSheet = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, templateSheet, "Templates");

    // Process Batches
    const batchData = batches.map(b => ({
      id: b.id,
      name: b.name,
      description: b.description,
      createdAt: b.createdAt,
      exportStrategy: b.exportStrategy,
      globalFileName: b.globalFileName || '',
      globalSheetName: b.globalSheetName || '',
      tasks: JSON.stringify(b.tasks.map(task => {
        // We do NOT export actual File objects or processing results (rows)
        // because they are large and file references become stale.
        const { files, results, validationResults, ...rest } = task;
        return {
          ...rest,
          status: 'pending' // Reset status on export/import
        };
      }))
    }));
    const batchSheet = XLSX.utils.json_to_sheet(batchData);
    XLSX.utils.book_append_sheet(wb, batchSheet, "Batches");

    // Format filename: TaxStandard_Config_CompanyName_UserName_DateTime
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
    const safeCompany = (companyName || 'UnknownCompany').replace(/[^a-z0-9]/gi, '_');
    const safeUser = (userName || 'UnknownUser').replace(/[^a-z0-9]/gi, '_');
    
    XLSX.writeFile(wb, `TaxStandard_Config_${safeCompany}_${safeUser}_${dateStr}_${timeStr}.xlsx`);
  };

  // Import Logic
  const handleImport = (file: File, strategy: 'replace' | 'merge') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Parse Definitions
        const defSheet = workbook.Sheets["Definitions"];
        let newDefs: DataDefinition[] = [];
        if (defSheet) {
          const raw = XLSX.utils.sheet_to_json(defSheet);
          newDefs = raw.map((r: any) => ({
            ...r,
            fields: typeof r.fields === 'string' ? JSON.parse(r.fields) : r.fields
          }));
        }

        // Parse Templates
        const templateSheet = workbook.Sheets["Templates"];
        let newTemplates: TransformationTemplate[] = [];
        if (templateSheet) {
          const raw = XLSX.utils.sheet_to_json(templateSheet);
          newTemplates = raw.map((r: any) => ({
            ...r,
            mapping: typeof r.mapping === 'string' ? JSON.parse(r.mapping) : r.mapping,
            expectedHeaders: typeof r.expectedHeaders === 'string' ? JSON.parse(r.expectedHeaders) : (r.expectedHeaders || []),
            includeFileName: Number(r.includeFileName) === 1,
            fileNamePosition: r.fileNamePosition || 'front',
            endRow: r.endRow !== '' ? Number(r.endRow) : undefined
          }));
        }

        // Parse Batches
        const batchSheet = workbook.Sheets["Batches"];
        let newBatches: BatchConfiguration[] = [];
        if (batchSheet) {
          const raw = XLSX.utils.sheet_to_json(batchSheet);
          newBatches = raw.map((r: any) => ({
            ...r,
            tasks: typeof r.tasks === 'string' ? JSON.parse(r.tasks).map((t: any) => ({
              ...t,
              files: [],
              status: 'pending'
            })) : []
          }));
        }

        if (strategy === 'replace') {
          setDefinitions(newDefs);
          setTemplates(newTemplates);
          setBatches(newBatches);
          localStorage.setItem('tax-definitions', JSON.stringify(newDefs));
          localStorage.setItem('tax-transformation-templates', JSON.stringify(newTemplates));
          localStorage.setItem('tax-batch-configs', JSON.stringify(newBatches));
        } else {
          // Merge strategy (Upsert)
          const mergedDefs = [...definitions];
          newDefs.forEach(nd => {
            const idx = mergedDefs.findIndex(d => d.id === nd.id);
            if (idx > -1) mergedDefs[idx] = nd;
            else mergedDefs.push(nd);
          });

          const mergedTemplates = [...templates];
          newTemplates.forEach(nt => {
            const idx = mergedTemplates.findIndex(t => t.id === nt.id);
            if (idx > -1) mergedTemplates[idx] = nt;
            else mergedTemplates.push(nt);
          });

          const mergedBatches = [...batches];
          newBatches.forEach(nb => {
            const idx = mergedBatches.findIndex(b => b.id === nb.id);
            if (idx > -1) mergedBatches[idx] = nb;
            else mergedBatches.push(nb);
          });

          setDefinitions(mergedDefs);
          setTemplates(mergedTemplates);
          setBatches(mergedBatches);
          localStorage.setItem('tax-definitions', JSON.stringify(mergedDefs));
          localStorage.setItem('tax-transformation-templates', JSON.stringify(mergedTemplates));
          localStorage.setItem('tax-batch-configs', JSON.stringify(mergedBatches));
        }

        setIsImportOpen(false);
        setSelectedImportFile(null);
        alert(t.dashboard.importSuccess);
      } catch (err) {
        console.error("Import failed:", err);
        alert(t.dashboard.importError);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'definitions':
        return <DefinitionManager definitions={definitions} onSave={saveDefinition} onDelete={deleteDefinition} language={language} />;
      case 'import':
        return (
          <TransformWizard 
            definitions={definitions} 
            templates={templates} 
            onSaveTemplate={saveTemplate} 
            onDeleteTemplate={deleteTemplate}
            language={language} 
          />
        );
      case 'batch':
        return (
          <BatchProcessor 
            templates={templates} 
            definitions={definitions}
            language={language}
            onSaveBatch={saveBatch}
            batches={batches}
            onDeleteBatch={deleteBatch}
          />
        );
      case 'history':
        return (
          <div className="p-12 max-w-[1600px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4">
            <header>
              <h1 className="text-5xl font-black text-slate-800 tracking-tighter">{t.sidebar.history}</h1>
              <p className="text-slate-500 font-bold mt-2 text-lg">Detailed logs of all standard cleansing and batch transformation activities.</p>
            </header>
            <div className="bg-white rounded-[48px] border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-32 text-center text-slate-400">
                <Clock className="w-24 h-24 mx-auto mb-8 opacity-10" />
                <p className="text-2xl font-black text-slate-300">No archival logs found.</p>
                <p className="mt-4 font-bold text-slate-400">Completed transformation tasks and export history will appear here.</p>
              </div>
            </div>
          </div>
        );
      case 'dashboard':
      default:
        return (
          <div className="p-12 max-w-[1600px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h1 className="text-5xl font-black text-slate-800 tracking-tighter">{t.dashboard.health}</h1>
                <p className="text-slate-500 font-bold mt-2 text-lg">{t.dashboard.monitoring}</p>
              </div>
              <div className="flex gap-4">
                <div className="bg-white border border-slate-200 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-sm border-b-4 border-b-emerald-500">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-black text-slate-600 uppercase tracking-widest">{t.dashboard.syncActive}</span>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { label: t.dashboard.activeModules, value: definitions.length, delta: '+2', color: 'indigo' },
                { label: t.dashboard.standardizedRows, value: '1.4M', color: 'slate' },
                { label: t.dashboard.accuracy, value: '99.4%', color: 'emerald' },
                { label: t.dashboard.exceptions, value: '1,240', color: 'amber' }
              ].map((stat, i) => (
                <div key={i} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col gap-2 group">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">{stat.label}</span>
                  <span className={`text-4xl font-black ${stat.color === 'indigo' ? 'text-indigo-600' : stat.color === 'emerald' ? 'text-emerald-500' : 'text-slate-800'}`}>
                    {stat.value}
                  </span>
                  {stat.delta && (
                    <div className="mt-4 flex items-center gap-1.5 text-[11px] text-emerald-600 font-black bg-emerald-50 self-start px-3 py-1 rounded-full border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {stat.delta} {t.dashboard.thisMonth}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-8 space-y-12">
                <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm space-y-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 text-indigo-50 group-hover:text-indigo-100 transition-colors">
                     <Share2 className="w-24 h-24" />
                  </div>
                  <div className="relative z-10 space-y-4">
                    <h3 className="text-3xl font-black text-slate-800 tracking-tight">{t.dashboard.configMgmt}</h3>
                    <p className="text-slate-500 font-bold max-w-xl text-lg">
                      {t.dashboard.configDesc}
                    </p>
                    <div className="flex flex-wrap gap-4 pt-4">
                      <button 
                        onClick={exportConfig}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-10 py-5 rounded-[32px] shadow-2xl shadow-indigo-100 transition-all flex items-center gap-3 transform hover:-translate-y-1 active:scale-95"
                      >
                        <Download className="w-6 h-6" />
                        {t.dashboard.exportBtn}
                      </button>
                      <button 
                        onClick={() => setIsImportOpen(true)}
                        className="bg-white border-2 border-slate-200 hover:border-indigo-600 hover:text-indigo-600 text-slate-600 font-black px-10 py-5 rounded-[32px] transition-all flex items-center gap-3 transform hover:-translate-y-1 active:scale-95"
                      >
                        <UploadIcon className="w-6 h-6" />
                        {t.dashboard.importBtn}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">{t.dashboard.recentBatches}</h3>
                    <button className="text-indigo-600 font-black text-xs uppercase tracking-widest hover:underline">{t.dashboard.viewAll}</button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {[
                      { title: 'VAT_EMEA_MAR25_Consolidation', user: 'Sarah Jenkins', status: 'Success', time: '1h ago', rows: '45,231' },
                      { title: 'CIT_APAC_Standardization', user: 'David Liu', status: 'Success', time: '3h ago', rows: '12,009' },
                      { title: 'WHT_Annual_Global_Report', user: 'Mark Chen', status: 'Warning', time: '5h ago', rows: '89,322' },
                      { title: 'TAX_UK_Quarterly_Return', user: 'System Automated', status: 'Success', time: '1d ago', rows: '210,000' },
                    ].map((log, i) => (
                      <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 flex items-center justify-between hover:border-indigo-200 hover:shadow-sm transition-all group">
                        <div className="flex items-center gap-6">
                          <div className={`p-4 rounded-2xl ${log.status === 'Success' ? 'bg-emerald-50' : 'bg-amber-50'} group-hover:scale-110 transition-transform`}>
                            {log.status === 'Success' ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <AlertCircle className="w-6 h-6 text-amber-500" />}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{log.title}</p>
                            <p className="text-sm text-slate-400 font-bold">Standardized {log.rows} rows • {log.user}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-slate-400 font-black uppercase tracking-widest">{log.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-10">
                <div className="space-y-6">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">{t.dashboard.quickActions}</h3>
                  <div className="space-y-4">
                    <button 
                      onClick={() => setActiveTab('import')}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 rounded-[32px] shadow-2xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1 text-lg"
                    >
                      <PlusCircle className="w-6 h-6" />
                      {t.dashboard.newBatch}
                    </button>
                    <button 
                      onClick={() => setActiveTab('definitions')}
                      className="w-full bg-white border-2 border-slate-200 hover:border-indigo-200 text-slate-600 font-black py-6 rounded-[32px] transition-all flex items-center justify-center gap-3 text-lg"
                    >
                      <Database className="w-6 h-6" />
                      {t.dashboard.manageModules}
                    </button>
                  </div>
                </div>

                <div className="bg-indigo-900 p-8 rounded-[40px] text-white shadow-2xl shadow-indigo-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                  <div className="relative z-10">
                    <h4 className="font-black text-xl mb-4 flex items-center gap-2">
                      <Info className="w-5 h-5" />
                      {t.dashboard.governanceTip}
                    </h4>
                    <p className="text-sm text-indigo-200 font-bold leading-relaxed mb-6">
                      {t.dashboard.governanceDesc}
                    </p>
                    <button className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-colors">
                      {t.dashboard.learnPolicy} <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      onOpenConfig={() => setIsConfigOpen(true)}
      language={language}
    >
      {renderContent()}

      {/* System Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsConfigOpen(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2.5 rounded-2xl">
                  <Settings className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-800">{t.config.title}</h2>
              </div>
              <button 
                onClick={() => setIsConfigOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-800 bg-white border border-slate-100 rounded-xl shadow-sm transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-10 space-y-10">
              {/* Identity Context Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-xl">
                      <UserIcon className="w-4 h-4 text-indigo-600" />
                    </div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.dashboard.userName}</label>
                  </div>
                  <input 
                    type="text" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    className="w-full px-5 py-3 border border-slate-200 rounded-2xl font-bold text-slate-700 bg-slate-50/50 outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-xl">
                      <BuildingIcon className="w-4 h-4 text-emerald-600" />
                    </div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.dashboard.companyName}</label>
                  </div>
                  <input 
                    type="text" 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Global Tech Solutions"
                    className="w-full px-5 py-3 border border-slate-200 rounded-2xl font-bold text-slate-700 bg-slate-50/50 outline-none focus:ring-4 focus:ring-emerald-100 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 group transition-all hover:bg-white hover:border-indigo-100">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-100 p-3 rounded-2xl group-hover:bg-indigo-600 transition-colors">
                    <Volume2 className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <p className="font-black text-slate-800">{t.config.voice}</p>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{t.config.voiceDesc}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={voiceEnabled}
                    onChange={(e) => setVoiceEnabled(e.target.checked)}
                  />
                  <div className="w-14 h-8 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                </label>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-2">
                  <div className="bg-emerald-100 p-2.5 rounded-xl">
                    <Globe className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest text-sm">{t.config.language}</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'zh-CN', label: '简体中文', icon: '🇨🇳' },
                    { id: 'en-US', label: 'English (US)', icon: '🇺🇸' },
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => setLanguage(lang.id as any)}
                      className={`flex items-center gap-4 p-5 rounded-[24px] border-2 transition-all font-bold ${
                        language === lang.id 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                          : 'border-slate-100 bg-white text-slate-500 hover:border-indigo-100'
                      }`}
                    >
                      <span className="text-2xl">{lang.icon}</span>
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => setIsConfigOpen(false)}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-5 rounded-[28px] shadow-xl transition-all uppercase tracking-[.2em] text-sm"
                >
                  {t.config.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={() => setIsImportOpen(false)} />
           <div className="relative bg-white w-full max-w-2xl rounded-[48px] shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2.5 rounded-2xl">
                    <UploadIcon className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t.dashboard.importTitle}</h2>
                </div>
                <button onClick={() => setIsImportOpen(false)} className="p-2 text-slate-400 hover:text-slate-800 transition-colors">
                  <X className="w-6 h-6" />
                </button>
             </div>

             <div className="p-10 space-y-10">
                <div className="space-y-4">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.dashboard.importLabel}</label>
                   <div className="relative border-2 border-dashed border-slate-200 rounded-[32px] p-12 text-center hover:border-indigo-400 transition-all cursor-pointer group">
                      <input 
                        type="file" 
                        accept=".xlsx, .xls"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setSelectedImportFile(file);
                        }}
                      />
                      <FileJson className={`w-12 h-12 mx-auto mb-4 transition-all ${selectedImportFile ? 'text-indigo-600 scale-110' : 'text-slate-300 group-hover:scale-110 group-hover:text-indigo-400'}`} />
                      <p className={`font-bold transition-colors ${selectedImportFile ? 'text-indigo-900' : 'text-slate-500'}`}>
                        {selectedImportFile ? selectedImportFile.name : 'Drop file here or click to select'}
                      </p>
                   </div>
                </div>

                <div className="space-y-4">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.dashboard.importMode}</label>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button 
                        disabled={!selectedImportFile}
                        onClick={() => selectedImportFile && handleImport(selectedImportFile, 'merge')}
                        className="flex flex-col items-start gap-3 p-6 border-2 border-slate-100 rounded-3xl hover:border-indigo-600 hover:bg-indigo-50 transition-all text-left disabled:opacity-30 disabled:cursor-not-allowed group"
                      >
                         <Layers className="w-8 h-8 text-indigo-600 group-hover:scale-110 transition-transform" />
                         <div>
                            <p className="font-black text-slate-800">{t.dashboard.modeMerge}</p>
                            <p className="text-xs text-slate-400 font-medium mt-1">Smart upsert: Keep your local data and update matching IDs.</p>
                         </div>
                      </button>
                      <button 
                        disabled={!selectedImportFile}
                        onClick={() => {
                          if (selectedImportFile && confirm(language === 'zh-CN' ? '警告：此操作将清空所有现有配置！确定吗？' : 'WARNING: This will wipe all current settings! Are you sure?')) {
                            handleImport(selectedImportFile, 'replace');
                          }
                        }}
                        className="flex flex-col items-start gap-3 p-6 border-2 border-slate-100 rounded-3xl hover:border-red-600 hover:bg-red-50 transition-all text-left disabled:opacity-30 disabled:cursor-not-allowed group"
                      >
                         <X className="w-8 h-8 text-red-600 group-hover:scale-110 transition-transform" />
                         <div>
                            <p className="font-black text-slate-800">{t.dashboard.modeReplace}</p>
                            <p className="text-xs text-slate-400 font-medium mt-1">Full override: Completely replace all local settings with the file content.</p>
                         </div>
                      </button>
                   </div>
                </div>
             </div>
           </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
