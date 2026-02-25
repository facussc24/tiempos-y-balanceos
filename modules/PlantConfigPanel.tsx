/**
 * PlantConfigPanel - UI for managing the central plant asset registry
 * 
 * @module PlantConfigPanel
 * @version 5.0.0 - FIX: Removed redundant Category field (derived from Sector)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Trash2, Edit2, Save, X, Factory, AlertTriangle } from 'lucide-react';
import { MachineType, Sector } from '../types';
import { usePlantAssets } from '../hooks/usePlantAssets';

/**
 * Map sector IDs to icons for visual identification.
 * Falls back to generic icon if sector not found.
 */
const SECTOR_ICONS: Record<string, React.ReactNode> = {
    COSTURA: <span className="text-purple-500">🧵</span>,
    INYECCION: <span className="text-orange-500">💉</span>,
    TAPIZADO: <span className="text-green-500">🛋️</span>,
    EMBALAJE: <span className="text-blue-500">📦</span>,
};

const DEFAULT_ICON = <span className="text-gray-500">⚙️</span>;

/**
 * Get icon for a machine based on its sector
 */
const getMachineIcon = (sectorId: string): React.ReactNode => {
    return SECTOR_ICONS[sectorId] || DEFAULT_ICON;
};

interface NewMachineForm {
    id: string;
    name: string;
    sectorId: string;
    availableUnits: number;
}

const INITIAL_FORM: NewMachineForm = {
    id: '',
    name: '',
    sectorId: '',
    availableUnits: 1
};

export const PlantConfigPanel: React.FC = () => {
    const {
        sectors,
        machines,
        getMachinesBySector,
        addMachine,
        updateMachine, // Needed for Edit
        deleteMachine,
        isLoading,
        error
    } = usePlantAssets();

    /* UX STATE */
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null); // Track Edit Mode
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string, name: string } | null>(null); // Custom Modal

    const [form, setForm] = useState<NewMachineForm>(INITIAL_FORM);
    const [formError, setFormError] = useState<string | null>(null);
    const [selectedSector, setSelectedSector] = useState<string | null>(null);
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    // Helper para clases de input con validación visual
    const getInputClass = useCallback((fieldName: string, hasError: boolean) => {
        const base = "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
        const errorClass = touched[fieldName] && hasError
            ? "border-red-400 bg-red-50"
            : "border-slate-200";
        return `${base} ${errorClass}`;
    }, [touched]);

    const handleEdit = (machine: MachineType) => {
        setEditingId(machine.id);
        setForm({
            id: machine.id,
            name: machine.name,
            sectorId: machine.sectorId,
            availableUnits: machine.availableUnits
        });
        setShowAddForm(true);
        setFormError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        // Validation
        if (!form.id.trim()) {
            setFormError('El ID es requerido');
            return;
        }
        if (!form.name.trim()) {
            setFormError('El nombre es requerido');
            return;
        }
        if (!form.sectorId) {
            setFormError('Debe seleccionar un sector');
            return;
        }

        const machineData: MachineType = {
            id: form.id.trim().toUpperCase(),
            name: form.name.trim(),
            sectorId: form.sectorId,
            availableUnits: form.availableUnits
        };

        let success = false;
        if (editingId) {
            // Update Mode
            success = await updateMachine(editingId, machineData);
        } else {
            // Create Mode
            success = await addMachine(machineData);
        }

        if (success) {
            setForm(INITIAL_FORM);
            setShowAddForm(false);
            setEditingId(null); // Reset Edit Mode
            setTouched({});
        } else {
            setFormError('Error al guardar. Verifique que el ID no esté duplicado.');
        }
    };

    // Trigger Custom Modal
    const confirmDelete = useCallback((id: string, name: string) => {
        setDeleteConfirmation({ id, name });
    }, []);

    // Execute Delete
    const executeDelete = useCallback(async () => {
        if (deleteConfirmation) {
            await deleteMachine(deleteConfirmation.id);
            setDeleteConfirmation(null);
        }
    }, [deleteConfirmation, deleteMachine]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl text-white">
                        <Factory size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Configuración de Planta</h1>
                        <p className="text-sm text-slate-500">Catálogo central de máquinas y recursos</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus size={18} />
                    Agregar Máquina
                </button>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                    {error}
                </div>
            )}

            {/* Configuration Form (Add / Edit) */}
            {showAddForm && (
                <div className="mb-6 p-4 bg-white border border-slate-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                            {editingId ? <Edit2 size={18} className="text-blue-500" /> : <Plus size={18} className="text-green-500" />}
                            {editingId ? 'Editar Máquina' : 'Nueva Máquina'}
                        </h3>
                        <button onClick={() => { setShowAddForm(false); setEditingId(null); setForm(INITIAL_FORM); }} className="text-slate-400 hover:text-slate-600">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">ID (único)</label>
                            <input
                                type="text"
                                value={form.id}
                                onChange={e => setForm({ ...form, id: e.target.value })}
                                onBlur={() => setTouched({ ...touched, id: true })}
                                placeholder="PFAFF-001"
                                className={getInputClass('id', !form.id.trim())}
                                disabled={!!editingId} // Disable ID edit
                                style={editingId ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed' } : {}}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                onBlur={() => setTouched({ ...touched, name: true })}
                                placeholder="Máquina Recta Industrial"
                                className={getInputClass('name', !form.name.trim())}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Sector</label>
                            <select
                                value={form.sectorId}
                                onChange={e => setForm({ ...form, sectorId: e.target.value })}
                                onBlur={() => setTouched({ ...touched, sectorId: true })}
                                className={getInputClass('sectorId', !form.sectorId)}
                            >
                                <option value="">Seleccionar...</option>
                                {sectors.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>



                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad Disponible</label>
                            <input
                                type="number"
                                min={1}
                                max={50} // Increased limit based on user feedback (Costura sometimes has lots)
                                value={form.availableUnits}
                                onChange={e => setForm({ ...form, availableUnits: parseInt(e.target.value) || 1 })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-center"
                            />
                        </div>

                        <div className="flex items-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddForm(false);
                                    setForm(INITIAL_FORM);
                                    setEditingId(null);
                                    setFormError(null);
                                }}
                                className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <X size={16} />
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className={`flex items-center gap-2 px-6 py-2 text-white rounded-lg shadow transition-all ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                <Save size={16} />
                                {editingId ? 'Actualizar' : 'Guardar'}
                            </button>
                        </div>
                    </form>

                    {formError && (
                        <div className="mt-3 p-2 bg-red-50 text-red-600 text-sm rounded border border-red-100 flex items-center gap-2">
                            <AlertTriangle size={16} />
                            {formError}
                        </div>
                    )}
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteConfirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-center mb-4">
                            <div className="bg-red-100 p-3 rounded-full text-red-600">
                                <Trash2 size={32} />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-center text-slate-800 mb-2">¿Eliminar Máquina?</h3>
                        <p className="text-center text-slate-500 text-sm mb-6">
                            Estás a punto de eliminar <strong>{deleteConfirmation.name}</strong> del catálogo global.
                            Esta acción no se puede deshacer.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirmation(null)}
                                className="flex-1 py-2.5 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeDelete}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md transition-colors"
                            >
                                Sí, Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sectors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sectors.map(sector => {
                    const sectorMachines = getMachinesBySector(sector.id);

                    return (
                        <div key={sector.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div
                                className="px-4 py-3 flex items-center justify-between"
                                style={{ backgroundColor: sector.color + '20', borderBottom: `3px solid ${sector.color}` }}
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: sector.color }}
                                    />
                                    <h3 className="font-semibold text-slate-800">{sector.name}</h3>
                                </div>
                                <span className="text-sm text-slate-500">{sectorMachines.length} máquinas</span>
                            </div>

                            <div className="p-4">
                                {sectorMachines.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-4">
                                        No hay máquinas registradas
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {sectorMachines.map(machine => (
                                            <div
                                                key={machine.id}
                                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="text-xl">
                                                        {getMachineIcon(machine.sectorId)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-800">{machine.name}</p>
                                                        <p className="text-xs text-slate-500">
                                                            ID: {machine.id} • Cantidad: {machine.availableUnits}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleEdit(machine)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => confirmDelete(machine.id, machine.name)}
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 bg-slate-100 rounded-xl">
                <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span><strong>{sectors.length}</strong> sectores</span>
                    <span>•</span>
                    <span><strong>{machines.length}</strong> máquinas totales</span>
                </div>
            </div>
        </div>
    );
};
