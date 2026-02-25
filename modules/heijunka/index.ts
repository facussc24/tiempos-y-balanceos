/**
 * Heijunka Module - Production Leveling
 * Phase 4: Lean Logistics Suite
 * 
 * Exports for the Heijunka functionality.
 */

export {
    calculateSlots,
    calculateQuantityPerSlot,
    generateHeijunkaSequence,
    euclideanDistribute,
    validateCapacity,
    calculateHeijunka,
    getProductColor
} from './heijunkaLogic';

export type {
    ProductDemand,
    SlotAssignment,
    HeijunkaSlot,
    MaterialDelivery,
    HeijunkaResult,
    ProductSummary,
    CapacityAlert
} from './heijunkaLogic';

export {
    exportHeijunkaPlanExcel,
    validatePitchVsRoute
} from './heijunkaExport';

export { HeijunkaBox } from './HeijunkaBox';

