/**
 * useOpenExportFolder — Opens the export folder for the current document
 *
 * In Tauri mode this would open the Y:\INGENIERIA folder in Windows Explorer.
 * In web mode the operation is a no-op because the browser cannot open local
 * filesystem folders.
 *
 * @module useOpenExportFolder
 */

import { useState, useCallback, useMemo } from 'react';
import {
    type ExportDocModule,
    extractDocMetadata,
} from '../utils/exportPathManager';
import { logger } from '../utils/logger';

export interface UseOpenExportFolderResult {
    /** Open the export folder in Windows Explorer (no-op in web mode) */
    openFolder: () => Promise<void>;
    /** Whether the folder is currently being opened */
    isOpening: boolean;
    /** Always false in web mode — folder opening requires the Tauri runtime */
    canOpen: boolean;
}

export function useOpenExportFolder(
    module: ExportDocModule,
    doc: unknown,
): UseOpenExportFolderResult {
    const [isOpening, setIsOpening] = useState(false);

    const metadata = useMemo(
        () => extractDocMetadata(module, doc),
        [module, doc],
    );

    // Not available in web mode — opening a local folder requires Tauri plugin-opener
    const canOpen = false;

    const openFolder = useCallback(async () => {
        if (!canOpen || isOpening) return;

        setIsOpening(true);
        try {
            // No-op in web mode: the browser cannot open filesystem folders
            logger.debug('OpenExportFolder', 'openFolder is a no-op in web mode', {
                module,
                metadata,
            });
        } finally {
            setIsOpening(false);
        }
    }, [canOpen, isOpening, module, metadata]);

    return { openFolder, isOpening, canOpen };
}
