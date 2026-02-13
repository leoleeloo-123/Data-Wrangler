
import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  X,
  PlusCircle,
  Hash,
  Type as TypeIcon,
  Calendar,
  ToggleLeft,
  Database,
  Edit,
  ChevronDown
} from 'lucide-react';
import { DataDefinition, FieldDefinition, FieldType } from '../types';
import { translations } from '../translations';

interface DefinitionManagerProps {
  definitions: DataDefinition[];
  onSave: (def: DataDefinition) => void;
  onDelete: (id: string) => void;
  language: 'en-US' | 'zh-CN';
}

const DefinitionManager: React.FC<DefinitionManagerProps> = ({ definitions, onSave, onDelete, language }) => {
  const t = translations[language].definitions;
  const [isEditing, setIsEditing] = useState(false);
  const [currentDef, setCurrentDef] = useState<DataDefinition | null>(null);

  const startNew = () => {
    setCurrentDef({
      id: crypto.randomUUID(),
      name: '',
      description: '',
      fields: [],
      createdAt: new Date().toISOString()
    });
    setIsEditing(true);
  };

  const handleEdit = (def: DataDefinition) => {
    setCurrentDef(JSON.parse(JSON.stringify(def)));
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm(t.deleteConfirm)) {
      onDelete(id);
    }
  };

  const addField = () => {
    if (!currentDef) return;
    const newField: FieldDefinition = {
      id: crypto.randomUUID(),
      name: '',
      type: FieldType.STRING,
      required: true,
      description: ''
    };
    setCurrentDef({ ...currentDef, fields: [...currentDef.fields, newField] });
  };

  const updateField = (index: number, updates: Partial<FieldDefinition>) => {
    if (!currentDef) return;
    const fields = [...currentDef.fields];
    fields[index] = { ...fields[index], ...updates };
    setCurrentDef({ ...currentDef, fields });
  };

  const removeField = (index: number) => {
    if (!currentDef) return;
    const fields = currentDef.fields.filter((_, i) => i !== index);
    setCurrentDef({ ...currentDef, fields });
  };

  return (
    <div className="p-12 max-w-[1600px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-slate-800 tracking-tighter">{t.title}</h1>
          <p className="text-slate-500 font-bold mt-2 text-lg">{t.subtitle}</p>
        </div>
        {!isEditing && (
          <button 
            onClick={startNew}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-[32px] flex items-center gap-3 shadow-2xl shadow-indigo-100 transition-all font-black text-lg transform hover:-translate-y-1 active:scale-95"
          >
            <Plus className="w-6 h-6" />
            {t.createModule}
          </button>
        )}
      </header>

      {!isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {definitions.map((def) => (
            <div key={def.id} className="bg-white p-8 rounded-[40px] border border-slate-200 hover:border-indigo-200 hover:shadow-xl shadow-sm transition-all group flex flex-col">
              <div className="flex justify-between mb-6">
                <div className="bg-indigo-50 p-4 rounded-2xl shadow-sm">
                  <Database className="w-8 h-8 text-indigo-600" />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(def)} className="p-3 text-slate-400 hover:text-indigo-600 bg-white border border-slate-100 rounded-xl shadow-sm"><Edit2 className="w-5 h-5"/></button>
                  <button onClick={() => handleDelete(def.id)} className="p-3 text-slate-400 hover:text-red-600 bg-white border border-slate-100 rounded-xl shadow-sm"><Trash2 className="w-5 h-5"/></button>
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-3 truncate" title={def.name}>{def.name || 'Untitled'}</h3>
              <p className="text-slate-500 font-bold mb-8 line-clamp-3 leading-relaxed">{def.description || '...'}</p>
              
              <div className="mb-8 flex flex-wrap gap-2 min-h-[44px]">
                {def.fields.slice(0, 4).map(f => (
                  <span key={f.id} className="text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-400 px-3 py-1.5 rounded-full border border-slate-100 whitespace-nowrap">
                    {f.name}
                  </span>
                ))}
                {def.fields.length > 4 && <span className="text-[10px] text-slate-400 font-black self-center">+{def.fields.length - 4}</span>}
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{def.fields.length} {language === 'zh-CN' ? '个字段' : 'Fields'}</span>
                <span className="text-xs text-slate-400 font-bold">{t.created} {new Date(def.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {definitions.length === 0 && (
            <div className="col-span-full py-32 text-center border-2 border-dashed border-slate-200 rounded-[48px] bg-white/50">
              <Database className="w-16 h-16 text-slate-300 mx-auto mb-6 opacity-20" />
              <p className="text-slate-500 font-bold text-xl">{t.subtitle}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-[48px] border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{currentDef?.id && !definitions.find(d => d.id === currentDef.id) ? t.newModule : t.editModule}</h2>
            <div className="flex gap-4">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-8 py-4 text-slate-500 hover:bg-white rounded-3xl font-black uppercase tracking-widest text-xs transition-all border border-transparent hover:border-slate-200 shadow-sm"
              >
                {t.cancel}
              </button>
              <button 
                onClick={() => { if(currentDef) onSave(currentDef); setIsEditing(false); }}
                className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-3xl font-black shadow-2xl shadow-indigo-100 transition-all uppercase tracking-widest text-xs transform hover:-translate-y-0.5"
              >
                {t.save}
              </button>
            </div>
          </div>

          <div className="p-12 space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.name}</label>
                </div>
                <input 
                  type="text" 
                  value={currentDef?.name}
                  onChange={(e) => setCurrentDef(prev => prev ? {...prev, name: e.target.value} : null)}
                  placeholder={t.placeholderName}
                  className="w-full px-6 py-4 border border-slate-200 rounded-[28px] font-bold text-lg text-slate-800 bg-slate-50/50 outline-none focus:ring-8 focus:ring-indigo-100 transition-all"
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.desc}</label>
                </div>
                <input 
                  type="text" 
                  value={currentDef?.description}
                  onChange={(e) => setCurrentDef(prev => prev ? {...prev, description: e.target.value} : null)}
                  placeholder={t.placeholderDesc}
                  className="w-full px-6 py-4 border border-slate-200 rounded-[28px] font-bold text-lg text-slate-800 bg-slate-50/50 outline-none focus:ring-8 focus:ring-indigo-100 transition-all"
                />
              </div>
            </div>

            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-4">
                  <div className="bg-indigo-100 p-3 rounded-2xl">
                    <Database className="w-6 h-6 text-indigo-600" />
                  </div>
                  {t.fieldStructure}
                </h3>
                <button 
                  onClick={addField}
                  className="bg-white border-2 border-slate-200 hover:border-indigo-600 hover:text-indigo-600 px-8 py-4 rounded-3xl flex items-center gap-3 text-sm font-black transition-all shadow-sm"
                >
                  <PlusCircle className="w-5 h-5" />
                  {t.addField}
                </button>
              </div>

              <div className="space-y-6">
                {currentDef?.fields.map((field, idx) => (
                  <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start p-10 border border-slate-100 rounded-[40px] bg-slate-50/30 group relative transition-all hover:bg-white hover:border-indigo-100 hover:shadow-xl">
                    <button 
                      onClick={() => removeField(idx)}
                      className="absolute -right-4 -top-4 bg-white shadow-2xl rounded-full p-2.5 text-slate-300 hover:text-red-600 border border-slate-100 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    
                    <div className="md:col-span-3 space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.fieldName}</label>
                      <input 
                        type="text" 
                        value={field.name}
                        onChange={(e) => updateField(idx, { name: e.target.value })}
                        className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl font-bold text-slate-800 bg-white shadow-sm focus:ring-8 focus:ring-indigo-50 transition-all outline-none"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.dataType}</label>
                      <div className="relative">
                        <select 
                          value={field.type}
                          onChange={(e) => updateField(idx, { type: e.target.value as FieldType })}
                          className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl font-bold text-slate-800 bg-white shadow-sm appearance-none focus:ring-8 focus:ring-indigo-50 outline-none transition-all pr-10"
                        >
                          <option value={FieldType.STRING}>String</option>
                          <option value={FieldType.NUMBER}>Number</option>
                          <option value={FieldType.DATE}>Date</option>
                          <option value={FieldType.BOOLEAN}>Boolean</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="md:col-span-2 flex flex-col items-center justify-center space-y-3 pt-8">
                      <label className="flex items-center gap-4 cursor-pointer select-none group/toggle">
                        <div className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={field.required}
                            onChange={(e) => updateField(idx, { required: e.target.checked })}
                          />
                          <div className="w-14 h-8 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                        </div>
                        <span className="text-sm text-slate-700 font-black uppercase tracking-widest">{t.required}</span>
                      </label>
                    </div>

                    <div className="md:col-span-5 space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.desc}</label>
                      <input 
                        type="text" 
                        value={field.description}
                        onChange={(e) => updateField(idx, { description: e.target.value })}
                        className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl font-bold text-slate-800 bg-white shadow-sm focus:ring-8 focus:ring-indigo-50 transition-all outline-none"
                        placeholder="..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DefinitionManager;
