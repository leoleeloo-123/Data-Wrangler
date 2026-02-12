
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import DefinitionManager from './components/DefinitionManager';
import TransformWizard from './components/TransformWizard';
import { DataDefinition, FieldType, TransformationTemplate } from './types';
import { translations } from './translations';
import { 
  LayoutDashboard, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  X,
  Volume2,
  Globe,
  Database,
  ArrowRight,
  Info,
  Settings
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [definitions, setDefinitions] = useState<DataDefinition[]>([]);
  const [templates, setTemplates] = useState<TransformationTemplate[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  // System Config State
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [language, setLanguage] = useState<'en-US' | 'zh-CN'>('zh-CN');

  const t = translations[language];

  // Initialize with dummy data if empty
  useEffect(() => {
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
      case 'history':
        return (
          <div className="p-8 max-w-[1600px] mx-auto">
            <h2 className="text-3xl font-black text-slate-800 mb-8">{t.sidebar.history}</h2>
            <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-32 text-center text-slate-400">
                <Clock className="w-20 h-20 mx-auto mb-6 opacity-10" />
                <p className="text-xl font-bold">No archival logs found.</p>
                <p className="mt-2 font-medium">Completed transformation tasks will appear here.</p>
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
                  <span className={`text-4xl font-black text-${stat.color === 'indigo' ? 'indigo-600' : stat.color === 'emerald' ? 'emerald-500' : 'slate-800'}`}>
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
              <div className="lg:col-span-8 space-y-8">
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
          <div className="relative bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
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
              {/* Voice Switch */}
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

              {/* Language Selection */}
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
    </Layout>
  );
};

export default App;

const PlusCircle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
