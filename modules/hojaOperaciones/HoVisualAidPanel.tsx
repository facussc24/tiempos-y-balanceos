/**
 * Visual Aid Panel — Upload/display images for the operation sheet.
 * Per IATF 8.5.1.2: visual aids are a requirement, not optional.
 * Uses Tauri file dialog for image selection.
 */

import React, { useCallback } from 'react';
import { HoVisualAid } from './hojaOperacionesTypes';
import { Plus, Trash2, ImageIcon } from 'lucide-react';
import { logger } from '../../utils/logger';

interface Props {
    aids: HoVisualAid[];
    onAdd: (imageData: string, caption: string) => void;
    onRemove: (aidId: string) => void;
    onUpdateCaption: (aidId: string, caption: string) => void;
    readOnly?: boolean;
}

const HoVisualAidPanel: React.FC<Props> = ({ aids, onAdd, onRemove, onUpdateCaption, readOnly }) => {
    const handleFileSelect = useCallback(async () => {
        try {
            // Use Tauri file dialog if available
            const { open } = await import('@tauri-apps/plugin-dialog');
            const selected = await open({
                multiple: false,
                filters: [{ name: 'Imagenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }],
            });
            if (!selected) return;

            const filePath = typeof selected === 'string' ? selected : String(selected);
            if (!filePath) return;

            const { readFile } = await import('@tauri-apps/plugin-fs');
            const bytes = await readFile(filePath);
            const base64 = btoa(
                Array.from(new Uint8Array(bytes))
                    .map(b => String.fromCharCode(b))
                    .join(''),
            );

            const ext = filePath.split('.').pop()?.toLowerCase() || 'png';
            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                : ext === 'gif' ? 'image/gif'
                : ext === 'bmp' ? 'image/bmp'
                : ext === 'webp' ? 'image/webp'
                : 'image/png';

            onAdd(`data:${mime};base64,${base64}`, '');
        } catch (err) {
            // Fallback for non-Tauri environment (dev/test)
            logger.warn('[HO] File dialog failed, using fallback:', err);
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            const cleanup = () => { input.onchange = null; input.value = ''; };
            input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) { cleanup(); return; }
                const reader = new FileReader();
                reader.onload = () => {
                    if (typeof reader.result === 'string') {
                        onAdd(reader.result, '');
                    }
                    cleanup();
                };
                reader.readAsDataURL(file);
            };
            input.click();
        }
    }, [onAdd]);

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
                            <div className="w-full h-32 flex items-center justify-center bg-gray-50 text-gray-300">
                                <ImageIcon size={32} />
                            </div>
                        )}
                        <div className="p-1.5">
                            <input
                                type="text"
                                value={aid.caption}
                                onChange={e => onUpdateCaption(aid.id, e.target.value)}
                                placeholder="Descripcion..."
                                readOnly={readOnly}
                                className="w-full text-[10px] px-1 py-0.5 border border-gray-100 rounded focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                            />
                        </div>
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={() => onRemove(aid.id)}
                                className="absolute top-1 right-1 p-1 bg-red-500/80 text-white rounded opacity-0 group-hover:opacity-100 transition"
                                title="Eliminar imagen"
                            >
                                <Trash2 size={12} />
                            </button>
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
