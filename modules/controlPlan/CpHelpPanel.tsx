/**
 * Control Plan Inline Help Panel
 *
 * Quick-reference panel for AIAG Control Plan 1st Ed (2024).
 * Displays column descriptions, keyboard shortcuts, and phase/sampling rules.
 */
import React, { useState, useEffect } from 'react';
import { X, BookOpen, Keyboard, Layers, ClipboardList, Settings2 } from 'lucide-react';

type HelpTab = 'columns' | 'shortcuts' | 'phases';

interface CpHelpPanelProps {
    onClose: () => void;
}

// ============================================================================
// COLUMN DATA (AIAG CP 2024 — 14 columns)
// ============================================================================

const CP_COLUMN_INFO = [
    { group: 'Proceso', items: [
        { col: 'Nro. Parte/Proceso', required: true, autoFill: false, desc: 'Número de referencia del paso del proceso. Tomado del diagrama de flujo.' },
        { col: 'Descripción Proceso', required: true, autoFill: false, desc: 'Descripción de la operación. Debe coincidir con diagrama de flujo y AMFE.' },
        { col: 'Máquina/Dispositivo', required: false, autoFill: false, desc: 'Equipo, máquina o herramienta utilizada en la operación.' },
    ]},
    { group: 'Características', items: [
        { col: 'Nro. Característica', required: false, autoFill: false, desc: 'Número de referencia cruzada con plano y AMFE.' },
        { col: 'Producto', required: true, autoFill: false, desc: 'Propiedad/dimensión del producto medida tras el proceso.' },
        { col: 'Proceso', required: false, autoFill: false, desc: 'Variable de proceso con relación causa-efecto con el producto.' },
        { col: 'Clasif. Caract. Esp.', required: false, autoFill: false, desc: 'CC (Crítica, S>=9), SC (Significativa, S=5-8), o PTC (Pass-Through, proveedor) per IATF 16949 / CP-1 2024.' },
    ]},
    { group: 'Métodos', items: [
        { col: 'Especificación/Tolerancia', required: false, autoFill: false, desc: 'Rango de aceptación. NUNCA auto-llenado (viene de ingeniería de diseño).' },
        { col: 'Técnica Evaluación', required: false, autoFill: true, desc: 'Sistema de medición (calibre, CMM, visual, etc.). Sugerido por IA.' },
        { col: 'Tamaño Muestra', required: true, autoFill: true, desc: 'Cantidad de piezas por muestreo. Auto-llenado según AP y fase.' },
        { col: 'Frecuencia', required: false, autoFill: true, desc: 'Periodicidad del muestreo. Auto-llenado según AP y fase.' },
        { col: 'Método Control', required: true, autoFill: true, desc: 'Poka-Yoke, SPC, checklist, etc. Obligatorio para CC/SC y AP=H.' },
        { col: 'Plan Reacción', required: true, autoFill: true, desc: 'Acciones correctivas ante no conformidad. Auto-llenado según severidad.' },
        { col: 'Responsable Reacción', required: true, autoFill: false, desc: 'Persona en piso. NUNCA auto-llenado. Obligatorio per CP 2024.' },
    ]},
];

// ============================================================================
// SHORTCUTS DATA
// ============================================================================

const SHORTCUTS = [
    { category: 'General', items: [
        { keys: 'Ctrl+S', desc: 'Guardar proyecto' },
        { keys: 'Ctrl+Z', desc: 'Deshacer último cambio' },
        { keys: 'Ctrl+Y', desc: 'Rehacer cambio' },
        { keys: 'Ctrl+D', desc: 'Alternar modo Vista/Edicion' },
        { keys: 'Ctrl+N', desc: 'Agregar item al final' },
        { keys: 'Ctrl+F', desc: 'Buscar/filtrar en tabla' },
        { keys: 'Escape', desc: 'Cerrar paneles abiertos' },
        { keys: 'Alt (hold)', desc: 'Mostrar atajos en botones' },
    ]},
    { category: 'Paneles', items: [
        { keys: 'Ctrl+E', desc: 'Abrir/cerrar Resumen' },
        { keys: 'Ctrl+H', desc: 'Abrir/cerrar Referencia Rapida' },
    ]},
    { category: 'Tabla', items: [
        { keys: 'Tab', desc: 'Siguiente celda' },
        { keys: 'Shift+Tab', desc: 'Celda anterior' },
        { keys: 'Enter', desc: 'Confirmar y avanzar' },
    ]},
];

// ============================================================================
// PHASE DATA (AIAG CP 2024 — 2 phases + sampling rules)
// ============================================================================

const PHASES = [
    {
        phase: 'Pre-Lanzamiento',
        code: 'preLaunch',
        color: 'bg-amber-100 text-amber-800 border-amber-200',
        desc: 'Corrida piloto de produccion. Inspeccion intensiva para validar proceso.',
        sampling: [
            { ap: 'H', size: '100%', freq: 'Cada pieza' },
            { ap: 'M', size: '100%', freq: 'Cada pieza' },
            { ap: 'L', size: '5 piezas', freq: 'Cada turno' },
        ],
    },
    {
        phase: 'Produccion',
        code: 'production',
        color: 'bg-green-100 text-green-800 border-green-200',
        desc: 'Produccion serie. Muestreo basado en CPK y estabilidad del proceso.',
        sampling: [
            { ap: 'H', size: '100%', freq: 'Cada pieza' },
            { ap: 'M (S>=9)', size: '5 piezas', freq: 'Cada hora' },
            { ap: 'M (S<9)', size: '5 piezas', freq: 'Cada turno' },
            { ap: 'L', size: 'A discrecion', freq: 'A discrecion' },
        ],
    },
];

const AP_DEFAULTS = [
    { level: 'H', label: 'Alto', color: 'bg-red-100 text-red-800 border-red-300', rules: 'Muestreo 100% obligatorio. Control Method requerido. Plan de reaccion: detener linea, escalar, segregar.' },
    { level: 'M', label: 'Medio', color: 'bg-amber-100 text-amber-800 border-amber-300', rules: 'Muestreo intensivo (varia por fase). Evaluar mejora de prevencion o deteccion.' },
    { level: 'L', label: 'Bajo', color: 'bg-green-100 text-green-800 border-green-300', rules: 'Muestreo a discrecion del equipo. Monitorear tendencias.' },
];

// ============================================================================
// COMPONENT
// ============================================================================

const CpHelpPanel: React.FC<CpHelpPanelProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<HelpTab>('columns');

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const tabs: { id: HelpTab; label: string; icon: React.ReactNode }[] = [
        { id: 'columns', label: 'Columnas', icon: <ClipboardList size={14} /> },
        { id: 'shortcuts', label: 'Atajos', icon: <Keyboard size={14} /> },
        { id: 'phases', label: 'Fases', icon: <Layers size={14} /> },
    ];

    return (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation" onClick={onClose}>
            <div className="absolute inset-0 bg-black/20 animate-in fade-in duration-150" />
            <div
                className="relative w-[520px] max-w-full bg-white shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-emerald-50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <BookOpen size={18} className="text-teal-600" />
                        <div>
                            <h3 className="text-sm font-bold text-gray-800">Referencia Rapida CP</h3>
                            <p className="text-[10px] text-gray-500">AIAG Control Plan 1st Ed (2024)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition" title="Cerrar referencia" aria-label="Cerrar referencia">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-4 pt-2 gap-1 flex-shrink-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t transition border-b-2 -mb-px ${
                                activeTab === tab.id
                                    ? 'border-teal-600 text-teal-700 bg-teal-50/50'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === 'columns' && <ColumnsTab />}
                    {activeTab === 'shortcuts' && <ShortcutsTab />}
                    {activeTab === 'phases' && <PhasesTab />}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// COLUMNS TAB
// ============================================================================

function ColumnsTab() {
    return (
        <div className="space-y-5">
            {/* Family FMEA Info */}
            <div className="border border-emerald-200 rounded-lg overflow-hidden">
                <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-200">
                    <h5 className="text-xs font-bold text-emerald-800">Familias de Productos (AIAG-VDA)</h5>
                </div>
                <div className="px-3 py-2 text-[11px] text-gray-600 space-y-1.5">
                    <p>
                        El Plan de Control puede cubrir una <strong>familia de productos</strong> — piezas
                        similares que comparten proceso, modos de falla y controles.
                    </p>
                    <p>
                        Al generar el CP desde el AMFE, el campo <strong>"Piezas Aplicables"</strong> se
                        copia automaticamente del AMFE. Si necesita ajustarlo, editelo en el encabezado del CP.
                    </p>
                    <p className="text-[10px] text-gray-500 italic">
                        IATF 16949 no obliga a usar familia o pieza individual — es decision del equipo multifuncional.
                    </p>
                </div>
            </div>

            {/* Product vs Process Explanation */}
            <div className="border border-sky-200 rounded-lg overflow-hidden">
                <div className="bg-sky-50 px-3 py-2 border-b border-sky-200">
                    <h5 className="text-xs font-bold text-sky-800">¿Por qué hay columnas "Producto" Y "Proceso"?</h5>
                </div>
                <div className="px-3 py-2 text-[11px] text-gray-600 space-y-2">
                    <p>
                        Ambas son <strong>obligatorias</strong> per AIAG CP-1 2024, incluso si solo hacés AMFE de proceso (PFMEA).
                        <strong> No vienen del AMFE de diseño (DFMEA).</strong>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
                            <p className="font-bold text-emerald-800 text-[10px] mb-1">📏 Producto = lo que MEDÍS en la pieza</p>
                            <ul className="text-[10px] text-emerald-700 space-y-0.5 list-disc list-inside">
                                <li>Penetración del cordón</li>
                                <li>Diámetro, rugosidad</li>
                                <li>Torque de apriete</li>
                                <li>Espesor de película</li>
                            </ul>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded p-2">
                            <p className="font-bold text-amber-800 text-[10px] mb-1">⚙️ Proceso = lo que CONTROLÁS en la máquina</p>
                            <ul className="text-[10px] text-amber-700 space-y-0.5 list-disc list-inside">
                                <li>Amperaje, voltaje</li>
                                <li>Velocidad de corte</li>
                                <li>Presión de prensa</li>
                                <li>Temperatura de horno</li>
                            </ul>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 italic">
                        CP-1 2024 <strong>prohíbe</strong> mezclar ambas en la misma fila. Nuestro generador ya las separa correctamente.
                    </p>
                </div>
            </div>

            {CP_COLUMN_INFO.map(group => (
                <div key={group.group}>
                    <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                        <Settings2 size={13} className="text-teal-500" />
                        {group.group}
                    </h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-[11px]">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600">
                                    <th className="px-2 py-1.5 text-left font-semibold">Columna</th>
                                    <th className="px-2 py-1.5 text-center w-12 font-semibold">Req.</th>
                                    <th className="px-2 py-1.5 text-center w-12 font-semibold">Auto</th>
                                    <th className="px-2 py-1.5 text-left font-semibold">Descripción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {group.items.map((item, i) => (
                                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/50">
                                        <td className="px-2 py-1.5 font-medium text-gray-700 whitespace-nowrap">{item.col}</td>
                                        <td className="px-2 py-1.5 text-center">
                                            {item.required
                                                ? <span className="text-red-500 font-bold">*</span>
                                                : <span className="text-gray-300">-</span>}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            {item.autoFill
                                                ? <span className="text-teal-500 font-bold text-[10px]">Auto</span>
                                                : <span className="text-gray-300">-</span>}
                                        </td>
                                        <td className="px-2 py-1.5 text-gray-600">{item.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}

            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] text-gray-500 pt-2">
                <span><span className="text-red-500 font-bold">*</span> = Campo obligatorio</span>
                <span><span className="text-teal-500 font-bold">Auto</span> = Auto-llenado desde AMFE</span>
            </div>
        </div>
    );
}

// ============================================================================
// SHORTCUTS TAB
// ============================================================================

function ShortcutsTab() {
    return (
        <div className="space-y-5">
            {SHORTCUTS.map(group => (
                <div key={group.category}>
                    <h4 className="text-xs font-bold text-gray-700 mb-2">{group.category}</h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        {group.items.map((item, i) => (
                            <div key={i} className={`flex items-center justify-between px-3 py-2 text-[11px] ${i > 0 ? 'border-t border-gray-100' : ''} hover:bg-gray-50/50`}>
                                <span className="text-gray-700">{item.desc}</span>
                                <kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold text-gray-600 whitespace-nowrap">
                                    {item.keys}
                                </kbd>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ============================================================================
// PHASES TAB
// ============================================================================

function PhasesTab() {
    return (
        <div className="space-y-5">
            {/* AP Rules Summary */}
            <div>
                <h4 className="text-xs font-bold text-gray-700 mb-2">Reglas de Muestreo por AP</h4>
                <div className="space-y-2">
                    {AP_DEFAULTS.map(r => (
                        <div key={r.level} className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${r.color}`}>
                            <span className="text-sm font-black min-w-[24px]">{r.level}</span>
                            <div>
                                <span className="font-bold text-xs">{r.label}</span>
                                <p className="text-[11px] mt-0.5 opacity-80">{r.rules}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Phase Details */}
            <div>
                <h4 className="text-xs font-bold text-gray-700 mb-2">Fases del Plan de Control</h4>
                <div className="space-y-3">
                    {PHASES.map(p => (
                        <div key={p.code} className={`rounded-lg border p-3 ${p.color}`}>
                            <h5 className="text-xs font-bold mb-1">{p.phase}</h5>
                            <p className="text-[11px] mb-2 opacity-80">{p.desc}</p>
                            <div className="bg-white/60 rounded p-2">
                                <table className="w-full text-[10px]">
                                    <thead>
                                        <tr className="text-left font-semibold">
                                            <th className="pr-2 pb-1">AP</th>
                                            <th className="pr-2 pb-1">Muestra</th>
                                            <th className="pb-1">Frecuencia</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {p.sampling.map((s, i) => (
                                            <tr key={i}>
                                                <td className="pr-2 py-0.5 font-bold">{s.ap}</td>
                                                <td className="pr-2 py-0.5">{s.size}</td>
                                                <td className="py-0.5">{s.freq}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* CC/SC Quick Ref */}
            <div>
                <h4 className="text-xs font-bold text-gray-700 mb-2">Características Especiales</h4>
                <div className="space-y-2">
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg border text-red-700 bg-red-50 border-red-200">
                        <span className="text-sm font-black min-w-[24px]">CC</span>
                        <div>
                            <span className="font-bold text-xs">Critica</span>
                            <p className="text-[11px] mt-0.5 opacity-80">Severidad &gt;= 9. Requiere controles especiales, SPC, y Plan de Reaccion con responsable.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg border text-amber-700 bg-amber-50 border-amber-200">
                        <span className="text-sm font-black min-w-[24px]">SC</span>
                        <div>
                            <span className="font-bold text-xs">Significativa</span>
                            <p className="text-[11px] mt-0.5 opacity-80">Severidad 5-8. Atencion especial en Plan de Control.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg border text-blue-700 bg-blue-50 border-blue-200">
                        <span className="text-sm font-black min-w-[24px]">PTC</span>
                        <div>
                            <span className="font-bold text-xs">Pass-Through</span>
                            <p className="text-[11px] mt-0.5 opacity-80">Característica del proveedor que pasa por planta sin modificación. Nuevo en CP-1 2024.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CpHelpPanel;
