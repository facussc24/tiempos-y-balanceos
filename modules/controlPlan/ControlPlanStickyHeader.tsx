/**
 * Control Plan Sticky Column Header
 *
 * Teal-themed two-row header with AIAG tooltips per column.
 * Groups: Proceso (teal) / Características (cyan) / Métodos (sky).
 * First two columns (Nro. Parte/Proceso + Descripción) are frozen sticky left.
 * Supports column group visibility toggles.
 */

import React from 'react';
import { CP_COLUMN_TERMS, CpTerm } from './controlPlanTypes';
import { CpColumnGroupVisibility } from './useCpColumnVisibility';
import { Tooltip } from '../../components/ui/Tooltip';

interface Props {
    columnVisibility?: CpColumnGroupVisibility;
}

/** Wrap a column header label with a tooltip showing the AIAG definition */
const HeaderWithTip: React.FC<{ termKey: string; label: string; className?: string }> = ({ termKey, label, className = '' }) => {
    const term: CpTerm | undefined = CP_COLUMN_TERMS[termKey];
    if (!term) return <span className={className}>{label}</span>;
    return (
        <Tooltip content={<><span className="font-bold text-teal-300">{term.term}</span>: {term.definition}</>}>
            <span className={`cursor-help border-b border-dotted border-current ${className}`}>{label}</span>
        </Tooltip>
    );
};

const ControlPlanStickyHeader: React.FC<Props> = ({ columnVisibility }) => {
    const showProceso = !columnVisibility || columnVisibility.proceso;
    const showCaract = !columnVisibility || columnVisibility.caracteristicas;
    const showMetodos = !columnVisibility || columnVisibility.metodos;

    return (
        <thead className="sticky top-0 z-10 shadow-md text-xs font-semibold text-slate-700">
            {/* Top Level Headers (Groups) */}
            <tr className="border-b border-gray-300">
                {showProceso && (
                    <th colSpan={3} className="bg-teal-200 px-3 py-2 text-center min-w-[390px] border-r border-teal-300 font-bold text-teal-900">
                        PROCESO
                    </th>
                )}
                {showCaract && (
                    <th colSpan={4} className="bg-cyan-100 px-3 py-2 text-center min-w-[440px] border-r border-cyan-200 font-bold text-cyan-900">
                        CARACTERÍSTICAS
                    </th>
                )}
                {showMetodos && (
                    <th colSpan={8} className="bg-sky-100 px-3 py-2 text-center min-w-[970px] border-r border-sky-200 font-bold text-sky-900">
                        MÉTODOS
                    </th>
                )}
                <th rowSpan={2} className="bg-gray-200 p-2 text-center w-16 border-l border-gray-300 font-bold text-gray-600">
                    Acc.
                </th>
            </tr>

            {/* Column Sub-headers */}
            <tr className="text-[11px] leading-4 text-center border-b border-gray-300 text-slate-600">
                {/* Proceso group — first 2 columns are sticky */}
                {showProceso && (
                    <>
                        <th className="bg-teal-50 p-2 w-20 min-w-[80px] border-r border-teal-100 sticky left-0 z-20" style={{ boxShadow: 'none' }}>
                            <HeaderWithTip termKey="processStepNumber" label="Nro. Parte" />
                        </th>
                        <th className="bg-teal-50 p-2 w-44 min-w-[170px] border-r border-teal-100 sticky left-[80px] z-20" style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }}>
                            <HeaderWithTip termKey="processDescription" label="Descripción Proceso" />
                        </th>
                        <th className="bg-teal-50 p-2 w-36 border-r border-gray-300">
                            <HeaderWithTip termKey="machineDeviceTool" label="Máquina/Disp./Herram." />
                        </th>
                    </>
                )}

                {/* Caracteristicas group */}
                {showCaract && (
                    <>
                        <th className="bg-cyan-50 p-2 w-14 border-r border-cyan-100">
                            <HeaderWithTip termKey="characteristicNumber" label="Nro." />
                        </th>
                        <th className="bg-cyan-50 p-2 w-40 border-r border-cyan-100">
                            <HeaderWithTip termKey="productCharacteristic" label="Producto" />
                        </th>
                        <th className="bg-cyan-50 p-2 w-40 border-r border-cyan-100">
                            <HeaderWithTip termKey="processCharacteristic" label="Proceso" />
                        </th>
                        <th className="bg-cyan-50 p-2 w-20 border-r border-gray-300">
                            <HeaderWithTip termKey="specialCharClass" label="Clasif. Esp." />
                        </th>
                    </>
                )}

                {/* Metodos group */}
                {showMetodos && (
                    <>
                        <th className="bg-sky-50 p-2 w-40 border-r border-sky-100">
                            <HeaderWithTip termKey="specification" label="Espec./Tolerancia" />
                        </th>
                        <th className="bg-sky-50 p-2 w-36 border-r border-sky-100">
                            <HeaderWithTip termKey="evaluationTechnique" label="Téc. Evaluación" />
                        </th>
                        <th className="bg-sky-50 p-2 w-24 border-r border-sky-100">
                            <HeaderWithTip termKey="sampleSize" label="Tam. Muestra" />
                        </th>
                        <th className="bg-sky-50 p-2 w-24 border-r border-sky-100">
                            <HeaderWithTip termKey="sampleFrequency" label="Frecuencia" />
                        </th>
                        <th className="bg-sky-50 p-2 w-36 border-r border-sky-100">
                            <HeaderWithTip termKey="controlMethod" label="Método Control" />
                        </th>
                        <th className="bg-sky-50 p-2 w-40 border-r border-sky-100">
                            <HeaderWithTip termKey="reactionPlan" label="Plan Reacción" />
                        </th>
                        <th className="bg-sky-50 p-2 w-32 border-r border-sky-100">
                            <HeaderWithTip termKey="reactionPlanOwner" label="Resp. Reacción" className="text-red-600" />
                        </th>
                        <th className="bg-sky-50 p-2 w-32 border-r border-gray-300">
                            <HeaderWithTip termKey="controlProcedure" label="Procedimiento/IT" />
                        </th>
                    </>
                )}
            </tr>
        </thead>
    );
};

export default React.memo(ControlPlanStickyHeader);
