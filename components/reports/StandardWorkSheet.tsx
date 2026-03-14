/**
 * StandardWorkSheet - Phase 10: Standard Work Sheet per Station
 * 
 * Generates a printable Standard Work Sheet for each workstation containing:
 * - Station identification and operator info
 * - Task list with sequence and times
 * - Takt time and cycle time reference
 * - Visual work instructions summary
 * 
 * Uses CSS print media queries for clean PDF generation via browser print.
 */
import React from 'react';
import { ProjectData, Task, StationConfig } from '../../types';
import { formatNumber } from '../../utils';
import { calculateEffectiveStationTime } from '../../core/balancing/simulation';
import { toast } from '../ui/Toast';

/** Sanitize a value for safe HTML output — prevents XSS in generated HTML */
function esc(value: string | number | undefined | null): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

interface StationWorkData {
    stationId: number;
    stationName: string;
    sectorName: string;
    sectorColor: string;
    tasks: Task[];
    totalTime: number;
    replicas: number;
    oeeTarget: number;
    machineNames: string[];
}

interface StandardWorkSheetProps {
    data: ProjectData;
    stationId: number;
    taktTime: number;
    onClose?: () => void;
}

/**
 * Extract station work data from ProjectData
 */
export const extractStationWorkData = (
    data: ProjectData,
    stationId: number
): StationWorkData | null => {
    // Get tasks assigned to this station
    const stationAssignments = data.assignments.filter(a => a.stationId === stationId);
    if (stationAssignments.length === 0) return null;

    const tasks = stationAssignments
        .map(a => data.tasks.find(t => t.id === a.taskId))
        .filter(Boolean) as Task[];

    // Get station config
    const config = data.stationConfigs.find(c => c.id === stationId) || {
        id: stationId,
        oeeTarget: data.meta.manualOEE,
        replicas: 1
    };

    // Get sector info
    const firstTask = tasks[0];
    const sector = data.sectors?.find(s => s.id === firstTask?.sectorId);

    // Calculate total time using effective station time (handles concurrent/machine overlap)
    const totalTime = calculateEffectiveStationTime(tasks);

    // Get machine names
    const machineIds = [...new Set(tasks.map(t => t.requiredMachineId).filter(Boolean))];
    const machineNames = machineIds.map(id => {
        const machine = data.plantConfig?.machines?.find(m => m.id === id);
        return machine?.name || id || '';
    }).filter(Boolean);

    return {
        stationId,
        stationName: config.name || `Estación ${stationId}`,
        sectorName: sector?.name || 'General',
        sectorColor: sector?.color || '#64748b',
        tasks,
        totalTime,
        replicas: config.replicas || 1,
        oeeTarget: config.oeeTarget || data.meta.manualOEE || 0.85,
        machineNames
    };
};

/**
 * Generate printable HTML content for a Standard Work Sheet
 */
export const generateStandardWorkSheetHTML = (
    stationData: StationWorkData,
    projectMeta: ProjectData['meta'],
    taktTime: number
): string => {
    const { stationId, stationName, sectorName, sectorColor, tasks, totalTime, replicas, machineNames } = stationData;

    const cycleTimePerOperator = replicas > 0 ? totalTime / replicas : totalTime;
    const saturation = taktTime > 0 ? (cycleTimePerOperator / taktTime) * 100 : 0;
    const saturationColor = saturation > 100 ? '#dc2626' : saturation > 85 ? '#16a34a' : '#ca8a04';

    const tasksHTML = tasks.map((task, index) => `
        <tr class="task-row">
            <td class="seq">${index + 1}</td>
            <td class="desc">${esc(task.description || task.id)}</td>
            <td class="time">${formatNumber(task.standardTime || task.averageTime || 0)}s</td>
            <td class="mode">${task.executionMode === 'manual' ? '&#128100;' : task.executionMode === 'machine' ? '&#9881;' : '&#128296;'}</td>
            <td class="notes">${task.isMachineInternal ? '(Interno)' : ''}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Hoja de Trabajo - ${esc(stationName)}</title>
    <style>
        @page { 
            size: A4 portrait; 
            margin: 15mm; 
        }
        
        * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0; 
        }
        
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            font-size: 11pt; 
            line-height: 1.4;
            color: #1e293b;
        }
        
        .sheet {
            max-width: 210mm;
            margin: 0 auto;
            padding: 10mm;
        }
        
        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid ${sectorColor};
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        
        .header-left h1 {
            font-size: 18pt;
            font-weight: 800;
            color: #0f172a;
        }
        
        .header-left .subtitle {
            font-size: 10pt;
            color: #64748b;
            margin-top: 2px;
        }
        
        .header-right {
            text-align: right;
        }
        
        .station-badge {
            display: inline-block;
            background: ${sectorColor};
            color: white;
            font-weight: bold;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14pt;
        }
        
        /* Info Grid */
        .info-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .info-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px;
            text-align: center;
        }
        
        .info-box .label {
            font-size: 8pt;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        
        .info-box .value {
            font-size: 16pt;
            font-weight: 700;
            color: #0f172a;
            margin-top: 4px;
        }
        
        .info-box.highlight {
            background: #ecfdf5;
            border-color: #a7f3d0;
        }
        
        .info-box.highlight .value {
            color: #059669;
        }
        
        .info-box.warning {
            background: #fef3c7;
            border-color: #fcd34d;
        }
        
        .info-box.warning .value {
            color: #d97706;
        }
        
        /* Tasks Table */
        .tasks-section h2 {
            font-size: 12pt;
            font-weight: 700;
            margin-bottom: 8px;
            color: #334155;
            border-left: 4px solid ${sectorColor};
            padding-left: 10px;
        }
        
        .tasks-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
        }
        
        .tasks-table th {
            background: #f1f5f9;
            padding: 8px 10px;
            text-align: left;
            font-weight: 600;
            color: #475569;
            border-bottom: 2px solid #cbd5e1;
        }
        
        .tasks-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .tasks-table .seq { 
            width: 40px; 
            text-align: center;
            font-weight: bold;
            background: #f8fafc;
        }
        
        .tasks-table .time { 
            width: 60px; 
            text-align: right;
            font-family: monospace;
            font-weight: 600;
        }
        
        .tasks-table .mode { 
            width: 40px; 
            text-align: center; 
        }
        
        .tasks-table .notes { 
            width: 80px; 
            font-size: 9pt;
            color: #64748b;
        }
        
        /* Footer */
        .footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 8pt;
            color: #94a3b8;
        }
        
        .signature-box {
            margin-top: 20px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
        }
        
        .signature-box .sig {
            border-top: 1px solid #cbd5e1;
            padding-top: 5px;
            text-align: center;
            font-size: 9pt;
            color: #64748b;
        }
        
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="sheet">
        <div class="header">
            <div class="header-left">
                <h1>📋 Hoja de Trabajo Estándar</h1>
                <div class="subtitle">${esc(projectMeta.client)} | ${esc(projectMeta.name)} | ${esc(projectMeta.date)}</div>
            </div>
            <div class="header-right">
                <div class="station-badge">${esc(stationName)}</div>
                <div style="color: #64748b; font-size: 9pt; margin-top: 4px;">${esc(sectorName)}</div>
            </div>
        </div>
        
        <div class="info-grid">
            <div class="info-box">
                <div class="label">Takt Time</div>
                <div class="value">${formatNumber(taktTime)}s</div>
            </div>
            <div class="info-box ${saturation <= 100 ? 'highlight' : 'warning'}">
                <div class="label">Tiempo Ciclo</div>
                <div class="value">${formatNumber(cycleTimePerOperator)}s</div>
            </div>
            <div class="info-box">
                <div class="label">Operarios</div>
                <div class="value">${replicas}</div>
            </div>
            <div class="info-box">
                <div class="label">Saturación</div>
                <div class="value" style="color: ${saturationColor}">${formatNumber(saturation)}%</div>
            </div>
        </div>
        
        ${machineNames.length > 0 ? `
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 8px 12px; margin-bottom: 15px;">
            <strong style="color: #0369a1;">⚙️ Equipos:</strong> 
            <span style="color: #0c4a6e;">${machineNames.map(esc).join(', ')}</span>
        </div>
        ` : ''}
        
        <div class="tasks-section">
            <h2>Secuencia de Operaciones (${tasks.length} tareas)</h2>
            <table class="tasks-table">
                <thead>
                    <tr>
                        <th class="seq">#</th>
                        <th class="desc">Descripción</th>
                        <th class="time">Tiempo</th>
                        <th class="mode">Tipo</th>
                        <th class="notes">Notas</th>
                    </tr>
                </thead>
                <tbody>
                    ${tasksHTML}
                </tbody>
                <tfoot>
                    <tr style="background: #f1f5f9; font-weight: bold;">
                        <td></td>
                        <td>TOTAL</td>
                        <td class="time">${formatNumber(totalTime)}s</td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
        
        <div class="signature-box">
            <div class="sig">Preparado por</div>
            <div class="sig">Aprobado por</div>
            <div class="sig">Fecha de Revisión</div>
        </div>
        
        <div class="footer">
            <div>Generado por Barack Mercosul - ${new Date().toLocaleDateString('es-AR')}</div>
            <div>Revisión: v1.0</div>
        </div>
    </div>
</body>
</html>
    `;
};

/**
 * StandardWorkSheet Component - Displays and prints a single station's work sheet
 */
export const StandardWorkSheet: React.FC<StandardWorkSheetProps> = ({
    data,
    stationId,
    taktTime,
    onClose
}) => {
    const stationData = extractStationWorkData(data, stationId);

    if (!stationData) {
        return (
            <div className="p-10 text-center text-slate-500">
                No hay tareas asignadas a esta estación.
            </div>
        );
    }

    const handlePrint = () => {
        const html = generateStandardWorkSheetHTML(stationData, data.meta, taktTime);

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.warning('Ventana bloqueada', 'No se pudo abrir la ventana de impresión. Verifique que los pop-ups no estén bloqueados.');
            return;
        }
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();

        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
            }, 300);
        };
    };

    return (
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
            {/* Preview Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="font-bold text-slate-700">
                    📋 Hoja de Trabajo - {stationData.stationName}
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                    >
                        🖨️ Imprimir / PDF
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="px-3 py-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Preview Content */}
            <div className="p-6 max-h-[60vh] overflow-auto">
                <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-50 rounded-lg p-3 text-center border">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Takt Time</div>
                        <div className="text-xl font-bold text-slate-800">{formatNumber(taktTime)}s</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Tiempo Ciclo</div>
                        <div className="text-xl font-bold text-emerald-700">
                            {formatNumber(stationData.totalTime / stationData.replicas)}s
                        </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-center border">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Operarios</div>
                        <div className="text-xl font-bold text-slate-800">{stationData.replicas}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-center border">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Tareas</div>
                        <div className="text-xl font-bold text-slate-800">{stationData.tasks.length}</div>
                    </div>
                </div>

                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 text-left font-bold text-slate-600 border-b-2">#</th>
                            <th className="p-2 text-left font-bold text-slate-600 border-b-2">Tarea</th>
                            <th className="p-2 text-right font-bold text-slate-600 border-b-2">Tiempo</th>
                            <th className="p-2 text-center font-bold text-slate-600 border-b-2">Tipo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stationData.tasks.map((task, i) => (
                            <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="p-2 font-bold text-slate-400">{i + 1}</td>
                                <td className="p-2">{task.description || task.id}</td>
                                <td className="p-2 text-right font-mono font-bold">
                                    {formatNumber(task.standardTime || task.averageTime || 0)}s
                                </td>
                                <td className="p-2 text-center">
                                    {task.executionMode === 'manual' ? '👤' : '⚙️'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-50 font-bold">
                            <td className="p-2"></td>
                            <td className="p-2">TOTAL</td>
                            <td className="p-2 text-right font-mono">{formatNumber(stationData.totalTime)}s</td>
                            <td className="p-2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default StandardWorkSheet;
