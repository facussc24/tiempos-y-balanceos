/**
 * TaskMaterialsModal - Configure materials and logistics for a task
 * 
 * Allows adding/editing TaskMaterial entries with:
 * - materialId, quantityPerCycle
 * - standardPack (Milk Run bin size)
 * - replenishmentMinutes, safetyMinutes
 * 
 * @module modules/task/modals/TaskMaterialsModal
 * @version 9.0.0
 */

import React, { useState, useEffect } from 'react';
import { X, Package, Truck, Plus, Trash2, Save } from 'lucide-react';
import { ProjectData, TaskMaterial, Task } from '../../../types';

interface TaskMaterialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  data: ProjectData;
  onSave: (materials: TaskMaterial[]) => void;
}

const TaskMaterialsModal: React.FC<TaskMaterialsModalProps> = ({
  isOpen,
  onClose,
  task,
  data,
  onSave
}) => {
  const [materials, setMaterials] = useState<TaskMaterial[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize from task
  useEffect(() => {
    if (task?.materials) {
      setMaterials([...task.materials]);
    } else {
      setMaterials([]);
    }
    setHasChanges(false);
  }, [task]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const availableMaterials = data.materials || [];

  const addMaterial = () => {
    const newMat: TaskMaterial = {
      materialId: '',
      quantityPerCycle: 1,
      standardPack: 10,
      replenishmentMinutes: undefined,
      safetyMinutes: 5
    };
    setMaterials([...materials, newMat]);
    setHasChanges(true);
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const updateMaterial = (index: number, field: keyof TaskMaterial, value: string | number) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    setMaterials(updated);
    setHasChanges(true);
  };

  const handleSave = () => {
    // Filter out empty entries
    const validMaterials = materials.filter(m => m.materialId && m.materialId.trim() !== '');
    onSave(validMaterials);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 text-white p-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package size={24} />
              <div>
                <h2 className="text-xl font-bold">Materiales y Logística</h2>
                <p className="text-blue-100 text-sm">Tarea: {task?.id} - {task?.description}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Cerrar" aria-label="Cerrar materiales"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Legend */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800 flex items-start gap-2">
            <Truck size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <strong>Configuración Milk Run:</strong> Define Q<sub>bin</sub> (piezas por cajón) 
              para calcular <code className="bg-blue-100 px-1 rounded">K = D × (T + Safety) / Q<sub>bin</sub></code>
            </div>
          </div>

          {/* Materials table */}
          {materials.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Package size={48} className="mx-auto mb-3 text-slate-300" />
              <p>No hay materiales configurados para esta tarea.</p>
              <button
                onClick={addMaterial}
                className="mt-3 text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mx-auto"
              >
                <Plus size={16} /> Agregar material
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {materials.map((mat, idx) => (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-lg p-4 bg-slate-50 hover:bg-white transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Material #{idx + 1}
                    </span>
                    <button
                      onClick={() => removeMaterial(idx)}
                      className="text-red-500 hover:text-red-700 p-1.5"
                      title="Eliminar material"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {/* Material selector */}
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Material
                      </label>
                      <select
                        value={mat.materialId}
                        onChange={(e) => updateMaterial(idx, 'materialId', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Seleccionar --</option>
                        {availableMaterials.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity per cycle */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Cantidad/Ciclo
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={mat.quantityPerCycle}
                        onChange={(e) => { const v = parseFloat(e.target.value); updateMaterial(idx, 'quantityPerCycle', isNaN(v) ? 1 : v); }}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Standard Pack (CRITICAL for Milk Run) */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2">
                      <label className="block text-xs font-bold text-indigo-700 mb-1">
                        📦 StandardPack (Q<sub>bin</sub>)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={mat.standardPack ?? 10}
                        onChange={(e) => { const v = parseInt(e.target.value, 10); updateMaterial(idx, 'standardPack', isNaN(v) ? 10 : v); }}
                        className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm font-mono bg-white focus:ring-2 focus:ring-indigo-500"
                        placeholder="Piezas por cajón"
                      />
                    </div>

                    {/* Replenishment time */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Ciclo MR (min)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={mat.replenishmentMinutes ?? ''}
                        onChange={(e) => updateMaterial(idx, 'replenishmentMinutes', e.target.value ? parseInt(e.target.value) : 0)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500"
                        placeholder="Global"
                      />
                    </div>

                    {/* Safety time */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Seguridad (min)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={mat.safetyMinutes ?? 5}
                        onChange={(e) => updateMaterial(idx, 'safetyMinutes', parseInt(e.target.value) || 0)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500"
                        placeholder="5"
                      />
                    </div>
                  </div>

                  {/* Preview Kanban formula */}
                  {mat.materialId && (
                    <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
                      <strong>Fórmula K:</strong> Demanda × ({mat.replenishmentMinutes ?? 'T_global'} + {mat.safetyMinutes ?? 5}) / {mat.standardPack ?? 10}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add button */}
          {materials.length > 0 && (
            <button
              onClick={addMaterial}
              className="mt-4 w-full border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 rounded-lg py-3 flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={18} /> Agregar otro material
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <span className="text-sm text-slate-500">
            {materials.length} material(es) configurado(s)
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save size={18} /> Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskMaterialsModal;
