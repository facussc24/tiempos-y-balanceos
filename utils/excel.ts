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

// --- ExcelJS DOWNLOAD (Tauri-native + browser fallback + auto-open) ---
export async function downloadExcelJSWorkbook(wb: { xlsx: { writeBuffer(): Promise<ArrayBuffer> } }, fileName: string): Promise<void> {
    const buffer = await wb.xlsx.writeBuffer();
    await saveAndOpenExcel(new Uint8Array(buffer as ArrayBuffer), fileName);
}

// --- Shared save logic (Tauri-native + browser fallback + auto-open) ---
async function saveAndOpenExcel(data: Uint8Array, fileName: string): Promise<void> {
    // Try Tauri native save
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        try {
            const dialog = await import('@tauri-apps/plugin-dialog');
            const fs = await import('@tauri-apps/plugin-fs');
            const savePath = await dialog.save({
                title: 'Guardar Excel',
                defaultPath: fileName,
                filters: [{ name: 'Excel', extensions: ['xlsx'] }],
            });
            if (savePath) {
                await fs.writeFile(savePath, data);
                logger.info('Excel', 'File saved via Tauri', { path: savePath });
                // Auto-open the saved file
                try {
                    const opener = await import('@tauri-apps/plugin-opener');
                    await opener.openPath(savePath);
                } catch {
                    logger.warn('Excel', 'Auto-open not available (opener plugin not installed)');
                }
                return;
            }
            return; // User cancelled
        } catch (tauriErr) {
            logger.warn('Excel', 'Tauri save failed, falling back to browser', {
                error: tauriErr instanceof Error ? tauriErr.message : String(tauriErr),
            });
        }
    }

    // Browser fallback
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
