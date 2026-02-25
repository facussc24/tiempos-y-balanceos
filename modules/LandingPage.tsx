import React, { useEffect } from 'react';
import { Clock, ShieldAlert, ClipboardCheck, GitBranch, ArrowRight } from 'lucide-react';
import barackLogo from '../src/assets/barack_logo.png';

interface LandingPageProps {
    onSelectModule: (module: 'pfd' | 'tiempos' | 'amfe' | 'controlPlan') => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSelectModule }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === '1') onSelectModule('pfd');
            if (e.key === '2') onSelectModule('amfe');
            if (e.key === '3') onSelectModule('controlPlan');
            if (e.key === '4') onSelectModule('tiempos');
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onSelectModule]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-8 font-sans">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-5 pointer-events-none">
                <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                }} />
            </div>

            {/* Main content */}
            <div className="relative z-10 text-center max-w-4xl mx-auto">
                {/* Logo & Title */}
                <div className="mb-12 opacity-0 animate-fade-in-up">
                    <img
                        src={barackLogo}
                        alt="Barack Mercosul"
                        className="h-20 mx-auto mb-6"
                        style={{ filter: 'drop-shadow(0 4px 12px rgba(59, 130, 246, 0.25))' }}
                    />
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
                        Barack Mercosul
                    </h1>
                    <p className="text-xl text-blue-400 font-medium tracking-wide">
                        Ingeniería de Calidad Automotriz
                    </p>
                    <div className="w-32 h-1 bg-gradient-to-r from-blue-500 to-cyan-400 mx-auto mt-4 rounded-full" />
                </div>

                {/* Module Cards */}
                <nav className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto" aria-label="Módulos disponibles">
                    {/* PFD Card */}
                    <button
                        onClick={() => onSelectModule('pfd')}
                        aria-label="Abrir módulo Diagrama de Flujo del Proceso"
                        className="group relative opacity-0 animate-fade-in-up stagger-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-left
                                   hover:bg-white/10 hover:border-cyan-400/50 hover:shadow-xl hover:shadow-cyan-500/10
                                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-white/70
                                   transition-all duration-300 cursor-pointer"
                    >
                        <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-60 transition-opacity">
                            <kbd className="text-xs text-slate-400 bg-white/10 px-1.5 py-0.5 rounded font-mono">1</kbd>
                        </div>
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight size={20} className="text-cyan-400" />
                        </div>
                        <div className="bg-cyan-500/20 w-14 h-14 rounded-xl flex items-center justify-center mb-5 group-hover:bg-cyan-500/30 transition-colors">
                            <GitBranch size={28} className="text-cyan-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            Diagrama de Flujo
                        </h2>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Diagrama de Flujo del Proceso según AIAG (APQP) con simbología ASME estándar.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">PFD</span>
                            <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">APQP</span>
                            <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">ASME</span>
                        </div>
                    </button>

                    {/* AMFE VDA Card */}
                    <button
                        onClick={() => onSelectModule('amfe')}
                        aria-label="Abrir módulo AMFE VDA"
                        className="group relative opacity-0 animate-fade-in-up stagger-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-left
                                   hover:bg-white/10 hover:border-orange-400/50 hover:shadow-xl hover:shadow-orange-500/10
                                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-white/70
                                   transition-all duration-300 cursor-pointer"
                    >
                        <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-60 transition-opacity">
                            <kbd className="text-xs text-slate-400 bg-white/10 px-1.5 py-0.5 rounded font-mono">2</kbd>
                        </div>
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight size={20} className="text-orange-400" />
                        </div>
                        <div className="bg-orange-500/20 w-14 h-14 rounded-xl flex items-center justify-center mb-5 group-hover:bg-orange-500/30 transition-colors">
                            <ShieldAlert size={28} className="text-orange-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            AMFE VDA
                        </h2>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Análisis de Modo y Efecto de Falla según AIAG-VDA 1ª Edición con cálculo automático de prioridad (AP).
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">AIAG-VDA</span>
                            <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">AP Automático</span>
                            <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">Riesgo</span>
                        </div>
                    </button>

                    {/* Plan de Control Card */}
                    <button
                        onClick={() => onSelectModule('controlPlan')}
                        aria-label="Abrir módulo Plan de Control"
                        className="group relative opacity-0 animate-fade-in-up stagger-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-left
                                   hover:bg-white/10 hover:border-green-400/50 hover:shadow-xl hover:shadow-green-500/10
                                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-white/70
                                   transition-all duration-300 cursor-pointer"
                    >
                        <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-60 transition-opacity">
                            <kbd className="text-xs text-slate-400 bg-white/10 px-1.5 py-0.5 rounded font-mono">3</kbd>
                        </div>
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight size={20} className="text-green-400" />
                        </div>
                        <div className="bg-green-500/20 w-14 h-14 rounded-xl flex items-center justify-center mb-5 group-hover:bg-green-500/30 transition-colors">
                            <ClipboardCheck size={28} className="text-green-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            Plan de Control
                        </h2>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Plan de Control AIAG (APQP) con 13 columnas. Genera desde el AMFE o crea de cero.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">AIAG</span>
                            <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">13 Columnas</span>
                            <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">Vinculado</span>
                        </div>
                    </button>

                    {/* Tiempos y Balanceos Card */}
                    <button
                        onClick={() => onSelectModule('tiempos')}
                        aria-label="Abrir módulo Tiempos y Balanceos"
                        className="group relative opacity-0 animate-fade-in-up stagger-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-left
                                   hover:bg-white/10 hover:border-blue-400/50 hover:shadow-xl hover:shadow-blue-500/10
                                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-white/70
                                   transition-all duration-300 cursor-pointer"
                    >
                        <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-60 transition-opacity">
                            <kbd className="text-xs text-slate-400 bg-white/10 px-1.5 py-0.5 rounded font-mono">4</kbd>
                        </div>
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight size={20} className="text-blue-400" />
                        </div>
                        <div className="bg-blue-500/20 w-14 h-14 rounded-xl flex items-center justify-center mb-5 group-hover:bg-blue-500/30 transition-colors">
                            <Clock size={28} className="text-blue-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            Tiempos y Balanceos
                        </h2>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Estudios de línea, balanceo de operaciones, simulación de flujo y análisis de capacidad.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Cronometraje</span>
                            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Balanceo</span>
                            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Simulación</span>
                        </div>
                    </button>
                </nav>

                {/* Footer */}
                <footer className="mt-16 text-slate-400 text-xs opacity-0 animate-fade-in-up stagger-4" role="contentinfo">
                    <p>v7.0 • Barack Mercosul • Ingeniería de Calidad Automotriz</p>
                </footer>
            </div>
        </div>
    );
};

export default LandingPage;
