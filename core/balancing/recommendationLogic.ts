import { PlantConfig } from '../../types';

// ============================================================================
// V4.7 Phase 26: Enhanced Recommendation Interfaces
// ============================================================================

export interface InvestmentItem {
    machineName: string;
    sectorName: string;
    required: number;
    available: number;
    deficit: number;
}

export interface ShiftMachineImpact {
    machineName: string;
    sectorName: string;
    requiredBefore: number;
    requiredAfter: number;
    available: number;
    isResolved: boolean;
}

export interface ShiftCalculation {
    currentShifts: number;
    targetShifts: number;
    currentTakt: number;
    newTakt: number;
    machineImpact: ShiftMachineImpact[];
    allResolved: boolean;
}

export interface Recommendation {
    id: string;
    type: 'investment' | 'shifts' | 'process' | 'general' | 'buffer';
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    // V4.7 Enhanced: Detailed data for UI
    investmentDetails?: InvestmentItem[];
    shiftCalculation?: ShiftCalculation;
    // FIX 7: Buffer recommendation details
    bufferDetails?: {
        afterStationId: number;
        stationName: string;
        recommendedSize: number;
        reason: 'bottleneck' | 'high_saturation' | 'man_machine_interface';
        saturation: number;
    }[];
}

export interface SectorAnalysisRow {
    name: string;
    required: number;
    available: number;
    weightedTime: number;
    saturation: number;
    sectorName?: string; // Optional: may come from MixSectorAnalysis
}

/**
 * V4.7 Phase 26: Enhanced recommendations with detailed breakdown
 */
export function generateMixRecommendations(
    sectors: SectorAnalysisRow[],
    currentShifts: number,
    taktTime: number,
    totalDemand: number,
    plantConfig?: PlantConfig
): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Safety: Ensure valid taktTime
    const safeTakt = (taktTime && taktTime > 0 && isFinite(taktTime)) ? taktTime : 1;

    // 1. Analyze Asset Deficits
    const deficitSectors = sectors.filter(s => s.required > s.available);

    if (deficitSectors.length > 0) {
        // A. Build Investment Details
        const investmentDetails: InvestmentItem[] = deficitSectors.map(s => ({
            machineName: s.name,
            sectorName: s.sectorName || deriveSectorFromName(s.name, plantConfig),
            required: s.required,
            available: s.available,
            deficit: s.required - s.available
        }));

        const totalDeficit = investmentDetails.reduce((sum, i) => sum + i.deficit, 0);

        recommendations.push({
            id: 'rec_investment',
            type: 'investment',
            severity: 'critical',
            title: 'Inversión Requerida',
            description: `Déficit de ${totalDeficit} unidades con ${currentShifts} turno(s).`,
            investmentDetails
        });

        // B. Shift Alternative Analysis
        const targetShifts = currentShifts + 1;
        if (targetShifts <= 3) {
            const newTakt = safeTakt * (targetShifts / currentShifts);

            const machineImpact: ShiftMachineImpact[] = deficitSectors.map(s => {
                const requiredAfter = Math.ceil(s.required * (currentShifts / targetShifts));
                return {
                    machineName: s.name,
                    sectorName: s.sectorName || deriveSectorFromName(s.name, plantConfig),
                    requiredBefore: s.required,
                    requiredAfter,
                    available: s.available,
                    isResolved: requiredAfter <= s.available
                };
            });

            const allResolved = machineImpact.every(m => m.isResolved);

            const shiftCalc: ShiftCalculation = {
                currentShifts,
                targetShifts,
                currentTakt: safeTakt,
                newTakt,
                machineImpact,
                allResolved
            };

            recommendations.push({
                id: 'rec_shifts',
                type: 'shifts',
                severity: allResolved ? 'info' : 'warning',
                title: `Alternativa: Turno ${targetShifts}`,
                description: allResolved
                    ? `Resuelve TODOS los déficits sin inversión.`
                    : `Resuelve ${machineImpact.filter(m => m.isResolved).length}/${machineImpact.length} déficits.`,
                shiftCalculation: shiftCalc
            });
        }
    }

    // 2. High Saturation Warning (only if no deficits, to avoid noise)
    if (deficitSectors.length === 0) {
        const riskySectors = sectors.filter(s => s.saturation > 95 && s.saturation <= 100);
        if (riskySectors.length > 0) {
            recommendations.push({
                id: 'rec_process_risk',
                type: 'process',
                severity: 'warning',
                title: 'Riesgo de Variabilidad',
                description: `${riskySectors.length} sector(es) operan al límite (>95%).`
            });
        }
    }

    return recommendations;
}

/**
 * Helper: Derive sector name from machine name using plantConfig
 */
function deriveSectorFromName(machineName: string, plantConfig?: PlantConfig): string {
    if (!plantConfig?.machines) return 'General';

    const machine = plantConfig.machines.find(m =>
        m.name.toLowerCase().includes(machineName.toLowerCase()) ||
        machineName.toLowerCase().includes(m.name.toLowerCase())
    );

    if (machine?.sectorId && plantConfig.sectors) {
        const sector = plantConfig.sectors.find(s => s.id === machine.sectorId);
        if (sector) return sector.name;
    }

    // Fallback: Guess from name
    const lower = machineName.toLowerCase();
    if (lower.includes('costura') || lower.includes('unión')) return 'Costura';
    if (lower.includes('inyección') || lower.includes('refilado')) return 'Preparación';
    if (lower.includes('empaque') || lower.includes('embalaje')) return 'Finalización';

    return 'General';
}
