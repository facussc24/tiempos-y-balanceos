/**
 * Engineering Module — Shared Types
 *
 * Types and utilities for the Manuales and Formatos viewers.
 */

/** Default engineering base path (Y:\Ingenieria) */
export const DEFAULT_ENGINEERING_BASE_PATH = 'Y:\\Ingenieria';

/** Subdirectory for manuals/procedures */
export const MANUALES_DIR = 'Manuales';

/** Subdirectory for standard formats/templates */
export const FORMATOS_DIR = 'Formatos Estandar';

/** File entry from a directory listing */
export interface EngineeringFileEntry {
    name: string;
    path: string;
    extension: string;
    isFile: boolean;
}

/** Detected file type for icon coloring */
export type FileTypeCategory = 'excel' | 'pdf' | 'word' | 'html' | 'image' | 'other';

/** Map file extension to a display category */
export function classifyFileType(extension: string): FileTypeCategory {
    const ext = extension.toLowerCase().replace(/^\./, '');
    if (['xlsx', 'xls', 'xlsm', 'csv'].includes(ext)) return 'excel';
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'word';
    if (['html', 'htm'].includes(ext)) return 'html';
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg'].includes(ext)) return 'image';
    return 'other';
}

/** Color config per file type (Tailwind classes) */
export const FILE_TYPE_COLORS: Record<FileTypeCategory, { text: string; bg: string }> = {
    excel: { text: 'text-green-600', bg: 'bg-green-100' },
    pdf: { text: 'text-red-600', bg: 'bg-red-100' },
    word: { text: 'text-blue-600', bg: 'bg-blue-100' },
    html: { text: 'text-purple-600', bg: 'bg-purple-100' },
    image: { text: 'text-amber-600', bg: 'bg-amber-100' },
    other: { text: 'text-gray-600', bg: 'bg-gray-100' },
};
