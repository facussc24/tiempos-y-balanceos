/**
 * Heijunka Export Module - "Train Schedule" Format
 * Phase 4.5: Shop Floor Usability
 * 
 * Generates Excel report for Mizusumashi operators with:
 * - Hora de Retiro (withdrawal times based on Pitch)
 * - Tarjetas Kanban per model
 * - Ruta Logística assignment
 */

import XLSX from 'xlsx-js-style';
import { HeijunkaResult, HeijunkaSlot, ProductSummary } from './heijunkaLogic';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { logger } from '../../utils/logger';

// ============================================================================
// STYLES (matching existing utils/excel.ts patterns)
// ============================================================================

const styles = {
    title: {
        font: { bold: true, sz: 18, color: { rgb: "1E3A8A" } },
        alignment: { horizontal: "center", vertical: "center" }
    },
    subtitle: {
        font: { bold: true, sz: 12, color: { rgb: "4B5563" } },
        alignment: { horizontal: "center" }
    },
    header: {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11, name: "Arial" },
        fill: { fgColor: { rgb: "7C3AED" } }, // Purple 600 (Heijunka brand)
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
        }
    },
    headerProduct: (color: string) => ({
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Arial" },
        fill: { fgColor: { rgb: color.replace('#', '') } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
        }
    }),
    cell: {
        font: { name: "Arial", sz: 10 },
        alignment: { vertical: "center", horizontal: "center" },
        border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
        }
    },
    cellHighlight: {
        font: { name: "Arial", sz: 10, bold: true },
        fill: { fgColor: { rgb: "EDE9FE" } }, // Light purple
        alignment: { vertical: "center", horizontal: "center" },
        border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
        }
    },
    totalRow: {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        fill: { fgColor: { rgb: "4C1D95" } }, // Purple 900
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "medium" },
            bottom: { style: "medium" },
            left: { style: "thin" },
            right: { style: "thin" }
        }
    },
    info: {
        font: { sz: 10, color: { rgb: "6B7280" } },
        alignment: { horizontal: "left" }
    }
};

// ============================================================================
// EXPORT FUNCTION
// ============================================================================

/**
 * Export Heijunka plan to Excel in "Train Schedule" format.
 * 
 * @param result - HeijunkaResult from calculateHeijunka()
 * @param projectName - Project name for filename
 * @param routeName - Optional route name (e.g., "Ruta Mizusumashi A")
 * @param date - Date string for the report
 */
export function exportHeijunkaPlanExcel(
    result: HeijunkaResult,
    projectName: string = 'Heijunka',
    routeName: string = 'Ruta Mizusumashi',
    date: string = new Date().toLocaleDateString('es-ES')
): void {
    const wb = XLSX.utils.book_new();

    // --- SHEET 1: HORARIO DE RETIROS (Train Schedule) ---
    const rows: any[][] = [];

    // Title Section
    rows.push([{ v: "🚂 HORARIO DE RETIROS - PLAN HEIJUNKA", s: styles.title }]);
    rows.push([{ v: sanitizeCellValue(`Proyecto: ${projectName}`), s: styles.info }]);
    rows.push([{ v: sanitizeCellValue(`Fecha: ${date}`), s: styles.info }]);
    rows.push([{ v: `Pitch: ${result.pitchMinutes} min | Intervalos: ${result.totalSlots}`, s: styles.info }]);
    rows.push([]); // Empty row

    // Build header row
    const headerRow: any[] = [
        { v: "HORA RETIRO", s: styles.header },
        { v: "HORA FIN", s: styles.header }
    ];

    // Add product columns with their colors
    result.productSummaries.forEach(product => {
        headerRow.push({
            v: sanitizeCellValue(product.productName),
            s: styles.headerProduct(product.color || '#7C3AED')
        });
    });

    headerRow.push({ v: "TOTAL SLOT", s: styles.header });
    headerRow.push({ v: "RUTA", s: styles.header });
    rows.push(headerRow);

    // Data rows for each slot
    result.slots.forEach((slot: HeijunkaSlot) => {
        const row: any[] = [
            { v: slot.startTime, s: styles.cellHighlight },
            { v: slot.endTime, s: styles.cell }
        ];

        // Add quantity for each product
        result.productSummaries.forEach(product => {
            const assignment = slot.assignments.find(a => a.productId === product.productId);
            const qty = assignment?.quantity || 0;
            row.push({
                v: qty > 0 ? qty : '-',
                s: qty > 0 ? styles.cellHighlight : styles.cell
            });
        });

        row.push({ v: slot.totalUnits, s: styles.cellHighlight });
        row.push({ v: sanitizeCellValue(routeName), s: styles.cell });
        rows.push(row);
    });

    // Total row
    const totalRow: any[] = [
        { v: "TOTAL DÍA", s: styles.totalRow },
        { v: "", s: styles.totalRow }
    ];

    result.productSummaries.forEach(product => {
        totalRow.push({ v: product.totalAssigned, s: styles.totalRow });
    });

    const grandTotal = result.productSummaries.reduce((sum, p) => sum + p.totalAssigned, 0);
    totalRow.push({ v: grandTotal, s: styles.totalRow });
    totalRow.push({ v: "", s: styles.totalRow });
    rows.push(totalRow);

    // Create sheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    const colWidths = [
        { wch: 12 },  // Hora Retiro
        { wch: 10 },  // Hora Fin
        ...result.productSummaries.map(() => ({ wch: 14 })),  // Products
        { wch: 12 },  // Total
        { wch: 18 }   // Ruta
    ];
    ws['!cols'] = colWidths;

    // Merge title cell
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colWidths.length - 1 } }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Horario de Retiros");

    // --- SHEET 2: RESUMEN POR PRODUCTO ---
    const summaryRows: any[][] = [
        [{ v: "RESUMEN POR PRODUCTO", s: styles.title }],
        [],
        [
            { v: "Producto", s: styles.header },
            { v: "Demanda Diaria", s: styles.header },
            { v: "Asignado", s: styles.header },
            { v: "Promedio/Slot", s: styles.header },
            { v: "Estado", s: styles.header }
        ]
    ];

    result.productSummaries.forEach(product => {
        const status = product.totalAssigned >= product.totalDemand ? "✅ OK" : "⚠️ Faltante";
        summaryRows.push([
            { v: sanitizeCellValue(product.productName), s: styles.cell },
            { v: product.totalDemand, s: styles.cell },
            { v: product.totalAssigned, s: styles.cell },
            { v: product.avgPerSlot.toFixed(1), s: styles.cell },
            { v: status, s: styles.cell }
        ]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Productos");

    // --- SHEET 3: INSTRUCCIONES ---
    const instructionsRows: any[][] = [
        [{ v: "INSTRUCCIONES PARA EL OPERADOR MIZUSUMASHI", s: styles.title }],
        [],
        [{ v: "1. Este documento muestra el horario de retiros de tarjetas Kanban.", s: styles.info }],
        [{ v: "2. A cada hora indicada, retirar las cantidades mostradas por producto.", s: styles.info }],
        [{ v: "3. Entregar los materiales siguiendo la ruta logística asignada.", s: styles.info }],
        [{ v: "4. Reportar cualquier faltante al supervisor inmediatamente.", s: styles.info }],
        [],
        [{ v: `Generado: ${new Date().toLocaleString('es-ES')}`, s: styles.info }]
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsRows);
    wsInstructions['!cols'] = [{ wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instrucciones");

    // Download file
    const filename = sanitizeFilename(
        `${projectName}_Heijunka_${date.replace(/\//g, '-')}.xlsx`
    );
    downloadWorkbook(wb, filename);
}

/** Download workbook as .xlsx file (browser-safe, same as utils/excel.ts) */
function downloadWorkbook(wb: XLSX.WorkBook, fileName: string): void {
    try {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
        logger.error('Heijunka', 'Error exporting Heijunka Excel', {}, err instanceof Error ? err : undefined);
    }
}

/**
 * Validate Pitch vs Mizusumashi Route Time.
 * 
 * @param pitchMinutes - Heijunka pitch in minutes
 * @param routeTimeMinutes - Mizusumashi route cycle time in minutes
 * @returns Validation result with status and message
 */
export function validatePitchVsRoute(
    pitchMinutes: number,
    routeTimeMinutes: number
): { ok: boolean; severity: 'ok' | 'warning' | 'critical'; message: string } {
    if (!Number.isFinite(pitchMinutes) || !Number.isFinite(routeTimeMinutes) || pitchMinutes <= 0) {
        return {
            ok: true,
            severity: 'ok',
            message: "Datos insuficientes para validar"
        };
    }

    const ratio = routeTimeMinutes / pitchMinutes;

    if (ratio > 1) {
        return {
            ok: false,
            severity: 'critical',
            message: `🔴 RUTA INSOSTENIBLE: El Mizusumashi requiere ${routeTimeMinutes.toFixed(0)} min pero el Pitch es ${pitchMinutes.toFixed(0)} min. Reducir paradas o aumentar pitch.`
        };
    } else if (ratio > 0.9) {
        return {
            ok: true,
            severity: 'warning',
            message: `⚠️ AJUSTADO: La ruta ocupa ${(ratio * 100).toFixed(0)}% del pitch. Considerar optimización.`
        };
    } else {
        return {
            ok: true,
            severity: 'ok',
            message: `✅ OK: Ruta ocupa ${(ratio * 100).toFixed(0)}% del pitch disponible.`
        };
    }
}
