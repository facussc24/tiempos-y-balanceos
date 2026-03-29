/**
 * SolicitudApp — Main entry point for the Solicitud module
 *
 * Orchestrates form state, persistence, sidebar list, toolbar,
 * server sync, attachments, procedure viewer, and pending ops.
 *
 * Phase 2: Added server folder management, file attachments,
 * procedure viewer overlay, server status, obsolete workflow,
 * and index Excel updates.
 *
 * Phase 2 Fixes: Auto-sync on save, delete button, index button,
 * procedure export to server, ConfirmModal instead of window.confirm.
 */

import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import type { SolicitudListItem, SolicitudStatus } from './solicitudTypes';
import type { ReconciliationResult } from './solicitudReconciliation';
import { createEmptySolicitud } from './solicitudTypes';
import { useSolicitud } from './useSolicitud';
import { useSolicitudPersistence } from './useSolicitudPersistence';
import { validateSolicitud, hasErrors } from './solicitudValidation';
import { useAmfeConfirm } from '../amfe/useAmfeConfirm';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import SolicitudForm from './SolicitudForm';
import SolicitudList from './SolicitudList';
import SolicitudToolbar from './SolicitudToolbar';
import SolicitudAttachmentPanel from './SolicitudAttachmentPanel';
import { useRevisionControl } from '../../hooks/useRevisionControl';
import { RevisionPromptModal } from '../../components/modals/RevisionPromptModal';
import { RevisionHistoryPanel } from '../../components/layout/RevisionHistoryPanel';
import { getNextRevisionLevel } from '../../utils/revisionUtils';
import { useOpenExportFolder } from '../../hooks/useOpenExportFolder';
import { Breadcrumb } from '../../components/navigation/Breadcrumb';
import { Loader2 } from 'lucide-react';

// Lazy-loaded overlays
const SolicitudProcedureViewer = lazy(() => import('./SolicitudProcedureViewer'));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SolicitudAppProps {
    onBackToLanding?: () => void;
}

interface ToastState {
    message: string;
    type: 'success' | 'error' | 'info';
    visible: boolean;
}

type ServerConnectionStatus = 'connected' | 'disconnected' | 'checking';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SolicitudApp: React.FC<SolicitudAppProps> = ({ onBackToLanding }) => {
    const solicitud = useSolicitud();
    const confirm = useAmfeConfirm();

    const [solicitudList, setSolicitudList] = useState<SolicitudListItem[]>([]);
    const [selectedId, setSelectedId] = useState<string>(solicitud.data.id);
    const [toast, setToast] = useState<ToastState>({ message: '', type: 'info', visible: false });
    const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Phase 2 state
    const [serverStatus, setServerStatus] = useState<ServerConnectionStatus>('checking');
    const [pendingOpsCount, setPendingOpsCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showProcedure, setShowProcedure] = useState(false);

    // Initial loading state
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // Reconciliation state
    const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
    const [showReconciliationPanel, setShowReconciliationPanel] = useState(false);

    const persistence = useSolicitudPersistence({
        currentData: solicitud.data,
        currentId: selectedId,
    });

    // --- Revision Control ---
    const revisionControl = useRevisionControl({
        module: 'solicitud',
        documentId: selectedId,
        currentData: solicitud.data,
        currentRevisionLevel: solicitud.data.header.revision || 'A',
        onRevisionCreated: useCallback(async (newLevel: string) => {
            solicitud.updateHeader({ revision: newLevel });

            // Auto-save the updated revision level
            try {
                const snapshot = {
                    ...solicitud.data,
                    header: { ...solicitud.data.header, revision: newLevel },
                    updatedAt: new Date().toISOString(),
                };
                const { saveSolicitud } = await import('../../utils/repositories/solicitudRepository');
                await saveSolicitud(snapshot.id, snapshot);
            } catch {
                // Non-critical
            }

            // Auto-update index on Y: (fire-and-forget)
            if (serverStatus === 'connected') {
                try {
                    const { updateSolicitudIndex } = await import('./SolicitudIndexExcel');
                    const { getSolicitudBasePath } = await import('./solicitudServerManager');
                    const basePath = await getSolicitudBasePath();
                    await updateSolicitudIndex(basePath);
                } catch {
                    // Index update failure is non-critical
                }
            }
        }, [solicitud.updateHeader, solicitud.data, serverStatus]),
    });

    // --- Export folder ---
    const exportFolder = useOpenExportFolder('solicitud', solicitud.data);

    // --- Validation ---
    const validationIssues = useMemo(() => validateSolicitud(solicitud.data), [solicitud.data]);
    const formHasErrors = hasErrors(validationIssues);

    // --- Toast helper ---
    const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ message, type, visible: true });
        toastTimerRef.current = setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, 3000);
    }, []);

    // Cleanup toast timer
    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    // --- Server availability check ---
    const checkServerStatus = useCallback(async () => {
        setServerStatus('checking');
        try {
            const { isSolicitudServerAvailable } = await import('./solicitudServerManager');
            const available = await isSolicitudServerAvailable();
            setServerStatus(available ? 'connected' : 'disconnected');
        } catch {
            setServerStatus('disconnected');
        }
    }, []);

    // --- Pending ops count ---
    const refreshPendingOps = useCallback(async () => {
        try {
            const { getPendingOpCount } = await import('./solicitudPendingOps');
            const count = await getPendingOpCount();
            setPendingOpsCount(count);
        } catch {
            // Silent
        }
    }, []);

    // --- Initial checks on mount ---
    useEffect(() => {
        checkServerStatus();
        refreshPendingOps();
        // Re-check server every 60 seconds
        const interval = setInterval(() => {
            checkServerStatus();
        }, 60_000);
        return () => clearInterval(interval);
    }, [checkServerStatus, refreshPendingOps]);

    // --- Auto-create base folders + export procedure + process pending ops when server becomes available ---
    useEffect(() => {
        if (serverStatus === 'connected') {
            (async () => {
                try {
                    // Ensure base folder structure exists (idempotent)
                    const { ensureBaseStructure, exportProcedureToServer } = await import('./solicitudServerManager');
                    await ensureBaseStructure();

                    // Ensure engineering folder structure (Manuales/, Formatos Estandar/)
                    const { ensureEngineeringStructure } = await import('../engineering/engineeringServerManager');
                    await ensureEngineeringStructure();

                    // Export procedure document to Manuales/ if not already present (idempotent)
                    await exportProcedureToServer();

                    // Then process pending ops
                    const { processPendingOps } = await import('./solicitudPendingOps');
                    const opsResult = await processPendingOps();
                    if (opsResult.processed > 0) {
                        showToast(`${opsResult.processed} operación(es) pendiente(s) procesada(s)`, 'success');
                    }
                    refreshPendingOps();

                    // Reconciliation check (max once per 24h)
                    try {
                        const { loadAppSettings } = await import('../../utils/repositories/settingsRepository');
                        const settings = await loadAppSettings();
                        const lastCheck = settings.lastReconciliationCheck;
                        const DAY_MS = 24 * 60 * 60 * 1000;
                        // FIX: If lastCheck is an invalid date string, getTime() returns NaN,
                        // and NaN > DAY_MS is false, causing reconciliation to be skipped.
                        // Treat invalid dates as stale (needs reconciliation).
                        const checkTime = lastCheck ? new Date(lastCheck).getTime() : NaN;
                        const stale = !lastCheck || !Number.isFinite(checkTime) || (Date.now() - checkTime > DAY_MS);
                        if (stale) {
                            const { runReconciliation } = await import('./solicitudReconciliation');
                            const reconResult = await runReconciliation();
                            if (reconResult.onlyOnServer.length > 0 || reconResult.onlyInDb.length > 0) {
                                setReconciliationResult(reconResult);
                            }
                        }
                    } catch {
                        // Reconciliation failure is non-critical
                    }
                } catch {
                    // Silent
                }
            })();
        }
    }, [serverStatus, refreshPendingOps, showToast]);

    // --- Load list on mount ---
    const refreshList = useCallback(async () => {
        const items = await persistence.listDocuments();
        setSolicitudList(items);
        return items;
    }, [persistence.listDocuments]);

    useEffect(() => {
        let cancelled = false;
        setIsInitialLoading(true);
        refreshList().then(async items => {
            if (cancelled) return;
            if (items.length > 0) {
                await handleSelect(items[0].id);
            }
        }).catch(() => {
            // FIX: Prevent unhandled promise rejection on mount if DB fails
            if (!cancelled) showToast('Error al cargar solicitudes', 'error');
        }).finally(() => {
            if (!cancelled) setIsInitialLoading(false);
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Select handler ---
    const handleSelect = useCallback(async (id: string) => {
        const doc = await persistence.loadDocument(id);
        if (doc) {
            solicitud.setData(doc);
            setSelectedId(doc.id);
        }
    }, [persistence.loadDocument, solicitud.setData]);

    // --- New handler ---
    const handleNew = useCallback(() => {
        const newDoc = createEmptySolicitud();
        solicitud.reset(newDoc);
        setSelectedId(newDoc.id);
    }, [solicitud.reset]);

    // --- Save handler (SQLite + auto-sync to server + index update) ---
    const handleSave = useCallback(async () => {
        if (formHasErrors) {
            const firstError = validationIssues.find(i => i.severity === 'error');
            showToast(firstError?.message || 'Hay errores en el formulario', 'error');
            return;
        }

        const success = await persistence.saveDocument();
        if (!success) {
            showToast('Error al guardar la solicitud', 'error');
            return;
        }

        const items = await refreshList();
        const saved = items.find(i => i.id === selectedId);
        if (saved) {
            const doc = await persistence.loadDocument(saved.id);
            if (doc) solicitud.setData(doc);
        }

        // Auto-sync to server if connected
        if (serverStatus === 'connected') {
            try {
                const { syncSolicitudToServer, getSolicitudBasePath } = await import('./solicitudServerManager');
                const syncResult = await syncSolicitudToServer(solicitud.data);

                if (syncResult.success) {
                    // Update server folder path if changed
                    if (syncResult.folderPath && syncResult.folderPath !== solicitud.data.serverFolderPath) {
                        solicitud.setServerFolderPath(syncResult.folderPath);
                        solicitud.setLastServerSync(new Date().toISOString());

                        const snapshot = {
                            ...solicitud.data,
                            serverFolderPath: syncResult.folderPath,
                            lastServerSync: new Date().toISOString(),
                        };
                        const { saveSolicitud } = await import('../../utils/repositories/solicitudRepository');
                        await saveSolicitud(snapshot.id, snapshot);
                    }

                    // Update index Excel (non-critical)
                    try {
                        const { updateSolicitudIndex } = await import('./SolicitudIndexExcel');
                        const basePath = await getSolicitudBasePath();
                        await updateSolicitudIndex(basePath);
                    } catch {
                        // Index update failure is non-critical
                    }

                    showToast('Guardado y sincronizado con el servidor', 'success');
                } else {
                    // Enqueue for retry
                    try {
                        const { enqueueOp } = await import('./solicitudPendingOps');
                        await enqueueOp('createFolder', solicitud.data.id, { doc: solicitud.data });
                        refreshPendingOps();
                    } catch {
                        // Silent
                    }
                    showToast('Guardado localmente (error al sincronizar)', 'info');
                }
            } catch {
                showToast('Guardado localmente (error al sincronizar)', 'info');
            }
        } else {
            showToast('Guardado localmente (servidor no disponible)', 'info');
        }
    }, [formHasErrors, validationIssues, persistence, refreshList, selectedId, solicitud, serverStatus, showToast, refreshPendingOps]);

    // --- Delete handler (with ConfirmModal + server cleanup) ---
    const handleDelete = useCallback(async (id: string) => {
        const ok = await confirm.requestConfirm({
            title: 'Eliminar solicitud',
            message: 'Eliminar esta solicitud? La carpeta en el servidor sera movida a Obsoletos. Esta accion no se puede deshacer.',
            variant: 'danger',
            confirmText: 'Eliminar',
        });
        if (!ok) return;

        // Move server folder to Obsoletos if exists
        if (serverStatus === 'connected') {
            try {
                const docToDelete = await persistence.loadDocument(id);
                if (docToDelete && docToDelete.serverFolderPath) {
                    const { moveSolicitudToObsoletos } = await import('./solicitudServerManager');
                    await moveSolicitudToObsoletos(docToDelete);
                }
            } catch {
                // Server cleanup failure is non-critical
            }
        }

        const success = await persistence.deleteDocument(id);
        if (success) {
            // Update index after deletion (non-critical)
            if (serverStatus === 'connected') {
                try {
                    const { updateSolicitudIndex } = await import('./SolicitudIndexExcel');
                    const { getSolicitudBasePath } = await import('./solicitudServerManager');
                    const basePath = await getSolicitudBasePath();
                    await updateSolicitudIndex(basePath);
                } catch {
                    // Non-critical
                }
            }

            showToast('Solicitud eliminada', 'info');
            const items = await refreshList();
            if (items.length > 0) {
                handleSelect(items[0].id);
            } else {
                handleNew();
            }
        } else {
            showToast('Error al eliminar', 'error');
        }
    }, [confirm, serverStatus, persistence, refreshList, handleSelect, handleNew, showToast]);

    // --- Server sync handler ---
    const handleSyncServer = useCallback(async () => {
        if (isSyncing) return;
        setIsSyncing(true);

        try {
            showToast('Sincronizando con el servidor...', 'info');
            const { syncSolicitudToServer } = await import('./solicitudServerManager');
            const result = await syncSolicitudToServer(solicitud.data);

            if (result.success) {
                // Update the document with the server folder path
                if (result.folderPath && result.folderPath !== solicitud.data.serverFolderPath) {
                    solicitud.setServerFolderPath(result.folderPath);
                    solicitud.setLastServerSync(new Date().toISOString());

                    // Auto-save the updated paths
                    const snapshot = {
                        ...solicitud.data,
                        serverFolderPath: result.folderPath,
                        lastServerSync: new Date().toISOString(),
                    };
                    const { saveSolicitud } = await import('../../utils/repositories/solicitudRepository');
                    await saveSolicitud(snapshot.id, snapshot);
                }

                // Update the index Excel (non-critical)
                try {
                    const { updateSolicitudIndex } = await import('./SolicitudIndexExcel');
                    const { getSolicitudBasePath } = await import('./solicitudServerManager');
                    const basePath = await getSolicitudBasePath();
                    await updateSolicitudIndex(basePath);
                } catch {
                    // Index update failure is non-critical
                }

                const msg = result.pdfCopied
                    ? 'Sincronizado: carpeta creada y PDF copiado al servidor'
                    : 'Sincronizado: carpeta creada en el servidor';
                showToast(msg, 'success');
            } else {
                // Enqueue for retry
                try {
                    const { enqueueOp } = await import('./solicitudPendingOps');
                    await enqueueOp('createFolder', solicitud.data.id, { doc: solicitud.data });
                    refreshPendingOps();
                } catch {
                    // Silent
                }
                showToast(result.error || 'Error al sincronizar con el servidor', 'error');
            }
        } catch {
            showToast('Error al sincronizar con el servidor', 'error');
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing, solicitud, showToast, refreshPendingOps]);

    // --- Mark Obsolete handler (with ConfirmModal) ---
    const handleMarkObsolete = useCallback(async () => {
        const ok = await confirm.requestConfirm({
            title: 'Marcar como obsoleta',
            message: 'Marcar esta solicitud como OBSOLETA? La carpeta en el servidor sera movida a Obsoletos.',
            variant: 'warning',
            confirmText: 'Marcar Obsoleta',
        });
        if (!ok) return;

        try {
            // Move server folder to Obsoletos
            if (serverStatus === 'connected' && solicitud.data.serverFolderPath) {
                const { moveSolicitudToObsoletos } = await import('./solicitudServerManager');
                const moved = await moveSolicitudToObsoletos(solicitud.data);
                if (!moved) {
                    const { enqueueOp } = await import('./solicitudPendingOps');
                    await enqueueOp('moveToObsoletos', solicitud.data.id, { doc: solicitud.data });
                    refreshPendingOps();
                    showToast('No se pudo mover la carpeta. Se reintentará automáticamente.', 'error');
                }
            }

            // Update status locally and save
            solicitud.setStatus('obsoleta');
            const snapshot = {
                ...solicitud.data,
                status: 'obsoleta' as SolicitudStatus,
                updatedAt: new Date().toISOString(),
            };
            const { saveSolicitud } = await import('../../utils/repositories/solicitudRepository');
            await saveSolicitud(snapshot.id, snapshot);

            // Update index (non-critical)
            if (serverStatus === 'connected') {
                try {
                    const { updateSolicitudIndex } = await import('./SolicitudIndexExcel');
                    const { getSolicitudBasePath } = await import('./solicitudServerManager');
                    const basePath = await getSolicitudBasePath();
                    await updateSolicitudIndex(basePath);
                } catch {
                    // Non-critical
                }
            }

            showToast('Solicitud marcada como obsoleta', 'info');
            await refreshList();
        } catch {
            showToast('Error al marcar como obsoleta', 'error');
        }
    }, [confirm, serverStatus, solicitud, showToast, refreshList, refreshPendingOps]);

    // --- Update index handler ---
    const handleUpdateIndex = useCallback(async () => {
        if (serverStatus !== 'connected') {
            showToast('Servidor no disponible para actualizar el indice', 'error');
            return;
        }

        try {
            showToast('Actualizando indice...', 'info');
            const { updateSolicitudIndex } = await import('./SolicitudIndexExcel');
            const { getSolicitudBasePath } = await import('./solicitudServerManager');
            const basePath = await getSolicitudBasePath();
            const ok = await updateSolicitudIndex(basePath);
            if (ok) {
                showToast('Indice actualizado correctamente', 'success');
            } else {
                showToast('Error al actualizar el indice', 'error');
            }
        } catch {
            showToast('Error al actualizar el indice', 'error');
        }
    }, [serverStatus, showToast]);

    // --- Open index file in Excel ---
    const handleOpenIndex = useCallback(async () => {
        if (serverStatus !== 'connected') {
            showToast('Servidor no disponible', 'error');
            return;
        }
        try {
            const { getSolicitudBasePath } = await import('./solicitudServerManager');
            const { joinPath } = await import('../../utils/networkUtils');
            const { logger } = await import('../../utils/logger');
            const basePath = await getSolicitudBasePath();
            const indexPath = joinPath(basePath, 'Indice_Solicitudes.xlsx');

            logger.debug('SolicitudApp', 'Opening index file', { indexPath });

            // En modo web no se puede abrir archivos locales con apps del sistema.
            // Mostramos la ruta para que el usuario la abra manualmente.
            showToast(`Índice en: ${indexPath} — Ábralo desde el explorador de archivos.`, 'info');
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            try {
                const { logger } = await import('../../utils/logger');
                logger.error('SolicitudApp', 'Error opening index file', { error: msg });
            } catch { /* ignore logging failure */ }
            showToast(`Error al abrir el indice: ${msg}`, 'error');
        }
    }, [serverStatus, showToast]);

    // --- Retry pending ops handler ---
    const handleRetryPending = useCallback(async () => {
        try {
            showToast('Reintentando operaciones pendientes...', 'info');
            const { processPendingOps } = await import('./solicitudPendingOps');
            const result = await processPendingOps();
            refreshPendingOps();

            if (result.processed > 0) {
                showToast(`${result.processed} operación(es) completada(s)`, 'success');
            } else if (result.failed > 0) {
                showToast(`${result.failed} operación(es) aún pendiente(s)`, 'error');
            } else {
                showToast('No hay operaciones pendientes', 'info');
            }
        } catch {
            showToast('Error al procesar operaciones pendientes', 'error');
        }
    }, [showToast, refreshPendingOps]);

    // --- Manual reconciliation ---
    const handleRunReconciliation = useCallback(async () => {
        if (serverStatus !== 'connected') return;
        try {
            showToast('Verificando servidor...', 'info');
            const { runReconciliation } = await import('./solicitudReconciliation');
            const result = await runReconciliation();
            if (result.onlyOnServer.length > 0 || result.onlyInDb.length > 0) {
                setReconciliationResult(result);
                setShowReconciliationPanel(true);
            } else {
                setReconciliationResult(null);
                setShowReconciliationPanel(false);
                showToast(`Todo sincronizado (${result.matched} carpeta(s) verificada(s))`, 'success');
            }
        } catch {
            showToast('Error al verificar servidor', 'error');
        }
    }, [serverStatus, showToast]);

    // --- Re-sync a single solicitud to server ---
    const handleResyncSolicitud = useCallback(async (id: string) => {
        try {
            const doc = await persistence.loadDocument(id);
            if (!doc) {
                showToast('No se encontro la solicitud', 'error');
                return;
            }
            const { syncSolicitudToServer } = await import('./solicitudServerManager');
            const result = await syncSolicitudToServer(doc);
            if (result.success) {
                showToast(`Carpeta creada para ${doc.header.solicitudNumber}`, 'success');
            } else {
                showToast(result.error || 'Error al sincronizar', 'error');
            }
        } catch {
            showToast('Error al re-sincronizar', 'error');
        }
    }, [persistence.loadDocument, showToast]);

    // --- Re-sync all solicitudes without server folder ---
    const handleResyncAll = useCallback(async () => {
        if (!reconciliationResult) return;
        showToast(`Re-sincronizando ${reconciliationResult.onlyInDb.length} solicitud(es)...`, 'info');
        let ok = 0;
        for (const item of reconciliationResult.onlyInDb) {
            try {
                const doc = await persistence.loadDocument(item.id);
                if (!doc) continue;
                const { syncSolicitudToServer } = await import('./solicitudServerManager');
                const result = await syncSolicitudToServer(doc);
                if (result.success) ok++;
            } catch {
                // Continue with next
            }
        }
        showToast(`${ok} de ${reconciliationResult.onlyInDb.length} carpeta(s) creada(s)`, ok > 0 ? 'success' : 'error');
        // Re-run reconciliation to refresh
        await handleRunReconciliation();
    }, [reconciliationResult, persistence.loadDocument, showToast, handleRunReconciliation]);

    // --- Regenerate index from reconciliation panel ---
    const handleRegenerateIndex = useCallback(async () => {
        try {
            showToast('Regenerando indice...', 'info');
            const { updateSolicitudIndex } = await import('./SolicitudIndexExcel');
            const { getSolicitudBasePath } = await import('./solicitudServerManager');
            const basePath = await getSolicitudBasePath();
            const ok = await updateSolicitudIndex(basePath);
            showToast(ok ? 'Indice regenerado' : 'Error al regenerar indice', ok ? 'success' : 'error');
        } catch {
            showToast('Error al regenerar indice', 'error');
        }
    }, [showToast]);

    // --- Export handlers (lazy loaded) ---
    const handleExportPdf = useCallback(async () => {
        try {
            showToast('Generando PDF...', 'info');
            const { exportSolicitudPdf } = await import('./solicitudPdfExport');
            await exportSolicitudPdf(solicitud.data);
            showToast('PDF exportado correctamente', 'success');
        } catch {
            showToast('Error al exportar PDF', 'error');
        }
    }, [showToast, solicitud.data]);

    const handleExportExcel = useCallback(async () => {
        try {
            showToast('Generando Excel...', 'info');
            const { exportSolicitudExcel } = await import('./solicitudExcelExport');
            await exportSolicitudExcel(solicitud.data);
            showToast('Excel exportado correctamente', 'success');
        } catch {
            showToast('Error al exportar Excel', 'error');
        }
    }, [showToast, solicitud.data]);

    // --- Attachments handler ---
    const handleAttachmentsChange = useCallback((attachments: import('./solicitudTypes').SolicitudAttachment[]) => {
        solicitud.updateAttachments(attachments);
    }, [solicitud.updateAttachments]);

    // --- Back handler ---
    const handleBack = useCallback(() => {
        if (onBackToLanding) {
            onBackToLanding();
        }
    }, [onBackToLanding]);

    // --- Computed ---
    const isReadOnly = solicitud.data.status === 'obsoleta';

    return (
        <div className="h-full flex flex-col bg-gray-50 font-sans text-sm">
            {/* Toolbar */}
            <SolicitudToolbar
                onBack={handleBack}
                onNew={handleNew}
                onSave={handleSave}
                onDelete={() => handleDelete(selectedId)}
                onExportPdf={handleExportPdf}
                onExportExcel={handleExportExcel}
                onShowProcedure={() => setShowProcedure(true)}
                onMarkObsolete={handleMarkObsolete}
                onSyncServer={handleSyncServer}
                onUpdateIndex={handleUpdateIndex}
                onOpenIndex={handleOpenIndex}
                onReconcile={handleRunReconciliation}
                status={solicitud.data.status}
                isSaving={persistence.isSaving}
                isSyncing={isSyncing}
                lastSavedAt={persistence.lastSavedAt}
                hasErrors={formHasErrors}
                serverStatus={serverStatus}
                pendingOps={pendingOpsCount}
                onRetryPending={handleRetryPending}
                onNewRevision={revisionControl.handleNewRevision}
                onShowHistory={() => revisionControl.setShowRevisionHistory(!revisionControl.showRevisionHistory)}
                revisionLevel={solicitud.data.header.revision || 'A'}
                onOpenExportFolder={exportFolder.openFolder}
                canOpenExportFolder={exportFolder.canOpen}
            />

            <Breadcrumb
                items={[
                    ...(onBackToLanding ? [{ label: 'Inicio', onClick: onBackToLanding }] : [{ label: 'Inicio' }]),
                    { label: 'Solicitudes de Código', isActive: true },
                ]}
                className="bg-white border-b border-gray-100 px-4 py-1"
            />

            {/* Reconciliation banner */}
            {reconciliationResult && (reconciliationResult.onlyOnServer.length > 0 || reconciliationResult.onlyInDb.length > 0) && !showReconciliationPanel && (
                <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs">
                    <span className="font-medium">
                        ⚠ {reconciliationResult.onlyOnServer.length > 0 && `${reconciliationResult.onlyOnServer.length} carpeta(s) sin registro`}
                        {reconciliationResult.onlyOnServer.length > 0 && reconciliationResult.onlyInDb.length > 0 && ', '}
                        {reconciliationResult.onlyInDb.length > 0 && `${reconciliationResult.onlyInDb.length} solicitud(es) sin carpeta`}
                    </span>
                    <button
                        onClick={() => setShowReconciliationPanel(true)}
                        className="px-2 py-0.5 rounded bg-amber-200 hover:bg-amber-300 text-amber-900 font-medium"
                    >
                        Ver detalles
                    </button>
                    <button
                        onClick={() => { setReconciliationResult(null); setShowReconciliationPanel(false); }}
                        className="px-2 py-0.5 rounded hover:bg-amber-100 text-amber-600"
                    >
                        Ignorar
                    </button>
                </div>
            )}

            {/* Reconciliation details panel */}
            {showReconciliationPanel && reconciliationResult && (
                <div className="border-b border-amber-200 bg-amber-50/50 p-4 overflow-y-auto max-h-[50vh]">
                    <div className="max-w-3xl mx-auto space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-amber-800">
                                Reconciliacion Servidor ↔ App
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleRegenerateIndex}
                                    className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700 hover:bg-blue-200"
                                >
                                    Regenerar Indice
                                </button>
                                <button
                                    onClick={() => setShowReconciliationPanel(false)}
                                    className="px-2 py-1 rounded text-xs bg-gray-200 text-gray-700 hover:bg-gray-300"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>

                        {reconciliationResult.onlyOnServer.length > 0 && (
                            <div>
                                <p className="text-xs font-medium text-amber-700 mb-1">
                                    Carpetas en servidor sin registro ({reconciliationResult.onlyOnServer.length})
                                </p>
                                <p className="text-xs text-amber-600 mb-2">
                                    Estas carpetas existen en el servidor pero no tienen solicitud registrada en la app.
                                </p>
                                <div className="bg-white rounded border border-amber-200 divide-y divide-amber-100">
                                    {reconciliationResult.onlyOnServer.map(f => (
                                        <div key={f.fullPath} className="px-3 py-1.5 flex items-center gap-2 text-xs">
                                            <span className="text-amber-500">📁</span>
                                            <span className="font-mono text-gray-700">{f.folderName}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                f.tipo === 'producto' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {f.tipo}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {reconciliationResult.onlyInDb.length > 0 && (
                            <div>
                                <p className="text-xs font-medium text-amber-700 mb-1">
                                    Solicitudes sin carpeta en servidor ({reconciliationResult.onlyInDb.length})
                                </p>
                                <div className="bg-white rounded border border-amber-200 divide-y divide-amber-100">
                                    {reconciliationResult.onlyInDb.map(item => (
                                        <div key={item.id} className="px-3 py-1.5 flex items-center gap-2 text-xs">
                                            <span className="text-gray-400">📄</span>
                                            <span className="font-medium text-gray-700">{item.solicitud_number}</span>
                                            <span className="text-gray-500">{item.codigo}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                item.status === 'aprobada' ? 'bg-green-100 text-green-700' :
                                                item.status === 'enviada' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {item.status}
                                            </span>
                                            <button
                                                onClick={() => handleResyncSolicitud(item.id)}
                                                className="ml-auto px-2 py-0.5 rounded text-[10px] bg-amber-200 hover:bg-amber-300 text-amber-900 font-medium"
                                            >
                                                Re-sincronizar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={handleResyncAll}
                                    className="mt-2 px-3 py-1 rounded text-xs bg-amber-200 hover:bg-amber-300 text-amber-900 font-medium"
                                >
                                    Re-sincronizar todas
                                </button>
                            </div>
                        )}

                        <p className="text-[10px] text-gray-400">
                            {reconciliationResult.matched} carpeta(s) verificada(s) — Ultima verificacion: {isNaN(new Date(reconciliationResult.lastCheck).getTime()) ? '—' : new Date(reconciliationResult.lastCheck).toLocaleString('es-AR')}
                        </p>
                    </div>
                </div>
            )}

            {/* Main content: sidebar + form */}
            {isInitialLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 size={32} className="text-amber-500 animate-spin mx-auto mb-3" />
                        <p className="text-sm text-gray-400">Cargando solicitudes...</p>
                    </div>
                </div>
            ) : (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Sidebar */}
                <div className="w-full md:w-[280px] max-h-[200px] md:max-h-none flex-shrink-0 overflow-auto md:overflow-hidden border-b md:border-b-0">
                    <SolicitudList
                        items={solicitudList}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                        onNew={handleNew}
                        onDelete={handleDelete}
                    />
                </div>

                {/* Form area */}
                <div className="flex-1 overflow-y-auto p-6">
                    <SolicitudForm
                        doc={solicitud.data}
                        onUpdateHeader={solicitud.updateHeader}
                        onUpdateProducto={solicitud.updateProducto}
                        onUpdateInsumo={solicitud.updateInsumo}
                        onSwitchTipo={solicitud.switchTipo}
                        onSetObservaciones={solicitud.setObservaciones}
                        readOnly={isReadOnly}
                    />

                    {/* Attachment panel */}
                    <SolicitudAttachmentPanel
                        attachments={solicitud.data.attachments}
                        serverFolderPath={solicitud.data.serverFolderPath}
                        serverAvailable={serverStatus === 'connected'}
                        readOnly={isReadOnly}
                        onAttachmentsChange={handleAttachmentsChange}
                    />

                    {/* Validation issues display */}
                    {validationIssues.length > 0 && (
                        <div className="max-w-4xl mx-auto mt-4">
                            <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3">
                                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                                    Validacion
                                </p>
                                <div className="space-y-1">
                                    {validationIssues.map((issue, i) => (
                                        <p
                                            key={`${issue.field}-${i}`}
                                            className={`text-xs flex items-center gap-1.5 ${
                                                issue.severity === 'error'
                                                    ? 'text-red-600'
                                                    : 'text-amber-600'
                                            }`}
                                        >
                                            <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                issue.severity === 'error' ? 'bg-red-500' : 'bg-amber-500'
                                            }`} />
                                            {issue.message}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* Toast notification */}
            <div
                className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
                    toast.visible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-4 pointer-events-none'
                }`}
            >
                <div className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white ${
                    toast.type === 'success' ? 'bg-green-600' :
                    toast.type === 'error' ? 'bg-red-600' :
                    'bg-gray-700'
                }`}>
                    {toast.message}
                </div>
            </div>

            {/* Procedure Viewer (lazy) */}
            <Suspense fallback={null}>
                <SolicitudProcedureViewer
                    isOpen={showProcedure}
                    onClose={() => setShowProcedure(false)}
                />
            </Suspense>

            {/* Revision Prompt Modal */}
            <RevisionPromptModal
                isOpen={revisionControl.showRevisionPrompt}
                onClose={() => revisionControl.setShowRevisionPrompt(false)}
                onConfirm={revisionControl.confirmRevision}
                currentRevisionLevel={solicitud.data.header.revision || 'A'}
                nextRevisionLevel={getNextRevisionLevel(solicitud.data.header.revision || 'A')}
                defaultRevisedBy={solicitud.data.header.solicitante || ''}
            />

            {/* Revision History Panel */}
            <RevisionHistoryPanel
                revisions={revisionControl.revisions}
                onViewSnapshot={async (level) => {
                    const snap = await revisionControl.loadSnapshot(level);
                    if (snap) {
                        solicitud.setData(snap as import('./solicitudTypes').SolicitudDocument);
                        showToast(`Snapshot Rev. ${level} cargado (solo lectura)`, 'info');
                    }
                }}
                isOpen={revisionControl.showRevisionHistory}
                onToggle={() => revisionControl.setShowRevisionHistory(!revisionControl.showRevisionHistory)}
            />

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirm.confirmState.isOpen}
                onClose={confirm.handleCancel}
                onConfirm={confirm.handleConfirm}
                title={confirm.confirmState.title}
                message={confirm.confirmState.message}
                variant={confirm.confirmState.variant}
                confirmText={confirm.confirmState.confirmText}
            />
        </div>
    );
};

export default SolicitudApp;
