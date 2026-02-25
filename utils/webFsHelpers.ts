/**
 * Web File System Access API helpers.
 * Used as fallback when NOT in Tauri mode (browser environment).
 * Tauri mode uses tauri_fs.ts and tauri_smart_save.ts instead.
 */

import { ProjectData } from '../types';
import { incrementVersion } from '../utils';
import { ConflictError } from './concurrency';
import { generateChecksum } from './crypto';
import { logger } from './logger';

// Web File System Access API experimental types (not in standard TS lib)
interface FSPermissionDescriptor { mode: 'read' | 'readwrite'; }
interface FSHandleWithPermissions {
    queryPermission(descriptor: FSPermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor: FSPermissionDescriptor): Promise<PermissionState>;
}

// --- PERMISSIONS ---
const verifyPermission = async (handle: FileSystemDirectoryHandle | FileSystemFileHandle, readWrite: boolean): Promise<boolean> => {
    const options: FSPermissionDescriptor = { mode: readWrite ? 'readwrite' : 'read' };
    try {
        const h = handle as unknown as FSHandleWithPermissions;
        const status = await h.queryPermission(options);
        if (status === 'granted') return true;
        if (status === 'prompt') {
            const request = await h.requestPermission(options);
            return request === 'granted';
        }
        return false;
    } catch (e) {
        logger.error('WebFS', 'Error verifying permission', {}, e instanceof Error ? e : undefined);
        return false;
    }
};

// --- READ PROJECT FILE (Web File System Access API) ---
export const readProjectFile = async (fileHandle: FileSystemFileHandle): Promise<ProjectData | null> => {
    try {
        const file = await fileHandle.getFile();
        const text = await file.text();
        const lastModified = file.lastModified;

        const data = JSON.parse(text) as ProjectData;
        data.fileHandle = fileHandle;
        data._loadedTimestamp = lastModified;
        data._checksum = await generateChecksum(text);

        return data;
    } catch (err) {
        logger.error('WebFS', 'Error reading project file', {}, err instanceof Error ? err : undefined);
        return null;
    }
};

// --- SMART SAVE (Atomic Write Pattern for Web File System Access API) ---
export const smartSaveProject = async (
    fileHandle: FileSystemFileHandle,
    dirHandle: FileSystemDirectoryHandle,
    data: ProjectData,
): Promise<ProjectData> => {
    const { sanitizeFilename } = await import('./filenameSanitization');
    const newVersion = incrementVersion(data.meta.version);
    const newData: ProjectData = { ...data, meta: { ...data.meta, version: newVersion } };
    delete newData.encryption;

    const { fileHandle: _, directoryHandle: __, _loadedTimestamp: ___, _checksum: ____, ...serializableData } = newData;
    const serializedNewData = JSON.stringify(serializableData, null, 2);
    const newChecksum = await generateChecksum(serializedNewData);

    try {
        const hasPerm = await verifyPermission(dirHandle, true);
        if (!hasPerm) throw new Error('Permiso denegado');

        // 1. Concurrency check
        const currentDiskFile = await fileHandle.getFile();
        const oldContent = await currentDiskFile.text();

        if (data._checksum) {
            const diskChecksum = await generateChecksum(oldContent);
            if (diskChecksum !== data._checksum) {
                throw new ConflictError(diskChecksum, data._checksum, currentDiskFile.lastModified, 'unknown');
            }
        }

        // 2. Temp write
        const tempFileName = `.${fileHandle.name}.tmp`;
        const tempHandle = await dirHandle.getFileHandle(tempFileName, { create: true });
        const tempWritable = await tempHandle.createWritable();
        await tempWritable.write(serializedNewData);
        await tempWritable.close();

        // 3. Backup to Obsoletos
        const obsoleteDir = await dirHandle.getDirectoryHandle('Obsoletos', { create: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const cleanName = sanitizeFilename(data.meta.name, { allowSpaces: false });
        const cleanVersion = sanitizeFilename(data.meta.version, { allowSpaces: false });
        const backupName = `${cleanName}_${cleanVersion}_${timestamp}.json`;
        const backupHandle = await obsoleteDir.getFileHandle(backupName, { create: true });
        const backupWritable = await backupHandle.createWritable();
        await backupWritable.write(oldContent);
        await backupWritable.close();

        // 4. Overwrite main file
        const writable = await fileHandle.createWritable();
        await writable.write(serializedNewData);
        await writable.close();

        // 5. Cleanup temp
        try { await dirHandle.removeEntry(tempFileName); } catch { /* ignore */ }

        // 6. Update state
        const newFile = await fileHandle.getFile();
        newData._loadedTimestamp = newFile.lastModified;
        newData._checksum = newChecksum;

        return newData;
    } catch (err) {
        const errorName = err instanceof Error ? err.name : 'Unknown';
        logger.error('WebFS', 'Save failed', { errorName }, err instanceof Error ? err : undefined);
        throw err;
    }
};

// --- MEDIA HELPERS (Web File System Access API) ---
export const saveTaskMediaWeb = async (rootHandle: FileSystemDirectoryHandle, file: File, taskId: string): Promise<string> => {
    try {
        const ext = file.name.split('.').pop() || 'dat';
        const filename = `Task_${taskId}_${Date.now()}.${ext}`;

        const hasPerm = await verifyPermission(rootHandle, true);
        if (!hasPerm) throw new Error('Permiso denegado');

        const mediaDir = await rootHandle.getDirectoryHandle('_STD_WORK', { create: true });
        const mediaFileHandle = await mediaDir.getFileHandle(filename, { create: true });
        const writable = await mediaFileHandle.createWritable();
        await writable.write(file);
        await writable.close();
        return `_STD_WORK/${filename}`;
    } catch (err) {
        logger.error('WebFS', 'Error guardando media', {}, err instanceof Error ? err : undefined);
        throw new Error('No se pudo guardar el archivo multimedia.');
    }
};

export const loadTaskMediaWeb = async (rootHandle: FileSystemDirectoryHandle, mediaRef: string): Promise<string | null> => {
    if (!mediaRef) return null;
    try {
        const parts = mediaRef.split('/');
        if (parts.length !== 2 || parts[0] !== '_STD_WORK') return null;

        const mediaDir = await rootHandle.getDirectoryHandle('_STD_WORK');
        const mediaFileHandle = await mediaDir.getFileHandle(parts[1]);
        const file = await mediaFileHandle.getFile();
        return URL.createObjectURL(file);
    } catch {
        logger.warn('WebFS', 'Media load error');
        return null;
    }
};
