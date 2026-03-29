/**
 * Balancing Capacity Preview — HTML builder
 *
 * Generates inline-styled HTML compatible with PdfPreviewModal + renderHtmlToPdf.
 * Format: "Capacidad de Producción por Proceso" matching Barack's real Excel template.
 *
 * Sections: Header, Production Params, Process Table, Bar Chart (CSS), Summary.
 */

import { ProjectData, Task } from '../../types';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import {
    calculateTaktTime,
    calculateShiftNetMinutes,
    calculateEffectiveStationTime,
    calculateStationOEE,
    calculateSectorTaktTime,
} from '../../core/balancing/simulation';
import { formatNumber } from '../../utils';

// ============================================================================
// TYPES
// ============================================================================

export interface CapacityStationInfo {
    id: number;
    description: string;
    sectorName: string;
    sectorColor: string;
    tipo: 'Interno' | 'Externo';
    cycleTimeSeconds: number;
    capPerHour: number;
    oee: number;
    requiredDaily: number;
    productionDaily: number;
    capacityPct: number;
    dotacion: number;
    operadores: number;
    machineTime: number;
    replicas: number;
    isInjection: boolean;
    injectionNote?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(s: string | number | undefined | null): string {
    const v = sanitizeCellValue(s);
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fmtNum(n: number, dec = 2): string {
    return formatNumber(n, dec);
}

function statusBadge(capacityPct: number): string {
    if (capacityPct >= 100) {
        return `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:10px;">OK</span>`;
    }
    return `<span style="background:#fecaca;color:#991b1b;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:10px;">DEFICIT</span>`;
}

function capacityColor(pct: number): string {
    if (pct >= 120) return '#166534';
    if (pct >= 100) return '#15803d';
    if (pct >= 80) return '#ca8a04';
    return '#dc2626';
}

// ============================================================================
// STATION INFO BUILDER
// ============================================================================

export function buildCapacityStationInfos(data: ProjectData): CapacityStationInfo[] {
    // FIX: Filter out NaN stationIds to prevent Math.max from returning NaN
    const validStationIds = data.assignments.map(a => a.stationId).filter(Number.isFinite);
    const maxA = validStationIds.length > 0 ? Math.max(...validStationIds) : 0;
    const count = Math.max(maxA, data.meta.configuredStations || 1);
    const cfgMap = new Map(data.stationConfigs?.map(c => [c.id, c]) ?? []);
    const tMap = new Map(data.tasks.map(t => [t.id, t]));

    // Calculate available seconds per day
    const oee = data.meta.useSectorOEE ? 1 : data.meta.manualOEE;
    const { totalAvailableMinutes } = calculateTaktTime(
        data.shifts, data.meta.activeShifts, data.meta.dailyDemand, oee,
        data.meta.setupLossPercent || 0
    );
    const totalAvailableSeconds = totalAvailableMinutes * 60;
    const shiftNetMinutes = data.shifts
        .filter((_, i) => i < data.meta.activeShifts)
        .reduce((sum, s) => sum + calculateShiftNetMinutes(s), 0);

    const dailyDemand = data.meta.dailyDemand || 1;

    const stations: CapacityStationInfo[] = [];

    for (let i = 1; i <= count; i++) {
        const cfg = cfgMap.get(i);
        const tasks = data.assignments
            .filter(a => a.stationId === i)
            .map(a => tMap.get(a.taskId))
            .filter(Boolean) as Task[];

        if (tasks.length === 0) continue; // Skip empty stations

        const replicas = cfg?.replicas && cfg.replicas > 0 ? cfg.replicas : 1;
        let effectiveTime = calculateEffectiveStationTime(tasks);
        // B2: Guard effectiveTime NaN/negative — clamp to 0 then skip zero-time stations
        if (!Number.isFinite(effectiveTime) || effectiveTime < 0) effectiveTime = 0;
        if (effectiveTime === 0) continue;
        const cycleTime = replicas > 0 ? effectiveTime / replicas : 0;

        // Station OEE (respects hierarchy: sector > station > global)
        const sectorId = tasks[0]?.sectorId;
        // B3: Clamp OEE to [0, 1] range
        const rawOee = calculateStationOEE(data, i, sectorId);
        const oee = Math.max(0, Math.min(1, Number.isFinite(rawOee) ? rawOee : 0.85));

        // Sector info
        const sector = sectorId ? data.sectors?.find(s => s.id === sectorId) : undefined;
        const sectorName = sector?.name || 'General';
        const sectorColor = sector?.color || '#64748b';

        // Description: first 3 task IDs/descriptions
        const taskDescs = tasks.slice(0, 3).map(t => t.description || t.id);
        const description = taskDescs.join(', ') + (tasks.length > 3 ? '...' : '');

        // Injection detection
        const injTask = tasks.find(t => t.executionMode === 'injection');
        const isInjection = !!injTask;
        let injectionNote: string | undefined;
        if (injTask?.injectionParams) {
            const ip = injTask.injectionParams;
            const n = ip.userSelectedN ?? ip.optimalCavities ?? 0;
            const mode = ip.injectionMode === 'carousel' ? 'Carrusel' : 'Batch';
            injectionNote = `Inyección PU: N=${n} cavidades (${mode}), t_iny=${fmtNum(ip.pInyectionTime || 0)}s, t_cur=${fmtNum(ip.pCuringTime || 0)}s`;
        }

        // Machine time (sum of machine/injection tasks)
        const machineTime = tasks
            .filter(t => t.executionMode === 'machine' || t.executionMode === 'injection')
            .reduce((sum, t) => sum + (t.standardTime || t.averageTime || 0), 0);

        // FIX: Use sector-specific available time when sector has shift override
        let stationAvailSeconds = totalAvailableSeconds;
        let stationShiftNetMin = shiftNetMinutes;
        if (sector?.shiftOverride) {
            const sectorOee = (data.meta.useSectorOEE && sector.targetOee && sector.targetOee > 0)
                ? sector.targetOee : (data.meta.useSectorOEE ? 1 : data.meta.manualOEE);
            const sectorTakt = calculateSectorTaktTime(
                sector, data.shifts, Math.min(data.meta.activeShifts, data.shifts.length),
                dailyDemand, sectorOee, data.meta.setupLossPercent || 0
            );
            stationAvailSeconds = sectorTakt.totalAvailableMinutes * 60;
            stationShiftNetMin = sectorTakt.totalAvailableMinutes;
        }

        // Capacity calculations
        const capPerHour = cycleTime > 0 ? 3600 / cycleTime : 0;
        const productionDaily = cycleTime > 0 ? stationAvailSeconds / cycleTime : 0;
        const capacityPct = dailyDemand > 0 ? (productionDaily / dailyDemand) * 100 : 0;

        // Dotación = (cycleTime_min × dailyDemand) / shiftNetMinutes
        const dotacion = stationShiftNetMin > 0 ? ((cycleTime / 60) * dailyDemand) / stationShiftNetMin : 0;

        stations.push({
            id: i,
            description,
            sectorName,
            sectorColor,
            tipo: 'Interno',
            cycleTimeSeconds: cycleTime,
            capPerHour,
            oee,
            requiredDaily: dailyDemand,
            productionDaily,
            capacityPct,
            dotacion,
            operadores: Math.ceil(dotacion),
            machineTime,
            replicas,
            isInjection,
            injectionNote,
        });
    }

    return stations;
}

// ============================================================================
// HTML BUILDER
// ============================================================================

export function buildCapacityPreviewHtml(data: ProjectData, logoBase64?: string): string {
    const stations = buildCapacityStationInfos(data);
    const rawPpv = data.meta.piecesPerVehicle;
    const ppv = Math.max(1, Number.isFinite(rawPpv) && (rawPpv ?? 0) > 0 ? (rawPpv ?? 1) : 1);
    const dailyDemand = data.meta.dailyDemand || 0;
    const vehicleDemand = ppv > 0 ? Math.round(dailyDemand / ppv) : dailyDemand;
    const weeklyDemand = dailyDemand * 5;

    // Shift info
    const oeeForCapacity = data.meta.useSectorOEE ? 1 : data.meta.manualOEE;
    const { totalAvailableMinutes } = calculateTaktTime(
        data.shifts, data.meta.activeShifts, dailyDemand, oeeForCapacity,
        data.meta.setupLossPercent || 0
    );

    // Detect sectors with shift overrides for informational note
    const sectorsWithOverride = (data.sectors || []).filter(s => s.shiftOverride);
    const hasMixedShifts = sectorsWithOverride.length > 0;

    // Summary
    const totalDotacion = stations.reduce((s, st) => s + st.dotacion, 0);
    const totalOperadoresDia = Math.ceil(totalDotacion);
    const operadoresTurno = Math.ceil(totalDotacion / (data.meta.activeShifts || 1));

    // Chart data: max for scaling
    const maxBarValue = Math.max(
        ...stations.map(s => Math.max(s.requiredDaily, s.productionDaily)),
        1
    );

    const logoHtml = logoBase64
        ? `<img src="${logoBase64}" style="height:50px;object-fit:contain;" />`
        : `<div style="font-size:20px;font-weight:900;color:#1e3a5f;">BARACK</div>`;

    return `
<div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;font-size:11px;line-height:1.4;">

    <!-- HEADER -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
            <td style="width:120px;vertical-align:middle;padding:8px;background:#ffffff;">${logoHtml}</td>
            <td style="vertical-align:middle;padding:8px;">
                <div style="font-size:16px;font-weight:900;color:#1e3a5f;text-transform:uppercase;">Capacidad de Producción por Proceso</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;">${esc(data.meta.name)} — ${esc(data.meta.client || '')}</div>
            </td>
            <td style="text-align:right;vertical-align:middle;padding:8px;font-size:10px;color:#64748b;">
                <div>Fecha: <strong>${esc(data.meta.date)}</strong></div>
                <div>Rev: <strong>${esc(data.meta.version)}</strong></div>
            </td>
        </tr>
    </table>

    <!-- PRODUCTION PARAMS -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10px;">
        <tr style="background:#f1f5f9;">
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#475569;width:25%;">Volumen vehículos diario</td>
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#1e3a5f;width:25%;">${vehicleDemand.toLocaleString('es-AR')}</td>
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#475569;width:25%;">Cantidad de turnos</td>
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#1e3a5f;width:25%;">${data.meta.activeShifts}</td>
        </tr>
        <tr>
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#475569;">Piezas necesarias por vehículo</td>
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#1e3a5f;">${ppv}</td>
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#475569;">Minutos netos disponibles/día</td>
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#1e3a5f;">${fmtNum(totalAvailableMinutes, 0)} min</td>
        </tr>
        <tr style="background:#f1f5f9;">
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#475569;">Piezas necesarias para producción</td>
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#1e3a5f;">${dailyDemand.toLocaleString('es-AR')}</td>
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#475569;">OEE Global</td>
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#1e3a5f;">${fmtNum((data.meta.manualOEE ?? 0.85) * 100, 1)}%</td>
        </tr>
        <tr>
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#475569;">Demanda semanal (Pcs)</td>
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#1e3a5f;">${weeklyDemand.toLocaleString('es-AR')}</td>
            <td style="padding:4px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#475569;"></td>
            <td style="padding:4px 10px;border:1px solid #cbd5e1;"></td>
        </tr>
        ${hasMixedShifts ? `<tr style="background:#eef2ff;">
            <td colspan="4" style="padding:5px 10px;border:1px solid #cbd5e1;font-size:10px;color:#4338ca;">
                <strong>Turnos por sector:</strong> ${sectorsWithOverride.map(s =>
                    `<span style="display:inline-flex;align-items:center;gap:3px;margin:0 6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${esc(s.color)};"></span>${esc(s.name)} (${s.shiftOverride!.activeShifts}T)</span>`
                ).join('')}
                <span style="color:#64748b;margin-left:4px;"> — Resto: ${data.meta.activeShifts}T (proyecto)</span>
            </td>
        </tr>` : ''}
    </table>

    <!-- PROCESS TABLE -->
    <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:16px;">
        <thead>
            <tr style="background:#1e3a5f;color:white;">
                <th style="padding:5px 6px;border:1px solid #1e3a5f;text-align:center;font-weight:bold;">Nro</th>
                <th style="padding:5px 6px;border:1px solid #1e3a5f;text-align:left;font-weight:bold;">Descripción del Proceso</th>
                <th style="padding:5px 6px;border:1px solid #1e3a5f;text-align:center;font-weight:bold;">Sector</th>
                <th style="padding:5px 6px;border:1px solid #1e3a5f;text-align:center;font-weight:bold;">Int/Ext</th>
                <th style="padding:5px 6px;border:1px solid #1e3a5f;text-align:center;font-weight:bold;">Ciclo (s)</th>
                <th style="padding:5px 6px;border:1px solid #1e3a5f;text-align:center;font-weight:bold;">Cap/hora</th>
                <th style="padding:5px 6px;border:1px solid #1e3a5f;text-align:center;font-weight:bold;">OEE %</th>
                <th style="padding:5px 6px;border:1px solid #1e3a5f;text-align:center;font-weight:bold;">Estado</th>
                <th style="padding:5px 6px;border:1px solid #1e3a5f;text-align:center;font-weight:bold;">Pzs Req/Día</th>
                <th style="padding:5px 6px;border:1px solid #1e3a5f;text-align:center;font-weight:bold;">Prod Diaria</th>
                <th style="padding:5px 6px;border:1px solid #1e3a5f;text-align:center;font-weight:bold;">Capacidad %</th>
                <th style="padding:5px 6px;border:1px solid #1e3a5f;text-align:center;font-weight:bold;">Dotación</th>
                <th style="padding:5px 6px;border:1px solid #1e3a5f;text-align:center;font-weight:bold;">Ops</th>
                <th style="padding:5px 6px;border:1px solid #1e3a5f;text-align:center;font-weight:bold;">T.Máq (s)</th>
            </tr>
        </thead>
        <tbody>
            ${stations.map((st, idx) => {
                const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                const capColor = capacityColor(st.capacityPct);
                return `
            <tr style="background:${bg};">
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;">${st.id}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:left;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(st.description)}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${esc(st.sectorColor)};margin-right:3px;vertical-align:middle;"></span>
                    ${esc(st.sectorName)}
                </td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;">${st.tipo}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;color:#1e40af;">${fmtNum(st.cycleTimeSeconds)}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;">${fmtNum(st.capPerHour, 0)}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;color:#1e40af;font-weight:bold;">${fmtNum(st.oee * 100, 1)}%</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;">${statusBadge(st.capacityPct)}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;">${st.requiredDaily.toLocaleString('es-AR')}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;">${fmtNum(st.productionDaily, 0)}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;color:${capColor};">${fmtNum(st.capacityPct, 1)}%</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;">${fmtNum(st.dotacion)}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;">${st.operadores}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;">${st.machineTime > 0 ? fmtNum(st.machineTime) : '-'}</td>
            </tr>
            ${st.injectionNote ? `
            <tr style="background:#fef3c7;">
                <td style="border:1px solid #e2e8f0;"></td>
                <td colspan="13" style="padding:3px 6px;border:1px solid #e2e8f0;font-size:9px;color:#92400e;font-style:italic;">
                    ⚙️ ${esc(st.injectionNote)}
                </td>
            </tr>` : ''}`;
            }).join('')}
        </tbody>
    </table>

    <!-- BAR CHART: Capacidad de Producción por Proceso -->
    <div style="margin-bottom:16px;">
        <div style="font-size:12px;font-weight:900;color:#1e3a5f;margin-bottom:8px;text-transform:uppercase;">
            Capacidad de Producción por Proceso
        </div>
        <div style="display:flex;gap:4px;align-items:flex-end;height:160px;border-bottom:2px solid #cbd5e1;padding-bottom:0;">
            ${stations.map(st => {
                const reqH = Math.max(1, (st.requiredDaily / maxBarValue) * 140);
                const prodH = Math.max(1, (st.productionDaily / maxBarValue) * 140);
                const prodColor = st.productionDaily >= st.requiredDaily ? '#22c55e' : '#ef4444';
                return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
                <div style="display:flex;gap:2px;align-items:flex-end;height:140px;">
                    <div style="width:14px;height:${reqH}px;background:#3b82f6;border-radius:2px 2px 0 0;" title="Requerido: ${st.requiredDaily}"></div>
                    <div style="width:14px;height:${prodH}px;background:${prodColor};border-radius:2px 2px 0 0;" title="Producción: ${fmtNum(st.productionDaily, 0)}"></div>
                </div>
                <div style="font-size:8px;color:#64748b;text-align:center;writing-mode:horizontal-tb;transform:rotate(0deg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40px;">${st.id}</div>
            </div>`;
            }).join('')}
        </div>
        <div style="display:flex;gap:16px;margin-top:6px;font-size:9px;color:#64748b;">
            <div style="display:flex;align-items:center;gap:4px;">
                <div style="width:10px;height:10px;background:#3b82f6;border-radius:2px;"></div>
                Pzs Requeridas/Día
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
                <div style="width:10px;height:10px;background:#22c55e;border-radius:2px;"></div>
                Producción Diaria (OK)
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
                <div style="width:10px;height:10px;background:#ef4444;border-radius:2px;"></div>
                Producción Diaria (DEFICIT)
            </div>
        </div>
    </div>

    <!-- SUMMARY -->
    <table style="width:auto;border-collapse:collapse;font-size:11px;margin-top:8px;">
        <tr style="background:#1e3a5f;color:white;">
            <th colspan="2" style="padding:6px 16px;font-weight:bold;text-align:left;">RESUMEN</th>
        </tr>
        <tr style="background:#f1f5f9;">
            <td style="padding:4px 16px;border:1px solid #cbd5e1;font-weight:bold;color:#475569;">Total Dotación (operadores/día)</td>
            <td style="padding:4px 16px;border:1px solid #cbd5e1;font-weight:bold;color:#1e3a5f;text-align:center;">${totalOperadoresDia}</td>
        </tr>
        <tr>
            <td style="padding:4px 16px;border:1px solid #cbd5e1;font-weight:bold;color:#475569;">Operadores por turno</td>
            <td style="padding:4px 16px;border:1px solid #cbd5e1;font-weight:bold;color:#1e3a5f;text-align:center;">${operadoresTurno}</td>
        </tr>
        <tr style="background:#f1f5f9;">
            <td style="padding:4px 16px;border:1px solid #cbd5e1;font-weight:bold;color:#475569;">Procesos analizados</td>
            <td style="padding:4px 16px;border:1px solid #cbd5e1;font-weight:bold;color:#1e3a5f;text-align:center;">${stations.length}</td>
        </tr>
    </table>

</div>`;
}
