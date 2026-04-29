/**
 * AppRouter — Top-level module router for Barack Mercosul - Ingeniería
 *
 * Manages navigation between:
 * - Landing page (module selection)
 * - Tiempos y Balanceos (original App)
 * - AMFE VDA Manager
 * - Plan de Control
 * - PFD (Process Flow Diagram)
 * - Document Hub (registry)
 */
import React, { useState, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import LandingPage from './modules/LandingPage';
import type { DocumentType } from './modules/registry/documentRegistryTypes';
import { useDocumentRegistry } from './modules/registry/useDocumentRegistry';
import { ModuleErrorBoundary } from './components/ui/ModuleErrorBoundary';
import { isProductCatalogSeeded, seedProductCatalog } from './utils/repositories/productRepository';
import { PRODUCTS, CUSTOMER_LINES } from './src/data/productCatalogSeed';
import { logger } from './utils/logger';
import './utils/seed/cleanupAmfeActions'; // One-time cleanup script (window.__cleanupAmfeActions)
import { AuthProvider } from './components/auth/AuthProvider';
import { LoginPage } from './components/auth/LoginPage';
import AppSidebar from './components/layout/AppSidebar';

// Lazy-load the heavy modules
const TiemposApp = lazy(() => import('./App'));
const AmfeApp = lazy(() => import('./modules/amfe/AmfeApp'));
const DocumentHub = lazy(() => import('./modules/registry/DocumentHub'));
const SolicitudApp = lazy(() => import('./modules/solicitud/SolicitudApp'));
const ManualesApp = lazy(() => import('./modules/engineering/ManualesApp'));
const FormatosApp = lazy(() => import('./modules/engineering/FormatosApp'));
const DataManager = lazy(() => import('./modules/DataManager'));
const PfdTestRoute = lazy(() => import('./modules/pfd/PfdTestRoute'));
const PfdSvgAudit = lazy(() => import('./modules/pfd/PfdSvgAudit'));
const PfdDebugRoute = lazy(() => import('./modules/pfd/PfdDebugRoute'));
const AdminPanel = lazy(() => import('./modules/admin/AdminPanel'));
const ApqpDashboard = lazy(() => import('./modules/dashboard/ApqpDashboard'));
const FlowchartApp = lazy(() => import('./modules/flowchart/FlowchartApp'));
const EightDApp = lazy(() => import('./modules/eightD/EightDApp'));
const MediosApp = lazy(() => import('./modules/mediosCalculator/MediosApp'));
const ThreeDApp = lazy(() => import('./modules/threeDPrint/ThreeDApp'));
const BomApp = lazy(() => import('./modules/bom/BomApp'));

type AppMode = 'landing' | 'dashboard' | 'pfd' | 'pfdTest' | 'pfdSvgAudit' | 'pfdDebug' | 'tiempos' | 'amfe' | 'controlPlan' | 'hojaOperaciones' | 'registry' | 'solicitud' | 'manuales' | 'formatos' | 'dataManager' | 'admin' | 'flowchart' | '8dReports' | 'mediosCalculator' | 'threeD' | 'bom';

const VALID_MODES = new Set<AppMode>(['landing', 'dashboard', 'pfd', 'pfdTest', 'pfdSvgAudit', 'pfdDebug', 'tiempos', 'amfe', 'controlPlan', 'hojaOperaciones', 'registry', 'solicitud', 'manuales', 'formatos', 'dataManager', 'admin', 'flowchart', '8dReports', 'mediosCalculator', 'threeD', 'bom']);
const LS_KEY_MODE = 'barack_lastModule';

const LoadingFallback: React.FC = () => (
    <div className="min-h-full bg-slate-50 p-8">
        {/* Skeleton header bar */}
        <div className="h-10 w-64 rounded-lg bg-slate-200 animate-shimmer mb-8" />
        {/* Skeleton 3-column card grid */}
        <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="h-24 rounded-xl bg-slate-200 animate-shimmer" />
            <div className="h-24 rounded-xl bg-slate-200 animate-shimmer [animation-delay:75ms]" />
            <div className="h-24 rounded-xl bg-slate-200 animate-shimmer [animation-delay:150ms]" />
        </div>
        {/* Skeleton main content block */}
        <div className="h-48 rounded-xl bg-slate-200 animate-shimmer [animation-delay:200ms] mb-8" />
        {/* Small spinner + text */}
        <div className="flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">Cargando módulo...</p>
        </div>
    </div>
);

/** Map DocumentType → AppMode */
const DOC_TYPE_TO_MODE: Record<DocumentType, AppMode> = {
    pfd: 'pfd',
    amfe: 'amfe',
    controlPlan: 'controlPlan',
    hojaOperaciones: 'hojaOperaciones',
};

const AppRouterInner: React.FC = () => {
    const [currentMode, setCurrentMode] = useState<AppMode>(() => {
        // Query param ?module=<name> tiene prioridad sobre localStorage.
        // Permite acceso directo a rutas de debug (pfdDebug, pfdSvgAudit)
        // sin pasar por landing. Creado 2026-04-23 para preview_screenshot
        // de PFDs desde Claude MCP sin navegacion clickable.
        try {
            const params = new URLSearchParams(window.location.search);
            const fromQs = params.get('module') as AppMode | null;
            if (fromQs && VALID_MODES.has(fromQs) && fromQs !== 'landing') return fromQs;
        } catch { /* ignore */ }
        try {
            const saved = localStorage.getItem(LS_KEY_MODE) as AppMode | null;
            if (saved && VALID_MODES.has(saved) && saved !== 'landing') return saved;
        } catch { /* ignore */ }
        return 'landing';
    });
    /** Family ID to auto-load when navigating to AMFE from landing page */
    const [pendingFamilyId, setPendingFamilyId] = useState<number | null>(null);
    const { entries: registryEntries } = useDocumentRegistry();

    // Seed product catalog on first launch (idempotent)
    useEffect(() => {
        let cancelled = false;
        isProductCatalogSeeded().then(seeded => {
            if (cancelled || seeded) return;
            return seedProductCatalog(PRODUCTS, CUSTOMER_LINES);
        }).then(result => {
            if (cancelled || !result) return;
            logger.info('AppRouter', 'Product catalog seeded', result);
        }).catch(err => {
            if (cancelled) return;
            logger.warn('AppRouter', 'Product catalog seed failed (non-critical)', { error: String(err) });
        });
        return () => { cancelled = true; };
    }, []);

    const handleSelectModule = useCallback((module: 'dashboard' | 'pfd' | 'pfdTest' | 'pfdSvgAudit' | 'pfdDebug' | 'tiempos' | 'amfe' | 'controlPlan' | 'hojaOperaciones' | 'registry' | 'solicitud' | 'manuales' | 'formatos' | 'dataManager' | 'admin' | 'flowchart' | '8dReports' | 'mediosCalculator' | 'threeD' | 'bom') => {
        setCurrentMode(module);
        try { localStorage.setItem(LS_KEY_MODE, module); } catch { /* ignore */ }
    }, []);

    const handleBackToLanding = useCallback(() => {
        setCurrentMode('landing');
        setPendingFamilyId(null);
        try { localStorage.removeItem(LS_KEY_MODE); } catch { /* ignore */ }
    }, []);

    /** Navigate to AMFE and auto-load a project by family ID */
    const handleOpenProjectFamily = useCallback((familyId: number) => {
        setPendingFamilyId(familyId);
        setCurrentMode('amfe');
        try { localStorage.setItem(LS_KEY_MODE, 'amfe'); } catch { /* ignore */ }
    }, []);

    /** Open a document from the Hub — navigates to the correct module */
    const handleOpenDocument = useCallback((_type: DocumentType, _id: string) => {
        const mode = DOC_TYPE_TO_MODE[_type];
        setCurrentMode(mode);
        // TODO: Pass document ID to module for auto-loading
    }, []);

    // Compute document counts and recent docs for landing page
    const documentCounts = useMemo(() => {
        const counts: Partial<Record<DocumentType, number>> = {};
        for (const e of registryEntries) {
            counts[e.type] = (counts[e.type] || 0) + 1;
        }
        return counts;
    }, [registryEntries]);

    const recentDocuments = useMemo(() => {
        return registryEntries.slice(0, 5);
    }, [registryEntries]);

    return (
        <div className="flex h-screen overflow-hidden">
            <AppSidebar
                currentMode={currentMode}
                onSelectModule={handleSelectModule}
                onBackToLanding={handleBackToLanding}
            />
            <main className="flex-1 overflow-auto">
                {currentMode === 'landing' ? (
                    <div className="page-transition-enter">
                        <LandingPage
                            onSelectModule={handleSelectModule}
                            onOpenProjectFamily={handleOpenProjectFamily}
                            documentCounts={documentCounts}
                            recentDocuments={recentDocuments}
                        />
                    </div>
                ) : (
                    <div key={currentMode} className="page-transition-enter">
                    <Suspense fallback={<LoadingFallback />}>
                        {currentMode === 'dashboard' && (
                            <ModuleErrorBoundary moduleName="Dashboard APQP" onNavigateHome={handleBackToLanding}>
                                <ApqpDashboard onBackToLanding={handleBackToLanding} />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'pfd' && (
                            <ModuleErrorBoundary moduleName="Diagrama de Flujo" onNavigateHome={handleBackToLanding}>
                                <AmfeApp onBackToLanding={handleBackToLanding} initialTab="pfd" />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'pfdTest' && (
                            <ModuleErrorBoundary moduleName="PFD Test" onNavigateHome={handleBackToLanding}>
                                <PfdTestRoute onBackToLanding={handleBackToLanding} />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'pfdSvgAudit' && (
                            <ModuleErrorBoundary moduleName="PFD SVG Audit" onNavigateHome={handleBackToLanding}>
                                <PfdSvgAudit />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'pfdDebug' && (
                            <ModuleErrorBoundary moduleName="PFD Debug" onNavigateHome={handleBackToLanding}>
                                <PfdDebugRoute />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'tiempos' && (
                            <ModuleErrorBoundary moduleName="Tiempos y Balanceos" onNavigateHome={handleBackToLanding}>
                                <TiemposApp onBackToLanding={handleBackToLanding} />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'amfe' && (
                            <ModuleErrorBoundary moduleName="AMFE VDA" onNavigateHome={handleBackToLanding}>
                                <AmfeApp onBackToLanding={handleBackToLanding} initialTab="amfe" initialFamilyId={pendingFamilyId} onFamilyIdConsumed={() => setPendingFamilyId(null)} />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'controlPlan' && (
                            <ModuleErrorBoundary moduleName="Plan de Control" onNavigateHome={handleBackToLanding}>
                                <AmfeApp onBackToLanding={handleBackToLanding} initialTab="controlPlan" />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'hojaOperaciones' && (
                            <ModuleErrorBoundary moduleName="Hojas de Operaciones" onNavigateHome={handleBackToLanding}>
                                <AmfeApp onBackToLanding={handleBackToLanding} initialTab="hojaOperaciones" />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'solicitud' && (
                            <ModuleErrorBoundary moduleName="Solicitudes de Código" onNavigateHome={handleBackToLanding}>
                                <SolicitudApp onBackToLanding={handleBackToLanding} />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'manuales' && (
                            <ModuleErrorBoundary moduleName="Manuales de Ingeniería" onNavigateHome={handleBackToLanding}>
                                <ManualesApp onBackToLanding={handleBackToLanding} />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'formatos' && (
                            <ModuleErrorBoundary moduleName="Formatos Estándar" onNavigateHome={handleBackToLanding}>
                                <FormatosApp onBackToLanding={handleBackToLanding} />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'registry' && (
                            <ModuleErrorBoundary moduleName="Registro de Documentos" onNavigateHome={handleBackToLanding}>
                                <DocumentHub onBackToLanding={handleBackToLanding} onOpenDocument={handleOpenDocument} />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'dataManager' && (
                            <ModuleErrorBoundary moduleName="Datos y Seguridad" onNavigateHome={handleBackToLanding}>
                                <DataManager onBackToLanding={handleBackToLanding} />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'admin' && (
                            <ModuleErrorBoundary moduleName="Administración" onNavigateHome={handleBackToLanding}>
                                <AdminPanel onBackToLanding={handleBackToLanding} />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'flowchart' && (
                            <ModuleErrorBoundary moduleName="Flujograma Estático" onNavigateHome={handleBackToLanding}>
                                <FlowchartApp />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === '8dReports' && (
                            <ModuleErrorBoundary moduleName="Reportes 8D" onNavigateHome={handleBackToLanding}>
                                <EightDApp onBackToLanding={handleBackToLanding} />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'mediosCalculator' && (
                            <ModuleErrorBoundary moduleName="Medios Logisticos" onNavigateHome={handleBackToLanding}>
                                <MediosApp onBackToLanding={handleBackToLanding} />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'threeD' && (
                            <ModuleErrorBoundary moduleName="Impresion 3D" onNavigateHome={handleBackToLanding}>
                                <ThreeDApp onBackToLanding={handleBackToLanding} />
                            </ModuleErrorBoundary>
                        )}
                        {currentMode === 'bom' && (
                            <ModuleErrorBoundary moduleName="Lista de Materiales (BOM)" onNavigateHome={handleBackToLanding}>
                                <BomApp onBackToLanding={handleBackToLanding} />
                            </ModuleErrorBoundary>
                        )}
                    </Suspense>
                    </div>
                )}
            </main>
        </div>
    );
};

const AppRouter: React.FC = () => (
    <AuthProvider loginPage={<LoginPage />}>
        <AppRouterInner />
    </AuthProvider>
);

export default AppRouter;
