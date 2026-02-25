import { Recommendation } from '../../core/balancing/recommendationLogic';

export const generateMixReport = (
    scenarioName: string,
    recommendations: Recommendation[],
    totalDemand: number,
    taktTime: number,
    headcount: number
): string => {
    const lines: string[] = [];

    lines.push(`REPORTE DE SIMULACIÓN MIX: ${(scenarioName || 'Escenario').toUpperCase()}`);
    lines.push(`==================================================`);
    lines.push(`Fecha: ${new Date().toLocaleString()}`);
    lines.push(`Demanda Total: ${(totalDemand || 0)} unidades`);
    lines.push(`Takt Time: ${(taktTime || 0).toFixed(2)}s`);
    lines.push(`Personal Requerido: ${headcount || 0}`);
    lines.push(``);

    if (recommendations.length === 0) {
        lines.push(`ESTADO: VIABLE`);
        lines.push(`La configuración actual cumple con los requerimientos.`);
    } else {
        lines.push(`ESTADO: REQUIERE ACCIÓN`);
        lines.push(``);

        // Investment Recommendation
        const investmentRec = recommendations.find(r => r.type === 'investment');
        if (investmentRec?.investmentDetails) {
            lines.push(`INVERSIÓN REQUERIDA`);
            lines.push(`--------------------------------------------------`);
            investmentRec.investmentDetails.forEach(item => {
                lines.push(`• ${item.machineName} (${item.sectorName})`);
                lines.push(`  Requerido: ${item.required} | Disponible: ${item.available} | Déficit: ${item.deficit}`);
            });
            lines.push(``);
        }

        // Shift Alternative
        const shiftRec = recommendations.find(r => r.type === 'shifts');
        if (shiftRec?.shiftCalculation) {
            const calc = shiftRec.shiftCalculation;
            lines.push(`ALTERNATIVA: TURNO ${calc.targetShifts}`);
            lines.push(`--------------------------------------------------`);
            lines.push(`Takt actual: ${calc.currentTakt.toFixed(1)}s → Nuevo: ${calc.newTakt.toFixed(1)}s`);
            lines.push(``);
            calc.machineImpact.forEach(m => {
                const status = m.isResolved ? '✓' : '✗';
                lines.push(`${status} ${m.machineName}: ${m.requiredBefore} → ${m.requiredAfter} (Disp: ${m.available})`);
            });
            lines.push(``);
            lines.push(`Resultado: ${calc.allResolved ? 'RESUELVE TODO' : 'RESUELVE PARCIALMENTE'}`);
            lines.push(``);
        }
    }

    lines.push(`==================================================`);
    lines.push(`Generado por Barack Mercosul Software`);

    return lines.join('\n');
};
