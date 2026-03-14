/**
 * useCrossDocAlerts — Hook for cross-document change alerts
 *
 * Detects pending alerts for the current document and provides
 * dismiss (acknowledge) functionality.
 *
 * @module useCrossDocAlerts
 */

import { useState, useEffect, useCallback } from 'react';
import type { DocumentModule } from '../utils/revisionUtils';
import { type CrossDocAlert, detectCrossDocAlerts } from '../utils/crossDocumentAlerts';
import { acknowledgeCrossDocAlert } from '../utils/repositories/crossDocRepository';
import { logger } from '../utils/logger';

interface UseCrossDocAlertsReturn {
    alerts: CrossDocAlert[];
    dismissAlert: (alert: CrossDocAlert) => Promise<void>;
    dismissAll: () => Promise<void>;
    isLoading: boolean;
}

export function useCrossDocAlerts(
    module: DocumentModule | null,
    documentId: string | null,
): UseCrossDocAlertsReturn {
    const [alerts, setAlerts] = useState<CrossDocAlert[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!module || !documentId) {
            setAlerts([]);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        detectCrossDocAlerts(module, documentId)
            .then(detected => {
                if (!cancelled) setAlerts(detected);
            })
            .catch(err => {
                logger.error('useCrossDocAlerts', 'Failed to detect alerts', {}, err instanceof Error ? err : undefined);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, [module, documentId]);

    const dismissAlert = useCallback(async (alert: CrossDocAlert) => {
        if (!module || !documentId) return;

        try {
            await acknowledgeCrossDocAlert(
                alert.sourceModule,
                alert.sourceDocId,
                module,
                documentId,
            );
            setAlerts(prev => prev.filter(a =>
                !(a.sourceModule === alert.sourceModule && a.sourceDocId === alert.sourceDocId),
            ));
        } catch (err) {
            logger.error('useCrossDocAlerts', 'Failed to dismiss alert', {}, err instanceof Error ? err : undefined);
        }
    }, [module, documentId]);

    const dismissAll = useCallback(async () => {
        if (!module || !documentId) return;

        // Capture snapshot to avoid stale closure if alerts change during iteration
        const alertsToProcess = [...alerts];
        try {
            for (const alert of alertsToProcess) {
                await acknowledgeCrossDocAlert(
                    alert.sourceModule,
                    alert.sourceDocId,
                    module,
                    documentId,
                );
            }
            setAlerts([]);
        } catch (err) {
            logger.error('useCrossDocAlerts', 'Failed to dismiss all alerts', {}, err instanceof Error ? err : undefined);
        }
    }, [module, documentId, alerts]);

    return {
        alerts,
        dismissAlert,
        dismissAll,
        isLoading,
    };
}
