/**
 * AMFE Inline Help Panel
 *
 * Quick-reference panel for AIAG-VDA FMEA methodology.
 * Displays severity/occurrence/detection scales, AP logic,
 * keyboard shortcuts, and a step-by-step workflow guide.
 */
import React, { useState, useEffect } from 'react';
import { X, BookOpen, Keyboard, Route, AlertTriangle, ShieldCheck, Eye, Gauge } from 'lucide-react';

type HelpTab = 'scales' | 'shortcuts' | 'workflow';

interface AmfeHelpPanelProps {
    onClose: () => void;
}

// ============================================================================
// SCALE DATA
// ============================================================================

const SEVERITY_SCALE = [
    { val: 10, label: 'Peligroso sin aviso', desc: 'Afecta seguridad/regulatorio. Sin aviso previo al operador.', color: 'bg-red-600 text-white' },
    { val: 9, label: 'Peligroso con aviso', desc: 'Afecta seguridad/regulatorio. Con aviso previo al operador.', color: 'bg-red-500 text-white' },
    { val: 8, label: 'Muy alto', desc: 'Vehículo/producto inoperable. Pérdida función primaria.', color: 'bg-orange-500 text-white' },
    { val: 7, label: 'Alto', desc: 'Vehículo operable con rendimiento reducido. Cliente insatisfecho.', color: 'bg-orange-400 text-white' },
    { val: 6, label: 'Moderado', desc: 'Vehículo operable, confort/conveniencia afectados.', color: 'bg-amber-400' },
    { val: 5, label: 'Bajo', desc: 'Vehículo operable, confort reducido. Cliente algo insatisfecho.', color: 'bg-amber-300' },
    { val: 4, label: 'Muy bajo', desc: 'Defecto notable por mayoría de clientes (>75%).', color: 'bg-yellow-200' },
    { val: 3, label: 'Menor', desc: 'Defecto notable por algunos clientes (50%).', color: 'bg-green-200' },
    { val: 2, label: 'Muy menor', desc: 'Defecto notable solo por clientes expertos (<25%).', color: 'bg-green-100' },
    { val: 1, label: 'Ninguno', desc: 'Sin efecto perceptible.', color: 'bg-gray-100' },
];

const OCCURRENCE_SCALE = [
    { val: 10, label: 'Muy alta', desc: '>=100 por mil piezas. Control inexistente.', color: 'bg-red-600 text-white' },
    { val: 9, label: 'Alta', desc: '50 por mil piezas. Controles débiles.', color: 'bg-red-500 text-white' },
    { val: 8, label: 'Alta', desc: '20 por mil piezas. Controles limitados.', color: 'bg-orange-500 text-white' },
    { val: 7, label: 'Moderada-alta', desc: '10 por mil piezas. Algunos controles.', color: 'bg-orange-400 text-white' },
    { val: 6, label: 'Moderada', desc: '2 por mil piezas. Controles moderados.', color: 'bg-amber-400' },
    { val: 5, label: 'Moderada-baja', desc: '0.5 por mil piezas. Buenos controles.', color: 'bg-amber-300' },
    { val: 4, label: 'Baja', desc: '0.1 por mil piezas. Controles efectivos.', color: 'bg-yellow-200' },
    { val: 3, label: 'Muy baja', desc: '0.01 por mil piezas. Controles robustos.', color: 'bg-green-200' },
    { val: 2, label: 'Remota', desc: '<=0.001 por mil. Prevención probada.', color: 'bg-green-100' },
    { val: 1, label: 'Eliminada', desc: 'Causa eliminada por diseño/prevención.', color: 'bg-gray-100' },
];

const DETECTION_SCALE = [
    { val: 10, label: 'Imposible', desc: 'Sin control de detección. No se puede detectar.', color: 'bg-red-600 text-white' },
    { val: 9, label: 'Muy remota', desc: 'Control improbable de detectar. Inspección aleatoria.', color: 'bg-red-500 text-white' },
    { val: 8, label: 'Remota', desc: 'Detección poco confiable. Inspección visual.', color: 'bg-orange-500 text-white' },
    { val: 7, label: 'Muy baja', desc: 'Detección post-proceso. Inspección doble.', color: 'bg-orange-400 text-white' },
    { val: 6, label: 'Baja', desc: 'Control estadístico (SPC) manual.', color: 'bg-amber-400' },
    { val: 5, label: 'Moderada', desc: 'SPC con alarmas. Gage tipo variable.', color: 'bg-amber-300' },
    { val: 4, label: 'Moderada-alta', desc: 'Control en estación siguiente. Error-proofing.', color: 'bg-yellow-200' },
    { val: 3, label: 'Alta', desc: 'Detección en estación. Múltiples Poka-Yoke.', color: 'bg-green-200' },
    { val: 2, label: 'Muy alta', desc: 'Detección automática. Segregación auto.', color: 'bg-green-100' },
    { val: 1, label: 'Segura', desc: 'Prevención por diseño. Pieza no puede hacerse mal.', color: 'bg-gray-100' },
];

const AP_RULES = [
    { level: 'H', label: 'Alto', color: 'bg-red-100 text-red-800 border-red-300', desc: 'Acción obligatoria. Severidad 9-10 casi siempre = H.' },
    { level: 'M', label: 'Medio', color: 'bg-amber-100 text-amber-800 border-amber-300', desc: 'Acción recomendada. Evaluar si mejorar prevención o detección.' },
    { level: 'L', label: 'Bajo', color: 'bg-green-100 text-green-800 border-green-300', desc: 'Acción a discreción del equipo. Monitorear tendencias.' },
];

const SPECIAL_CHARS = [
    { code: 'CC', label: 'Crítica', desc: 'Severidad >= 9. Requiere controles especiales, plan de control y SPC.', color: 'text-red-700 bg-red-50 border-red-200' },
    { code: 'SC', label: 'Significativa', desc: 'Severidad 5-8. Requiere atención en Plan de Control.', color: 'text-amber-700 bg-amber-50 border-amber-200' },
    { code: 'PTC', label: 'Pass-Through', desc: 'Característica del proveedor que pasa sin modificación en planta. Nuevo en CP-1 2024.', color: 'text-blue-700 bg-blue-50 border-blue-200' },
];

// ============================================================================
// SHORTCUTS DATA
// ============================================================================

const SHORTCUTS = [
    { category: 'General', items: [
        { keys: 'Ctrl+S', desc: 'Guardar proyecto' },
        { keys: 'Ctrl+Z', desc: 'Deshacer último cambio' },
        { keys: 'Ctrl+Y', desc: 'Rehacer cambio' },
        { keys: 'Ctrl+D', desc: 'Alternar modo Vista/Edición' },
        { keys: 'Ctrl+N', desc: 'Agregar operación al final' },
        { keys: 'Ctrl+F', desc: 'Buscar/filtrar en tabla' },
        { keys: 'Escape', desc: 'Cerrar paneles / limpiar filtros' },
        { keys: 'Alt (hold)', desc: 'Mostrar atajos en botones' },
    ]},
    { category: 'Paneles', items: [
        { keys: 'Ctrl+E', desc: 'Abrir/cerrar Resumen' },
        { keys: 'Ctrl+T', desc: 'Abrir/cerrar Templates' },
    ]},
    { category: 'Tabla', items: [
        { keys: 'Tab', desc: 'Siguiente celda' },
        { keys: 'Shift+Tab', desc: 'Celda anterior' },
        { keys: 'Enter', desc: 'Confirmar y avanzar' },
        { keys: 'ArrowLeft/Right', desc: 'Navegar tabs de efectos' },
    ]},
];

// ============================================================================
// WORKFLOW DATA
// ============================================================================

const WORKFLOW_STEPS = [
    { step: 1, title: 'Definir Operaciones', desc: 'Crear las operaciones/pasos del proceso productivo. Identificar cada paso que transforma el producto.', tip: 'Use el botón + o Ctrl+N. Copie desde Biblioteca si ya existen operaciones similares.' },
    { step: 2, title: 'Asignar 6M (Elementos de Trabajo)', desc: 'Para cada operación, definir los elementos 6M: Máquina, Mano de Obra, Material, Método, Medio Ambiente, Medición.', tip: 'No todos los 6M aplican a cada operación. Focalice en los más relevantes.' },
    { step: 3, title: 'Definir Funciones', desc: 'Para cada elemento de trabajo, definir qué debe hacer (función). Formato: Verbo + Sustantivo.', tip: 'Ejemplo: "Mantener temperatura > 200°C", "Posicionar pieza a ±0.1mm".' },
    { step: 4, title: 'Identificar Modos de Falla', desc: 'Para cada función, identificar cómo puede fallar. Es el opuesto/negativo de la función.', tip: 'Si función = "Mantener temperatura", falla = "No mantiene temperatura" o "Temperatura excesiva".' },
    { step: 5, title: 'Evaluar Efectos y Severidad (S)', desc: 'Documentar 3 niveles de efecto: interno, en planta cliente, en usuario final. Asignar S = máximo de los 3.', tip: 'S >= 9 implica seguridad/regulatorio. S nunca puede reducirse con controles.' },
    { step: 6, title: 'Identificar Causas y Controles', desc: 'Para cada falla: listar causas raíz, controles de prevención existentes, y controles de detección existentes.', tip: 'Use la Biblioteca para reutilizar causas y controles de operaciones similares.' },
    { step: 7, title: 'Evaluar O y D, Calcular AP', desc: 'Asignar Ocurrencia (con prevención actual) y Detección (con detección actual). AP se calcula automáticamente.', tip: 'AP = H requiere acción obligatoria. AP = M requiere evaluación. AP = L a discreción.' },
    { step: 8, title: 'Definir Acciones de Optimización', desc: 'Para causas con AP Alto: definir acciones preventivas y/o detectivas, responsable, fecha objetivo.', tip: 'Priorice reducir O (prevención) antes que D (detección). S no se puede cambiar.' },
    { step: 9, title: 'Generar Plan de Control', desc: 'Desde la pestaña Plan de Control, generar items automáticamente desde las causas AP=H y AP=M del AMFE.', tip: 'Revise los items generados. Complete especificaciones y responsables manualmente.' },
    { step: 10, title: 'Validar y Exportar', desc: 'Use Auditar AMFE para verificar completitud. Exporte a Excel/PDF para revisión con el equipo.', tip: 'La validación cruzada AMFE↔CP detecta inconsistencias entre ambos documentos.' },
];

// ============================================================================
// COMPONENT
// ============================================================================

const AmfeHelpPanel: React.FC<AmfeHelpPanelProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<HelpTab>('scales');

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const tabs: { id: HelpTab; label: string; icon: React.ReactNode }[] = [
        { id: 'scales', label: 'Escalas', icon: <Gauge size={14} /> },
        { id: 'shortcuts', label: 'Atajos', icon: <Keyboard size={14} /> },
        { id: 'workflow', label: 'Flujo VDA', icon: <Route size={14} /> },
    ];

    return (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation" onClick={onClose}>
            <div className="absolute inset-0 bg-black/20 animate-in fade-in duration-150" />
            <div
                className="relative w-[520px] max-w-full bg-white shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <BookOpen size={18} className="text-blue-600" />
                        <div>
                            <h3 className="text-sm font-bold text-gray-800">Referencia Rapida AMFE</h3>
                            <p className="text-[10px] text-gray-500">AIAG-VDA FMEA Handbook</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-100 transition" title="Cerrar referencia" aria-label="Cerrar referencia">
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
                                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
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
                    {activeTab === 'scales' && <ScalesTab />}
                    {activeTab === 'shortcuts' && <ShortcutsTab />}
                    {activeTab === 'workflow' && <WorkflowTab />}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// SCALES TAB
// ============================================================================

function ScaleTable({ title, icon, scale }: { title: string; icon: React.ReactNode; scale: typeof SEVERITY_SCALE }) {
    return (
        <div className="mb-5">
            <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-2">
                {icon} {title}
            </h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-[11px]">
                    <thead>
                        <tr className="bg-gray-50 text-gray-600">
                            <th className="px-2 py-1.5 text-center w-8 font-semibold">Val</th>
                            <th className="px-2 py-1.5 text-left w-24 font-semibold">Nivel</th>
                            <th className="px-2 py-1.5 text-left font-semibold">Criterio</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scale.map(row => (
                            <tr key={row.val} className="border-t border-gray-100 hover:bg-gray-50/50">
                                <td className="px-2 py-1 text-center">
                                    <span className={`inline-block w-6 h-5 rounded text-[10px] font-bold leading-5 text-center ${row.color}`}>
                                        {row.val}
                                    </span>
                                </td>
                                <td className="px-2 py-1 font-medium text-gray-700">{row.label}</td>
                                <td className="px-2 py-1 text-gray-600">{row.desc}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ScalesTab() {
    return (
        <div>
            <ScaleTable title="Severidad (S)" icon={<AlertTriangle size={14} className="text-red-500" />} scale={SEVERITY_SCALE} />
            <ScaleTable title="Ocurrencia (O)" icon={<Gauge size={14} className="text-orange-500" />} scale={OCCURRENCE_SCALE} />
            <ScaleTable title="Detección (D)" icon={<Eye size={14} className="text-blue-500" />} scale={DETECTION_SCALE} />

            {/* AP Rules */}
            <div className="mb-5">
                <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-2">
                    <ShieldCheck size={14} className="text-indigo-500" /> Prioridad de Accion (AP)
                </h4>
                <div className="space-y-2">
                    {AP_RULES.map(r => (
                        <div key={r.level} className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${r.color}`}>
                            <span className="text-sm font-black min-w-[24px]">{r.level}</span>
                            <div>
                                <span className="font-bold text-xs">{r.label}</span>
                                <p className="text-[11px] mt-0.5 opacity-80">{r.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-2 italic">
                    AP se calcula de la tabla S x O x D (AIAG-VDA, 1000 combinaciones). Severidad es el factor dominante.
                </p>
            </div>

            {/* Special Characteristics */}
            <div>
                <h4 className="text-xs font-bold text-gray-700 mb-2">Características Especiales</h4>
                <div className="space-y-2">
                    {SPECIAL_CHARS.map(sc => (
                        <div key={sc.code} className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${sc.color}`}>
                            <span className="text-sm font-black min-w-[24px]">{sc.code}</span>
                            <div>
                                <span className="font-bold text-xs">{sc.label}</span>
                                <p className="text-[11px] mt-0.5 opacity-80">{sc.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
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
// WORKFLOW TAB
// ============================================================================

function FamilyInfoBox() {
    return (
        <div className="mb-4 border border-indigo-200 rounded-lg overflow-hidden">
            <div className="bg-indigo-50 px-3 py-2 border-b border-indigo-200">
                <h5 className="text-xs font-bold text-indigo-800">Familias de Productos (AIAG-VDA)</h5>
            </div>
            <div className="px-3 py-2 text-[11px] text-gray-600 space-y-1.5">
                <p>
                    Un <strong>Family FMEA</strong> cubre piezas múltiples similares en aplicación, diseño,
                    manufactura, requerimientos y especificación (ej: espejos izq/der, variaciones dimensionales).
                </p>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-green-50 border border-green-200 rounded p-1.5">
                        <p className="font-semibold text-green-800 text-[10px] mb-0.5">✓ Usar familia cuando:</p>
                        <ul className="list-disc list-inside text-[10px] text-green-700 space-y-0.5">
                            <li>Mismo proceso de manufactura</li>
                            <li>Mismos modos de falla</li>
                            <li>Diferencia solo dimensional</li>
                        </ul>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded p-1.5">
                        <p className="font-semibold text-red-800 text-[10px] mb-0.5">✗ Separar cuando:</p>
                        <ul className="list-disc list-inside text-[10px] text-red-700 space-y-0.5">
                            <li>Procesos diferentes</li>
                            <li>Fallas distintas</li>
                            <li>Controles diferentes</li>
                        </ul>
                    </div>
                </div>
                <p className="text-[10px] text-gray-500 italic">
                    En el encabezado: usar <strong>"Alcance / Familia"</strong> para describir la familia
                    y <strong>"Piezas Aplicables"</strong> para listar los nros de pieza cubiertos.
                    IATF 16949 no obliga un enfoque — es decision del equipo.
                </p>
            </div>
        </div>
    );
}

function WorkflowTab() {
    return (
        <div className="space-y-3">
            <FamilyInfoBox />
            <p className="text-[11px] text-gray-600 mb-2">
                Flujo de trabajo AMFE VDA — 7 pasos + vinculacion a Plan de Control.
            </p>
            {WORKFLOW_STEPS.map(s => (
                <div key={s.step} className="flex gap-3">
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        s.step <= 4 ? 'bg-blue-100 text-blue-700' :
                        s.step <= 8 ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                    }`}>
                        {s.step}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-bold text-gray-800">{s.title}</h5>
                        <p className="text-[11px] text-gray-600 mt-0.5">{s.desc}</p>
                        <p className="text-[10px] text-blue-600 mt-1 italic">{s.tip}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default AmfeHelpPanel;
