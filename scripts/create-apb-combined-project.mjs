#!/usr/bin/env node
/**
 * Crear proyecto NUEVO en Supabase: "Inyeccion PU Armrest Rear y APB Puerta"
 *
 * Combina las 5 variantes de espuma APB en un solo proyecto de Tiempos y Balanceos
 * con demanda total de 1.555 pz/dia. Usa los mismos parametros de inyeccion,
 * turnos y OEE del proyecto APB existente (master.json).
 *
 * piecesPerVehicle = 1 (la demanda ya esta en piezas totales/dia)
 *
 * Usage: node scripts/create-apb-combined-project.mjs
 */

import { readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Read source data from APB master.json ──────────────────────────────────

const MASTER_PATH = '//SERVER/compartido/Ingenieria/Datos Software/01_DATA/VWA/PATAGONIA/APB/master.json';
const source = JSON.parse(readFileSync(MASTER_PATH, 'utf-8'));

// ─── Build new combined project ─────────────────────────────────────────────

const PROJECT_NAME = 'Inyeccion PU Armrest Rear y APB Puerta';
const TOTAL_DEMAND = 1555;

// Copy shifts exactly from the APB source (real data)
const shifts = source.shifts.map(s => ({ ...s }));

// Copy injection sector from source
const injSector = source.sectors.find(s => s.id === 'INYECCION');

// Get all injection-related tasks from source (sector INYECCION)
const injectionTasks = source.tasks
    .filter(t => t.sectorId === 'INYECCION')
    .map(t => ({
        ...t,
        // Update injection params to reflect new demand
        ...(t.injectionParams ? {
            injectionParams: {
                ...t.injectionParams,
                productionVolume: TOTAL_DEMAND,
            }
        } : {}),
    }));

// Copy assignments for injection station tasks
const injectionTaskIds = new Set(injectionTasks.map(t => t.id));
const assignments = source.assignments
    .filter(a => injectionTaskIds.has(a.taskId));

// Station configs for used stations only
const usedStations = new Set(assignments.map(a => a.stationId));
const stationConfigs = source.stationConfigs
    .filter(sc => usedStations.has(sc.id));

// Build the ProjectData
const newProject = {
    meta: {
        name: PROJECT_NAME,
        date: new Date().toISOString().split('T')[0],
        client: 'Volkswagen Argentina',
        version: 'Rev A',
        engineer: '',
        project: 'PATAGONIA',
        activeShifts: source.meta.activeShifts, // 3
        manualOEE: source.meta.manualOEE,       // 0.90
        useManualOEE: true,
        useSectorOEE: false,
        dailyDemand: TOTAL_DEMAND,              // 1555
        piecesPerVehicle: 1,                    // 1 porque demanda ya es en piezas totales
        configuredStations: Math.max(...[...usedStations], 1),
        activeModels: [
            { id: 'default', name: 'Modelo Estándar', percentage: 1.0, color: '#3b82f6' }
        ],
        createdAt: new Date().toISOString(),
        modifiedBy: 'Script: capacidad moldes APB',
    },
    shifts,
    sectors: injSector ? [{ ...injSector }] : [],
    tasks: injectionTasks,
    assignments,
    stationConfigs,
    zoningConstraints: [],
    vsmExternalNodes: [],
    vsmInfoFlows: [],
};

// ─── Insert into Supabase ───────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  CREAR PROYECTO COMBINADO: Inyeccion PU APB');
    console.log('═══════════════════════════════════════════════════════════\n');

    await initSupabase();

    // Check if already exists
    const existing = await selectSql(
        `SELECT id, name FROM projects WHERE name = ?`,
        [PROJECT_NAME]
    );

    if (existing.length > 0) {
        console.log(`  ⚠ Proyecto "${PROJECT_NAME}" ya existe (id: ${existing[0].id})`);
        console.log('  Actualizando...\n');
        const data = JSON.stringify(newProject);
        await execSql(
            `UPDATE projects SET client = ?, project_code = ?, version = ?, daily_demand = ?, data = ?, updated_at = datetime('now') WHERE name = ?`,
            ['VWA', 'PATAGONIA', 'Rev A', TOTAL_DEMAND, data, PROJECT_NAME]
        );
    } else {
        console.log(`  Insertando proyecto nuevo: "${PROJECT_NAME}"\n`);
        const data = JSON.stringify(newProject);
        await execSql(
            `INSERT INTO projects (name, client, project_code, engineer, version, daily_demand, data, checksum) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [PROJECT_NAME, 'VWA', 'PATAGONIA', '', 'Rev A', TOTAL_DEMAND, data, '']
        );
    }

    // Verify
    const check = await selectSql(`SELECT id, name, client, daily_demand FROM projects WHERE name = ?`, [PROJECT_NAME]);
    if (check.length > 0) {
        console.log('  ✓ Proyecto creado:');
        console.log(`    ID: ${check[0].id}`);
        console.log(`    Nombre: ${check[0].name}`);
        console.log(`    Cliente: ${check[0].client}`);
        console.log(`    Demanda: ${check[0].daily_demand} pz/dia`);
    }

    // Show summary
    console.log('\n  ── Parametros del proyecto ──');
    console.log(`  Turnos: ${newProject.meta.activeShifts}`);
    console.log(`  OEE: ${(newProject.meta.manualOEE * 100).toFixed(0)}%`);
    console.log(`  Demanda diaria: ${newProject.meta.dailyDemand} pz/dia`);
    console.log(`  Piezas por vehiculo: ${newProject.meta.piecesPerVehicle}`);
    console.log(`  Tareas inyeccion: ${injectionTasks.length}`);
    console.log(`  Estaciones: ${stationConfigs.length}`);

    const injTask = injectionTasks.find(t => t.executionMode === 'injection');
    if (injTask?.injectionParams) {
        console.log(`  Inyeccion PU: ${injTask.injectionParams.pInyectionTime}s iny + ${injTask.injectionParams.pCuringTime}s curado`);
        console.log(`  Moldes carrusel: ${injTask.injectionParams.userSelectedN || injTask.injectionParams.optimalCavities}`);
    }

    // List all projects in DB
    const allProjects = await selectSql('SELECT id, name, client, daily_demand FROM projects ORDER BY id');
    console.log(`\n  ── Todos los proyectos en Supabase (${allProjects.length}) ──`);
    allProjects.forEach(p => {
        const marker = p.name === PROJECT_NAME ? ' ← NUEVO' : '';
        console.log(`    [${p.id}] ${p.name} (${p.client}) — ${p.daily_demand} pz/dia${marker}`);
    });

    console.log('\n═══════════════════════════════════════════════════════════\n');
    close();
}

main().catch(err => {
    console.error('\n  FATAL:', err.message);
    process.exit(1);
});
