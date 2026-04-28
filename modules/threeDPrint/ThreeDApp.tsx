/**
 * ThreeDApp — Modulo "3D" (impresion 3D parametrica)
 *
 * Generador de tornillo + tuerca ISO metricos con exportacion STL para
 * impresion 3D. Renderizado con Three.js (carga via importmap CDN).
 *
 * El generador completo vive en `public/3d-bolt-generator.html` y se carga
 * en un iframe — asi conserva el styling y el comportamiento del prototipo
 * de Claude Design sin tener que portar el codigo Three.js a React.
 */
import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface ThreeDAppProps {
    onBackToLanding?: () => void;
}

const ThreeDApp: React.FC<ThreeDAppProps> = ({ onBackToLanding }) => {
    // BASE_URL respeta el subpath en GitHub Pages (/tiempos-y-balanceos/)
    const src = `${import.meta.env.BASE_URL}3d-bolt-generator.html`;

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Mini header con boton de volver */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200">
                {onBackToLanding && (
                    <button
                        type="button"
                        onClick={onBackToLanding}
                        className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                    >
                        <ArrowLeft size={14} />
                        <span>Inicio</span>
                    </button>
                )}
                <h1 className="text-sm font-semibold text-slate-900">
                    Impresion 3D — Tornillo &amp; Tuerca parametricos
                </h1>
                <span className="text-xs text-slate-500 ml-auto">
                    ISO metrica · exporta STL
                </span>
            </div>

            {/* Iframe ocupa el resto */}
            <iframe
                src={src}
                title="Generador 3D parametrico"
                className="flex-1 w-full border-0"
                style={{ minHeight: 0 }}
            />
        </div>
    );
};

export default ThreeDApp;
