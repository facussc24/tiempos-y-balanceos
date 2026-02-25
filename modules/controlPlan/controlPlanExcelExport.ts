/**
 * Control Plan Excel Export
 *
 * Exports the Control Plan in AIAG standard format with green styling.
 * Uses xlsx-js-style for formatted Excel output.
 */

import XLSX from 'xlsx-js-style';
import { ControlPlanDocument, CP_COLUMNS, CP_COLUMN_GROUPS, CONTROL_PLAN_PHASES } from './controlPlanTypes';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';

const GREEN_FILL = { fgColor: { rgb: '16A34A' } };
const LIGHT_GREEN_FILL = { fgColor: { rgb: 'DCFCE7' } };
const WHITE_FILL = { fgColor: { rgb: 'FFFFFF' } };
const BORDER_THIN = {
    top: { style: 'thin', color: { rgb: 'D1D5DB' } },
    bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
    left: { style: 'thin', color: { rgb: 'D1D5DB' } },
    right: { style: 'thin', color: { rgb: 'D1D5DB' } },
} as const;

const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
    fill: GREEN_FILL,
    alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
    border: BORDER_THIN,
};

const cellStyle: Record<string, any> = {
    font: { sz: 9 },
    fill: WHITE_FILL,
    alignment: { vertical: 'center' as const, wrapText: true },
    border: BORDER_THIN,
};

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportControlPlan(doc: ControlPlanDocument) {
    const wb = XLSX.utils.book_new();
    const rows: any[][] = [];
    const h = doc.header;
    const phaseName = CONTROL_PLAN_PHASES.find(p => p.value === h.phase)?.label || h.phase;

    // Title row
    rows.push([{
        v: 'PLAN DE CONTROL',
        s: { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: GREEN_FILL, alignment: { horizontal: 'center' } },
    }]);

    // Header info rows
    const headerInfo = [
        ['Nro. Plan de Control', h.controlPlanNumber, 'Fase', phaseName, 'Fecha', h.date],
        ['Pieza', h.partName, 'Nro. Pieza', h.partNumber, 'Nivel de Cambio', h.latestChangeLevel],
        ['Organizacion/Planta', h.organization, 'Proveedor', h.supplier, 'Cod. Proveedor', h.supplierCode],
        ['Contacto Clave/Telefono', h.keyContactPhone, 'Cliente', h.client, 'Revision', h.revision],
        ['Responsable', h.responsible, 'Equipo', h.coreTeam, '', ''],
        ['Aprob. Proveedor/Planta', h.approvedBy, 'Aprob. Ing. Cliente', h.customerEngApproval, 'Aprob. Cal. Cliente', h.customerQualityApproval],
        ['Otra Aprobacion', h.otherApproval, 'AMFE Vinculado', h.linkedAmfeProject, '', ''],
    ];

    for (const row of headerInfo) {
        rows.push(row.map((val, i) => ({
            v: i % 2 === 0 ? val : sanitizeCellValue(val),
            s: i % 2 === 0
                ? { font: { bold: true, sz: 9 }, fill: LIGHT_GREEN_FILL, border: BORDER_THIN }
                : { font: { sz: 9 }, fill: WHITE_FILL, border: BORDER_THIN },
        })));
    }

    // Empty row separator
    rows.push([]);

    // Group header row
    const groupRow: any[] = [];
    for (const group of CP_COLUMN_GROUPS) {
        groupRow.push({ v: group.label, s: headerStyle });
        for (let i = 1; i < group.colSpan; i++) {
            groupRow.push({ v: '', s: headerStyle });
        }
    }
    rows.push(groupRow);

    // Column headers
    rows.push(CP_COLUMNS.map(col => ({ v: col.label, s: headerStyle })));

    // Data rows (sanitized against formula injection)
    for (const item of doc.items) {
        rows.push(CP_COLUMNS.map(col => {
            const value = (item[col.key] as string) || '';
            return { v: sanitizeCellValue(value), s: cellStyle };
        }));
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Calculate row indices
    const titleRowIdx = 0;
    const groupRowIdx = 1 + headerInfo.length + 1; // title + header rows + empty separator

    // Merges
    const merges: XLSX.Range[] = [
        // Title row merge
        { s: { r: titleRowIdx, c: 0 }, e: { r: titleRowIdx, c: CP_COLUMNS.length - 1 } },
    ];

    // Group header merges
    let colOffset = 0;
    for (const group of CP_COLUMN_GROUPS) {
        if (group.colSpan > 1) {
            merges.push({
                s: { r: groupRowIdx, c: colOffset },
                e: { r: groupRowIdx, c: colOffset + group.colSpan - 1 },
            });
        }
        colOffset += group.colSpan;
    }

    ws['!merges'] = merges;

    // Column widths
    ws['!cols'] = CP_COLUMNS.map(col => ({ wch: parseInt(col.width) / 6 }));

    XLSX.utils.book_append_sheet(wb, ws, 'Plan de Control');

    const safeName = sanitizeFilename(h.partName || 'Export', { allowSpaces: true });
    const filename = `PlanDeControl_${safeName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    downloadWorkbook(wb, filename);
}
