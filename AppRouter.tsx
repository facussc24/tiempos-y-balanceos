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
import { AuthProvider } from './components/auth/AuthProvider';
import { LoginPage } from './components/auth/LoginPage';

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
const AdminPanel = lazy(() => import('./modules/admin/AdminPanel'));

type AppMode = 'landing' | 'pfd' | 'pfdTest' | 'pfdSvgAudit' | 'tiempos' | 'amfe' | 'controlPlan' | 'hojaOperaciones' | 'registry' | 'solicitud' | 'manuales' | 'formatos' | 'dataManager' | 'admin';

const VALID_MODES = new Set<AppMode>(['landing', 'pfd', 'pfdTest', 'pfdSvgAudit', 'tiempos', 'amfe', 'controlPlan', 'hojaOperaciones', 'registry', 'solicitud', 'manuales', 'formatos', 'dataManager', 'admin']);
const LS_KEY_MODE = 'barack_lastModule';

const LoadingFallback: React.FC = () => (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Cargando módulo...</p>
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
        try {
            const saved = localStorage.getItem(LS_KEY_MODE) as AppMode | null;
            if (saved && VALID_MODES.has(saved) && saved !== 'landing') return saved;
        } catch { /* ignore */ }
        return 'landing';
    });
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

    const handleSelectModule = useCallback((module: 'pfd' | 'pfdTest' | 'pfdSvgAudit' | 'tiempos' | 'amfe' | 'controlPlan' | 'hojaOperaciones' | 'registry' | 'solicitud' | 'manuales' | 'formatos' | 'dataManager' | 'admin') => {
        setCurrentMode(module);
        try { localStorage.setItem(LS_KEY_MODE, module); } catch { /* ignore */ }
    }, []);

    const handleBackToLanding = useCallback(() => {
        setCurrentMode('landing');
        try { localStorage.removeItem(LS_KEY_MODE); } catch { /* ignore */ }
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

    if (currentMode === 'landing') {
        return (
            <LandingPage
                onSelectModule={handleSelectModule}
                documentCounts={documentCounts}
                recentDocuments={recentDocuments}
            />
        );
    }

    return (
        <Suspense fallback={<LoadingFallback />}>
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
            {currentMode === 'tiempos' && (
                <ModuleErrorBoundary moduleName="Tiempos y Balanceos" onNavigateHome={handleBackToLanding}>
                    <TiemposApp onBackToLanding={handleBackToLanding} />
                </ModuleErrorBoundary>
            )}
            {currentMode === 'amfe' && (
                <ModuleErrorBoundary moduleName="AMFE VDA" onNavigateHome={handleBackToLanding}>
                    <AmfeApp onBackToLanding={handleBackToLanding} initialTab="amfe" />
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
        </Suspense>
    );
};

const AppRouter: React.FC = () => (
    <AuthProvider loginPage={<LoginPage />}>
        <AppRouterInner />
    </AuthProvider>
);

export default AppRouter;
