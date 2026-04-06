/**
 * Quality Check Table — Read-only display of CP-derived quality checks.
 * Per NotebookLM: WI "consumes" CP data. Only 'registro' column is editable.
 * CC/SC symbols are shown visually per IATF requirement.
 */

import React from 'react';
import { HoQualityCheck } from './hojaOperacionesTypes';
import { HO_QC_INHERITED_SET } from '../controlPlan/fieldClassification';
import { ExternalLink, AlertTriangle } from 'lucide-react';

interface Props {
    checks: HoQualityCheck[];
    onUpdateRegistro: (checkId: string, value: string) => void;
    readOnly?: boolean;
    onNavigateToCp?: (cpItemId: string) => void;
    /** Set of check IDs with broken CP links (for row highlighting). */
    brokenCheckIds?: Set<string>;
}

function SpecialCharBadge({ symbol }: { symbol: string }) {
    if (!symbol) return null;
    const upper = (symbol || '').toUpperCase().trim();
    const colorClass = upper === 'CC'
        ? 'bg-red-100 text-red-700 border border-red-300'
        : upper === 'SC'
        ? 'bg-amber-100 text-amber-700 border border-amber-300'
        : upper === 'PTC'
        ? 'bg-blue-100 text-blue-700 border border-blue-300'
        : '';
    if (!colorClass) return null;
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${colorClass}`}>
            {symbol}
        </span>
    );
}

const HoQualityCheckTable: React.FC<Props> = ({ checks, onUpdateRegistro, readOnly, onNavigateToCp, brokenCheckIds }) => {
    if (checks.length === 0) {
        return (
            <p className="text-xs text-gray-400 italic px-2 py-3">
                Sin verificaciones de calidad. Genere primero el Plan de Control.
            </p>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" aria-label="Verificaciones de calidad">
                <thead>
                    <tr className="bg-gray-50 text-left">
                        <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600 w-8">#</th>
                        <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600">Característica</th>
                        <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600">Especificación</th>
                        <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600">Método</th>
                        <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600">Resp.</th>
                        <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600">Frec.</th>
                        <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600">Registro</th>
                        {onNavigateToCp && <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600 w-10"></th>}
                    </tr>
                </thead>
                <tbody>
                    {checks.map((qc, i) => {
                        const isBroken = brokenCheckIds?.has(qc.id) ?? false;
                        const isOrphaned = qc.orphaned === true;
                        const rowBg = isOrphaned
                            ? 'bg-amber-50 border-l-2 border-l-amber-400'
                            : isBroken
                            ? 'bg-orange-50 border-l-2 border-l-orange-400'
                            : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                        return (
                            <tr key={qc.id} className={rowBg}>
                                <td className="px-2 py-1.5 border border-gray-200 text-gray-400 text-center">
                                    {isBroken ? (
                                        <span title="Vínculo CP roto"><AlertTriangle size={12} className="text-orange-500 mx-auto" /></span>
                                    ) : (
                                        i + 1
                                    )}
                                </td>
                                <td className="px-2 py-1.5 border border-gray-200 border-l-2 border-l-blue-200" title="Dato del CP — se actualiza al regenerar">
                                    <div className="flex items-center gap-1.5">
                                        <SpecialCharBadge symbol={qc.specialCharSymbol} />
                                        <span>{qc.characteristic}</span>
                                    </div>
                                </td>
                                <td className="px-2 py-1.5 border border-gray-200 text-gray-600 border-l-2 border-l-blue-200" title="Dato del CP — se actualiza al regenerar">
                                    {qc.specification || <span className="text-gray-300 italic text-[10px]">Según plano</span>}
                                </td>
                                <td className="px-2 py-1.5 border border-gray-200 text-gray-600 border-l-2 border-l-blue-200" title="Dato del CP — se actualiza al regenerar">
                                    {qc.controlMethod || qc.evaluationTechnique}
                                </td>
                                <td className="px-2 py-1.5 border border-gray-200 text-gray-600 border-l-2 border-l-blue-200" title="Dato del CP — se actualiza al regenerar">
                                    {qc.reactionContact || <span className="text-gray-300 italic text-[10px]">Ver CP</span>}
                                </td>
                                <td className="px-2 py-1.5 border border-gray-200 text-gray-600 border-l-2 border-l-blue-200" title="Dato del CP — se actualiza al regenerar">
                                    {qc.frequency}
                                </td>
                                <td className="px-2 py-1.5 border border-gray-200">
                                    <input
                                        type="text"
                                        value={qc.registro}
                                        onChange={e => onUpdateRegistro(qc.id, e.target.value)}
                                        readOnly={readOnly}
                                        placeholder="Ej: PLN-001"
                                        className="w-full px-1 py-0.5 text-xs border border-transparent hover:border-gray-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded bg-transparent focus:bg-white outline-none transition"
                                    />
                                </td>
                                {onNavigateToCp && (
                                    <td className="px-1 py-1 border border-gray-200 text-center">
                                        {qc.cpItemId ? (
                                            isBroken ? (
                                                <span className="text-[9px] text-orange-500 font-medium" title="Ítem CP eliminado">
                                                    <AlertTriangle size={10} className="inline" /> roto
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => onNavigateToCp(qc.cpItemId!)}
                                                    className="text-[9px] text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-1.5 py-0.5 rounded transition flex items-center gap-0.5"
                                                    title="Ver item en Plan de Control"
                                                >
                                                    <ExternalLink size={10} />
                                                    CP
                                                </button>
                                            )
                                        ) : (
                                            <span className="text-gray-300 text-[9px]">—</span>
                                        )}
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default HoQualityCheckTable;
