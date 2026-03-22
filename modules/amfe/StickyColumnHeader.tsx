/**
 * AMFE VDA Sticky Column Header
 *
 * Two-row header following the AIAG-VDA 7-step process.
 * Op # and Op Name columns are frozen (sticky left) for horizontal scroll context.
 *
 * Column layout (VDA standard):
 * Step 2 (3): Op#, Item/Paso, Elem. Trabajo 6M
 * Step 3 (3): Func. Item, Func. Paso + Car. Producto, Func. Elem. Trabajo + Car. Proceso
 * Step 4 (3): Efecto Falla (FE), Modo Falla (FM), Causa Falla (FC)
 * Step 5 (7): S, PC, O, DC, D, AP, Car. Especiales
 * Step 6 (11): Actions, Responsible, Dates, New S/O/D/AP
 * Obs (1): Observations
 */

import React from 'react';
import { AMFE_TERMS, AmfeTerm } from './amfeTerms';
import { Tooltip } from '../../components/ui/Tooltip';
import { ColumnGroupVisibility } from './useAmfeColumnVisibility';

interface Props {
    visibility?: ColumnGroupVisibility;
}

/** Wrap a column header label with a tooltip showing the term definition */
const HeaderWithTip: React.FC<{ term: AmfeTerm; label: string; className?: string }> = ({ term, label, className = '' }) => (
    <Tooltip content={<><span className="font-bold text-blue-300">{term.term}</span>: {term.definition}</>}>
        <span className={`cursor-help border-b border-dotted border-current ${className}`}>{label}</span>
    </Tooltip>
);

const StickyColumnHeader: React.FC<Props> = ({ visibility }) => {
    const v = visibility || { step2: true, step3: true, step4: true, step5: true, step6: true, obs: true };
    return (
        <thead className="sticky top-0 z-10 shadow-md text-xs font-semibold text-slate-700">
            {/* Top Level Headers (Steps) */}
            <tr className="border-b border-gray-300">
                {v.step2 && <th colSpan={3} className="bg-slate-200 px-3 py-2 text-center min-w-[300px] border-r border-gray-300 font-bold">PASO 2: ESTRUCTURA</th>}
                {v.step3 && <th colSpan={3} className="bg-slate-200/70 px-3 py-2 text-center min-w-[400px] border-r border-gray-300 font-bold">PASO 3: ANÁLISIS FUNCIONAL</th>}
                {v.step4 && <th colSpan={3} className="bg-orange-200 px-3 py-2 text-center min-w-[500px] border-r border-orange-300 font-bold text-orange-800">PASO 4: ANÁLISIS DE FALLAS</th>}
                {v.step5 && <th colSpan={7} className="bg-yellow-200 px-3 py-2 text-center min-w-[400px] border-r border-yellow-300 font-bold text-yellow-800">PASO 5: ANÁLISIS DE RIESGO</th>}
                {v.step6 && <th colSpan={11} className="bg-blue-200 px-3 py-2 text-center min-w-[700px] border-r border-blue-300 font-bold text-blue-800">PASO 6: OPTIMIZACIÓN</th>}
                {v.obs && <th rowSpan={2} className="bg-gray-200 p-2 text-center w-40 border-l border-gray-300 font-bold"><HeaderWithTip term={AMFE_TERMS.OBS} label="OBS." /></th>}
            </tr>

            {/* Column Sub-headers */}
            <tr className="text-[11px] leading-4 text-center border-b border-gray-300 text-slate-600">
                {/* Step 2 — Op# and Op Name are frozen (sticky left) */}
                {v.step2 && <>
                    <th className="bg-slate-100 p-2 w-24 border-r border-gray-200 sticky left-0 z-20" style={{ boxShadow: 'none' }}><HeaderWithTip term={AMFE_TERMS.OP_NUMBER} label="1. NO. OP" /></th>
                    <th className="bg-slate-100 p-2 w-48 border-r-2 border-r-slate-300 sticky left-[96px] z-20" style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }}><HeaderWithTip term={AMFE_TERMS.OP_NAME} label="2. ITEM / PASO" /></th>
                    <th className="bg-slate-100 p-2 w-44 border-r border-gray-300"><HeaderWithTip term={AMFE_TERMS.WE} label="3. ELEM. TRABAJO (6M)" /></th>
                </>}

                {/* Step 3 — 3 function columns per VDA standard */}
                {v.step3 && <>
                    <th className="bg-slate-100 p-2 w-48 border-r border-gray-200"><HeaderWithTip term={AMFE_TERMS.FUNC_ITEM} label="1. FUNC. ITEM" /></th>
                    <th className="bg-slate-100 p-2 w-48 border-r border-gray-200"><HeaderWithTip term={AMFE_TERMS.FUNC_PASO} label="2. FUNC. PASO" /></th>
                    <th className="bg-slate-100 p-2 w-48 border-r border-gray-300"><HeaderWithTip term={AMFE_TERMS.FUNC} label="3. FUNC. ELEM." /></th>
                </>}

                {/* Step 4 — VDA: FE, FM, FC */}
                {v.step4 && <>
                    <th className="bg-orange-50 p-2 w-64 border-r border-orange-100"><HeaderWithTip term={AMFE_TERMS.FE} label="EFECTO DE FALLA (FE)" /></th>
                    <th className="bg-orange-50 p-2 w-48 border-r border-orange-100"><HeaderWithTip term={AMFE_TERMS.FM} label="MODO DE FALLA (FM)" /></th>
                    <th className="bg-orange-50 p-2 w-48 border-r border-gray-300"><HeaderWithTip term={AMFE_TERMS.FC} label="CAUSA RAÍZ (FC)" /></th>
                </>}

                {/* Step 5 — VDA: S, PC, O, DC, D, AP, Car.Especiales */}
                {v.step5 && <>
                    <th className="bg-yellow-50 p-2 w-12 border-r border-yellow-100 font-bold text-red-600"><HeaderWithTip term={AMFE_TERMS.S} label="S" className="text-red-600" /></th>
                    <th className="bg-yellow-50 p-2 w-48 border-r border-yellow-100"><HeaderWithTip term={AMFE_TERMS.PC} label="PREVENCIÓN (PC)" /></th>
                    <th className="bg-yellow-50 p-2 w-12 border-r border-yellow-100 text-orange-600"><HeaderWithTip term={AMFE_TERMS.O} label="O" className="text-orange-600" /></th>
                    <th className="bg-yellow-50 p-2 w-48 border-r border-yellow-100"><HeaderWithTip term={AMFE_TERMS.DC} label="DETECCIÓN (DC)" /></th>
                    <th className="bg-yellow-50 p-2 w-12 border-r border-yellow-100 text-blue-600"><HeaderWithTip term={AMFE_TERMS.D} label="D" className="text-blue-600" /></th>
                    <th className="bg-yellow-50 p-2 w-16 border-r border-yellow-100 font-black text-slate-800"><HeaderWithTip term={AMFE_TERMS.AP} label="AP" className="font-black" /></th>
                    <th className="bg-yellow-50 p-2 w-20 border-r border-gray-300"><HeaderWithTip term={AMFE_TERMS.SPECIAL_CHAR} label="CAR. ESP." /></th>
                </>}

                {/* Step 6 */}
                {v.step6 && <>
                    <th className="bg-blue-50 p-2 w-40 border-r border-blue-100"><HeaderWithTip term={AMFE_TERMS.PREV_ACTION} label="ACCIÓN PREV." /></th>
                    <th className="bg-blue-50 p-2 w-40 border-r border-blue-100"><HeaderWithTip term={AMFE_TERMS.DET_ACTION} label="ACCIÓN DET." /></th>
                    <th className="bg-blue-50 p-2 w-24 border-r border-blue-100"><HeaderWithTip term={AMFE_TERMS.RESPONSIBLE} label="RESPONSABLE" /></th>
                    <th className="bg-blue-50 p-2 w-20 border-r border-blue-100"><HeaderWithTip term={AMFE_TERMS.TARGET_DATE} label="FECHA OBJ." /></th>
                    <th className="bg-blue-50 p-2 w-20 border-r border-blue-100"><HeaderWithTip term={AMFE_TERMS.STATUS} label="ESTATUS" /></th>
                    <th className="bg-blue-50 p-2 w-40 border-r border-blue-100"><HeaderWithTip term={AMFE_TERMS.ACTION_TAKEN} label="ACCIÓN TOMADA" /></th>
                    <th className="bg-blue-50 p-2 w-20 border-r border-blue-100"><HeaderWithTip term={AMFE_TERMS.COMPLETION_DATE} label="FECHA REAL" /></th>
                    <th className="bg-blue-50 p-2 w-12 border-r border-blue-100"><HeaderWithTip term={AMFE_TERMS.S_NEW} label="S" className="text-red-500" /></th>
                    <th className="bg-blue-50 p-2 w-12 border-r border-blue-100"><HeaderWithTip term={AMFE_TERMS.O_NEW} label="O" className="text-orange-500" /></th>
                    <th className="bg-blue-50 p-2 w-12 border-r border-blue-100"><HeaderWithTip term={AMFE_TERMS.D_NEW} label="D" className="text-blue-500" /></th>
                    <th className="bg-blue-50 p-2 w-12 border-r border-gray-300"><HeaderWithTip term={AMFE_TERMS.AP_NEW} label="AP" className="font-bold" /></th>
                </>}
            </tr>
        </thead>
    );
};

export default React.memo(StickyColumnHeader);
