/**
 * Diagnostic QA Panel
 * 
 * Provides QA testing buttons for validating:
 * - Atomic write operations
 * - Lock creation/expiration
 * - Retry behavior with transient errors
 * - Diagnostic export
 * 
 * Only available in Tauri mode with a valid project directory.
 */

import { useState } from 'react';
import {
    FlaskConical,
    HardDrive,
    Lock,
    RefreshCw,
    Download,
    Bug,
    CheckCircle,
    XCircle,
    Loader2,
    X,
    AlertTriangle
} from 'lucide-react';
import { toast } from '../ui/Toast';
import { logger, exportDiagnosticJSON } from '../../utils/logger';
import {
    isFaultSimulationAvailable,
    enableFaultSimulation,
    disableFaultSimulation,
    getFaultSimulationStatus,
    testAtomicWrite,
    testLockBehavior,
    testRetryBehavior,
    testConflictNotRetried,
    QATestResult,
    FaultConfig,
} from '../../utils/faultSimulation';

interface DiagnosticQAProps {
    isOpen: boolean;
    onClose: () => void;
    directoryPath?: string | null;
}

type TestStatus = 'idle' | 'running' | 'passed' | 'failed';

interface TestState {
    status: TestStatus;
    result?: QATestResult;
}

export function DiagnosticQA({ isOpen, onClose, directoryPath }: DiagnosticQAProps) {
    const [tests, setTests] = useState<Record<string, TestState>>({
        atomicWrite: { status: 'idle' },
        lockBehavior: { status: 'idle' },
        retryBehavior: { status: 'idle' },
        conflictNoRetry: { status: 'idle' }
    });

    const [faultSimEnabled, setFaultSimEnabled] = useState(false);
    const [selectedFault, setSelectedFault] = useState<FaultConfig['errorType']>('ETIMEDOUT');

    const isDevMode = isFaultSimulationAvailable();

    const updateTest = (name: string, state: TestState) => {
        setTests(prev => ({ ...prev, [name]: state }));
    };

    const runTest = async (
        name: string,
        testFn: () => Promise<QATestResult>
    ) => {
        updateTest(name, { status: 'running' });
        logger.info('QA', `Starting test: ${name}`);

        try {
            const result = await testFn();
            updateTest(name, { status: result.passed ? 'passed' : 'failed', result });

            if (result.passed) {
                toast.success('Test Pasado', `${result.testName}: ${result.duration}ms`);
                logger.info('QA', `Test passed: ${name}`, { duration: result.duration, details: result.details });
            } else {
                toast.error('Test Fallido', result.error || result.details);
                logger.error('QA', `Test failed: ${name}`, { error: result.error, details: result.details });
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            updateTest(name, {
                status: 'failed',
                result: {
                    testName: name,
                    passed: false,
                    duration: 0,
                    details: 'Unexpected error',
                    error: errorMsg
                }
            });
            toast.error('Error en Test', errorMsg);
            logger.error('QA', `Test error: ${name}`, { error: errorMsg });
        }
    };

    const handleExportDiagnostic = () => {
        try {
            const json = exportDiagnosticJSON(directoryPath);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `diagnostico_qa_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1500);

            toast.success('Diagnóstico Exportado', 'Archivo guardado');
            logger.info('QA', 'Diagnostic exported');
        } catch (err) {
            toast.error('Error al Exportar', String(err));
        }
    };

    const toggleFaultSimulation = () => {
        if (faultSimEnabled) {
            disableFaultSimulation();
            setFaultSimEnabled(false);
            toast.info('Simulación Desactivada', 'Modo normal restaurado');
        } else {
            enableFaultSimulation(selectedFault, 2, 100);
            setFaultSimEnabled(true);
            toast.warning('Simulación Activada', `Forzando error ${selectedFault} (2 intentos)`);
        }
    };

    const getStatusIcon = (status: TestStatus) => {
        switch (status) {
            case 'running':
                return <Loader2 className="animate-spin text-blue-500" size={18} />;
            case 'passed':
                return <CheckCircle className="text-green-500" size={18} />;
            case 'failed':
                return <XCircle className="text-red-500" size={18} />;
            default:
                return <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300" />;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-100 text-purple-600 p-2 rounded-lg">
                            <FlaskConical size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Diagnóstico / QA</h2>
                            <p className="text-xs text-slate-500">Pruebas de integridad del sistema</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1" title="Cerrar" aria-label="Cerrar diagnóstico">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Directory Status */}
                    {!directoryPath && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-amber-700 text-sm">
                            <AlertTriangle size={16} />
                            <span>Abra un proyecto para ejecutar pruebas de archivo</span>
                        </div>
                    )}

                    {/* Test Buttons */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Pruebas</h3>

                        {/* Atomic Write Test */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                {getStatusIcon(tests.atomicWrite.status)}
                                <div>
                                    <div className="font-medium text-slate-800">Escritura Atómica</div>
                                    <div className="text-xs text-slate-500">Temp → Verificar → Rename</div>
                                </div>
                            </div>
                            <button
                                onClick={() => runTest('atomicWrite', () => testAtomicWrite(directoryPath || ''))}
                                disabled={!directoryPath || tests.atomicWrite.status === 'running'}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <HardDrive size={14} /> Probar
                            </button>
                        </div>

                        {/* Lock Behavior Test */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                {getStatusIcon(tests.lockBehavior.status)}
                                <div>
                                    <div className="font-medium text-slate-800">Comportamiento Lock</div>
                                    <div className="text-xs text-slate-500">Crear → Leer → Expiración → Liberar</div>
                                </div>
                            </div>
                            <button
                                onClick={() => runTest('lockBehavior', () => testLockBehavior(directoryPath || ''))}
                                disabled={!directoryPath || tests.lockBehavior.status === 'running'}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Lock size={14} /> Probar
                            </button>
                        </div>

                        {/* Retry Behavior Test */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                {getStatusIcon(tests.retryBehavior.status)}
                                <div>
                                    <div className="font-medium text-slate-800">Lógica de Reintentos</div>
                                    <div className="text-xs text-slate-500">Fallo transitorio → Backoff → Éxito</div>
                                </div>
                            </div>
                            <button
                                onClick={() => runTest('retryBehavior', testRetryBehavior)}
                                disabled={tests.retryBehavior.status === 'running'}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RefreshCw size={14} /> Probar
                            </button>
                        </div>

                        {/* Conflict No-Retry Test */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                {getStatusIcon(tests.conflictNoRetry.status)}
                                <div>
                                    <div className="font-medium text-slate-800">Conflicto Sin Retry</div>
                                    <div className="text-xs text-slate-500">ConflictError → NO reintentar</div>
                                </div>
                            </div>
                            <button
                                onClick={() => runTest('conflictNoRetry', testConflictNotRetried)}
                                disabled={tests.conflictNoRetry.status === 'running'}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RefreshCw size={14} /> Probar
                            </button>
                        </div>
                    </div>

                    {/* DEV Only: Fault Simulation */}
                    {isDevMode && (
                        <div className="pt-4 border-t border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                                🔧 Modo Desarrollo
                            </h3>
                            <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Bug className="text-red-500" size={18} />
                                    <div>
                                        <div className="font-medium text-red-800">Simulación de Fallos</div>
                                        <div className="text-xs text-red-600">Forzar errores para probar manejo</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={selectedFault ?? ''}
                                        onChange={(e) => setSelectedFault(e.target.value as FaultConfig['errorType'])}
                                        disabled={faultSimEnabled}
                                        className="text-xs border border-red-300 rounded px-2 py-1 bg-white"
                                    >
                                        <option value="ETIMEDOUT">ETIMEDOUT</option>
                                        <option value="EBUSY">EBUSY</option>
                                        <option value="EACCES">EACCES</option>
                                        <option value="EIO">EIO</option>
                                    </select>
                                    <button
                                        onClick={toggleFaultSimulation}
                                        className={`px-3 py-1.5 text-sm rounded-lg ${faultSimEnabled
                                                ? 'bg-red-600 text-white hover:bg-red-700'
                                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                                            }`}
                                    >
                                        {faultSimEnabled ? 'Desactivar' : 'Activar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Export Button */}
                    <div className="pt-4 border-t border-slate-200">
                        <button
                            onClick={handleExportDiagnostic}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium"
                        >
                            <Download size={18} /> Exportar Diagnóstico Completo
                        </button>
                        <p className="text-xs text-slate-500 text-center mt-2">
                            Incluye logs, metadata del sistema. Sin datos sensibles.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DiagnosticQA;
