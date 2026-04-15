import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import type { MediosProject } from '../types';

interface Props {
  projects: MediosProject[];
  activeProject: MediosProject | null;
  loading: boolean;
  onSelect: (id: string) => Promise<void>;
  onCreate: (name: string, description?: string) => Promise<MediosProject | null>;
  onDelete: (id: string) => Promise<void>;
}

export const ProjectSelector: React.FC<Props> = ({
  projects, activeProject, loading, onSelect, onCreate, onDelete,
}) => {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreate(newName.trim());
    setNewName('');
    setCreating(false);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 min-w-[200px]"
      >
        <span className="truncate flex-1 text-left">
          {activeProject ? activeProject.name : 'Seleccionar proyecto...'}
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setCreating(false); }} />
          <div className="absolute right-0 mt-1 w-72 bg-white rounded-lg shadow-lg border border-slate-200 z-20 py-1">
            {projects.map(p => (
              <div
                key={p.id}
                className={`flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer group ${
                  p.id === activeProject?.id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'
                }`}
                onClick={() => { onSelect(p.id); setOpen(false); }}
              >
                <span className="text-sm truncate flex-1">{p.name}</span>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(p.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500"
                  title="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {projects.length === 0 && !creating && (
              <p className="px-3 py-2 text-sm text-slate-400">Sin proyectos</p>
            )}

            <div className="border-t border-slate-100 mt-1 pt-1">
              {creating ? (
                <div className="px-3 py-2 flex gap-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="Nombre del proyecto"
                    className="flex-1 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim()}
                    className="text-sm px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Crear
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50"
                >
                  <Plus size={14} />
                  Nuevo proyecto
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
