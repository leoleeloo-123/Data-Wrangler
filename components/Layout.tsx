
import React from 'react';
import { translations } from '../translations';
import { 
  LayoutDashboard, 
  Settings, 
  FileUp, 
  ChevronRight, 
  Database,
  FileBarChart,
  Layers,
  ClipboardCheck
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenConfig: () => void;
  language: 'en-US' | 'zh-CN';
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, onOpenConfig, language }) => {
  const t = translations[language];

  const navItems = [
    { id: 'dashboard', label: t.sidebar.dashboard, icon: LayoutDashboard },
    { id: 'definitions', label: t.sidebar.definitions, icon: Database },
    { id: 'import', label: t.sidebar.transform, icon: FileUp },
    { id: 'batch', label: t.sidebar.batch, icon: Layers },
    { id: 'review', label: t.sidebar.review, icon: ClipboardCheck },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar - Widened slightly to accommodate larger font */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-8 border-b border-slate-100 flex items-center gap-4">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-100">
            <FileBarChart className="w-8 h-8 text-white" />
          </div>
          <span className="font-black text-3xl tracking-tighter text-slate-800">TaxStandard</span>
        </div>
        
        <nav className="flex-1 p-6 space-y-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-5 px-6 py-5 rounded-2xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm font-black' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-bold'
                }`}
              >
                <Icon className={`w-7 h-7 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="text-xl">{item.label}</span>
                {isActive && <ChevronRight className="w-5 h-5 ml-auto opacity-50" />}
              </button>
            );
          })}
        </nav>

        <div className="p-6 mt-auto border-t border-slate-100">
          <button 
            onClick={onOpenConfig}
            className="w-full flex items-center gap-5 px-6 py-5 rounded-2xl text-slate-500 hover:bg-slate-50 transition-colors font-bold"
          >
            <Settings className="w-7 h-7 text-slate-400" />
            <span className="text-xl">{t.sidebar.config}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
        <div className="w-full h-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
