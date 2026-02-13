
import React from 'react';
import { translations } from '../translations';
import { 
  LayoutDashboard, 
  Settings, 
  FileUp, 
  ChevronRight, 
  Database,
  Building2,
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
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-800">TaxStandard</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm font-bold' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="text-base">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
              </button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100">
          <button 
            onClick={onOpenConfig}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors font-medium"
          >
            <Settings className="w-5 h-5 text-slate-400" />
            <span className="text-base">{t.sidebar.config}</span>
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