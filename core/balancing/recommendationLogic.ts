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

