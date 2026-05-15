/**
 * ThreeDApp — Modulo "Modelos 3D"
 *
 * Selector entre modelos 3D del proyecto:
 *  - Tornillo + Tuerca paramétricos (impresion 3D, exporta STL)
 *  - Puesto de Trabajo (reconstruccion 3D del puesto Barack, exporta glTF/STL/OBJ)
 *
 * Cada modelo vive en su propio archivo HTML standalone bajo `public/` y se
 * carga en un iframe para conservar styling/comportamiento del prototipo
 * sin tener que portar el codigo Three.js a React.
 */
import React, { useState } from 'react';
import { ArrowLeft, Wrench, Box } from 'lucide-react';

interface ThreeDAppProps {
    onBackToLanding?: () => void;
}

type ModelId = 'bolt' | 'workstation';

interface ModelDef {
    id: ModelId;
    label: string;
    sub: string;
    file: string;
    icon: React.ComponentType<{ size?: number }>;
}

const MODELS: ModelDef[] = [
    {
        id: 'bolt',
        label: 'Tornillo + Tuerca',
        sub: 'ISO métrica · STL',
        file: '3d-bolt-generator.html',
        icon: Wrench,
    },
    {
        id: 'workstation',
        label: 'Puesto de Trabajo',
        sub: 'Reconstrucción 3D · glTF/STL/OBJ',
        file: 'puesto-3d/index.html',
        icon: Box,
    },
];

const ThreeDApp: React.FC<ThreeDAppProps> = ({ onBackToLanding }) => {
    const [selected, setSelected] = useState<ModelId>('bolt');

    const model = MODELS.find((m) => m.id === selected) ?? MODELS[0];

    // Cache-bust dual:
    //  - __BUILD_TIMESTAMP__ (build time): cambia en cada deploy a GH Pages.
    //  - mountTs (runtime, useState lazy init): cambia cada vez que se monta
    //    el componente. useState lazy init es purity-safe (ejecuta una vez al
    //    primer render). useMemo() con Date.now() falla react-hooks/purity.
    // El segundo garantiza que aun si el usuario tiene el bundle React viejo
    // cacheado, el iframe se re-fetcha. Antes solo el primero -> si el bundle
    // viejo no incluia el ?v=..., el iframe servia cache vieja indefinidamente.
    const [mountTs] = useState(() => Date.now());
    const src = `${import.meta.env.BASE_URL}${model.file}?v=${__BUILD_TIMESTAMP__}&t=${mountTs}`;

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Header con boton volver + selector de modelo */}
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
                <h1 className="text-sm font-semibold text-slate-900 mr-2">
                    Modelos 3D
                </h1>

                {/* Selector tipo tabs */}
                <div className="flex items-center gap-1 bg-slate-100 rounded p-0.5">
                    {MODELS.map((m) => {
                        const Icon = m.icon;
                        const isActive = m.id === selected;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setSelected(m.id)}
                                className={
                                    'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-colors ' +
                                    (isActive
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900')
                                }
                                aria-pressed={isActive}
                                title={m.sub}
                            >
                                <Icon size={14} />
                                <span>{m.label}</span>
                            </button>
                        );
                    })}
                </div>

                <span className="text-xs text-slate-500 ml-auto">{model.sub}</span>
            </div>

            {/* Iframe ocupa el resto. `key` fuerza re-mount al cambiar de modelo,
             *  asi cada visor arranca fresco (Three.js + listeners limpios). */}
            <iframe
                key={selected}
                src={src}
                title={`Visor 3D — ${model.label}`}
                className="flex-1 w-full border-0"
                style={{ minHeight: 0 }}
            />
        </div>
    );
};

export default ThreeDApp;
