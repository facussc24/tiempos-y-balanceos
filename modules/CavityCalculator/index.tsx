import React, { useState, useMemo } from 'react';
import { useCavityCalculator } from './hooks/useCavityCalculator';
import { useInjectionState } from './hooks/useInjectionState';
import { MachineConfiguration } from './components/MachineConfiguration';
import { ManualOperations } from './components/ManualOperations';
import { ProductionControls } from './components/ProductionControls';
import { SimulationResults } from './components/SimulationResults';
import { CalculationErrorBoundary } from './components/CalculationErrorBoundary';
import { Task, InjectionParams, Shift } from '../../types';
import { calculateTaktTime } from '../../utils';
import { Calculator, X, HelpCircle, ArrowRight, BookOpen, MousePointer2 } from 'lucide-react';

interface Props {
    task: Task;
    projectTasks?: Task[];
    shifts?: Shift[];  // FIX Bug #3: Real shift configuration
    dailyDemand: number;
    activeShifts?: number;
    oee?: number;
    setupLossPercent?: number;
    onClose: () => void;
    onApply: (params: InjectionParams, calculatedCycle: number) => void;
}

export const CavityCalculator: React.FC<Props> = ({
    task, projectTasks = [], shifts = [], dailyDemand, activeShifts = 1, oee = 0.85, setupLossPercent = 0, onClose, onApply
}) => {
    // Local editable setup loss (initialized from prop)
    const [localSetupLoss, setLocalSetupLoss] = useState(setupLossPercent);

    // FIX Bug #3: Calculate real available seconds from shift configuration
    const availableSeconds = useMemo(() => {
        if (!shifts || shifts.length === 0) return undefined; // Fallback to constant in core
        const taktResult = calculateTaktTime(shifts, activeShifts, dailyDemand, oee, localSetupLoss);
        return taktResult.totalAvailableMinutes * 60;
    }, [shifts, activeShifts, dailyDemand, oee, localSetupLoss]);

    // 1. STATE HOOK (Managed Inputs)
    const state = useInjectionState(task, projectTasks);

    // 2. CALCULATION HOOK (Managed Logic)
    const calculator = useCavityCalculator(state, dailyDemand, activeShifts, oee, availableSeconds);

    // Local UI State
    const [sections, setSections] = useState({ machine: true, manual: true });
    const [showHelp, setShowHelp] = useState(false);
    const [showGuideModal, setShowGuideModal] = useState(false);

    const toggleSection = (key: 'machine' | 'manual') => {
        setSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleApply = () => {
        const totalShotTime = calculator.metrics.realCycleTime * calculator.activeN;
        // FIX: Only persist user-added manual ops, not concurrent tasks (those are dynamic)
        const concurrentIds = new Set(
            projectTasks.filter(t => t.concurrentWith === task.id).map(t => t.id)
        );
        const opsToSave = state.manualOps.filter(op => !concurrentIds.has(op.id));
        onApply({
            productionVolume: dailyDemand,
            investmentRatio: 0,
            optimalCavities: calculator.activeN,
            pInyectionTime: calculator.puInyTime,
            pCuringTime: calculator.puCurTime,
            manualInteractionTime: calculator.metrics.currentEffectiveManualTime,
            manualOperations: opsToSave,
            // FIX-1: Persist both cavity and headcount modes
            cavityMode: state.cavityMode,
            userSelectedN: state.cavityMode === 'manual' ? calculator.activeN : undefined,
            headcountMode: state.headcountMode,
            userHeadcount: state.headcountMode === 'manual' ? calculator.userHeadcountOverride : undefined,
            injectionMode: state.injectionMode,
            indexTime: state.injectionMode === 'carousel' ? (parseFloat(state.indexTimeStr.replace(',', '.')) || 0) : undefined
        }, totalShotTime);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            {/* HELP MODAL */}
            {showHelp && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden relative">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><HelpCircle size={20} /> Guía de Interpretación</h3>
                            <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-slate-700" title="Cerrar ayuda"><X size={20} /></button>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[70vh]">
                            <div>
                                <h4 className="font-bold text-blue-700 text-sm mb-2 uppercase tracking-wide border-b border-blue-100 pb-1">1. Modos de Dotación</h4>
                                <ul className="space-y-3 text-xs text-slate-600">
                                    <li className="bg-blue-50 p-2 rounded border border-blue-100">
                                        <div className="font-bold text-blue-800 mb-1">Modo AUTO</div>
                                        El sistema calcula matemáticamente cuántos operarios se necesitan para que la máquina NUNCA se detenga. Prioriza la máxima producción posible.
                                    </li>
                                    <li className="bg-amber-50 p-2 rounded border border-amber-100">
                                        <div className="font-bold text-amber-800 mb-1">Modo MANUAL (What-If)</div>
                                        Le permite forzar una cantidad de operarios (ej: &ldquo;Solo tengo 1 persona&rdquo;). El sistema recalculará el ciclo mostrando cuánto tiempo pierde la máquina esperando al operario.
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-indigo-700 text-sm mb-2 uppercase tracking-wide border-b border-indigo-100 pb-1">2. Lectura del Gráfico</h4>
                                <ul className="space-y-3 text-xs text-slate-600">
                                    <li className="flex gap-2 items-start">
                                        <div className="w-3 h-3 bg-indigo-500 rounded-sm mt-0.5 flex-shrink-0"></div>
                                        <div>
                                            <strong>Barra Sólida (Azul/Ámbar):</strong> Tiempo de Ciclo de Máquina puro.
                                        </div>
                                    </li>
                                    <li className="flex gap-2 items-start">
                                        <div className="w-3 h-3 bg-red-500/60 rounded-sm mt-0.5 flex-shrink-0 border border-red-500"></div>
                                        <div>
                                            <strong>Barra Roja (Superior):</strong> <span className="text-red-600 font-bold">Tiempo Perdido / Espera</span>. Aparece cuando el operario es más lento que la máquina.
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="bg-slate-50 px-6 py-3 text-right">
                            <button onClick={() => setShowHelp(false)} className="bg-slate-800 text-white px-4 py-2 rounded text-sm font-bold hover:bg-slate-700 transition-colors">Cerrar Ayuda</button>
                        </div>
                    </div>
                </div>
            )}

            {/* GUIDE MODAL */}
            {showGuideModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-in fade-in p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <BookOpen className="text-indigo-600" /> Guía de Carga de Tareas
                            </h3>
                            <button onClick={() => setShowGuideModal(false)} className="p-1 hover:bg-slate-100 rounded-full transition-colors" title="Cerrar guía">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-8">
                            <section>
                                <h4 className="font-bold text-indigo-900 text-sm uppercase mb-4 flex items-center gap-2 border-b border-indigo-100 pb-2">
                                    1. Clasificación de Tareas (INT vs EXT)
                                </h4>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded">INT (Interna)</span>
                                            <span className="text-emerald-800 font-bold text-sm">Tiempo Oculto</span>
                                        </div>
                                        <p className="text-xs text-emerald-700 mb-3">
                                            Se realizan <strong>mientras la máquina está inyectando o curando</strong>.
                                            NO suman tiempo al ciclo total (siempre que sean menores al tiempo de máquina).
                                        </p>
                                        <ul className="text-xs text-emerald-800 space-y-1 list-disc pl-4">
                                            <li>Refilado de rebabas</li>
                                            <li>Colocación de insertos en molde de espera</li>
                                            <li>Inspección visual</li>
                                            <li>Embalaje</li>
                                        </ul>
                                    </div>
                                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">EXT (Externa)</span>
                                            <span className="text-red-800 font-bold text-sm">Tiempo Máquina Parada</span>
                                        </div>
                                        <p className="text-xs text-red-700 mb-3">
                                            La máquina <strong>debe detenerse</strong> para realizar estas tareas.
                                            Suman DIRECTAMENTE al tiempo de ciclo.
                                        </p>
                                        <ul className="text-xs text-red-800 space-y-1 list-disc pl-4">
                                            <li>Apertura de puerta (si es manual)</li>
                                            <li>Desmoldeo de pieza</li>
                                            <li>Limpieza de molde</li>
                                            <li>Aplicación de desmoldante</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setShowGuideModal(false)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-6 rounded transition-colors"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN CARD */}
            <div className="bg-white w-full max-w-[95vw] lg:max-w-[90vw] xl:max-w-7xl rounded-xl shadow-xl overflow-hidden flex flex-col md:flex-row h-[90vh] border border-slate-200 animate-in fade-in zoom-in duration-300 relative z-[100]">

                <CalculationErrorBoundary>

                    {/* LEFT */}
                    <div className="w-full md:w-4/12 bg-slate-50 p-6 border-r border-slate-200 flex flex-col gap-5 overflow-y-auto">
                        <div className="flex items-center justify-between text-indigo-700 font-bold text-lg mb-1">
                            <div className="flex items-center gap-2">
                                <div className="bg-indigo-100 p-2 rounded-lg"><Calculator size={20} /></div>
                                <h2 className="leading-tight">Configuración de<br />Ciclo de Inyección</h2>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <MachineConfiguration
                                isOpen={sections.machine}
                                onToggle={() => toggleSection('machine')}
                                puInyTimeStr={state.puInyTimeStr}
                                setPuInyTimeStr={state.setPuInyTimeStr}
                                puCurTimeStr={state.puCurTimeStr}
                                setPuCurTimeStr={state.setPuCurTimeStr}
                                nStar={calculator.metrics.nStar}
                                errors={calculator.validation.errors}
                                injectionMode={state.injectionMode}
                                setInjectionMode={state.setInjectionMode}
                                indexTimeStr={state.indexTimeStr}
                                setIndexTimeStr={state.setIndexTimeStr}
                                setupLossPercent={localSetupLoss}
                                setSetupLossPercent={setLocalSetupLoss}
                            />

                            <ManualOperations
                                isOpen={sections.manual}
                                onToggle={() => toggleSection('manual')}
                                manualOps={state.manualOps}
                                addManualOp={state.addManualOp}
                                removeManualOp={state.removeManualOp}
                                toggleOpType={state.toggleOpType}
                                manualTimeOverrideStr={state.manualTimeOverrideStr}
                                setManualTimeOverrideStr={state.setManualTimeOverrideStr}
                                isUsingDefaultManual={calculator.isUsingDefaultManual}
                                currentEffectiveManualTime={calculator.metrics.currentEffectiveManualTime}
                                calculatedManualTime={calculator.metrics.currentEffectiveManualTime}
                                onShowGuide={() => setShowGuideModal(true)}
                            />

                            <ProductionControls
                                activeN={calculator.activeN}
                                updateCavities={state.updateCavities}
                                cavityMode={state.cavityMode}
                                setCavityMode={state.setCavityMode}
                                activeHeadcount={calculator.metrics.activeHeadcount}
                                updateHeadcount={state.updateHeadcount}
                                headcountMode={state.headcountMode}
                                setHeadcountMode={state.setHeadcountMode}
                                userHeadcountStr={state.userHeadcountStr}
                                setUserHeadcountStr={state.setUserHeadcountStr}
                                isBottleneckLabor={calculator.metrics.isBottleneckLabor}
                                realSaturation={calculator.metrics.realSaturation}
                                chartData={calculator.chartData}
                                selectedData={calculator.selectedData}
                                manualOps={state.manualOps}
                                hourlyOutput={calculator.metrics.hourlyOutput}
                                realCycleTime={calculator.metrics.realCycleTime}
                            />
                        </div>
                    </div>

                    {/* RIGHT: RESULTS */}
                    <div className="flex-1 bg-white p-6 flex flex-col relative">
                        <button onClick={onClose} aria-label="Cerrar calculadora de cavidades" className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition-colors z-10">
                            <X size={24} />
                        </button>

                        <SimulationResults
                            chartData={calculator.chartData}
                            activeN={calculator.activeN}
                            taktTime={calculator.metrics.taktTime}
                            realCycleTime={calculator.metrics.realCycleTime}
                            isBottleneckLabor={calculator.metrics.isBottleneckLabor}
                            hourlyOutput={calculator.metrics.hourlyOutput}
                            lostOutput={calculator.metrics.lostOutput}
                            machinePortionPct={calculator.metrics.machinePortionPct}
                            operatorDelay={calculator.metrics.operatorDelay}
                            manualLimitCycle={calculator.metrics.manualLimitCycle}
                            activeHeadcount={calculator.metrics.activeHeadcount}
                            currentEffectiveManualTime={calculator.metrics.currentEffectiveManualTime}
                            nStar={calculator.metrics.nStar}
                            dailyDemand={dailyDemand}
                            availableSeconds={availableSeconds}
                            oee={oee}
                        />

                        <div className="mt-4 flex justify-between items-center">
                            <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border transition-colors ${state.cavityMode === 'auto' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-indigo-50 border-indigo-200 text-indigo-800'}`}>
                                <MousePointer2 size={20} />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase opacity-70">
                                        {state.cavityMode === 'auto' ? 'SELECCIÓN AUTOMÁTICA' : 'SELECCIÓN MANUAL'}
                                    </span>
                                    <span className="font-black text-sm leading-none flex items-center gap-2">
                                        {calculator.activeN} Cavidades / {calculator.metrics.activeHeadcount} Op.
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleApply}
                                    disabled={!calculator.metrics.isCurrentFeasible}
                                    data-testid="btn-apply-calculator"
                                    className={`px-6 py-2 rounded-lg font-bold shadow-md transition-all transform active:scale-95 flex items-center gap-2 text-sm ${calculator.metrics.isCurrentFeasible ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-white border-2 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'}`}
                                >
                                    Aplicar <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                </CalculationErrorBoundary>

            </div>
        </div>
    );
};
