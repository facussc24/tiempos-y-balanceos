/**
 * PieceListTable — Editable table of pieces (equivalent to Excel hoja ① Listado de Piezas).
 * Blue cells = editable input, grey cells = auto-calculated.
 */
import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import type { MediosPiece, ContainerType } from '../types';

interface Props {
  pieces: readonly MediosPiece[];
  containerTypes: readonly ContainerType[];
  projectId: string;
  onAddPiece: (piece: Omit<MediosPiece, 'id' | 'createdAt'>) => Promise<MediosPiece | null>;
  onUpdatePiece: (id: string, updates: Partial<MediosPiece>) => Promise<void>;
  onDeletePiece: (id: string) => Promise<void>;
}

const STAGES = ['WIP', 'Semiterminado', 'Producto Terminado'];

export const PieceListTable: React.FC<Props> = ({
  pieces, containerTypes, projectId, onAddPiece, onUpdatePiece, onDeletePiece,
}) => {
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);

  const handleAddPiece = useCallback(async () => {
    const defaultCt = containerTypes[0];
    await onAddPiece({
      projectId,
      pieceCode: '',
      description: '',
      family: '',
      client: '',
      stage: 'WIP',
      dailyDemand: 0,
      leadTimeDays: 5,
      safetyPct: 0.15,
      containerTypeId: defaultCt?.id ?? '',
      pcsPerContainer: defaultCt?.defaultPcs ?? 1,
      productId: null,
      sortOrder: pieces.length,
    });
  }, [projectId, containerTypes, pieces.length, onAddPiece]);

  const handleDuplicate = useCallback(async (piece: MediosPiece) => {
    await onAddPiece({
      ...piece,
      projectId,
      pieceCode: piece.pieceCode + ' (copia)',
      sortOrder: pieces.length,
    });
  }, [projectId, pieces.length, onAddPiece]);

  const handleCellChange = useCallback((id: string, field: string, value: string | number) => {
    onUpdatePiece(id, { [field]: value } as Partial<MediosPiece>);
  }, [onUpdatePiece]);

  const renderEditableCell = (piece: MediosPiece, field: keyof MediosPiece, type: 'text' | 'number' = 'text') => {
    const value = piece[field];
    const isEditing = editingCell?.id === piece.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <input
          autoFocus
          type={type}
          defaultValue={String(value ?? '')}
          onBlur={e => {
            const v = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
            handleCellChange(piece.id, field, v);
            setEditingCell(null);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditingCell(null);
          }}
          className="w-full px-1 py-0.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-blue-50"
          step={type === 'number' && field === 'safetyPct' ? '0.05' : undefined}
        />
      );
    }

    return (
      <div
        onClick={() => setEditingCell({ id: piece.id, field })}
        className="px-1 py-0.5 text-sm cursor-pointer hover:bg-blue-50 rounded min-h-[24px] text-blue-800"
        title="Click para editar"
      >
        {field === 'safetyPct' ? `${((value as number) * 100).toFixed(0)}%` : String(value ?? '')}
      </div>
    );
  };

  const renderSelect = (piece: MediosPiece, field: 'stage' | 'containerTypeId', options: { value: string; label: string }[]) => (
    <select
      value={String(piece[field])}
      onChange={e => {
        handleCellChange(piece.id, field, e.target.value);
        // If changing container type, update pcs/container to default
        if (field === 'containerTypeId') {
          const ct = containerTypes.find(c => c.id === e.target.value);
          if (ct?.defaultPcs) handleCellChange(piece.id, 'pcsPerContainer', ct.defaultPcs);
        }
      }}
      className="w-full text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded py-0.5 text-blue-800 cursor-pointer"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-700 text-balance">Listado de Piezas</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {pieces.length} piezas
          </span>
        </div>
        <button
          onClick={handleAddPiece}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <Plus size={14} />
          Agregar pieza
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="size-3 rounded bg-blue-100 border border-blue-300" /> Editable
        </span>
        <span className="flex items-center gap-1">
          <span className="size-3 rounded bg-slate-100 border border-slate-300" /> Auto-calculado
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-xs uppercase">
              <th className="px-2 py-2 text-left font-medium w-8">#</th>
              <th className="px-2 py-2 text-left font-medium bg-blue-50">Familia</th>
              <th className="px-2 py-2 text-left font-medium bg-blue-50">Codigo</th>
              <th className="px-2 py-2 text-left font-medium bg-blue-50 min-w-[160px]">Descripcion</th>
              <th className="px-2 py-2 text-left font-medium bg-blue-50">Cliente</th>
              <th className="px-2 py-2 text-left font-medium bg-blue-50">Etapa</th>
              <th className="px-2 py-2 text-right font-medium bg-blue-50">Demanda/dia</th>
              <th className="px-2 py-2 text-right font-medium bg-blue-50">LT (dias)</th>
              <th className="px-2 py-2 text-right font-medium bg-blue-50">% Seg.</th>
              <th className="px-2 py-2 text-left font-medium bg-blue-50">Contenedor</th>
              <th className="px-2 py-2 text-right font-medium bg-blue-50">Pzs/Cont</th>
              <th className="px-2 py-2 text-center font-medium">Ubicacion</th>
              <th className="px-2 py-2 text-center font-medium">Metodo</th>
              <th className="px-2 py-2 text-center font-medium w-16">Acc.</th>
            </tr>
          </thead>
          <tbody>
            {pieces.length === 0 ? (
              <tr>
                <td colSpan={14} className="text-center py-8 text-slate-400">
                  Sin piezas. Haz click en &quot;Agregar pieza&quot; para comenzar.
                </td>
              </tr>
            ) : (
              pieces.map((piece, idx) => {
                // Auto-calc location code
                const ctIdx = containerTypes.findIndex(ct => ct.id === piece.containerTypeId);
                const sameCtBefore = pieces.slice(0, idx).filter(p => p.containerTypeId === piece.containerTypeId).length;
                const locLetter = ctIdx >= 0 ? String.fromCharCode(65 + ctIdx) : 'X';
                const locCode = `${locLetter}-${String(sameCtBefore + 1).padStart(2, '0')}`;

                return (
                  <tr key={piece.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-2 py-1 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-2 py-1 bg-blue-50/30">{renderEditableCell(piece, 'family')}</td>
                    <td className="px-2 py-1 bg-blue-50/30">{renderEditableCell(piece, 'pieceCode')}</td>
                    <td className="px-2 py-1 bg-blue-50/30">{renderEditableCell(piece, 'description')}</td>
                    <td className="px-2 py-1 bg-blue-50/30">{renderEditableCell(piece, 'client')}</td>
                    <td className="px-2 py-1 bg-blue-50/30">
                      {renderSelect(piece, 'stage', STAGES.map(s => ({ value: s, label: s })))}
                    </td>
                    <td className="px-2 py-1 bg-blue-50/30 text-right tabular-nums">{renderEditableCell(piece, 'dailyDemand', 'number')}</td>
                    <td className="px-2 py-1 bg-blue-50/30 text-right tabular-nums">{renderEditableCell(piece, 'leadTimeDays', 'number')}</td>
                    <td className="px-2 py-1 bg-blue-50/30 text-right tabular-nums">{renderEditableCell(piece, 'safetyPct', 'number')}</td>
                    <td className="px-2 py-1 bg-blue-50/30">
                      {renderSelect(piece, 'containerTypeId', containerTypes.map(ct => ({ value: ct.id, label: ct.name })))}
                    </td>
                    <td className="px-2 py-1 bg-blue-50/30 text-right tabular-nums">{renderEditableCell(piece, 'pcsPerContainer', 'number')}</td>
                    <td className="px-2 py-1 text-center text-slate-500 text-xs font-mono tabular-nums bg-slate-50">{locCode}</td>
                    <td className="px-2 py-1 text-center text-slate-500 text-xs bg-slate-50">Kanban</td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          onClick={() => handleDuplicate(piece)}
                          className="p-1 text-slate-400 hover:text-blue-500"
                          aria-label="Duplicar"
                          title="Duplicar"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => onDeletePiece(piece.id)}
                          className="p-1 text-slate-400 hover:text-red-500"
                          aria-label="Eliminar"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
