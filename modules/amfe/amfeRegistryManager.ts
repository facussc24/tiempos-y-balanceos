/**
 * AMFE Registry Manager
 *
 * Backward-compatible API for the AMFE registry.
 * Delegates to SQLite — the registry is now the amfe_documents table itself.
 */

import { v4 as uuidv4 } from 'uuid';
import type { AmfeDocument } from './amfeTypes';
import type { AmfeRegistry, AmfeRegistryEntry, AmfeLifecycleStatus } from './amfeRegistryTypes';
import { createEmptyRegistry } from './amfeRegistryTypes';
import {
    listAmfeDocuments,
    saveAmfeDocument,
    updateAmfeStatus,
    computeAmfeStats,
} from '../../utils/repositories/amfeRepository';
import { logger } from '../../utils/logger';

/**
 * Load the registry (reconstructed from amfe_documents table).
 */
export async function loadRegistry(): Promise<AmfeRegistry> {
    try {
        const entries = await listAmfeDocuments();
        const maxNum = entries.reduce((max, e) => {
            const num = parseInt(e.amfeNumber.replace('AMFE-', ''), 10);
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        return {
            entries,
            lastUpdated: new Date().toISOString(),
            nextNumber: maxNum + 1,
        };
    } catch (err) {
        logger.error('AmfeRegistry', 'Failed to load registry', {}, err instanceof Error ? err : undefined);
        return createEmptyRegistry();
    }
}

/**
 * Save the registry. In SQLite mode, this is a no-op because
 * individual documents are saved directly via saveAmfeDocument.
 * The registry is always reconstructed from the table.
 */
export async function saveRegistry(_registry: AmfeRegistry): Promise<boolean> {
    // No-op — registry state is derived from amfe_documents table
    return true;
}

/**
 * Get the next AMFE number and return an updated registry.
 */
export function getNextAmfeNumber(registry: AmfeRegistry): { number: string; updatedRegistry: AmfeRegistry } {
    const currentNumbers = registry.entries.map(e => {
        const n = parseInt(e.amfeNumber.replace('AMFE-', ''), 10);
        return isNaN(n) ? 0 : n;
    });

    let nextNum = registry.nextNumber;
    while (currentNumbers.includes(nextNum)) {
        nextNum++;
        if (nextNum > 99999) {
            throw new Error('AMFE numbers exhausted: all numbers up to 99999 are in use');
        }
    }

    const number = `AMFE-${String(nextNum).padStart(3, '0')}`;
    return {
        number,
        updatedRegistry: { ...registry, nextNumber: nextNum + 1 },
    };
}

/**
 * Find duplicate AMFE numbers in the registry.
 */
export function findDuplicateAmfeNumbers(registry: AmfeRegistry): { amfeNumber: string; entries: AmfeRegistryEntry[] }[] {
    const numberMap = new Map<string, AmfeRegistryEntry[]>();
    for (const entry of registry.entries) {
        const list = numberMap.get(entry.amfeNumber) || [];
        list.push(entry);
        numberMap.set(entry.amfeNumber, list);
    }
    return Array.from(numberMap.entries())
        .filter(([_, entries]) => entries.length > 1)
        .map(([amfeNumber, entries]) => ({ amfeNumber, entries }));
}

/**
 * Repair duplicate AMFE numbers (keep oldest, reassign rest).
 */
export function repairDuplicateNumbers(registry: AmfeRegistry): AmfeRegistry {
    const duplicates = findDuplicateAmfeNumbers(registry);
    if (duplicates.length === 0) return registry;

    const updatedEntries = [...registry.entries];
    let nextNum = registry.nextNumber;

    for (const dup of duplicates) {
        const sorted = [...dup.entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        for (let i = 1; i < sorted.length; i++) {
            const entry = updatedEntries.find(e => e.id === sorted[i].id);
            if (entry) {
                entry.amfeNumber = `AMFE-${String(nextNum).padStart(3, '0')}`;
                nextNum++;
            }
        }
    }

    return { ...registry, entries: updatedEntries, nextNumber: nextNum };
}

/**
 * Compute summary statistics from an AMFE document.
 * Delegates to the canonical implementation in amfeRepository.
 */
export function computeEntryStats(doc: AmfeDocument): Pick<AmfeRegistryEntry, 'operationCount' | 'causeCount' | 'apHCount' | 'apMCount' | 'coveragePercent'> {
    return computeAmfeStats(doc);
}

/**
 * Add a new document to the registry.
 */
export async function addToRegistry(registry: AmfeRegistry, projectName: string, doc: AmfeDocument): Promise<{ entry: AmfeRegistryEntry; updatedRegistry: AmfeRegistry }> {
    const { number, updatedRegistry } = getNextAmfeNumber(registry);
    const stats = computeEntryStats(doc);
    const now = new Date().toISOString();

    const entry: AmfeRegistryEntry = {
        id: uuidv4(),
        amfeNumber: number,
        projectName,
        status: 'draft',
        subject: doc.header.subject || '',
        client: doc.header.client || '',
        partNumber: doc.header.partNumber || '',
        responsible: doc.header.responsible || '',
        startDate: doc.header.startDate || '',
        lastRevisionDate: doc.header.revDate || '',
        ...stats,
        revisions: [],
        createdAt: now,
        updatedAt: now,
    };

    // Persist to SQLite
    const ok = await saveAmfeDocument(entry.id, entry.amfeNumber, projectName, doc, 'draft', []);
    if (!ok) {
        logger.error('AmfeRegistry', 'Failed to persist new entry to SQLite');
    }

    return {
        entry,
        updatedRegistry: {
            ...updatedRegistry,
            entries: [...updatedRegistry.entries, entry],
            lastUpdated: now,
        },
    };
}

/**
 * Update an existing registry entry from a document.
 */
export async function updateRegistryEntry(registry: AmfeRegistry, projectName: string, doc: AmfeDocument): Promise<AmfeRegistry> {
    const stats = computeEntryStats(doc);
    const now = new Date().toISOString();
    const entries = registry.entries.map(e => {
        if (e.projectName === projectName) {
            return {
                ...e,
                subject: doc.header.subject || e.subject,
                client: doc.header.client || e.client,
                partNumber: doc.header.partNumber || e.partNumber,
                responsible: doc.header.responsible || e.responsible,
                startDate: doc.header.startDate || e.startDate,
                lastRevisionDate: doc.header.revDate || e.lastRevisionDate,
                ...stats,
                updatedAt: now,
            };
        }
        return e;
    });

    // Persist matched entry to SQLite
    const matched = entries.find(e => e.projectName === projectName);
    if (matched) {
        const ok = await saveAmfeDocument(matched.id, matched.amfeNumber, projectName, doc, matched.status, matched.revisions);
        if (!ok) {
            logger.error('AmfeRegistry', 'Failed to persist updated entry');
        }
    }

    return { ...registry, entries, lastUpdated: now };
}

/**
 * Update the status of a registry entry.
 */
export async function updateEntryStatus(registry: AmfeRegistry, entryId: string, status: AmfeLifecycleStatus): Promise<AmfeRegistry> {
    // Persist to SQLite
    const ok = await updateAmfeStatus(entryId, status);
    if (!ok) {
        logger.error('AmfeRegistry', 'Failed to persist status update');
    }

    return {
        ...registry,
        entries: registry.entries.map(e =>
            e.id === entryId ? { ...e, status, updatedAt: new Date().toISOString() } : e
        ),
        lastUpdated: new Date().toISOString(),
    };
}

/**
 * Add a revision to a registry entry.
 */
export function addRevisionToEntry(
    registry: AmfeRegistry,
    entryId: string,
    revision: { reason: string; revisedBy: string; description: string }
): AmfeRegistry {
    const now = new Date().toISOString();
    return {
        ...registry,
        entries: registry.entries.map(e => {
            if (e.id === entryId) {
                return {
                    ...e,
                    revisions: [...e.revisions, { ...revision, date: now }],
                    lastRevisionDate: now,
                    updatedAt: now,
                };
            }
            return e;
        }),
        lastUpdated: now,
    };
}

/**
 * Sync registry from SQLite (replaces syncRegistryFromProjects which scanned filesystem).
 */
export async function syncRegistryFromProjects(_registry: AmfeRegistry): Promise<AmfeRegistry> {
    // Just reload from DB — it's the source of truth
    return loadRegistry();
}
