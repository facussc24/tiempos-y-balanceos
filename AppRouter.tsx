/**
 * AppRouter — Top-level module router for Barack Mercosul - Ingeniería
 *
 * Manages navigation between:
 * - Landing page (module selection)
 * - Tiempos y Balanceos (original App)
 * - AMFE VDA Manager
 * - Plan de Control
 */
import React, { useState, lazy, Suspense } from 'react';
import LandingPage from './modules/LandingPage';

// Lazy-load the heavy modules
const TiemposApp = lazy(() => import('./App'));
const AmfeApp = lazy(() => import('./modules/amfe/AmfeApp'));
const ControlPlanApp = lazy(() => import('./modules/controlPlan/ControlPlanApp'));
const PfdApp = lazy(() => import('./modules/pfd/PfdApp'));

type AppMode = 'landing' | 'pfd' | 'tiempos' | 'amfe' | 'controlPlan';

const LoadingFallback: React.FC = () => (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Cargando módulo...</p>
        </div>
    </div>
);

const AppRouter: React.FC = () => {
    const [currentMode, setCurrentMode] = useState<AppMode>('landing');

    const handleSelectModule = (module: 'pfd' | 'tiempos' | 'amfe' | 'controlPlan') => {
        setCurrentMode(module);
    };

    const handleBackToLanding = () => {
        setCurrentMode('landing');
    };

    if (currentMode === 'landing') {
        return <LandingPage onSelectModule={handleSelectModule} />;
    }

    return (
        <Suspense fallback={<LoadingFallback />}>
            {currentMode === 'pfd' && <PfdApp onBackToLanding={handleBackToLanding} />}
            {currentMode === 'tiempos' && <TiemposApp onBackToLanding={handleBackToLanding} />}
            {currentMode === 'amfe' && <AmfeApp onBackToLanding={handleBackToLanding} />}
            {currentMode === 'controlPlan' && <ControlPlanApp onBackToLanding={handleBackToLanding} />}
        </Suspense>
    );
};

export default AppRouter;
