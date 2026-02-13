
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
  ChevronDown,
  Tag,
  GripVertical,
  Copy
} from 'lucide-react';
import { DataDefinition, FieldDefinition, FieldType, DataGroup } from '../types';
import { translations } from '../translations';

interface DefinitionManagerProps {
  definitions: DataDefinition[];
  groups: DataGroup[];
  onSave: (def: DataDefinition) => void;
  onDelete: (id: string) => void;
  language: 'en-US' | 'zh-CN';
}

const DefinitionManager: React.FC<DefinitionManagerProps> = ({ definitions, groups, onSave, onDelete, language }) => {
  const t = translations[language].definitions;
  const [isEditing, setIsEditing] = useState(false);
  const [currentDef, setCurrentDef] = useState<DataDefinition | null>(null);
  
  // Drag and Drop state
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const startNew = () => {
    setCurrentDef({
      id: crypto.randomUUID(),
      name: '',
      description: '',
      fields: [],
      createdAt: new Date().toISOString(),
      groupId: undefined
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

  const handleDuplicate = () => {
    if (!currentDef) return;
    const duplicate: DataDefinition = {
      ...currentDef,
      id: crypto.randomUUID(),
      name: `${currentDef.name} Copy`,
      createdAt: new Date().toISOString()
    };
    onSave(duplicate);
    setIsEditing(false);
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

  // Drag and Drop Handlers
  const onDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === index) return;
    setDragOverIndex(index);
  };

  const onDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === dropIndex || !currentDef) return;

    const fields = [...currentDef.fields];
    const itemToMove = fields.splice(draggedItemIndex, 1)[0];
    fields.splice(dropIndex, 0, itemToMove);

    setCurrentDef({ ...currentDef, fields });
    setDraggedItemIndex(null);
    setDragOverIndex(null);
  };

  const onDragEnd = () => {
    setDraggedItemIndex(null);
    setDragOverIndex(null);
  };

  // Group definitions by their assigned group
  const groupedDefinitions = groups.map(group => ({
    group,
    defs: definitions.filter(d => d.groupId === group.id)
  })).filter(g => g.defs.length > 0);

  const ungroupedDefs = definitions.filter(d => !d.groupId || !groups.find(g => g.id === d.groupId));

  const renderCard = (def: DataDefinition) => {
    const group = groups.find(g => g.id === def.groupId);
    return (
      <div key={def.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg shadow-sm transition-all group flex flex-col lg:flex-row items-center gap-6">
        {/* Module Identity Section */}
        <div className="flex items-center gap-4 min-w-[280px] max-w-[280px] flex-shrink-0">
          <div className="bg-indigo-50 p-3 rounded-xl shadow-inner flex-shrink-0">
            <Database className="w-8 h-8 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-800 leading-tight truncate" title={def.name}>
              {def.name || 'Untitled'}
            </h3>
            {group ? (
              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest text-white shadow-sm" style={{ backgroundColor: group.color }}>
                {group.name}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ungrouped</p>
            )}
          </div>
        </div>

        {/* Info & Columns Section */}
        <div className="flex-1 min-w-0 space-y-3">
          <p className="text-slate-500 font-medium line-clamp-1 text-xs leading-relaxed">
            {def.description || 'No description available for this module.'}
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-[64px] overflow-y-auto custom-scrollbar">
            {def.fields.map(f => (
              <div key={f.id} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-600 hover:bg-white hover:border-indigo-200 transition-all whitespace-nowrap">
                {f.name}
                <span className="text-[7px] text-slate-300 ml-1 font-bold border-l pl-1.5 border-slate-200">
                  {f.type === FieldType.STRING ? 'STR' : f.type === FieldType.NUMBER ? 'NUM' : f.type === FieldType.DATE ? 'DAT' : 'BOL'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Meta & Actions Section */}
        <div className="flex items-center gap-8 pl-6 border-l border-slate-100 flex-shrink-0 ml-auto">
          <div className="text-right hidden xl:block">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{language === 'zh-CN' ? '创建日期' : 'Created'}</p>
            <p className="text-xs font-black text-slate-700">{new Date(def.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-center mr-4">
              <p className="text-[18px] font-black text-indigo-600 leading-none">{def.fields.length}</p>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{language === 'zh-CN' ? '字段' : 'Fields'}</p>
            </div>
            <button onClick={() => handleEdit(def)} className="p-2.5 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl transition-all shadow-sm">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => handleDelete(def.id)} className="p-2.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-white border border-transparent hover:border-red-100 rounded-xl transition-all shadow-sm">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="px-8 py-10 max-w-[1800px] mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-slate-800 tracking-tighter">{t.title}</h1>
          <p className="text-slate-500 font-bold mt-2 text-lg">{t.subtitle}</p>
        </div>
        {!isEditing && (
          <button 
            onClick={startNew}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-2xl flex items-center gap-3 shadow-xl shadow-indigo-100 transition-all font-black text-lg transform hover:-translate-y-1 active:scale-95"
          >
            <Plus className="w-6 h-6" />
            {t.createModule}
          </button>
        )}
      </header>

      {!isEditing ? (
        <div className="space-y-16">
          {/* Categorized Sections */}
          {groupedDefinitions.map(({ group, defs }) => (
            <section key={group.id} className="space-y-6 animate-in fade-in slide-in-from-left-4">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: group.color }} />
                <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                  {group.name}
                  <span className="text-xs font-black bg-slate-100 text-slate-400 px-2.5 py-0.5 rounded-lg">{defs.length}</span>
                </h2>
              </div>
              <div className="flex flex-col gap-4">
                {defs.map(renderCard)}
              </div>
            </section>
          ))}

          {/* Ungrouped Section */}
          {ungroupedDefs.length > 0 && (
            <section className="space-y-6 animate-in fade-in slide-in-from-left-4">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-8 rounded-full bg-slate-300" />
                <h2 className="text-2xl font-black text-slate-400 tracking-tight flex items-center gap-3">
                  {t.noGroup}
                  <span className="text-xs font-black bg-slate-100 text-slate-300 px-2.5 py-0.5 rounded-lg">{ungroupedDefs.length}</span>
                </h2>
              </div>
              <div className="flex flex-col gap-4">
                {ungroupedDefs.map(renderCard)}
              </div>
            </section>
          )}

          {definitions.length === 0 && (
            <div className="py-48 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
              <Database className="w-20 h-20 text-slate-300 mx-auto mb-6 opacity-20" />
              <p className="text-slate-500 font-bold text-2xl">{t.subtitle}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{currentDef?.id && !definitions.find(d => d.id === currentDef.id) ? t.newModule : t.editModule}</h2>
            <div className="flex gap-4">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-8 py-3 text-slate-500 hover:bg-white rounded-xl font-black uppercase tracking-widest text-xs transition-all border border-transparent hover:border-slate-200 shadow-sm"
              >
                {t.cancel}
              </button>
              <button 
                onClick={handleDuplicate}
                className="px-8 py-3 bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2 shadow-sm"
              >
                <Copy className="w-3.5 h-3.5" />
                {t.duplicate}
              </button>
              <button 
                onClick={() => { if(currentDef) onSave(currentDef); setIsEditing(false); }}
                className="px-10 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-lg shadow-indigo-100 transition-all uppercase tracking-widest text-xs transform hover:-translate-y-0.5"
              >
                {t.save}
              </button>
            </div>
          </div>

          <div className="p-10 space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.name}</label>
                </div>
                <input 
                  type="text" 
                  value={currentDef?.name}
                  onChange={(e) => setCurrentDef(prev => prev ? {...prev, name: e.target.value} : null)}
                  placeholder={t.placeholderName}
                  className="w-full px-6 py-4 border border-slate-200 rounded-xl font-bold text-lg text-slate-800 bg-slate-50/50 outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.group}</label>
                </div>
                <div className="relative">
                  <select 
                    value={currentDef?.groupId || ''}
                    onChange={(e) => setCurrentDef(prev => prev ? {...prev, groupId: e.target.value || undefined} : null)}
                    className="w-full px-6 py-4 border border-slate-200 rounded-xl font-bold text-lg text-slate-800 bg-slate-50/50 outline-none focus:ring-4 focus:ring-indigo-100 transition-all appearance-none"
                  >
                    <option value="">-- {language === 'zh-CN' ? '无组别' : 'No Group'} --</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-4 lg:col-span-3">
                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.desc}</label>
                </div>
                <input 
                  type="text" 
                  value={currentDef?.description}
                  onChange={(e) => setCurrentDef(prev => prev ? {...prev, description: e.target.value} : null)}
                  placeholder={t.placeholderDesc}
                  className="w-full px-6 py-4 border border-slate-200 rounded-xl font-bold text-lg text-slate-800 bg-slate-50/50 outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-4">
                  <div className="bg-indigo-100 p-3 rounded-xl">
                    <Database className="w-6 h-6 text-indigo-600" />
                  </div>
                  {t.fieldStructure}
                </h3>
              </div>

              <div className="space-y-4">
                {currentDef?.fields.map((field, idx) => (
                  <div 
                    key={field.id} 
                    draggable
                    onDragStart={(e) => onDragStart(e, idx)}
                    onDragOver={(e) => onDragOver(e, idx)}
                    onDrop={(e) => onDrop(e, idx)}
                    onDragEnd={onDragEnd}
                    className={`grid grid-cols-1 md:grid-cols-12 gap-4 items-start p-6 border rounded-xl relative transition-all group ${
                      draggedItemIndex === idx ? 'opacity-40 scale-[0.98]' : 'opacity-100'
                    } ${
                      dragOverIndex === idx ? 'border-indigo-400 bg-indigo-50/20' : 'border-slate-100 bg-slate-50/30 hover:bg-white hover:border-indigo-100 hover:shadow-md'
                    }`}
                  >
                    {/* Drag Handle */}
                    <div className="hidden md:flex items-center justify-center pt-8 cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-400">
                      <GripVertical className="w-5 h-5" />
                    </div>

                    <div className="md:col-span-3 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.fieldName}</label>
                      <input 
                        type="text" 
                        value={field.name}
                        onChange={(e) => updateField(idx, { name: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg font-bold text-slate-800 bg-white shadow-sm focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.dataType}</label>
                      <div className="relative">
                        <select 
                          value={field.type}
                          onChange={(e) => updateField(idx, { type: e.target.value as FieldType })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg font-bold text-slate-800 bg-white shadow-sm appearance-none focus:ring-4 focus:ring-indigo-50 outline-none transition-all pr-10"
                        >
                          <option value={FieldType.STRING}>String</option>
                          <option value={FieldType.NUMBER}>Number</option>
                          <option value={FieldType.DATE}>Date</option>
                          <option value={FieldType.BOOLEAN}>Boolean</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
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
                          <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                        </div>
                        <span className="text-xs text-slate-700 font-bold uppercase tracking-widest">{t.required}</span>
                      </label>
                    </div>

                    <div className="md:col-span-4 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.desc}</label>
                      <input 
                        type="text" 
                        value={field.description}
                        onChange={(e) => updateField(idx, { description: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg font-bold text-slate-800 bg-white shadow-sm focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                        placeholder="..."
                      />
                    </div>

                    {/* Delete Button */}
                    <button 
                      onClick={() => removeField(idx)}
                      className="absolute -right-3 -top-3 bg-white shadow-lg rounded-full p-2 text-slate-300 hover:text-red-600 border border-slate-100 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 z-10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* New Add Field Button at Bottom */}
                <button 
                  onClick={addField}
                  className="w-full py-6 border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-600 hover:bg-indigo-50/30 hover:text-indigo-600 flex items-center justify-center gap-3 text-sm font-black text-slate-400 transition-all group"
                >
                  <PlusCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  {t.addField}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DefinitionManager;
