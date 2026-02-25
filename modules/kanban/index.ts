/**
 * Kanban Module - Supermarket Dimensioning
 * Phase 2: Lean Logistics Suite
 * Version: 2.0 - Expert Lean Methodology
 * 
 * Exports for the Kanban calculator functionality.
 */

export {
    calculateKanban,
    convertToHours,
    calculateDemandPerHour,
    formatKanbanDisplay,
    // v2.0: New functions
    calculateTotalLeadTime,
    getZFactor,
    calculateAdvancedSafetyStock
} from './kanbanLogic';

export type {
    KanbanResult,
    KanbanInput,
    // v2.0: New types
    LeadTimeBreakdown,
    SafetyStockAdvanced
} from './kanbanLogic';

export { KanbanCalculator } from './KanbanCalculator';
