/**
 * Visual Aid Panel -- Upload/display images for the operation sheet.
 * Per IATF 8.5.1.2: visual aids are a requirement, not optional.
 * Uses native HTML <input type="file"> for image selection.
 *
 * Images are compressed via canvas before storage to limit base64 payload.
 * Max dimension: 1024px (proportional scale). Quality: 0.7 JPEG.
 * Post-compression limit: 2 MB.
 */

import React, { useCallback, useState } from 'react';
import { HoVisualAid } from './hojaOperacionesTypes';
import { Plus, Trash2, ImageIcon } from 'lucide-react';
import { logger } from '../../utils/logger';
import { toast } from '../../components/ui/Toast';

// ============================================================================
// IMAGE COMPRESSION CONSTANTS
// ============================================================================

/** Maximum dimension (width or height) for stored images. */
export const MAX_IMAGE_DIMENSION = 1024;

/** JPEG quality for compressed output (0-1). */
export const MAX_IMAGE_QUALITY = 0.7;

/** Maximum byte size for a compressed image (2 MB). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Regex for accepted image data URI formats. */
export const SUPPORTED_IMAGE_REGEX = /^data:image\/(jpeg|png|webp|gif|bmp|x-ms-bmp)/;

// ============================================================================
// IMAGE VALIDATION & COMPRESSION
// ============================================================================

/**
 * Validate that a data URI starts with a supported image MIME type.
 * Returns true if the format is supported, false otherwise.
 */
export function isValidImageFormat(dataUri: string): boolean {
    return SUPPORTED_IMAGE_REGEX.test(dataUri);
}

/**
 * Compute the byte size of a base64 data URI payload.
 */
export function dataUriByteSize(dataUri: string): number {
    // Strip the "data:...;base64," prefix
    const commaIdx = dataUri.indexOf(',');
    if (commaIdx < 0) return 0;
    const b64 = dataUri.substring(commaIdx + 1);
    // base64 encodes 3 bytes per 4 chars; account for padding
    const padding = (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
    return Math.floor((b64.length * 3) / 4) - padding;
}

/**
 * Compress an image data URI using an off-screen canvas.
 *
 * 1. Loads the image in an HTMLImageElement.
 * 2. If either dimension exceeds `maxDimension`, scales proportionally.
 * 3. Draws onto a canvas and exports as JPEG at the given quality.
 * 4. If the result exceeds MAX_IMAGE_BYTES, throws an error.
 *
 * @returns Compressed data URI (always image/jpeg).
 */
/** Timeout for image compression (15 seconds). */
const COMPRESS_TIMEOUT_MS = 15_000;

export function compressImage(
    dataUri: string,
    maxDimension: number = MAX_IMAGE_DIMENSION,
    quality: number = MAX_IMAGE_QUALITY,
): Promise<string> {
    const compression = new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                let { width, height } = img;

                // Scale down proportionally if needed
                if (width > maxDimension || height > maxDimension) {
                    const ratio = Math.min(maxDimension / width, maxDimension / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('No se pudo obtener contexto 2D del canvas'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                const compressed = canvas.toDataURL('image/jpeg', quality);

                // Check post-compression size
                const byteSize = dataUriByteSize(compressed);
                if (byteSize > MAX_IMAGE_BYTES) {
                    reject(new Error(
                        `La imagen comprimida excede el limite de 2 MB (${(byteSize / (1024 * 1024)).toFixed(1)} MB). ` +
                        'Use una imagen mas pequena o con menor resolucion.',
                    ));
                    return;
                }

                resolve(compressed);
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = () => {
            reject(new Error('No se pudo cargar la imagen. Verifique que el archivo es valido.'));
        };
        img.src = dataUri;
    });

    const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(
            'La compresión de imagen tardó demasiado (más de 15 segundos). La imagen puede estar corrupta o ser demasiado grande.',
        )), COMPRESS_TIMEOUT_MS);
    });

    return Promise.race([compression, timeout]);
}

// ============================================================================
// COMPONENT
// ============================================================================

interface Props {
    aids: HoVisualAid[];
    onAdd: (imageData: string, caption: string) => void;
    onRemove: (aidId: string) => void;
    onUpdateCaption: (aidId: string, caption: string) => void;
    readOnly?: boolean;
}

const HoVisualAidPanel: React.FC<Props> = ({ aids, onAdd, onRemove, onUpdateCaption, readOnly }) => {
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const handleDelete = useCallback((aidId: string) => {
        setConfirmDeleteId(aidId);
    }, []);

    const confirmDelete = useCallback(() => {
        if (confirmDeleteId) {
            onRemove(confirmDeleteId);
            setConfirmDeleteId(null);
        }
    }, [confirmDeleteId, onRemove]);

    const cancelDelete = useCallback(() => {
        setConfirmDeleteId(null);
    }, []);

    /**
     * Validate format, compress, and deliver a processed image to onAdd.
     * Shows alert to the user on validation or compression failure.
     */
    const processAndAdd = useCallback(async (rawDataUri: string) => {
        // Validate format
        if (!isValidImageFormat(rawDataUri)) {
            const msg = 'Formato de imagen no soportado. Use JPEG, PNG, WebP o GIF.';
            logger.warn('HO-VisualAid', msg);
            toast.warning('Formato no válido', msg);
            return;
        }

        try {
            const compressed = await compressImage(rawDataUri);
            onAdd(compressed, '');
            toast.success('Imagen agregada', 'La imagen fue comprimida y agregada correctamente.');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al procesar la imagen.';
            logger.error('HO-VisualAid', message);
            toast.error('Error de imagen', message);
        }
    }, [onAdd]);

    const handleFileSelect = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        const cleanup = () => { input.onchange = null; input.value = ''; };
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) { cleanup(); return; }
            const reader = new FileReader();
            reader.onload = async () => {
                if (typeof reader.result === 'string') {
                    await processAndAdd(reader.result);
                }
                cleanup();
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }, [processAndAdd]);

    // When empty and not readOnly, show a compact add button instead of the large grid placeholder
    if (aids.length === 0 && !readOnly) {
        return (
            <div className="px-1 py-1">
                <button
                    type="button"
                    onClick={handleFileSelect}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-amber-600 hover:bg-amber-50 border border-dashed border-gray-300 hover:border-amber-400 rounded-lg transition"
                >
                    <Plus size={14} />
                    Agregar imagen
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {aids.map(aid => (
                    <div key={aid.id} className="group relative border border-gray-200 rounded overflow-hidden bg-white">
                        {aid.imageData ? (
                            <img
                                src={aid.imageData}
                                alt={aid.caption || 'Ayuda visual'}
                                className="w-full h-32 object-contain bg-gray-50"
                            />
                        ) : (
                            <div className="w-full h-32 flex items-center justify-center bg-gray-50 text-gray-300" aria-label="Sin imagen cargada">
                                <ImageIcon size={32} aria-hidden="true" />
                            </div>
                        )}
                        <div className="p-1.5">
                            <input
                                type="text"
                                value={aid.caption}
                                onChange={e => onUpdateCaption(aid.id, e.target.value)}
                                placeholder="Descripción..."
                                readOnly={readOnly}
                                className="w-full text-[10px] px-1 py-0.5 border border-gray-100 rounded focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                            />
                        </div>
                        {!readOnly && (
                            confirmDeleteId === aid.id ? (
                                <div className="absolute top-1 right-1 flex items-center gap-1 bg-white rounded shadow-md border border-red-200 px-1.5 py-1">
                                    <span className="text-[9px] text-red-600 font-medium mr-1">Eliminar?</span>
                                    <button
                                        type="button"
                                        onClick={confirmDelete}
                                        className="px-1.5 py-0.5 text-[9px] bg-red-500 text-white rounded hover:bg-red-600 transition font-medium"
                                    >
                                        Sí
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cancelDelete}
                                        className="px-1.5 py-0.5 text-[9px] bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition font-medium"
                                    >
                                        No
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => handleDelete(aid.id)}
                                    aria-label="Eliminar imagen"
                                    className="absolute top-1 right-1 p-1.5 bg-red-500/80 text-white rounded opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                                    title="Eliminar imagen"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )
                        )}
                    </div>
                ))}

                {!readOnly && (
                    <button
                        type="button"
                        onClick={handleFileSelect}
                        className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-200 rounded text-gray-400 hover:border-amber-400 hover:text-amber-500 hover:bg-amber-50/50 transition"
                    >
                        <Plus size={24} />
                        <span className="text-[10px] mt-1">Agregar imagen</span>
                    </button>
                )}
            </div>

            {aids.length === 0 && readOnly && (
                <p className="text-xs text-gray-400 italic px-2 py-3">
                    Sin ayudas visuales.
                </p>
            )}
        </div>
    );
};

export default HoVisualAidPanel;
