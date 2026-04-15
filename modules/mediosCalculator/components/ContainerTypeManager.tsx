/**
 * ContainerTypeManager — CRUD for container types + project settings.
 */
import React, { useState } from 'react';
import { Plus, Trash2, Save, Package } from 'lucide-react';
import type { ContainerType, MediosProject } from '../types';

interface Props {
  containerTypes: readonly ContainerType[];
  onAdd: (ct: Omit<ContainerType, 'id' | 'createdBy'>) => Promise<ContainerType | null>;
  onUpdate: (id: string, updates: Partial<ContainerType>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  project: MediosProject;
  onUpdateProject: (updates: Partial<{ name: string; description: string; utilizationRate: number; availableM2: number | null }>) => Promise<void>;
}

const EMPTY_CT = {
  name: '',
  lengthMm: 1200,
  widthMm: 800,
  heightMm: 1000,
  weightRefKg: null as number | null,
  maxStacking: 2,
  defaultPcs: null as number | null,
};

export const ContainerTypeManager: React.FC<Props> = ({
  containerTypes, onAdd, onUpdate, onDelete, project, onUpdateProject,
}) => {
  const [adding, setAdding] = useState(false);
  const [newCt, setNewCt] = useState(EMPTY_CT);

  const handleAdd = async () => {
    if (!newCt.name.trim()) return;
    await onAdd(newCt);
    setNewCt(EMPTY_CT);
    setAdding(false);
  };

  return (
    <div className="space-y-8">
      {/* Project Settings */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 text-balance mb-4">Configuracion del Proyecto</h2>
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <div>
            <label className="text-xs text-slate-500 uppercase font-medium block mb-1">Nombre</label>
            <input
              type="text"
              value={project.name}
              onChange={e => onUpdateProject({ name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase font-medium block mb-1">Descripcion</label>
            <input
              type="text"
              value={project.description}
              onChange={e => onUpdateProject({ description: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-400 focus:outline-none"
              placeholder="Opcional"
            />
          </div>
        </div>
      </section>

      {/* Container Types */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-700 text-balance">Tipos de Contenedor</h2>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {containerTypes.length}
            </span>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <Plus size={14} />
            Agregar tipo
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-xs uppercase">
                <th className="px-3 py-2 text-left font-medium">Nombre</th>
                <th className="px-3 py-2 text-right font-medium">Largo (mm)</th>
                <th className="px-3 py-2 text-right font-medium">Ancho (mm)</th>
                <th className="px-3 py-2 text-right font-medium">Alto (mm)</th>
                <th className="px-3 py-2 text-right font-medium">Peso (kg)</th>
                <th className="px-3 py-2 text-right font-medium">Apilado</th>
                <th className="px-3 py-2 text-right font-medium">Pzs/Cont</th>
                <th className="px-3 py-2 text-right font-medium">m2</th>
                <th className="px-3 py-2 text-center font-medium w-12">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {containerTypes.map(ct => (
                <tr key={ct.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-2 font-medium">{ct.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{ct.lengthMm}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{ct.widthMm}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{ct.heightMm}</td>
                  <td className="px-3 py-2 text-right text-slate-500 tabular-nums">{ct.weightRefKg ?? '-'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{ct.maxStacking}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{ct.defaultPcs ?? '-'}</td>
                  <td className="px-3 py-2 text-right text-slate-500 tabular-nums">
                    {((ct.lengthMm / 1000) * (ct.widthMm / 1000)).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onDelete(ct.id)}
                      className="p-1 text-slate-400 hover:text-red-500"
                      aria-label="Eliminar tipo de contenedor"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {adding && (
                <tr className="border-t border-emerald-200 bg-emerald-50/30">
                  <td className="px-3 py-2">
                    <input autoFocus value={newCt.name} onChange={e => setNewCt({ ...newCt, name: e.target.value })}
                      placeholder="Nombre" className="w-full text-sm border rounded px-2 py-1" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={newCt.lengthMm} onChange={e => setNewCt({ ...newCt, lengthMm: parseInt(e.target.value) || 0 })}
                      className="w-20 text-sm border rounded px-2 py-1 text-right" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={newCt.widthMm} onChange={e => setNewCt({ ...newCt, widthMm: parseInt(e.target.value) || 0 })}
                      className="w-20 text-sm border rounded px-2 py-1 text-right" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={newCt.heightMm} onChange={e => setNewCt({ ...newCt, heightMm: parseInt(e.target.value) || 0 })}
                      className="w-20 text-sm border rounded px-2 py-1 text-right" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={newCt.weightRefKg ?? ''} onChange={e => setNewCt({ ...newCt, weightRefKg: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-16 text-sm border rounded px-2 py-1 text-right" placeholder="-" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={newCt.maxStacking} onChange={e => setNewCt({ ...newCt, maxStacking: parseInt(e.target.value) || 1 })}
                      className="w-12 text-sm border rounded px-2 py-1 text-right" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={newCt.defaultPcs ?? ''} onChange={e => setNewCt({ ...newCt, defaultPcs: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-14 text-sm border rounded px-2 py-1 text-right" placeholder="-" />
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-center">
                    <button onClick={handleAdd} className="p-1 text-emerald-600 hover:text-emerald-700" title="Guardar">
                      <Save size={14} />
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
