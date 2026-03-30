/**
 * HeroSection - Welcome component for Dashboard
 * Shows when no client is selected
 * @version 6.1.0 - Landing Page Redesign
 */
import React from 'react';
import { Plus, Sparkles, ArrowRight } from 'lucide-react';

interface HeroSectionProps {
    onNewStudy: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onNewStudy }) => {
    return (
        <div className="relative py-12 px-8">
            {/* Animated glow background */}
            <div className="shadow-glow left-1/2 -translate-x-1/2 top-0" />

            {/* Content */}
            <div className="relative text-center space-y-8 max-w-2xl mx-auto">
                {/* Icon */}
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-600 to-sky-400 flex items-center justify-center shadow-lg animate-fade-in-up">
                    <Sparkles size={40} className="text-white" />
                </div>

                {/* Title */}
                <div className="animate-fade-in-up stagger-1">
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-3">
                        ¡Bienvenido a{' '}
                        <span className="gradient-text">Barack Mercosul</span>!
                    </h1>
                    <p className="text-lg text-slate-500 max-w-lg mx-auto leading-relaxed">
                        Tu herramienta profesional para optimizar procesos de manufactura
                        y balanceo de líneas de producción.
                    </p>
                </div>

                {/* CTA */}
                <div className="animate-fade-in-up stagger-2 space-y-4">
                    <button
                        onClick={onNewStudy}
                        className="hero-cta"
                    >
                        <Plus size={22} />
                        Crear Mi Primer Estudio
                        <ArrowRight size={18} className="ml-1" />
                    </button>

                    <p className="text-sm text-slate-400">
                        O selecciona un{' '}
                        <button
                            onClick={() => {
                                const clientSelect = document.querySelector('select') as HTMLSelectElement;
                                if (clientSelect) {
                                    clientSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    setTimeout(() => clientSelect.focus(), 300);
                                }
                            }}
                            className="font-semibold text-blue-600 hover:text-blue-700 underline decoration-dotted underline-offset-2 hover:decoration-solid transition-all"
                        >
                            cliente
                        </button>{' '}
                        arriba para explorar proyectos existentes
                    </p>
                </div>

                {/* Feature highlights */}
                <div className="flex items-center justify-center gap-6 text-xs text-slate-400 animate-fade-in-up stagger-3">
                    <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Análisis de tiempos
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        Balanceo de líneas
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                        Simulación de flujo
                    </span>
                </div>
            </div>
        </div>
    );
};
