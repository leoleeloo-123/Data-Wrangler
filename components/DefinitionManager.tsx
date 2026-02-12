
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
  Edit
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
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">{t.title}</h1>
          <p className="text-slate-500">{t.subtitle}</p>
        </div>
        <button 
          onClick={startNew}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all font-semibold"
        >
          <Plus className="w-5 h-5" />
          {t.createModule}
        </button>
      </div>

      {!isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {definitions.map((def) => (
            <div key={def.id} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-md shadow-sm transition-all group flex flex-col">
              <div className="flex justify-between mb-4">
                <div className="bg-indigo-50 p-3 rounded-xl">
                  <Database className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(def)} className="p-2 text-slate-400 hover:text-indigo-600 bg-white border border-slate-100 rounded-lg shadow-sm"><Edit2 className="w-4 h-4"/></button>
                  <button onClick={() => handleDelete(def.id)} className="p-2 text-slate-400 hover:text-red-600 bg-white border border-slate-100 rounded-lg shadow-sm"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 truncate" title={def.name}>{def.name || 'Untitled'}</h3>
              <p className="text-sm text-slate-500 mb-6 line-clamp-3 h-15 overflow-hidden">{def.description || '...'}</p>
              
              <div className="mb-6 flex flex-wrap gap-1.5 min-h-[44px]">
                {def.fields.slice(0, 4).map(f => (
                  <span key={f.id} className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-0.5 rounded whitespace-nowrap">
                    {f.name}
                  </span>
                ))}
                {def.fields.length > 4 && <span className="text-[10px] text-slate-400 font-bold self-center">+{def.fields.length - 4}</span>}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                <span className="text-xs font-semibold text-slate-400">{def.fields.length} {language === 'zh-CN' ? '个字段' : 'Fields'}</span>
                <span className="text-xs text-slate-400 italic">{t.created} {new Date(def.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {definitions.length === 0 && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white/50">
              <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">{t.subtitle}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-800">{currentDef?.id && !definitions.find(d => d.id === currentDef.id) ? t.newModule : t.editModule}</h2>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
              >
                {t.cancel}
              </button>
              <button 
                onClick={() => { if(currentDef) onSave(currentDef); setIsEditing(false); }}
                className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all"
              >
                {t.save}
              </button>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">{t.name}</label>
                <input 
                  type="text" 
                  value={currentDef?.name}
                  onChange={(e) => setCurrentDef(prev => prev ? {...prev, name: e.target.value} : null)}
                  placeholder={t.placeholderName}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">{t.desc}</label>
                <input 
                  type="text" 
                  value={currentDef?.description}
                  onChange={(e) => setCurrentDef(prev => prev ? {...prev, description: e.target.value} : null)}
                  placeholder={t.placeholderDesc}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-500" />
                  {t.fieldStructure}
                </h3>
                <button 
                  onClick={addField}
                  className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors border border-indigo-100"
                >
                  <PlusCircle className="w-4 h-4" />
                  {t.addField}
                </button>
              </div>

              <div className="space-y-4">
                {currentDef?.fields.map((field, idx) => (
                  <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start p-6 border border-slate-100 rounded-3xl bg-slate-50/30 group relative transition-all hover:bg-white hover:border-indigo-100 hover:shadow-sm">
                    <button 
                      onClick={() => removeField(idx)}
                      className="absolute -right-3 -top-3 bg-white shadow-md rounded-full p-1.5 text-slate-300 hover:text-red-500 border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    
                    <div className="md:col-span-3 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.fieldName}</label>
                      <input 
                        type="text" 
                        value={field.name}
                        onChange={(e) => updateField(idx, { name: e.target.value })}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.dataType}</label>
                      <select 
                        value={field.type}
                        onChange={(e) => updateField(idx, { type: e.target.value as FieldType })}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white shadow-sm appearance-none focus:ring-2 focus:ring-indigo-100 outline-none"
                      >
                        <option value={FieldType.STRING}>String</option>
                        <option value={FieldType.NUMBER}>Number</option>
                        <option value={FieldType.DATE}>Date</option>
                        <option value={FieldType.BOOLEAN}>Boolean</option>
                      </select>
                    </div>

                    <div className="md:col-span-2 flex flex-col items-center justify-center space-y-2 pt-6">
                      <label className="flex items-center gap-3 cursor-pointer select-none group/toggle">
                        <div className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={field.required}
                            onChange={(e) => updateField(idx, { required: e.target.checked })}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </div>
                        <span className="text-sm text-slate-600 font-bold">{t.required}</span>
                      </label>
                    </div>

                    <div className="md:col-span-5 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.desc}</label>
                      <input 
                        type="text" 
                        value={field.description}
                        onChange={(e) => updateField(idx, { description: e.target.value })}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-100 outline-none"
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
