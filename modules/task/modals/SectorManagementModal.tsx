import React, { useState } from 'react';
import { Layers, X, Plus, Trash2, Globe, Download } from 'lucide-react';
import { ProjectData, Sector } from '../../../types';
import { usePlantAssets } from '../../../hooks/usePlantAssets';
import { ConfirmModal } from '../../../components/modals/ConfirmModal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    data: ProjectData;
    updateData: (data: ProjectData) => void;
}

export const SectorManagementModal: React.FC<Props> = ({ isOpen, onClose, data, updateData }) => {
    const [newSectorName, setNewSectorName] = useState("");
    const [newSectorColor, setNewSectorColor] = useState("#3b82f6");
    const [newSectorOEE, setNewSectorOEE] = useState("85");
    const [newSectorSequence, setNewSectorSequence] = useState("1");
    const [activeTab, setActiveTab] = useState<'local' | 'global'>('local');
    const [pendingDeleteSectorId, setPendingDeleteSectorId] = useState<string | null>(null);

    const { sectors: globalSectors } = usePlantAssets();

    if (!isOpen) return null;

    const sectorsList = data.sectors || [];

    // Calculate next available sequence
    const getNextSequence = () => {
        const usedSequences = sectorsList.map(s => s.sequence || 0);
        for (let i = 1; i <= 20; i++) {
            if (!usedSequences.includes(i)) return i.toString();
        }
        return "1";
    };

    const addSector = () => {
        if (!newSectorName.trim()) return;
        const newSector: Sector = {
            id: Math.random().toString(36).substr(2, 5).toUpperCase(),
            name: newSectorName,
            color: newSectorColor,
            targetOee: Math.max(0.01, parseFloat(newSectorOEE) / 100),
            sequence: Math.min(20, Math.max(1, parseInt(newSectorSequence) || 1))
        };
        updateData({ ...data, sectors: [...sectorsList, newSector] });
        setNewSectorName("");
        setNewSectorOEE("85");
        setNewSectorSequence(getNextSequence());
    };

    const importGlobalSector = (sector: Sector) => {
        if (sectorsList.some(s => s.id === sector.id)) return;
        updateData({ ...data, sectors: [...sectorsList, sector] });
    };

    const deleteSector = (id: string) => {
        const newSectors = sectorsList.filter(s => s.id !== id);
        const newTasks = data.tasks.map(t => t.sectorId === id ? { ...t, sectorId: undefined } : t);
        updateData({ ...data, sectors: newSectors, tasks: newTasks });
    };

    const updateSector = (id: string, updates: Partial<Sector>) => {
        const newSectors = sectorsList.map(s =>
            s.id === id ? { ...s, ...updates } : s
        );
        updateData({ ...data, sectors: newSectors });
    };

    // Sort sectors by sequence for display
    const sortedSectors = [...sectorsList].sort((a, b) => (a.sequence || 99) - (b.sequence || 99));

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">

                {/* HEADER - Diseño moderno con gradiente */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-xl">
                                <Layers size={24} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-lg">Gestión de Sectores</h3>
                                <p className="text-blue-100 text-sm">Define el orden del flujo productivo</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/70 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all"
                        >
                            <X size={22} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={() => setActiveTab('local')}
                            title="Sectores específicos de este proyecto"
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'local'
                                ? 'bg-white text-blue-600 shadow-lg'
                                : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            📋 Proyecto
                        </button>
                        <button
                            onClick={() => setActiveTab('global')}
                            title="Sectores compartidos entre todos los proyectos de la planta"
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'global'
                                ? 'bg-white text-purple-600 shadow-lg'
                                : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            <Globe size={16} /> Planta Global
                        </button>
                    </div>
                </div>

                {/* BODY */}
                <div className="p-6">
                    {activeTab === 'local' ? (
                        <>
                            {/* FORMULARIO DE CREACIÓN - Diseño de tarjeta */}
                            <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-5 rounded-xl border-2 border-dashed border-blue-200 mb-6">
                                <h4 className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2">
                                    <Plus size={18} className="text-blue-500" />
                                    Agregar Nuevo Sector
                                </h4>

                                <div className="grid grid-cols-12 gap-3">
                                    {/* Orden */}
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold text-slate-500 block mb-1">Orden</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="20"
                                            className="w-full h-11 border-2 border-slate-200 rounded-lg text-base font-bold text-center text-slate-700 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                            value={newSectorSequence}
                                            onChange={e => {
                                                const val = Math.min(20, Math.max(1, parseInt(e.target.value) || 1));
                                                setNewSectorSequence(val.toString());
                                            }}
                                        />
                                    </div>

                                    {/* Nombre */}
                                    <div className="col-span-5">
                                        <label className="text-xs font-semibold text-slate-500 block mb-1">Nombre</label>
                                        <input
                                            placeholder="Ej: Costura, Corte..."
                                            className="w-full h-11 border-2 border-slate-200 px-3 rounded-lg text-sm text-slate-700 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                            value={newSectorName}
                                            onChange={e => setNewSectorName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addSector()}
                                        />
                                    </div>

                                    {/* OEE */}
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold text-slate-500 block mb-1">OEE %</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            className="w-full h-11 border-2 border-slate-200 rounded-lg text-base font-bold text-center text-slate-700 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                            value={newSectorOEE}
                                            onChange={e => setNewSectorOEE(e.target.value)}
                                        />
                                    </div>

                                    {/* Color */}
                                    <div className="col-span-1">
                                        <label className="text-xs font-semibold text-slate-500 block mb-1">Color</label>
                                        <input
                                            type="color"
                                            className="w-full h-11 border-2 border-slate-200 rounded-lg cursor-pointer p-1"
                                            value={newSectorColor}
                                            onChange={e => setNewSectorColor(e.target.value)}
                                        />
                                    </div>

                                    {/* Botón Agregar */}
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold text-transparent block mb-1">.</label>
                                        <button
                                            onClick={addSector}
                                            disabled={!newSectorName.trim()}
                                            title={!newSectorName.trim() ? "Ingresa un nombre para agregar el sector" : "Agregar sector"}
                                            className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all flex items-center justify-center gap-1 shadow-md hover:shadow-lg"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* LISTA DE SECTORES */}
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {sortedSectors.length === 0 && (
                                    <div className="text-center py-8 text-slate-400">
                                        <Layers size={40} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">No hay sectores definidos</p>
                                        <p className="text-xs">Agrega sectores arriba para comenzar</p>
                                    </div>
                                )}

                                {sortedSectors.map(s => (
                                    <div
                                        key={s.id}
                                        className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all group"
                                    >
                                        {/* Orden - Input editable */}
                                        <input
                                            type="number"
                                            min="1"
                                            max="20"
                                            className="w-12 h-10 border-2 border-slate-200 rounded-lg text-lg font-bold text-center text-blue-600 bg-slate-50 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                            value={s.sequence ?? ''}
                                            placeholder="?"
                                            onChange={e => {
                                                // Allow empty string during editing
                                                const rawVal = e.target.value;
                                                if (rawVal === '') {
                                                    updateSector(s.id, { sequence: undefined });
                                                } else {
                                                    const parsed = parseInt(rawVal);
                                                    if (!isNaN(parsed)) {
                                                        updateSector(s.id, { sequence: parsed });
                                                    }
                                                }
                                            }}
                                            onBlur={e => {
                                                // Clamp value on blur
                                                const val = parseInt(e.target.value);
                                                if (isNaN(val) || val < 1) {
                                                    updateSector(s.id, { sequence: 1 });
                                                } else if (val > 20) {
                                                    updateSector(s.id, { sequence: 20 });
                                                }
                                            }}
                                        />

                                        {/* Color - Picker editable */}
                                        <input
                                            type="color"
                                            className="w-10 h-10 border-2 border-slate-200 rounded-lg cursor-pointer p-1 hover:border-blue-400 transition-all"
                                            value={s.color || '#3b82f6'}
                                            onChange={e => updateSector(s.id, { color: e.target.value })}
                                        />

                                        {/* Nombre y OEE - Editables inline */}
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <input
                                                type="text"
                                                className="w-full font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 text-sm transition-all rounded"
                                                value={s.name}
                                                onChange={e => updateSector(s.id, { name: e.target.value })}
                                            />
                                            <div className="flex items-center gap-1 text-xs text-slate-500">
                                                <span>OEE:</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    className="w-14 text-center font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none text-blue-600 transition-all rounded"
                                                    value={s.targetOee ? Math.round(s.targetOee * 100) : 85}
                                                    onChange={e => {
                                                        const v = Math.min(100, Math.max(1, parseInt(e.target.value) || 85));
                                                        updateSector(s.id, { targetOee: v / 100 });
                                                    }}
                                                />
                                                <span>%</span>
                                            </div>
                                        </div>

                                        {/* Eliminar */}
                                        <button
                                            onClick={() => setPendingDeleteSectorId(s.id)}
                                            className="p-2 text-slate-300 hover:text-white hover:bg-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            title="Eliminar sector"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Footer info */}
                            {sortedSectors.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                                    <p className="text-xs text-slate-400">
                                        {sortedSectors.length} sector{sortedSectors.length !== 1 ? 'es' : ''} definido{sortedSectors.length !== 1 ? 's' : ''} •
                                        El orden determina el flujo de producción
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        /* TAB GLOBAL - Sin cambios */
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500 mb-4">
                                Importa sectores definidos en el catálogo global de planta.
                            </p>
                            <div className="space-y-2 max-h-80 overflow-y-auto">
                                {globalSectors.map(s => {
                                    const isImported = sectorsList.some(local => local.id === s.id);
                                    return (
                                        <div key={s.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg shadow-sm border border-black/10" style={{ backgroundColor: s.color }}></div>
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">{s.name}</div>
                                                    <div className="text-xs text-slate-500">OEE: {(s.targetOee || 0.85) * 100}%</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => importGlobalSector(s)}
                                                disabled={isImported}
                                                className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${isImported
                                                    ? 'bg-green-100 text-green-700 cursor-default'
                                                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md'
                                                    }`}
                                            >
                                                {isImported ? '✓ Importado' : <><Download size={14} /> Importar</>}
                                            </button>
                                        </div>
                                    );
                                })}
                                {globalSectors.length === 0 && (
                                    <div className="p-6 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                                        No hay sectores globales definidos.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sector Deletion Confirmation */}
            <ConfirmModal
                isOpen={!!pendingDeleteSectorId}
                onClose={() => setPendingDeleteSectorId(null)}
                onConfirm={() => {
                    if (pendingDeleteSectorId) {
                        deleteSector(pendingDeleteSectorId);
                        setPendingDeleteSectorId(null);
                    }
                }}
                title="Eliminar Sector"
                message={`¿Eliminar el sector "${sectorsList.find(s => s.id === pendingDeleteSectorId)?.name || ''}"?\n\n${data.tasks.filter(t => t.sectorId === pendingDeleteSectorId).length} tarea(s) serán movidas a "General".`}
                confirmText="Eliminar Sector"
                variant="danger"
            />
        </div>
    );
};
