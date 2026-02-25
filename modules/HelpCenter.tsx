
import React, { useState, useMemo, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Search, BookOpen, Calculator, AlertTriangle, HelpCircle, ChevronDown, ChevronUp, Rocket, CheckCircle2, ArrowRight, Activity, Zap } from 'lucide-react';

// Import all static content from extracted module
import {
    HelpItem,
    HelpTab,
    ColorKey,
    COLOR_MAP,
    GLOSSARY,
    QUICK_START,
    FAQ_ITEMS,
    FORMULAS
} from './help/helpContent';

// TabButton extracted outside component for performance
interface TabButtonProps {
    tab: HelpTab;
    icon: any;
    label: string;
    activeTab: HelpTab;
    onClick: (tab: HelpTab) => void;
}

const TabButton: React.FC<TabButtonProps> = ({ tab, icon: Icon, label, activeTab, onClick }) => (
    <button
        onClick={() => onClick(tab)}
        className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all ${activeTab === tab
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
    >
        <Icon size={18} />
        {label}
    </button>
);

export const HelpCenter: React.FC = () => {
    const [activeTab, setActiveTab] = useState<HelpTab>('start');
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

    // Memoized filtered items to avoid recalculation on each render
    const filteredItems = useMemo(() =>
        GLOSSARY.filter(item =>
            item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.definition.toLowerCase().includes(searchTerm.toLowerCase())
        ), [searchTerm]);

    // Extracted callback for FAQ toggle
    const toggleFaq = useCallback((idx: number) => {
        setExpandedFaq(prev => prev === idx ? null : idx);
    }, []);

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* HEADER */}
            <div className="text-center py-6">
                <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4 border border-blue-100">
                    <BookOpen size={16} />
                    Centro de Ayuda
                </div>
                <h2 className="text-3xl font-bold text-slate-800 mb-2">Aprende a usar Barack Mercosul</h2>
                <p className="text-slate-500 max-w-lg mx-auto">Guía rápida, conceptos clave, fórmulas y respuestas a preguntas frecuentes.</p>
            </div>

            {/* TAB NAVIGATION */}
            <div className="flex flex-wrap gap-3 justify-center">
                <TabButton tab="start" icon={Rocket} label="Primeros Pasos" activeTab={activeTab} onClick={setActiveTab} />
                <TabButton tab="concepts" icon={BookOpen} label="Conceptos" activeTab={activeTab} onClick={setActiveTab} />
                <TabButton tab="formulas" icon={Calculator} label="Fórmulas" activeTab={activeTab} onClick={setActiveTab} />
                <TabButton tab="faq" icon={HelpCircle} label="FAQ" activeTab={activeTab} onClick={setActiveTab} />
            </div>

            {/* TAB: PRIMEROS PASOS */}
            {activeTab === 'start' && (
                <div className="space-y-8 animate-fade-in-up">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
                        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Rocket className="text-blue-600" size={24} />
                            Guía Rápida: 5 Pasos para Empezar
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            {QUICK_START.map((step, idx) => (
                                <div key={idx} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover-lift relative overflow-hidden">
                                    <div className={`absolute top-0 right-0 w-16 h-16 ${COLOR_MAP[step.color].bg} rounded-bl-full opacity-50`}></div>
                                    <div className={`w-10 h-10 rounded-lg ${COLOR_MAP[step.color].bg} flex items-center justify-center mb-3`}>
                                        <step.icon size={20} className={COLOR_MAP[step.color].text} />
                                    </div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Paso {step.step}</div>
                                    <h4 className="font-bold text-slate-800 mb-2">{step.title}</h4>
                                    <p className="text-sm text-slate-600">{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Tips */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100">
                            <h4 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">
                                <CheckCircle2 size={20} />
                                Consejos para Buenos Resultados
                            </h4>
                            <ul className="space-y-2 text-sm text-emerald-700">
                                <li className="flex gap-2"><ArrowRight size={16} className="flex-shrink-0 mt-0.5" /> Tome al menos 5 muestras de tiempo por tarea</li>
                                <li className="flex gap-2"><ArrowRight size={16} className="flex-shrink-0 mt-0.5" /> Defina dependencias antes de balancear</li>
                                <li className="flex gap-2"><ArrowRight size={16} className="flex-shrink-0 mt-0.5" /> Use la simulación para validar antes de implementar</li>
                                <li className="flex gap-2"><ArrowRight size={16} className="flex-shrink-0 mt-0.5" /> Revise el semáforo de riesgos regularmente</li>
                            </ul>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                            <h4 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
                                <AlertTriangle size={20} />
                                Errores Comunes a Evitar
                            </h4>
                            <ul className="space-y-2 text-sm text-amber-700">
                                <li className="flex gap-2"><ArrowRight size={16} className="flex-shrink-0 mt-0.5" /> Balancear sin definir dependencias (PDM)</li>
                                <li className="flex gap-2"><ArrowRight size={16} className="flex-shrink-0 mt-0.5" /> Ignorar la variabilidad (σ) de los operarios</li>
                                <li className="flex gap-2"><ArrowRight size={16} className="flex-shrink-0 mt-0.5" /> Separar tareas concurrentes sin considerar penalización</li>
                                <li className="flex gap-2"><ArrowRight size={16} className="flex-shrink-0 mt-0.5" /> No validar con simulación antes de implementar</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: CONCEPTOS (GLOSSARY) */}
            {activeTab === 'concepts' && (
                <div className="space-y-6 animate-fade-in-up">
                    {/* Search */}
                    <div className="relative max-w-lg mx-auto">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="text-slate-400" size={20} />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm"
                            placeholder="Buscar concepto (ej: Takt, OEE, Monte Carlo...)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Glossary Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredItems.length === 0 ? (
                            <div className="col-span-2 text-center py-12 text-slate-400">
                                <BookOpen size={48} className="mx-auto mb-2 opacity-50" />
                                <p>No se encontraron resultados para "{searchTerm}"</p>
                            </div>
                        ) : (
                            filteredItems.map((item, idx) => (
                                <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex gap-4 hover-lift">
                                    <div className="flex-shrink-0">
                                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                            <item.icon size={20} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-slate-800">{item.term}</h3>
                                            {item.category === 'Prerrequisitos' && <span className="bg-yellow-100 text-yellow-800 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Base</span>}
                                        </div>
                                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 mb-2">
                                            {item.category}
                                        </span>
                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            {item.definition}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB: FÓRMULAS */}
            {activeTab === 'formulas' && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="grid grid-cols-1 gap-4">
                        {FORMULAS.map((f, i) => (
                            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-shadow hover-lift">
                                <div className={`w-full md:w-28 ${COLOR_MAP[f.color].bgLight} p-5 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r ${COLOR_MAP[f.color].border} flex-shrink-0`}>
                                    <span className={`text-xl font-black ${COLOR_MAP[f.color].text} font-mono`}>{f.symbol}</span>
                                </div>
                                <div className="p-5 flex-1">
                                    <h4 className="font-bold text-slate-800 text-lg mb-2">{f.title}</h4>
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 font-mono text-sm text-slate-700 overflow-x-auto whitespace-nowrap">
                                        {f.formula}
                                    </div>
                                    <p className="text-slate-600 text-sm leading-relaxed">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Visual Tools Section */}
                    <div className="bg-slate-900 rounded-xl p-8 text-white shadow-xl">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Activity size={24} className="text-emerald-400" />
                            Interpretación Visual (Lean)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <h4 className="font-bold text-emerald-300 mb-2">Gráfico Yamazumi</h4>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    Diagrama de barras apiladas. Muestra la carga de trabajo vs Takt Time. Úselo para identificar visualmente qué estaciones están sobrecargadas.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-bold text-emerald-300 mb-2">Diagrama de Espagueti</h4>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    Muestra el flujo de tareas como un grafo. Ayuda a identificar movimientos complejos y dependencias que ensucian el flujo.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-bold text-emerald-300 mb-2">Alertas de Saturación</h4>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    Barras rojas en el balanceo indican que la estación excede el Takt. Es la señal para aplicar Multi-Manning o reasignar.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: FAQ */}
            {activeTab === 'faq' && (
                <div className="space-y-4 animate-fade-in-up">
                    {FAQ_ITEMS.map((faq, idx) => (
                        <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover-lift">
                            <button
                                onClick={() => toggleFaq(idx)}
                                className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
                            >
                                <span className="font-bold text-slate-800 flex items-center gap-3">
                                    <HelpCircle size={20} className="text-blue-500 flex-shrink-0" />
                                    {faq.q}
                                </span>
                                {expandedFaq === idx ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                            </button>
                            {expandedFaq === idx && (
                                <div className="px-5 pb-5 pt-0 border-t border-slate-100 animate-fade-in-up">
                                    <p className="text-slate-600 text-sm leading-relaxed pl-8">{faq.a}</p>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Special Section: Rotary Machines */}
                    <div className="mt-8 bg-indigo-50 rounded-xl p-6 border border-indigo-100">
                        <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                            <Zap size={20} className="text-indigo-600" />
                            Caso Especial: Eficiencia en Máquinas Rotativas
                        </h3>
                        <p className="text-slate-700 text-sm mb-4">
                            En líneas con <strong>Máquinas Rotativas</strong> (ej: Inyectoras de Múltiples Estaciones), es común observar diferencias entre la eficiencia teórica y la reportada.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-100">
                                <h4 className="font-bold text-indigo-700 mb-2">Visión del Experto (Física)</h4>
                                <p className="text-sm mb-2">Considera el tiempo <strong>total de curado</strong> como trabajo útil.</p>
                                <p className="text-sm font-mono bg-indigo-50 p-2 rounded">
                                    E = 300s / 135s ≈ <strong>300% (Súper-Uso)</strong>
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-100">
                                <h4 className="font-bold text-indigo-700 mb-2">Visión del Software (Balanceo)</h4>
                                <p className="text-sm mb-2">Usa el tiempo de <strong>salida por pieza</strong> para normalizar el flujo.</p>
                                <p className="text-sm font-mono bg-indigo-50 p-2 rounded">
                                    E = 42.86s / 45s ≈ <strong>~100% (Normalizado)</strong>
                                </p>
                            </div>
                        </div>
                        <p className="text-xs italic text-indigo-800 mt-3">
                            <strong>Nota:</strong> Ambos valores son "correctos" según el contexto. El software prioriza la visión de flujo (100%) para asegurar que la máquina quepa en el Takt Time.
                        </p>
                    </div>
                </div>
            )}

            {/* VERSION FOOTER */}
            <div className="text-center text-xs text-slate-400 pt-8 border-t border-slate-200">
                Barack Mercosul v4.0.0-alpha · Ingeniería & Procesos · 2024
            </div>
        </div>
    );
};
