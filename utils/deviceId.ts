/**
 * Device Identification
 *
 * Generates and persists a unique device ID + friendly name.
 * Used by backup, export/import, and folder sync to identify
 * which computer produced each data file.
 */

import { getSetting, setSetting } from './repositories/settingsRepository';
import { logger } from './logger';

interface DeviceInfo {
    id: string;
    name: string;
}

const SETTINGS_KEY = 'device_info';

function generateUUID(): string {
    return crypto.randomUUID?.() ??
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
}

function generateDefaultName(): string {
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PC-${random}`;
}

let cachedInfo: DeviceInfo | null = null;

/**
 * Get the device info (id + name). Creates one if it doesn't exist yet.
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
    if (cachedInfo) return cachedInfo;

    try {
        const stored = await getSetting<DeviceInfo>(SETTINGS_KEY);
        if (stored?.id && stored?.name) {
            cachedInfo = stored;
            return stored;
        }
    } catch {
        // First run or corrupted – generate new
    }

    const info: DeviceInfo = { id: generateUUID(), name: generateDefaultName() };
    try {
        await setSetting(SETTINGS_KEY, info);
    } catch (err) {
        logger.warn('DeviceId', 'Could not persist device info', { error: String(err) });
    }
    cachedInfo = info;
    logger.info('DeviceId', 'New device registered', { id: info.id, name: info.name });
    return info;
}

/**
 * Shorthand: get just the device ID.
 */
export async function getDeviceId(): Promise<string> {
    return (await getDeviceInfo()).id;
}

/**
 * Shorthand: get just the friendly device name.
 */
export async function getDeviceName(): Promise<string> {
    return (await getDeviceInfo()).name;
}

/**
 * Rename this device (persisted across sessions).
 */
export async function setDeviceName(name: string): Promise<void> {
    const info = await getDeviceInfo();
    info.name = name;
    await setSetting(SETTINGS_KEY, info);
    cachedInfo = info;
    logger.info('DeviceId', 'Device renamed', { name });
}
