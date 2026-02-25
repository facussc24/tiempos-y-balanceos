import { ProjectData, Task } from "../types";
import { formatNumber, formatTime, parseTime } from "./formatting";
import { calculateTaktTime, calculateTotalHeadcount, calculateEffectiveStationTime } from "../core/balancing/simulation";
import XLSX from 'xlsx-js-style';
import { logger } from './logger';


// --- EXCEL EXPORT (ENGINEERING) ---
export const exportToExcel = (data: ProjectData) => {
    // xlsx-js-style is now bundled via npm - always available

    const wb = XLSX.utils.book_new();

    // 1. Tasks Sheet
    const tasksData = data.tasks.map(t => ({
        ID: t.id,
        Descripción: t.description,
        "Modo": t.executionMode === 'machine' ? 'Máquina' : t.executionMode === 'injection' ? 'Inyección' : 'Manual',
        "Pzs/Ciclo": t.cycleQuantity || 1,
        "Concurrente con": t.concurrentWith || "-",
        "T. Promedio (Unit)": t.averageTime,
        "Muestras (N)": t.requiredSamples || "-",
        "Ritmo (VR%)": t.ratingFactor,
        // Fatigue removed v10.1 (global only)
        "Variabilidad (StdDev)": t.stdDev || 0,
        "T. Estándar": t.standardTime,
        "Prioridad (Peso)": t.positionalWeight,
        "Predecesoras": t.predecessors.join(", "),
        "Sucesoras": t.successors.join(", ")
    }));
    const wsTasks = XLSX.utils.json_to_sheet(tasksData);
    XLSX.utils.book_append_sheet(wb, wsTasks, "Tareas (Ingeniería)");

    // 2. Balance Sheet
    const stationsData: any[] = [];
    const stationIds = new Set(data.assignments.map(a => a.stationId));
    Array.from(stationIds).sort().forEach(stId => {
        const tasks = data.assignments.filter(a => a.stationId === stId);
        tasks.forEach(a => {
            const t = data.tasks.find(x => x.id === a.taskId);
            stationsData.push({
                Estación: stId,
                Tarea: a.taskId,
                "Tiempo Tarea": t?.standardTime || 0
            });
        });
    });
    const wsBalance = XLSX.utils.json_to_sheet(stationsData);
    XLSX.utils.book_append_sheet(wb, wsBalance, "Balanceo");

    downloadWorkbook(wb, `${data.meta.name}_Data_Ingenieria.xlsx`);
};

// --- EXCEL EXPORT (PRODUCTION / SHOP FLOOR) - WITH STYLES ---
export const exportProductionExcel = (data: ProjectData) => {
    // xlsx-js-style is now bundled via npm - always available

    // --- STYLES DEFINITION ---
    const styles = {
        header: {
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12, name: "Arial" },
            fill: { fgColor: { rgb: "2563EB" } }, // Blue 600
            alignment: { horizontal: "center", vertical: "center" },
            border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
        },
        cell: {
            font: { name: "Arial", sz: 10 },
            alignment: { vertical: "center" },
            border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
        },
        cellCenter: {
            font: { name: "Arial", sz: 10 },
            alignment: { horizontal: "center", vertical: "center" },
            border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
        },
        title: {
            font: { bold: true, sz: 16, color: { rgb: "1E3A8A" } } // Dark Blue
        }
    };

    const wb = XLSX.utils.book_new();

    // --- SHEET 1: PLAN DE PRODUCCIÓN ---
    const { nominalSeconds, effectiveSeconds } = calculateTaktTime(
        data.shifts, data.meta.activeShifts, data.meta.dailyDemand, data.meta.manualOEE
    );
    const targetPerHour = nominalSeconds > 0 ? Math.floor(3600 / nominalSeconds) : 0;
    const totalHeadcount = calculateTotalHeadcount(data);

    // Build Data Array
    const planRows: any[][] = [
        [{ v: "PLAN DE PRODUCCIÓN - BARACK MERCOSUL", s: styles.title }],
        [],
        ["Proyecto:", data.meta.name],
        ["Fecha:", data.meta.date],
        ["Versión:", data.meta.version],
        [],
        [{ v: "OBJETIVOS", s: { font: { bold: true } } }],
        ["Demanda Diaria (u):", data.meta.dailyDemand],
        ["Takt Time (s):", formatNumber(nominalSeconds)],
        ["META HORARIA (u/h):", targetPerHour],
        [],
        [{ v: "RECURSOS", s: { font: { bold: true } } }],
        ["Dotación Total (Headcount):", totalHeadcount],
        ["Turnos Activos:", data.meta.activeShifts],
        [],
        [{ v: "DETALLE DE ESTACIONES", s: { font: { bold: true } } }]
    ];

    // Header Row for Stations Table
    const tableHeader = ["Estación", "Operarios (N)", "Sector", "Tiempo Ciclo (s)", "Tareas Principales"];
    const tableHeaderRow = tableHeader.map(h => ({ v: h, s: styles.header }));
    planRows.push(tableHeaderRow);

    const configuredStations = data.meta.configuredStations || 1;
    for (let i = 1; i <= configuredStations; i++) {
        const config = data.stationConfigs?.find(c => c.id === i);
        const replicas = config?.replicas || 1;
        const tasks = data.assignments.filter(a => a.stationId === i).map(a => data.tasks.find(t => t.id === a.taskId)).filter(Boolean) as Task[];

        const sectorId = tasks[0]?.sectorId;
        const sectorName = data.sectors?.find(s => s.id === sectorId)?.name || "General";

        const effectiveTime = calculateEffectiveStationTime(tasks);
        const cycleTime = effectiveTime / replicas;

        const mainTasksDesc = tasks.slice(0, 3).map(t => t.id).join(", ") + (tasks.length > 3 ? "..." : "");

        planRows.push([
            { v: i, s: styles.cellCenter },
            { v: replicas, s: styles.cellCenter },
            { v: sectorName, s: styles.cell },
            { v: formatNumber(cycleTime), s: styles.cellCenter },
            { v: mainTasksDesc, s: styles.cell }
        ]);
    }

    const wsPlan = XLSX.utils.aoa_to_sheet(planRows);
    wsPlan['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsPlan, "Plan de Producción");


    // --- SHEET 2: HORA A HORA ---
    const hourlyHeader = ["Turno", "Hora", "Meta (u)", "Real (u)", "Diferencia", "Acumulado Meta", "Acumulado Real", "Observaciones / Paradas"];
    const hourlyRows: any[][] = [
        hourlyHeader.map(h => ({ v: h, s: styles.header }))
    ];

    data.shifts.filter(s => s.id <= data.meta.activeShifts).forEach(shift => {
        const startMin = parseTime(shift.startTime);
        let endMin = parseTime(shift.endTime);
        if (endMin < startMin) endMin += 24 * 60;

        let currentMin = startMin;


        while (currentMin < endMin) {
            const hourStart = formatTime(currentMin);
            currentMin += 60;
            const hourEnd = formatTime(currentMin);

            // Calculate breaks in this hour
            // Simplified: Just check target

            hourlyRows.push([
                { v: shift.name, s: styles.cell },
                { v: `${hourStart} - ${hourEnd}`, s: styles.cellCenter },
                { v: targetPerHour, s: styles.cellCenter }, // Meta
                { v: "", s: styles.cell }, // Real (Empty)
                { v: { f: `D${hourlyRows.length + 1}-C${hourlyRows.length + 1}` }, s: styles.cellCenter }, // Diff formula
                { v: "", s: styles.cell },
                { v: "", s: styles.cell },
                { v: "", s: styles.cell }
            ]);

        }
    });

    const wsHourly = XLSX.utils.aoa_to_sheet(hourlyRows);
    wsHourly['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsHourly, "Control Hora a Hora");

    downloadWorkbook(wb, `${data.meta.name}_Produccion.xlsx`);
};

// --- CSV PARSING ---
export const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    // Remove surrounding quotes if present
    return result.map(col => {
        if (col.startsWith('"') && col.endsWith('"')) {
            return col.slice(1, -1).trim();
        }
        return col;
    });
};

// --- BROWSER-SAFE XLSX DOWNLOAD ---
// XLSX.writeFile uses fs.writeFileSync which Vite externalizes for browser.
// This produces corrupted files. Use XLSX.write + Blob instead.
const downloadWorkbook = (wb: any, fileName: string): void => {
    try {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
        logger.error('Excel', 'Error exporting Excel', {}, err instanceof Error ? err : undefined);
        alert('Error al exportar Excel. Intente nuevamente.');
    }
};
