/**
 * SolicitudAttachmentPanel — File attachment management UI
 *
 * Displays attached files with upload/delete capabilities.
 * Files are stored on the server folder, only metadata in SQLite.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Paperclip, Upload, Trash2, FileText, FileSpreadsheet, Image, File, ExternalLink, AlertCircle } from 'lucide-react';
import type { SolicitudAttachment } from './solicitudTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SolicitudAttachmentPanelProps {
    attachments: SolicitudAttachment[];
    serverFolderPath: string | null;
    serverAvailable: boolean;
    readOnly: boolean;
    onAttachmentsChange: (attachments: SolicitudAttachment[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

function getFileIcon(fileType: string) {
    const ext = fileType.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-4 h-4 text-red-500" />;
    if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return <Image className="w-4 h-4 text-blue-500" />;
    return <File className="w-4 h-4 text-gray-500" />;
}

function formatDate(isoStr: string): string {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        // FIX: Validate date before using getDate() etc. (Invalid Date returns NaN → "aN/aN/aN")
        if (isNaN(d.getTime())) return isoStr;
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch {
        return isoStr;
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SolicitudAttachmentPanel: React.FC<SolicitudAttachmentPanelProps> = ({
    attachments,
    serverFolderPath,
    serverAvailable,
    readOnly,
    onAttachmentsChange,
}) => {
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canUpload = !readOnly && serverAvailable && !!serverFolderPath;

    const handleUploadClick = useCallback(() => {
        if (!canUpload) return;

        // Try Tauri dialog first, fallback to file input
        (async () => {
            try {
                const { selectAttachmentFiles, uploadAttachment } = await import('./solicitudAttachments');
                const files = await selectAttachmentFiles();
                if (files.length === 0) return;

                setUploading(true);
                const adjuntosDir = serverFolderPath + '\\adjuntos';
                const newAttachments = [...attachments];

                for (const filePath of files) {
                    const result = await uploadAttachment(filePath, adjuntosDir, '');
                    if (result.success && result.attachment) {
                        newAttachments.push(result.attachment);
                    }
                }

                onAttachmentsChange(newAttachments);
                setUploading(false);
            } catch {
                // Fallback to HTML input
                fileInputRef.current?.click();
                setUploading(false);
            }
        })();
    }, [canUpload, serverFolderPath, attachments, onAttachmentsChange]);

    const handleDelete = useCallback((index: number) => {
        setConfirmDeleteIndex(index);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (confirmDeleteIndex === null) return;
        const attachment = attachments[confirmDeleteIndex];

        try {
            if (serverAvailable && serverFolderPath) {
                const { deleteServerAttachment } = await import('./solicitudAttachments');
                await deleteServerAttachment(serverFolderPath + '\\adjuntos', attachment.fileName);
            }
        } catch {
            // Continue with local removal even if server delete fails
        }

        const updated = attachments.filter((_, i) => i !== confirmDeleteIndex);
        onAttachmentsChange(updated);
        setConfirmDeleteIndex(null);
    }, [confirmDeleteIndex, attachments, serverAvailable, serverFolderPath, onAttachmentsChange]);

    const cancelDelete = useCallback(() => {
        setConfirmDeleteIndex(null);
    }, []);

    const handleOpenFile = useCallback(async (attachment: SolicitudAttachment) => {
        if (!serverFolderPath) return;
        try {
            const { openAttachmentFile } = await import('./solicitudAttachments');
            const fullPath = `${serverFolderPath}\\${attachment.relativePath}`;
            await openAttachmentFile(fullPath);
        } catch {
            // Silent fail for file open
        }
    }, [serverFolderPath]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (canUpload) setDragOver(true);
    }, [canUpload]);

    const handleDragLeave = useCallback(() => {
        setDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        // In Tauri, drag & drop from OS is handled differently
        // For now, show a message to use the upload button
    }, []);

    return (
        <div className="max-w-4xl mx-auto mt-4">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Archivos Adjuntos
                        </span>
                        {attachments.length > 0 && (
                            <span className="text-xs text-gray-400">({attachments.length})</span>
                        )}
                    </div>
                    {canUpload && (
                        <button
                            onClick={handleUploadClick}
                            disabled={uploading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50
                                       border border-amber-200 rounded-md hover:bg-amber-100 transition-colors
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            {uploading ? 'Subiendo...' : 'Adjuntar'}
                        </button>
                    )}
                </div>

                {/* Server unavailable notice */}
                {!serverAvailable && !readOnly && (
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span className="text-xs text-amber-600">
                            Servidor no disponible. Los adjuntos se pueden agregar cuando el servidor este accesible.
                        </span>
                    </div>
                )}

                {/* No folder yet */}
                {serverAvailable && !serverFolderPath && !readOnly && (
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span className="text-xs text-blue-600">
                            Guarde la solicitud para crear la carpeta en el servidor y habilitar adjuntos.
                        </span>
                    </div>
                )}

                {/* File list */}
                <div className="divide-y divide-gray-50">
                    {attachments.length === 0 ? (
                        <div
                            className={`px-4 py-8 text-center transition-colors ${
                                dragOver ? 'bg-amber-50 border-2 border-dashed border-amber-300' : ''
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <Paperclip className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                            <p className="text-xs text-gray-400">Sin archivos adjuntos</p>
                            {canUpload && (
                                <p className="text-xs text-gray-300 mt-1">
                                    Haga click en "Adjuntar" para agregar archivos
                                </p>
                            )}
                        </div>
                    ) : (
                        attachments.map((att, i) => (
                            <div
                                key={`${att.fileName}-${i}`}
                                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors group"
                            >
                                {getFileIcon(att.fileType)}
                                <div className="flex-1 min-w-0">
                                    <button
                                        onClick={() => handleOpenFile(att)}
                                        className="text-xs font-medium text-gray-700 hover:text-amber-600
                                                   truncate block max-w-full text-left transition-colors"
                                        title={`Abrir ${att.fileName}`}
                                    >
                                        {att.fileName}
                                    </button>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-gray-400">{formatBytes(att.fileSize)}</span>
                                        {att.uploadedAt && (
                                            <span className="text-[10px] text-gray-300">{formatDate(att.uploadedAt)}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleOpenFile(att)}
                                        className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Abrir archivo"
                                        aria-label={`Abrir ${att.fileName}`}
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </button>
                                    {!readOnly && (
                                        confirmDeleteIndex === i ? (
                                            <div className="flex items-center gap-1 bg-white rounded shadow-md border border-red-200 px-1.5 py-1">
                                                <span className="text-[9px] text-red-600 font-medium whitespace-nowrap mr-0.5">Eliminar?</span>
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
                                                onClick={() => handleDelete(i)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Eliminar"
                                                aria-label={`Eliminar ${att.fileName}`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Hidden file input fallback */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={() => {
                        // Browser fallback - limited functionality
                    }}
                />
            </div>
        </div>
    );
};

export default SolicitudAttachmentPanel;
