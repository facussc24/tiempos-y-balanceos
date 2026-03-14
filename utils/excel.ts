import XLSX from 'xlsx-js-style';
import { logger } from './logger';

// --- CSV PARSING ---
export const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    // Remove surrounding quotes if present
    return result.map(col => {
        if (col.startsWith('"') && col.endsWith('"')) {
            return col.slice(1, -1).trim();
        }
        return col;
    });
};

// --- ExcelJS DOWNLOAD ---
export async function downloadExcelJSWorkbook(wb: { xlsx: { writeBuffer(): Promise<ArrayBuffer> } }, fileName: string): Promise<void> {
    const buffer = await wb.xlsx.writeBuffer();
    await saveAndOpenExcel(new Uint8Array(buffer as ArrayBuffer), fileName);
}

// --- Shared save logic (browser download) ---
async function saveAndOpenExcel(data: Uint8Array, fileName: string): Promise<void> {
    // Browser download via blob URL
    const blob = new Blob([data], {
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
}

// --- XLSX-JS-STYLE BUFFER GENERATION (for auto-export, no download dialog) ---
export function generateWorkbookBuffer(wb: XLSX.WorkBook): Uint8Array {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    return new Uint8Array(wbout);
}

// --- XLSX-JS-STYLE DOWNLOAD (delegates to shared save logic) ---
export async function downloadWorkbook(wb: XLSX.WorkBook, fileName: string): Promise<void> {
    try {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
        await saveAndOpenExcel(new Uint8Array(wbout), fileName);
    } catch (err) {
        logger.error('Excel', 'Error exporting Excel', {}, err instanceof Error ? err : undefined);
        throw new Error('Error al exportar Excel: ' + (err instanceof Error ? err.message : String(err)));
    }
}
