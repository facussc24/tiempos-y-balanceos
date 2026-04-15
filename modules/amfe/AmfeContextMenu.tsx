/**
 * Right-click context menu for AMFE table rows.
 * Extracted from AmfeTableBody to reduce component size.
 */
import React, { useRef } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { useAmfe } from './useAmfe';

export interface CtxTarget {
    x: number;
    y: number;
    opId: string;
    weId?: string;
    funcId?: string;
    failId?: string;
    causeId?: string;
}

interface Props {
    ctxMenu: CtxTarget;
    onClose: () => void;
    amfe: ReturnType<typeof useAmfe>;
    confirmDeleteOp: (opId: string) => void;
    confirmDeleteWE: (opId: string, weId: string) => void;
    confirmDeleteFunc: (opId: string, weId: string, funcId: string) => void;
    confirmDeleteFailure: (opId: string, weId: string, funcId: string, failId: string) => void;
    confirmDeleteCause: (opId: string, weId: string, funcId: string, failId: string, causeId: string) => void;
    restColSpan: number;
}

const AmfeContextMenu: React.FC<Props> = ({ ctxMenu, onClose, amfe, confirmDeleteOp, confirmDeleteWE, confirmDeleteFunc, confirmDeleteFailure, confirmDeleteCause, restColSpan }) => {
    const ctxRef = useRef<HTMLDivElement>(null);
    const items: { label: string; icon: React.ReactNode; action: () => void; color?: string }[] = [];
    const { opId, weId, funcId, failId, causeId } = ctxMenu;

    // Cause-level actions
    if (causeId && failId && funcId && weId) {
        items.push(
            { label: 'Duplicar Causa', icon: <Copy size={12} />, action: () => amfe.duplicateCause(opId, weId, funcId, failId, causeId) },
            { label: 'Eliminar Causa', icon: <Trash2 size={12} />, action: () => confirmDeleteCause(opId, weId, funcId, failId, causeId), color: 'text-red-600' },
            { label: '+ Causa', icon: <Plus size={12} />, action: () => amfe.addCause(opId, weId, funcId, failId), color: 'text-orange-600' },
        );
    }
    // Failure-level actions
    if (failId && funcId && weId) {
        items.push(
            { label: 'Duplicar Falla', icon: <Copy size={12} />, action: () => amfe.duplicateFailure(opId, weId, funcId, failId) },
            { label: 'Eliminar Falla', icon: <Trash2 size={12} />, action: () => confirmDeleteFailure(opId, weId, funcId, failId), color: 'text-red-600' },
            { label: '+ Modo de Falla', icon: <Plus size={12} />, action: () => amfe.addFailure(opId, weId, funcId), color: 'text-red-500' },
        );
    }
    // Function-level actions
    if (funcId && weId) {
        items.push(
            { label: 'Duplicar Función', icon: <Copy size={12} />, action: () => amfe.duplicateFunction(opId, weId, funcId) },
            { label: 'Eliminar Función', icon: <Trash2 size={12} />, action: () => confirmDeleteFunc(opId, weId, funcId), color: 'text-red-600' },
            { label: '+ Función', icon: <Plus size={12} />, action: () => amfe.addFunction(opId, weId), color: 'text-green-600' },
        );
    }
    // WE-level actions
    if (weId) {
        items.push(
            { label: 'Eliminar Elem. Trabajo', icon: <Trash2 size={12} />, action: () => confirmDeleteWE(opId, weId), color: 'text-red-600' },
        );
    }
    // Op-level actions (always available)
    items.push(
        { label: 'Duplicar Operación', icon: <Copy size={12} />, action: () => amfe.duplicateOperation(opId) },
        { label: 'Eliminar Operación', icon: <Trash2 size={12} />, action: () => confirmDeleteOp(opId), color: 'text-red-600' },
        { label: '+ Operación', icon: <Plus size={12} />, action: () => amfe.addOperation(), color: 'text-blue-600' },
    );

    return (
        <tr style={{ display: 'contents' }}>
            <td colSpan={restColSpan} style={{ padding: 0, border: 'none' }}>
                <div ref={ctxRef} className="fixed z-overlay bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[180px] text-xs" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
                    {items.map((item, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && items[i - 1].label.startsWith('+') && <div className="border-t border-gray-100 my-0.5" />}
                            <button
                                onClick={(e) => { e.stopPropagation(); item.action(); onClose(); }}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition ${item.color || 'text-gray-700'}`}
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            </td>
        </tr>
    );
};

export default AmfeContextMenu;
