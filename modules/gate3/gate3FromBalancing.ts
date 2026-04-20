/**
 * Adapter: ProjectData del modulo Balancing -> Gate3Project para precarga del Excel VW.
 *
 * Reusa las funciones de calculo de balanceo (cycle time, OEE por estacion) e infiere
 * el tipo de proceso desde el nombre. NO inventa OK/NOK: deja en 0 y pasa el OEE
 * global del proyecto al `oeeOverride` de cada estacion.
 */
import { v4 as uuidv4 } from 'uuid';
import type { ProjectData, Task } from '../../types';
import {
    calculateEffectiveStationTime,
    calculateStationOEE,
    calculateTaktTime,
} from '../../core/balancing/simulation';
import type { Gate3Project, Gate3Station } from '../../core/gate3/types';
import { GATE3_MAX_STATIONS } from '../../core/gate3/constants';
import { inferGate3ProcessType } from '../../core/gate3/processType';

const today = (): string => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const safeNum = (v: unknown, fb = 0): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fb;

export function buildGate3FromProjectData(data: ProjectData): Gate3Project {
    // Defensa: si el proyecto esta a medio crear, evitar errores
    const assignments = data.assignments ?? [];
    const tasks = data.tasks ?? [];
    const stationConfigs = data.stationConfigs ?? [];
    const shifts = data.shifts ?? [];

    const activeShifts = Math.max(1, safeNum(data.meta?.activeShifts, 1));
    const dailyDemand = Math.max(0, safeNum(data.meta?.dailyDemand, 0));
    const globalOee = data.meta?.useSectorOEE ? 1 : safeNum(data.meta?.manualOEE, 0.85);

    const taktResult = calculateTaktTime(
        shifts, activeShifts, dailyDemand, globalOee, safeNum(data.meta?.setupLossPercent, 0),
    );
    const totalAvailMin = safeNum(taktResult.totalAvailableMinutes, 480 * activeShifts);
    const minPerShiftAvg = totalAvailMin / activeShifts;
    const hoursPerShift = Math.max(1, minPerShiftAvg / 60);

    // Construir lista de estaciones (1..N) en base a assignments
    const tMap = new Map(tasks.map((t) => [t.id, t]));
    const cfgMap = new Map(stationConfigs.map((c) => [c.id, c]));
    const validIds = assignments.map((a) => a.stationId).filter(Number.isFinite);
    const maxId = validIds.length > 0 ? Math.max(...validIds) : 0;
    const total = Math.max(maxId, safeNum(data.meta?.configuredStations, 1));

    const stations: Gate3Station[] = [];
    for (let i = 1; i <= total && stations.length < GATE3_MAX_STATIONS; i++) {
        const stationTasks = assignments
            .filter((a) => a.stationId === i)
            .map((a) => tMap.get(a.taskId))
            .filter(Boolean) as Task[];
        if (stationTasks.length === 0) continue;

        const cfg = cfgMap.get(i);
        const replicas = cfg?.replicas && cfg.replicas > 0 ? cfg.replicas : 1;
        let effective = calculateEffectiveStationTime(stationTasks);
        if (!Number.isFinite(effective) || effective < 0) effective = 0;
        const cycleTime = replicas > 0 ? effective / replicas : 0;

        const stationOee = (() => {
            const raw = calculateStationOEE(data, i, stationTasks[0]?.sectorId);
            const num = Number.isFinite(raw) ? raw : globalOee;
            return Math.min(1, Math.max(0, num));
        })();

        const description = (stationTasks[0]?.description || `Estacion ${i}`).slice(0, 50);
        const processType = inferGate3ProcessType(description);

        // Si la task tiene injectionParams (caso inyeccion), usar las cavidades reales del molde
        const cavities = processType === 'inyeccion'
            ? Math.max(1, safeNum(stationTasks[0]?.injectionParams?.optimalCavities, 1))
            : 1;

        stations.push({
            id: uuidv4(),
            name: description,
            processType,
            observationTimeMin: 0,
            cycleTimeSec: Number(cycleTime.toFixed(2)),
            cavities,
            downtimeMin: 0,
            okParts: 0,
            nokParts: 0,
            shiftsPerWeek: activeShifts * 5, // 5 dias laborales — VW estandar
            hoursPerShift: Number(hoursPerShift.toFixed(2)) || 8,
            reservationPct: 1,
            machines: replicas,
            oeeOverride: stationOee,
        });
    }

    return {
        partNumber: data.meta?.name || '',
        partDesignation: data.meta?.name || '',
        project: data.meta?.name || '',
        supplier: 'Barack Mercosul',
        location: 'Zarate, Argentina',
        creator: '',
        date: data.meta?.date || today(),
        department: 'Ingenieria',
        gsisNr: '',
        normalDemandWeek: dailyDemand * 5,
        stations: stations.length > 0 ? stations : [{
            id: uuidv4(),
            name: 'Estacion 1',
            processType: 'general',
            observationTimeMin: 0,
            cycleTimeSec: 0,
            cavities: 1,
            downtimeMin: 0,
            okParts: 0,
            nokParts: 0,
            shiftsPerWeek: 15,
            hoursPerShift: 8,
            reservationPct: 1,
            machines: 1,
            oeeOverride: globalOee,
        }],
    };
}
