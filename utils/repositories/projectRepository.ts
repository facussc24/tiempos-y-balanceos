/**
 * Project Repository
 *
 * CRUD for ProjectData (time studies / line balancing projects).
 * Replaces: db.ts (IndexedDB CRUD) and filesystem JSON persistence.
 */

import type { ProjectData } from '../../types';
import { getDatabase } from '../database';
import { logger } from '../logger';
import { generateChecksum } from '../crypto';
import { scheduleBackup } from '../backupService';

export interface ProjectListItem {
    id: number;
    name: string;
    client: string;
    project_code: string;
    engineer: string;
    version: string;
    daily_demand: number;
    updated_at: string;
}

/**
 * List all projects (metadata only — no full data).
 */
export async function listProjects(): Promise<ProjectListItem[]> {
    try {
        const db = await getDatabase();
        return await db.select<ProjectListItem>(
            'SELECT id, name, client, project_code, engineer, version, daily_demand, updated_at FROM projects ORDER BY updated_at DESC'
        );
    } catch (err) {
        logger.error('ProjectRepo', 'Failed to list projects', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * Load a project by ID.
 */
export async function loadProject(id: number): Promise<ProjectData | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ data: string; id: number; checksum: string | null }>(
            'SELECT id, data, checksum FROM projects WHERE id = ?',
            [id]
        );
        if (rows.length === 0) return null;

        const project = JSON.parse(rows[0].data) as ProjectData;
        project.id = rows[0].id;
        project._checksum = rows[0].checksum ?? undefined;
        project._loadedTimestamp = Date.now();
        return project;
    } catch (err) {
        logger.error('ProjectRepo', `Failed to load project ${id}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Save a project (insert or update). Returns the project ID.
 */
export async function saveProject(project: ProjectData): Promise<number> {
    try {
        const db = await getDatabase();

        // Strip transient fields from persisted data
        const { id, fileHandle: _fileHandle, directoryHandle: _directoryHandle, _loadedTimestamp, _checksum, ...persistData } = project;
        const data = JSON.stringify(persistData);
        const checksum = await generateChecksum(data);

        const name = project.meta.name || 'Sin nombre';
        const client = project.meta.client || '';
        const projectCode = project.meta.project || '';
        const engineer = project.meta.engineer || '';
        const version = project.meta.version || 'Borrador';
        const dailyDemand = project.meta.dailyDemand || 1000;

        if (id) {
            // Update existing
            await db.execute(
                `UPDATE projects SET name = ?, client = ?, project_code = ?, engineer = ?,
                 version = ?, daily_demand = ?, data = ?, checksum = ?, updated_at = datetime('now')
                 WHERE id = ?`,
                [name, client, projectCode, engineer, version, dailyDemand, data, checksum, id]
            );
            scheduleBackup();
            return id;
        }

        // Insert new
        const result = await db.execute(
            `INSERT INTO projects (name, client, project_code, engineer, version, daily_demand, data, checksum)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, client, projectCode, engineer, version, dailyDemand, data, checksum]
        );
        scheduleBackup();
        return result.lastInsertId;
    } catch (err) {
        logger.error('ProjectRepo', 'Failed to save project', {}, err instanceof Error ? err : undefined);
        throw err;
    }
}

/**
 * Delete a project by ID.
 */
export async function deleteProject(id: number): Promise<void> {
    try {
        const db = await getDatabase();
        await db.execute('DELETE FROM projects WHERE id = ?', [id]);
    } catch (err) {
        logger.error('ProjectRepo', `Failed to delete project ${id}`, {}, err instanceof Error ? err : undefined);
        throw err;
    }
}

/**
 * Search projects by name or client.
 */
export async function searchProjects(query: string): Promise<ProjectListItem[]> {
    try {
        const db = await getDatabase();
        const pattern = `%${query}%`;
        return await db.select<ProjectListItem>(
            `SELECT id, name, client, project_code, engineer, version, daily_demand, updated_at
             FROM projects WHERE name LIKE ? OR client LIKE ? ORDER BY updated_at DESC`,
            [pattern, pattern]
        );
    } catch (err) {
        logger.error('ProjectRepo', 'Failed to search projects', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * Get projects by client name.
 */
export async function getProjectsByClient(client: string): Promise<ProjectListItem[]> {
    try {
        const db = await getDatabase();
        return await db.select<ProjectListItem>(
            `SELECT id, name, client, project_code, engineer, version, daily_demand, updated_at
             FROM projects WHERE client = ? ORDER BY updated_at DESC`,
            [client]
        );
    } catch (err) {
        logger.error('ProjectRepo', 'Failed to get projects by client', {}, err instanceof Error ? err : undefined);
        return [];
    }
}
