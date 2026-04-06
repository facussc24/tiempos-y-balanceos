/**
 * Seed: TOYOTA TELAS PLANAS 581D — Time Study
 *
 * Loads measured sewing times from the PDF "TIEMPOS PWA TELAS LISAS"
 * into a Tiempos y Balanceos project.
 *
 * Data source:
 *   - GRUPO 1: Items 21-9463 a 21-9468 (Overlock, Recta, Aplix)
 *   - GRUPO 2: Items 21-9474, 21-9475 (Overlock, Recta, Aplix)
 *   - PENDIENTES: 21-9469, 21-9470, 21-9471, 21-9472 (sin medicion)
 *
 * Run via browser console: await window.__seedToyotaTelas()
 */

import type { ProjectData, Task } from '../../types';
import { saveProject, listProjects } from '../repositories/projectRepository';
import { deleteProject } from '../repositories/projectRepository';
import { logger } from '../logger';

const PROJECT_NAME = 'TOYOTA TELAS PLANAS 581D';
const FATIGUE_STANDARD = 0.14; // 14% — matches FATIGUE_OPTIONS 'standard'

function makeTask(
    id: string,
    description: string,
    times: number[],
    avg: number,
    sectorId?: string,
): Task {
    const standardTime = avg > 0
        ? parseFloat((avg * 1.0 * (1 + FATIGUE_STANDARD)).toFixed(2))
        : 0;

    return {
        id,
        description,
        times: times.length > 0 ? times : [],
        averageTime: avg,
        ratingFactor: 100,
        fatigueCategory: 'standard',
        standardTime,
        executionMode: 'manual',
        predecessors: [],
        successors: [],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        ...(sectorId ? { sectorId } : {}),
    };
}

function buildProjectData(): ProjectData {
    const SECTOR_COSTURA = 'sector-costura';
    const SECTOR_APLIX = 'sector-aplix';

    const tasks: Task[] = [
        // ── GRUPO 1: Items 21-9463 a 21-9468 ──
        makeTask(
            'G1-OP-001',
            'Costura Overlock (G1: 21-9463 a 21-9468)',
            [30.0, 36.8, 42.0],
            36.8,
            SECTOR_COSTURA,
        ),
        makeTask(
            'G1-OP-002',
            'Costura Recta - Refuerzos (G1: solo 21-9467, 21-9468)',
            [40.0, 45.1, 50.0],
            45.1,
            SECTOR_COSTURA,
        ),
        makeTask(
            'G1-OP-003',
            'Aplicacion de Aplix (G1: 21-9463 a 21-9468) — 11 aplix/pza (9463-9466), 5 aplix/pza (9467-9468)',
            [23.0, 29.5, 36.0],
            29.5,
            SECTOR_APLIX,
        ),

        // ── GRUPO 2: Items 21-9474, 21-9475 ──
        makeTask(
            'G2-OP-001',
            'Costura Overlock (G2: 21-9474, 21-9475)',
            [82.0, 95.8, 108.0],
            95.8,
            SECTOR_COSTURA,
        ),
        makeTask(
            'G2-OP-002',
            'Costura Recta - Refuerzos (G2: 21-9474, 21-9475)',
            [90.0, 95.4, 100.0],
            95.4,
            SECTOR_COSTURA,
        ),
        makeTask(
            'G2-OP-003',
            'Aplicacion de Aplix (G2: 21-9474, 21-9475) — 34 aplix/pza',
            [104.0, 110.9, 120.0],
            110.9,
            SECTOR_APLIX,
        ),

        // ── PENDIENTES (sin medicion) ──
        makeTask('PEND-9469', '21-9469 (PENDIENTE - Sin datos) — 39 aplix/pza', [], 0),
        makeTask('PEND-9470', '21-9470 (PENDIENTE - Sin datos) — 39 aplix/pza', [], 0),
        makeTask('PEND-9471', '21-9471 (PENDIENTE - Sin datos) — 42 aplix/pza', [], 0),
        makeTask('PEND-9472', '21-9472 (PENDIENTE - Sin datos) — 42 aplix/pza', [], 0),
    ];

    return {
        meta: {
            name: PROJECT_NAME,
            date: '2026-03-30',
            client: 'PWA',
            project: 'HILUX 581D',
            version: 'Rev A',
            engineer: 'F. Santoro',
            activeShifts: 1,
            manualOEE: 0.85,
            useManualOEE: true,
            useSectorOEE: false,
            dailyDemand: 160,
            configuredStations: 1,
            activeModels: [
                { id: 'default', name: 'Modelo Estandar', percentage: 1.0, color: '#3b82f6' },
            ],
            fatigueCompensation: {
                enabled: true,
                globalPercent: 10,
            },
        },
        shifts: [
            {
                id: 1,
                name: 'Turno 1',
                startTime: '06:00',
                endTime: '15:00',
                breaks: [{ id: 'b1', name: 'Descanso', startTime: '11:00', duration: 60 }],
            },
        ],
        sectors: [
            { id: SECTOR_COSTURA, name: 'Costura', color: '#3b82f6' },
            { id: SECTOR_APLIX, name: 'Aplicacion Aplix', color: '#10b981' },
        ],
        tasks,
        assignments: [],
        stationConfigs: [],
        vsmExternalNodes: [],
        vsmInfoFlows: [],
    };
}

async function seedToyotaTelasPlanas(): Promise<number> {
    logger.info('Seed', `Seeding project: ${PROJECT_NAME}`);

    // Check for existing project with same name to avoid duplicates
    const existing = await listProjects();
    const match = existing.find(p => p.name === PROJECT_NAME && p.client === 'PWA');
    if (match) {
        logger.info('Seed', `Deleting existing project id=${match.id} to avoid duplicates`);
        await deleteProject(match.id);
    }

    const projectData = buildProjectData();
    const id = await saveProject(projectData);
    logger.info('Seed', `Project "${PROJECT_NAME}" saved with id=${id}, ${projectData.tasks.length} tasks`);
    return id;
}

// Wire to window for browser console execution
if (typeof window !== 'undefined') {
    (window as any).__seedToyotaTelas = seedToyotaTelasPlanas;
}

export { seedToyotaTelasPlanas };
