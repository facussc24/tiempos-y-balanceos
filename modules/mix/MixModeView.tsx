/**
 * MixModeView - Planificador de Mix de Producción
 * 
 * Flujo simplificado de 2 pasos:
 * 1. Seleccionar productos (checkboxes)
 * 2. Ver resultados por sector
 * 
 * Reutiliza la lógica existente de mixBalancing pero con UI simplificada.
 * 
 * @module MixModeView
 * @version 3.0.0 - Consolidado (eliminado v1 legacy)
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Play, RefreshCw, Loader2, Save, FileText, History, Settings } from 'lucide-react';
import { MixSelectableProduct, MixSimplifiedResult, MixScenario, ProjectData, MixSavedScenario } from '../../types';
import { MixProductGrid } from './MixProductGrid';
import { MixResultsSummary } from './MixResultsSummary';
import { MixSectorCardView } from './MixSectorCardView';
import { MixHistoryModal } from './MixHistoryModal';
import { ConfirmModal } from '../../components/modals/ConfirmModal';

// Reutilizar lógica existente
import {
    balanceMixedModel,
    analyzeMixBySector,
    validateProcessConstraints,
    validateModelVariability
} from '../../core/balancing/mixBalancing';
import { calculateTaktTime } from '../../core/balancing/simulation';
import { loadMixProducts, createEmptyMixScenario, detectConfigConflicts } from '../../utils/mixHelpers';
import { toSimplifiedResult } from '../../core/balancing/mixSimplifier';
import { usePlantAssets } from '../../hooks/usePlantAssets';
import { getPathConfig } from '../../utils/pathManager';
import { toast } from '../../components/ui/Toast';
import { logger } from '../../utils/logger';

interface MixModeViewProps {
    onBack?: () => void;
    initialProducts?: Array<{ path: string; demand: number }>;
}

export const MixModeView: React.FC<MixModeViewProps> = ({
    onBack,
    initialProducts = []
}) => {
    // Step state
    const [step, setStep] = useState<'select' | 'calculating' | 'results'>('select');

    // Selection state
    const [selectedProducts, setSelectedProducts] = useState<MixSelectableProduct[]>([]);

    // Procesar productos iniciales desde Dashboard
    useEffect(() => {
        // Solo ejecutar si hay productos iniciales
        if (initialProducts.length > 0) {
            // Convertir initialProducts a formato MixSelectableProduct
            const converted: MixSelectableProduct[] = initialProducts.map(p => {
                // Extraer client/project/part del path: "C:/path/to/CLIENT/PROJECT/PART/master.json"
                const pathParts = p.path.replace(/\\/g, '/').split('/');
                const part = pathParts[pathParts.length - 2] || 'Producto';
                const project = pathParts[pathParts.length - 3] || '';
                const client = pathParts[pathParts.length - 4] || '';

                return {
                    path: p.path,
                    displayName: part,
                    client,
                    project,
                    part,
                    dailyDemand: p.demand,
                    isSelected: true
                };
            });
            // Solo actualizar si el estado está vacío (previene loops infinitos)
            setSelectedProducts(prev => prev.length === 0 ? converted : prev);
        }
    }, [initialProducts]); // initialProducts es estable desde props

    // Results state
    const [result, setResult] = useState<MixSimplifiedResult | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    // History modal state
    const [showHistory, setShowHistory] = useState(false);

    // V5.1: Exit confirmation state
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [pendingAction, setPendingAction] = useState<'back' | 'reset' | null>(null);

    // V5.3: Configuration conflict warning
    const [configWarning, setConfigWarning] = useState<string | null>(null);

    // V4.2: Setup time for Takt calculation (per expert feedback)
    const [setupMinutes, setSetupMinutes] = useState<number>(0);

    // Plant assets for validation
    const plantAssets = usePlantAssets();
    const basePath = getPathConfig().basePath;

    /**
     * V5.0: Cargar escenario desde historial
     * 
     * CRITICAL FIX: Restaurar selectedProducts para evitar pérdida de datos
     * si el usuario vuelve a guardar el escenario.
     * 
     * V5.2: Extraer client/project del path para mantener metadatos
     */
    const handleLoadScenario = (scenario: MixSavedScenario) => {
        // Restaurar productos seleccionados desde el escenario guardado
        const restoredProducts: MixSelectableProduct[] = scenario.selectedProducts.map(sp => {
            // Extraer client/project del path: "Cliente/Proyecto/Pieza/master.json"
            const pathParts = sp.path.replace(/\\/g, '/').split('/');
            const client = pathParts.length >= 4 ? pathParts[pathParts.length - 4] : '';
            const project = pathParts.length >= 3 ? pathParts[pathParts.length - 3] : '';

            return {
                path: sp.path,
                displayName: sp.name,
                client,
                project,
                part: sp.name,
                dailyDemand: sp.demand,
                isSelected: true
            };
        });
        setSelectedProducts(restoredProducts);

        // V4.2: Restaurar setup si existe
        if (scenario.setupMinutesPerShift !== undefined) {
            setSetupMinutes(scenario.setupMinutesPerShift);
        } else {
            setSetupMinutes(0);  // Reset a default si no existe
        }

        setResult(scenario.result);
        setStep('results');
        setShowHistory(false);
        toast.success('Escenario Cargado', `"${scenario.name}" cargado`);
    };

    /**
     * V5.0: Eliminar escenario del historial
     */
    const handleDeleteScenario = async (id: string) => {
        await plantAssets.deleteMixScenario(id);
        toast.success('Eliminado', 'Escenario eliminado');
    };
    /**
     * Ejecutar cálculo de Mix
     */
    const handleCalculate = async () => {
        if (selectedProducts.length === 0) {
            toast.error('Selección Vacía', 'Seleccioná al menos un producto');
            return;
        }

        setIsCalculating(true);
        setStep('calculating');

        try {
            // 1. Preparar referencias de productos
            const productRefs = selectedProducts.map(p => ({
                path: p.path,
                demand: p.dailyDemand
            }));

            // 2. Cargar productos usando lógica existente
            const { products: loadedProducts, errors, totalDemand, isPartial } = await loadMixProducts(
                basePath,
                productRefs
            );

            if (errors.length > 0) {
                toast.error('Error de Carga', `${errors.length} producto(s) no pudieron cargarse`);
                setStep('select');
                setIsCalculating(false);
                return;
            }

            if (totalDemand <= 0) {
                toast.error('Error de Demanda', 'La demanda total debe ser mayor a 0');
                setStep('select');
                setIsCalculating(false);
                return;
            }

            // V5.3: Detectar conflictos de configuración entre productos
            const conflictResult = detectConfigConflicts(loadedProducts);
            if (conflictResult.hasConflict) {
                setConfigWarning(conflictResult.message);
                toast.warning('Configuración Inconsistente', conflictResult.message || 'Los productos tienen configuraciones diferentes');
            } else {
                setConfigWarning(null);
            }

            // 3. Calcular Takt Time (V5.5 FIX: usa calculateTaktTime que itera sobre cada turno)
            const template = loadedProducts[0];
            const activeShiftsCount = template.meta?.activeShifts || 1;
            const oee = template.meta?.useManualOEE
                ? (template.meta?.manualOEE || 0.85)
                : 0.85;

            // Calcular setup como porcentaje del tiempo total estimado
            const estimatedTotalMinutes = activeShiftsCount * 8 * 60;
            const setupLossPercent = setupMinutes > 0
                ? Math.min(0.20, setupMinutes / estimatedTotalMinutes)
                : 0;

            // V5.5: Usar calculateTaktTime que itera sobre cada turno correctamente
            // Esto corrige el bug donde solo se usaban los breaks del primer turno
            const taktResult = calculateTaktTime(
                template.shifts || [],
                activeShiftsCount,
                totalDemand,
                oee,
                setupLossPercent
            );
            const taktTime = taktResult.effectiveSeconds;

            // Validar setup excesivo (menos de 30 min productivos por turno)
            if (taktResult.netAvailableMinutes < 30 * activeShiftsCount) {
                toast.warning('Setup Excesivo',
                    `El setup de ${setupMinutes} min deja muy poco tiempo productivo`);
            }

            // 4. Crear escenario para balanceo
            const scenario: MixScenario = {
                ...createEmptyMixScenario('Mix V2', 'Sistema'),
                products: productRefs.map(p => ({ path: p.path, demand: p.demand })),
                totalDemand
            };

            // 5. Ejecutar balanceo usando lógica existente
            const balanceResult = balanceMixedModel(
                loadedProducts,
                scenario,
                taktTime,
                taktTime,
                plantAssets.machines || []
            );

            if (!balanceResult.success || !balanceResult.result) {
                toast.error('Error de Balanceo', balanceResult.error || 'Error desconocido');
                setStep('select');
                setIsCalculating(false);
                return;
            }

            // 6. Analizar por sector (lógica existente)
            const productNames = selectedProducts.map((p, idx) => ({
                path: p.path,
                name: p.displayName,
                demand: p.dailyDemand
            }));

            const sectorAnalysis = analyzeMixBySector(
                balanceResult.result,
                productNames,
                taktTime,
                {
                    version: 1,
                    lastModified: Date.now(),
                    sectors: plantAssets.sectors || [],
                    machines: plantAssets.machines || []
                },
                0.85
            );

            // 7. Transformar a formato simplificado
            const simplified = toSimplifiedResult(sectorAnalysis, productNames, taktTime);

            // 8. V4.2: Validar restricciones de proceso (curado, inyección)
            const allTasks = loadedProducts.flatMap(p => p.tasks);
            const processResult = validateProcessConstraints(
                allTasks,
                taktTime,
                {
                    version: 1,
                    lastModified: Date.now(),
                    sectors: plantAssets.sectors || [],
                    machines: plantAssets.machines || []
                }
            );

            if (processResult.violations.length > 0) {
                // Agregar violaciones de proceso al resultado
                simplified.processViolations = processResult.violations.map(v => ({
                    taskId: v.taskId,
                    taskDescription: v.taskDescription,
                    requiredMachines: v.requiredMachines,
                    deficit: v.deficit,
                    message: v.message
                }));

                if (processResult.fatalMessage) {
                    toast.error('Restricción de Proceso', processResult.fatalMessage);
                    simplified.isViable = false;
                }
            }

            // 9. V4.2: Validar modelos individuales vs Takt
            if (balanceResult.weightedTasks) {
                const modelResult = validateModelVariability(
                    balanceResult.weightedTasks,
                    taktTime,
                    totalDemand
                );

                if (modelResult.alerts.length > 0) {
                    simplified.modelAlerts = modelResult.alerts.map(a => ({
                        modelName: a.modelName,
                        taskId: a.taskId,
                        taskDescription: a.taskDescription,
                        message: a.message,
                        severity: a.severity
                    }));
                    // V5.4 FIX: Removed duplicate warning push - modelAlerts section already shows this info
                }
            }

            setResult(simplified);
            setStep('results');

            if (simplified.isViable) {
                toast.success('Cálculo Completado', simplified.summary);
            } else {
                toast.warning('Recursos Insuficientes', 'Ver detalles por sector');
            }

        } catch (e) {
            logger.error('MixV2', 'Calculation error', { error: String(e) });
            toast.error('Error', (e as Error).message);
            setStep('select');
        } finally {
            setIsCalculating(false);
        }
    };

    /**
     * Volver a selección
     */
    const handleReset = useCallback(() => {
        setStep('select');
        setResult(null);
    }, []);

    /**
     * V5.1: Manejar acción de volver con confirmación si hay resultados
     */
    const handleBackWithConfirm = () => {
        if (result !== null) {
            setPendingAction('back');
            setShowExitConfirm(true);
        } else {
            onBack?.();
        }
    };

    /**
     * V5.1: Manejar reset con confirmación si hay resultados
     */
    const handleResetWithConfirm = () => {
        if (result !== null) {
            setPendingAction('reset');
            setShowExitConfirm(true);
        } else {
            handleReset();
        }
    };

    /**
     * V5.1: Confirmar acción pendiente
     */
    const confirmPendingAction = () => {
        if (pendingAction === 'back') {
            onBack?.();
        } else if (pendingAction === 'reset') {
            handleReset();
        }
        setShowExitConfirm(false);
        setPendingAction(null);
    };

    /**
     * V5.1: Cancelar acción pendiente
     */
    const cancelPendingAction = () => {
        setShowExitConfirm(false);
        setPendingAction(null);
    };

    /**
     * V5.0: Guardar escenario Mix
     */
    const handleSaveMix = async () => {
        if (!result) return;

        const scenario: MixSavedScenario = {
            type: 'mix_saved_scenario',
            version: 1,
            id: crypto.randomUUID(),
            name: `Mix ${new Date().toLocaleDateString('es-AR')}`,
            createdAt: new Date().toISOString(),
            selectedProducts: selectedProducts.map(p => ({
                path: p.path,
                name: p.displayName,
                demand: p.dailyDemand
            })),
            totalDemand,
            setupMinutesPerShift: setupMinutes,  // V4.2: Persistir setup
            result
        };

        const success = await plantAssets.saveMixScenario(scenario);
        if (success) {
            toast.success('Escenario Guardado', `"${scenario.name}" guardado correctamente`);
        } else {
            toast.error('Error', 'No se pudo guardar el escenario');
        }
    };

    /**
     * V5.0: Exportar a PDF (usando print)
     */
    const handleExportPDF = useCallback(() => {
        window.print();
    }, []);

    // Memoized totalDemand to avoid recalculating on each render
    const totalDemand = useMemo(() =>
        selectedProducts.reduce((sum, p) => sum + p.dailyDemand, 0),
        [selectedProducts]);

    // Memoized Takt preview to avoid IIFE in render
    const taktPreview = useMemo(() => {
        if (totalDemand === 0) return '';
        const hoursPerShift = 8;
        const defaultOEE = 0.85;
        const availableMin = (hoursPerShift * 60 * defaultOEE) - setupMinutes;
        const taktEstimado = (availableMin * 60) / totalDemand;
        if (taktEstimado <= 0) return '⚠️ Setup muy alto - no hay tiempo de producción';
        const multiProduct = selectedProducts.length > 1;
        const disclaimer = multiProduct
            ? '(conservador: 1 turno, OEE 85% — el cálculo usará config. del primer producto)'
            : '(conservador: 1 turno, OEE 85% — el cálculo usará tu configuración exacta)';
        return `📊 Takt estimado: ~${taktEstimado.toFixed(1)}s ${disclaimer}`;
    }, [totalDemand, setupMinutes, selectedProducts.length]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                <div className="max-w-5xl mx-auto px-6 py-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {onBack && (
                                <button
                                    onClick={handleBackWithConfirm}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <ArrowLeft size={24} />
                                </button>
                            )}
                            <div>
                                <h1 className="text-2xl font-bold">Planificador de Mix</h1>
                                <p className="text-blue-100 text-sm mt-1">
                                    {step === 'select' && 'Seleccioná los productos que vas a fabricar'}
                                    {step === 'calculating' && 'Calculando recursos necesarios...'}
                                    {step === 'results' && 'Recursos necesarios para tu producción'}
                                </p>
                            </div>
                        </div>

                        {/* Step indicator */}
                        <div className="flex items-center gap-3">
                            {/* History Button */}
                            {plantAssets.savedMixScenarios.length > 0 && (
                                <button
                                    onClick={() => setShowHistory(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-sm"
                                >
                                    <History size={16} />
                                    Historial ({plantAssets.savedMixScenarios.length})
                                </button>
                            )}

                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'select' ? 'bg-white text-indigo-600' : 'bg-white/20 text-white'
                                    }`}>
                                    1
                                </div>
                                <div className="w-8 h-0.5 bg-white/30" />
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'results' ? 'bg-white text-indigo-600' : 'bg-white/20 text-white'
                                    }`}>
                                    2
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Step 1: Selection */}
                {step === 'select' && (
                    <>
                        <MixProductGrid
                            onSelectionChange={setSelectedProducts}
                            initialSelection={selectedProducts}
                        />

                        {/* V4.2: Setup Time Input (per expert feedback) */}
                        {selectedProducts.length > 0 && (
                            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <Settings size={18} className="text-slate-500" />
                                    <label className="text-sm font-medium text-slate-700">
                                        Tiempo de cambio/setup por turno (opcional)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="120"
                                        value={setupMinutes}
                                        onChange={(e) => setSetupMinutes(Math.max(0, Math.min(120, parseInt(e.target.value) || 0)))}
                                        className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-center"
                                        placeholder="0"
                                    />
                                    <span className="text-sm text-slate-500">min</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 ml-8">
                                    Tiempo perdido en cambios de modelo/moldes. Dejá en 0 si no aplica.
                                </p>
                                {/* V4.2: Preview Takt en tiempo real */}
                                {/* V5.6 FIX: Mensaje mejorado que distingue 1 vs múltiples productos */}
                                {selectedProducts.length > 0 && taktPreview && (
                                    <p className="text-xs text-blue-600 mt-1 ml-8 font-medium">
                                        {taktPreview}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Advertencia de demanda estimada */}
                        {selectedProducts.some(p => p.isDefaultDemand) && (
                            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                                <span className="text-amber-500">⚠️</span>
                                <div className="text-sm text-amber-800">
                                    <strong>{selectedProducts.filter(p => p.isDefaultDemand).length} producto(s)</strong> tienen demanda estimada (100 pz/día).
                                    Revisá los valores antes de calcular.
                                </div>
                            </div>
                        )}

                        {/* Calculate Button */}
                        {selectedProducts.length > 0 && (
                            <div className="mt-6 flex justify-center">
                                <button
                                    onClick={handleCalculate}
                                    disabled={isCalculating}
                                    className={`flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-lg font-semibold shadow-lg transition-all ${isCalculating
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl active:scale-95'
                                        }`}
                                >
                                    {isCalculating ? <Loader2 size={24} className="animate-spin" /> : <Play size={24} />}
                                    {isCalculating ? 'Calculando...' : 'Calcular Recursos'}
                                </button>
                            </div>
                        )}

                        {/* Selection Summary */}
                        {selectedProducts.length > 0 && (
                            <div className="mt-4 text-center text-slate-500 text-sm">
                                {selectedProducts.length} producto{selectedProducts.length > 1 ? 's' : ''} seleccionado{selectedProducts.length > 1 ? 's' : ''} •
                                Demanda total: {totalDemand.toLocaleString()} pz/día
                            </div>
                        )}
                    </>
                )}

                {/* Step: Calculating */}
                {step === 'calculating' && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
                        <Loader2 size={64} className="mx-auto text-blue-500 animate-spin mb-6" />
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Calculando recursos...</h2>
                        <p className="text-slate-500">
                            Analizando {selectedProducts.length} producto{selectedProducts.length > 1 ? 's' : ''}
                            con demanda total de {totalDemand.toLocaleString()} pz/día
                        </p>
                    </div>
                )}

                {/* Step 2: Results */}
                {step === 'results' && result && (
                    <>
                        {/* Action Bar */}
                        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                            <button
                                onClick={handleResetWithConfirm}
                                className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
                            >
                                <RefreshCw size={18} />
                                Modificar selección
                            </button>

                            <div className="flex items-center gap-2">
                                {/* Save Button */}
                                <button
                                    onClick={handleSaveMix}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                                >
                                    <Save size={18} />
                                    Guardar
                                </button>

                                {/* Export PDF Button */}
                                <button
                                    onClick={handleExportPDF}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    <FileText size={18} />
                                    Exportar PDF
                                </button>
                            </div>
                        </div>

                        {/* V5.3: Configuration Warning Banner */}
                        {configWarning && (
                            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-start gap-3">
                                <span className="text-xl">⚠️</span>
                                <div>
                                    <strong className="block">Advertencia de Configuración</strong>
                                    <p className="text-sm mt-1">{configWarning}</p>
                                </div>
                            </div>
                        )}

                        {/* Summary */}
                        <MixResultsSummary result={result} />

                        {/* Sector Details */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800">
                                Detalle por Sector
                            </h3>
                            {result.sectors.map(sector => (
                                <MixSectorCardView
                                    key={sector.sectorId}
                                    sector={sector}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* History Modal */}
            <MixHistoryModal
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
                scenarios={plantAssets.savedMixScenarios}
                onDelete={handleDeleteScenario}
                onSelect={handleLoadScenario}
            />

            {/* V5.1: Exit Confirmation Modal */}
            <ConfirmModal
                isOpen={showExitConfirm}
                onClose={cancelPendingAction}
                onConfirm={confirmPendingAction}
                title="¿Descartar resultados?"
                message={"Tenés un cálculo de Mix sin guardar.\nSi continuás, perderás estos resultados."}
                confirmText="Salir sin guardar"
                cancelText="Cancelar"
                variant="warning"
            />
        </div>
    );
};
