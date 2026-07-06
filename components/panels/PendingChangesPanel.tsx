/**
 * PendingChangesPanel — Panel de cambios sin oficializar de un AMFE
 *
 * Lista los cambios registrados (diff-on-save) que todavia no fueron consumidos
 * por una revision oficial. Alimenta al usuario para que vea que se modifico
 * desde la ultima revision antes de decidir crear una nueva.
 *
 * Los datos salen de amfe_change_log via listPendingChanges (repositorio tipado).
 *
 * @module PendingChangesPanel
 */

import React, { useEffect, useState } from 'react';
import { FileClock, Loader2 } from 'lucide-react';
import { listPendingChanges } from '../../utils/repositories';
import type { AmfeChangeLogRow } from '../../utils/repositories/amfeChangeLogRepository';
import { logger } from '../../utils/logger';

interface PendingChangesPanelProps {
    /** id del documento AMFE actual (null si no hay proyecto abierto). */
    documentId: string | null;
    /** Cambiar este valor fuerza un recargado (ej: despues de guardar). */
    refreshKey?: number;
}

/** Agrupa las entradas por opNumber preservando el orden de llegada. */
function groupByOp(rows: AmfeChangeLogRow[]): { opNumber: string; items: AmfeChangeLogRow[] }[] {
    const groups: { opNumber: string; items: AmfeChangeLogRow[] }[] = [];
    const index = new Map<string, number>();
    for (const row of rows) {
        const key = row.opNumber || '';
        let pos = index.get(key);
        if (pos === undefined) {
            pos = groups.length;
            index.set(key, pos);
            groups.push({ opNumber: key, items: [] });
        }
        groups[pos].items.push(row);
    }
    return groups;
}

export const PendingChangesPanel: React.FC<PendingChangesPanelProps> = ({ documentId, refreshKey }) => {
    const [changes, setChanges] = useState<AmfeChangeLogRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Sin documento: el componente ya retorna null; no hace falta tocar el estado.
        if (!documentId) return;

        let cancelled = false;
        // Toda la actualizacion de estado corre dentro de la funcion async (no en el
        // cuerpo sincrono del effect) para no disparar cascading renders.
        void (async () => {
            setIsLoading(true);
            try {
                const rows = await listPendingChanges(documentId);
                if (!cancelled) setChanges(rows);
            } catch (err) {
                logger.error('PendingChangesPanel', 'Failed to load pending changes', {}, err instanceof Error ? err : undefined);
                if (!cancelled) setChanges([]);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [documentId, refreshKey]);

    // Sin documento abierto: no renderizar nada.
    if (!documentId) return null;

    const count = changes.length;
    const groups = groupByOp(changes);

    return (
        <div className="bg-white border-b border-gray-200 no-print">
            {/* Header con badge de conteo */}
            <div className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-600">
                <FileClock size={14} className="text-amber-500" />
                <span>Cambios sin oficializar</span>
                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {count}
                </span>
                {isLoading && <Loader2 size={12} className="text-gray-400 animate-spin" />}
            </div>

            <div className="px-4 pb-3 max-h-60 overflow-y-auto">
                {isLoading && count === 0 ? (
                    <p className="text-xs text-gray-400 py-3 text-center">Cargando cambios...</p>
                ) : count === 0 ? (
                    <p className="text-xs text-gray-400 py-3 text-center">
                        Sin cambios pendientes desde la última revisión
                    </p>
                ) : (
                    <div className="space-y-3">
                        {groups.map(group => (
                            <div key={group.opNumber || '__doc__'}>
                                {group.opNumber && (
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                                        OP {group.opNumber}
                                    </p>
                                )}
                                <ul className="space-y-1">
                                    {group.items.map(item => (
                                        <li
                                            key={item.id}
                                            className="flex items-start gap-2 text-xs text-gray-700 py-1 border-b border-gray-50 last:border-0"
                                        >
                                            <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />
                                            <span className="flex-1">{item.summary}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PendingChangesPanel;
