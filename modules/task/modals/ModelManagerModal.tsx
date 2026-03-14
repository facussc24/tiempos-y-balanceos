import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertTriangle, Save, PieChart as PieIcon, Calculator } from 'lucide-react';
import { ProjectData, ProductModel } from '../../../types';
import { formatNumber } from '../../../utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    data: ProjectData;
    updateData: (data: ProjectData) => void;
}

export const ModelManagerModal: React.FC<Props> = ({ isOpen, onClose, data, updateData }) => {
    // Initialize models. 
    // MIGRATION V2.1: If 'units' is not defined, reverse engineer it from DailyDemand * Percentage
    const [models, setModels] = useState<ProductModel[]>([]);

    useEffect(() => {
        if (isOpen) {
            const currentModels = (data.meta.activeModels || []).length > 0
                ? JSON.parse(JSON.stringify(data.meta.activeModels))
                : [{ id: 'default', name: 'Modelo Estándar', percentage: 1.0, color: '#3b82f6', units: data.meta.dailyDemand }];

            // Ensure 'units' are set
            const initializedModels = currentModels.map((m: ProductModel) => ({
                ...m,
                units: m.units ?? Math.round(data.meta.dailyDemand * m.percentage)
            }));
            setModels(initializedModels);
        }
    }, [isOpen, data]);

    const [error, setError] = useState<string | null>(null);

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

    // Computed Values
    const totalUnits = models.reduce((sum, m) => sum + (m.units || 0), 0);

    // We update percentages On-The-Fly for the Chart, but they are technically derived from Units now
    const chartData = models.map(m => ({
        ...m,
        percentage: totalUnits > 0 ? (m.units || 0) / totalUnits : 0
    }));

    const handleAdd = () => {
        const newId = crypto.randomUUID().split('-')[0];
        setModels([...models, {
            id: newId,
            name: `Nuevo Modelo`,
            percentage: 0,
            units: 0,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16)
        }]);
    };

    const handleRemove = (id: string) => {
        if (models.length <= 1) {
            setError("Debe haber al menos un modelo y no puede quedar vacío.");
            return;
        }
        setModels(models.filter(m => m.id !== id));
    };

    const handleChange = (id: string, field: keyof ProductModel, value: any) => {
        setError(null);
        setModels(models.map(m => {
            if (m.id !== id) return m;
            return { ...m, [field]: value };
        }));
    };

    const handleSave = () => {
        if (totalUnits <= 0) {
            setError("La cantidad total de piezas debe ser mayor a 0.");
            return;
        }

        // Finalize Data: Calculate exact percentages derived from units
        const finalizedModels = models.map(m => ({
            ...m,
            percentage: (m.units || 0) / totalUnits
        }));

        // Validations
        // (Floating point check is less critical now as we derive from integers, but sum must be 1.0 logic for engine)

        // Save to Global Data
        const newData = { ...data };
        newData.meta.activeModels = finalizedModels;
        newData.meta.dailyDemand = totalUnits; // SYNC: Update Global Demand

        // Force update of OEE/Eff if needed? 
        // Usually React state updates handle this, but calculating Takt Time might happen in PanelControl based on this new Demand.

        updateData(newData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <PieIcon size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Mix de Producción</h2>
                            <p className="text-xs text-slate-500">Defina la cantidad de piezas por modelo. La demanda total se ajustará automáticamente.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-200 rounded-lg transition-colors" title="Cerrar" aria-label="Cerrar mix de producción">
                        <X size={24} />
                    </button>
                </div>

                {/* Body - Grid Layout */}
                <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">

                    {/* LEFT: Inputs */}
                    <div className="p-6 overflow-y-auto border-r border-slate-100">
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                                <AlertTriangle size={16} />
                                {error}
                            </div>
                        )}

                        <div className="space-y-3">
                            {models.map((model) => (
                                <div key={model.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors group">
                                    {/* Color Indicator */}
                                    <input
                                        type="color"
                                        value={model.color || '#3b82f6'}
                                        onChange={(e) => handleChange(model.id, 'color', e.target.value)}
                                        className="w-8 h-8 rounded cursor-pointer border-none bg-transparent shrink-0"
                                        title="Color de Referencia"
                                    />

                                    {/* Name */}
                                    <div className="flex-1 min-w-0">
                                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Modelo / Referencia</label>
                                        <input
                                            type="text"
                                            value={model.name}
                                            onChange={(e) => handleChange(model.id, 'name', e.target.value)}
                                            className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-sm font-medium focus:outline-none focus:border-blue-500"
                                            placeholder="Ej: Modelo A"
                                        />
                                    </div>

                                    {/* Units Input */}
                                    <div className="w-28">
                                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Piezas</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                value={model.units === 0 ? '' : model.units}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    handleChange(model.id, 'units', isNaN(val) ? 0 : val);
                                                }}
                                                placeholder="0"
                                                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-sm font-bold text-right pr-2 focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Scrap Rate Input - Phase 1 Completion */}
                                    <div className="w-20">
                                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1" title="Este valor infla la demanda de materiales para compensar mermas, asegurando que no falte stock. NO afecta el Takt Time (eso lo hace el OEE).">Scrap %</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                max="20"
                                                step="0.5"
                                                value={(model.scrapRate ?? 0) * 100}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) / 100;
                                                    const clamped = Math.max(0, Math.min(0.20, isNaN(val) ? 0 : val));
                                                    handleChange(model.id, 'scrapRate', clamped);
                                                }}
                                                placeholder="0"
                                                className="w-full bg-white border border-amber-200 rounded px-2 py-1.5 text-sm font-bold text-right focus:outline-none focus:border-amber-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-end pb-0.5">
                                        <button
                                            onClick={() => handleRemove(model.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar Modelo"
                                            disabled={models.length <= 1}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleAdd}
                            className="mt-4 w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium text-sm"
                        >
                            <Plus size={18} /> Agregar Variante
                        </button>
                    </div>

                    {/* RIGHT: Visualization */}
                    <div className="bg-slate-50/50 p-6 flex flex-col items-center justify-center relative border-l border-slate-100">
                        <div className="absolute top-4 right-4 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Demanda Total</div>
                            <div className="text-2xl font-black text-slate-800 flex items-center gap-2">
                                <Calculator size={20} className="text-blue-500" />
                                {formatNumber(totalUnits)} <span className="text-xs font-medium text-slate-400">pzs</span>
                            </div>
                        </div>

                        <div className="w-full h-[300px] mt-8">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="units"
                                        stroke="none"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        formatter={(value: number, name: string, props: any) => [
                                            `${value} pzs (${((value / totalUnits) * 100).toFixed(1)}%)`,
                                            props.payload.name
                                        ]}
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4 w-full max-w-md">
                            {chartData.map(m => (
                                <div key={m.id} className="flex items-center justify-between text-sm p-2 rounded bg-white border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }}></div>
                                        <span className="font-medium text-slate-600 truncate max-w-[100px]" title={m.name}>{m.name}</span>
                                    </div>
                                    <span className="font-bold text-slate-800">{(m.percentage * 100).toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center shrink-0">
                    <div className="text-xs text-slate-400">
                        * Al guardar, se actualizará la Demanda Diaria del proyecto a <strong>{totalUnits}</strong> piezas.
                    </div>

                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium text-sm transition-colors">
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={totalUnits <= 0}
                            className={`px-6 py-2 rounded-lg font-bold text-white shadow-md flex items-center gap-2 transition-all ${totalUnits > 0
                                ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
                                : 'bg-slate-400 cursor-not-allowed opacity-70'
                                }`}
                        >
                            <Save size={18} /> Confirmar Mix
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
