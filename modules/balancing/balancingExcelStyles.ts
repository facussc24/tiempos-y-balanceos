/**
 * Shared style constants for balancing Excel exports.
 * Uses xlsx-js-style cell style format.
 */

const BORDER_THIN = {
    top: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    left: { style: 'thin' as const },
    right: { style: 'thin' as const },
};

export const STYLES = {
    title: {
        font: { bold: true, sz: 14, name: 'Arial', color: { rgb: '1E3A8A' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    },
    companyName: {
        font: { bold: true, sz: 11, name: 'Arial', color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E3A8A' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    },
    subtitle: {
        font: { bold: true, sz: 11, name: 'Arial' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    },
    sectionTitle: {
        font: { bold: true, sz: 10, name: 'Arial', color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4472C4' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER_THIN,
    },
    metaLabel: {
        font: { bold: true, sz: 9, name: 'Arial' },
        fill: { fgColor: { rgb: 'F2F2F2' } },
        alignment: { vertical: 'center' as const },
        border: BORDER_THIN,
    },
    metaValue: {
        font: { sz: 9, name: 'Arial' },
        alignment: { vertical: 'center' as const },
        border: BORDER_THIN,
    },
    colHeader: {
        font: { bold: true, sz: 8, name: 'Arial', color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4472C4' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
        border: BORDER_THIN,
    },
    dataCell: {
        font: { sz: 8, name: 'Arial' },
        alignment: { vertical: 'top' as const, wrapText: true },
        border: BORDER_THIN,
    },
    dataCenter: {
        font: { sz: 8, name: 'Arial' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER_THIN,
    },
    numberCell: {
        font: { sz: 8, name: 'Arial' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER_THIN,
        numFmt: '0.00',
    },
    timeCell: {
        font: { sz: 8, name: 'Arial' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER_THIN,
        numFmt: '0.000',
    },
    pctCell: {
        font: { sz: 8, name: 'Arial' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER_THIN,
        numFmt: '0.00%',
    },
    summaryLabel: {
        font: { bold: true, sz: 10, name: 'Arial' },
        fill: { fgColor: { rgb: 'E8E8E8' } },
        border: BORDER_THIN,
    },
    summaryValue: {
        font: { bold: true, sz: 10, name: 'Arial' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER_THIN,
    },
    feasible: {
        font: { bold: true, sz: 10, name: 'Arial', color: { rgb: '006100' } },
        fill: { fgColor: { rgb: 'C6EFCE' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER_THIN,
    },
    notFeasible: {
        font: { bold: true, sz: 10, name: 'Arial', color: { rgb: '9C0006' } },
        fill: { fgColor: { rgb: 'FFC7CE' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER_THIN,
    },
    shiftCell: {
        font: { sz: 8, name: 'Arial' },
        fill: { fgColor: { rgb: 'FFF2CC' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER_THIN,
    },
    chartTitle: {
        font: { bold: true, sz: 12, name: 'Arial', color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4472C4' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    },
} as const;
