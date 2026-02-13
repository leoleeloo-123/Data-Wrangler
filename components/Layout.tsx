
import React, { useState, useEffect } from 'react';
import { translations } from '../translations';
import { 
  LayoutDashboard, 
  Settings, 
  FileUp, 
  ChevronRight, 
  Database,
  FileBarChart,
  Layers,
  ClipboardCheck,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

interface LayoutProps {
  children: React.Node;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenConfig: () => void;
  language: 'en-US' | 'zh-CN';
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, onOpenConfig, language }) => {
  const t = translations[language];
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Responsive behavior: auto-collapse on smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      <aside 
        className={`${
          isCollapsed ? 'w-24' : 'w-80'
        } bg-white border-r border-slate-200 flex flex-col flex-shrink-0 h-full transition-all duration-300 ease-in-out relative z-50`}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-4 top-10 bg-white border border-slate-200 rounded-full p-1.5 shadow-md text-slate-400 hover:text-indigo-600 hover:scale-110 transition-all z-50"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>

        {/* Header - Fixed */}
        <div className={`p-8 border-b border-slate-100 flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'} flex-shrink-0 overflow-hidden`}>
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-100 flex-shrink-0">
            <FileBarChart className="w-8 h-8 text-white" />
          </div>
          {!isCollapsed && (
            <span className="font-black text-3xl tracking-tighter text-slate-800 whitespace-nowrap animate-in fade-in duration-500">
              TaxStandard
            </span>
          )}
        </div>
        
        {/* Nav - Scrollable */}
        <nav className="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar overflow-x-hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={isCollapsed ? item.label : ''}
                className={`w-full flex items-center transition-all duration-300 rounded-2xl ${
                  isCollapsed ? 'justify-center p-4' : 'gap-5 px-6 py-5'
                } ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm font-black' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-bold'
                }`}
              >
                <Icon className={`w-7 h-7 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {!isCollapsed && (
                  <>
                    <span className="text-xl whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">{item.label}</span>
                    {isActive && <ChevronRight className="w-5 h-5 ml-auto opacity-50" />}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer - Fixed */}
        <div className="p-4 border-t border-slate-100 flex-shrink-0">
          <button 
            onClick={onOpenConfig}
            title={isCollapsed ? t.sidebar.config : ''}
            className={`w-full flex items-center transition-colors font-bold rounded-2xl text-slate-500 hover:bg-slate-50 ${
              isCollapsed ? 'justify-center p-4' : 'gap-5 px-6 py-5'
            }`}
          >
            <Settings className="w-7 h-7 text-slate-400 flex-shrink-0" />
            {!isCollapsed && (
              <span className="text-xl whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
                {t.sidebar.config}
              </span>
            )}
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
