/**
 * Quality Check Table — Read-only display of CP-derived quality checks.
 * Per NotebookLM: WI "consumes" CP data. Only 'registro' column is editable.
 * CC/SC symbols are shown visually per IATF requirement.
 */

import React from 'react';
import { HoQualityCheck } from './hojaOperacionesTypes';

interface Props {
    checks: HoQualityCheck[];
    onUpdateRegistro: (checkId: string, value: string) => void;
    readOnly?: boolean;
}

function SpecialCharBadge({ symbol }: { symbol: string }) {
    if (!symbol) return null;
    const upper = symbol.toUpperCase().trim();
    const isCC = upper === 'CC';
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
            isCC
                ? 'bg-red-100 text-red-700 border border-red-300'
                : 'bg-amber-100 text-amber-700 border border-amber-300'
        }`}>
            {symbol}
        </span>
    );
}

const HoQualityCheckTable: React.FC<Props> = ({ checks, onUpdateRegistro, readOnly }) => {
    if (checks.length === 0) {
        return (
            <p className="text-xs text-gray-400 italic px-2 py-3">
                Sin verificaciones de calidad. Genere primero el Plan de Control.
            </p>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr className="bg-gray-50 text-left">
                        <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600 w-8">#</th>
                        <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600">Caracteristica</th>
                        <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600">Especificacion</th>
                        <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600">Metodo</th>
                        <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600">Resp.</th>
                        <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600">Frec.</th>
                        <th className="px-2 py-1.5 border border-gray-200 font-medium text-gray-600">Registro</th>
                    </tr>
                </thead>
                <tbody>
                    {checks.map((qc, i) => (
                        <tr key={qc.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <td className="px-2 py-1.5 border border-gray-200 text-gray-400 text-center">
                                {i + 1}
                            </td>
                            <td className="px-2 py-1.5 border border-gray-200">
                                <div className="flex items-center gap-1.5">
                                    <SpecialCharBadge symbol={qc.specialCharSymbol} />
                                    <span>{qc.characteristic}</span>
                                </div>
                            </td>
                            <td className="px-2 py-1.5 border border-gray-200 text-gray-600">
                                {qc.specification}
                            </td>
                            <td className="px-2 py-1.5 border border-gray-200 text-gray-600">
                                {qc.controlMethod || qc.evaluationTechnique}
                            </td>
                            <td className="px-2 py-1.5 border border-gray-200 text-gray-600">
                                {qc.reactionContact}
                            </td>
                            <td className="px-2 py-1.5 border border-gray-200 text-gray-600">
                                {qc.frequency}
                            </td>
                            <td className="px-2 py-1.5 border border-gray-200">
                                <input
                                    type="text"
                                    value={qc.registro}
                                    onChange={e => onUpdateRegistro(qc.id, e.target.value)}
                                    readOnly={readOnly}
                                    placeholder="—"
                                    className="w-full px-1 py-0.5 text-xs border border-transparent hover:border-gray-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded bg-transparent focus:bg-white outline-none transition"
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default HoQualityCheckTable;
