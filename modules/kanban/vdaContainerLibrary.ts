/**
 * VDA Container Library - Standard KLT Containers for Automotive Industry
 * Phase 2: Lean Logistics Suite - VDA Enhancement
 * 
 * This module defines the standard VDA-compliant KLT containers used in the
 * automotive industry. These containers enable:
 * 
 * 1. Quick selection of standard container sizes
 * 2. Auto-population of capacity in Kanban calculations
 * 3. Future integration with pallet and Milk Run calculations
 * 
 * Reference: VDA 4500 (Kleinladungsträger - Small Load Carriers)
 * 
 * Standard EUR Pallet: 1200mm × 800mm
 * KLT containers are designed to fit optimally on EUR pallets.
 */

// ============================================================================
// TYPES
// ============================================================================

export type ContainerCategory = 'small' | 'medium' | 'large' | 'extra-large' | 'custom';

/**
 * VDA Container specification following industry standards.
 */
export interface VDAContainer {
    /** Unique identifier (e.g., "R-KLT-3215") */
    id: string;

    /** Display name (e.g., "R-KLT 3215") */
    name: string;

    /** External length in mm */
    lengthMm: number;

    /** External width in mm */
    widthMm: number;

    /** External height in mm */
    heightMm: number;

    /** Default capacity for typical automotive parts (user can override) */
    defaultCapacity: number;

    /** Container size category */
    category: ContainerCategory;

    /** Whether containers can be stacked when full */
    stackable: boolean;

    /** How many containers fit per layer on a EUR pallet (1200×800mm) */
    containersPerPalletLayer: number;

    /** Maximum recommended stacking height (number of layers) */
    maxStackLayers: number;

    /** Typical use case description */
    description: string;
}

// ============================================================================
// STANDARD VDA CONTAINERS (R-KLT Series)
// ============================================================================

/**
 * Standard VDA R-KLT containers.
 * 
 * R-KLT = Returnable Kleinladungsträger (Returnable Small Load Carrier)
 * 
 * Naming convention: R-KLT [Length/100][Width/100][Height/10]
 * Example: R-KLT 3215 = 300mm × 200mm × 150mm
 */
export const VDA_CONTAINERS: VDAContainer[] = [
    {
        id: 'R-KLT-3215',
        name: 'R-KLT 3215',
        lengthMm: 300,
        widthMm: 200,
        heightMm: 147,  // VDA 4500 spec: 147mm (≈5.3L)
        defaultCapacity: 25,
        category: 'small',
        stackable: true,
        containersPerPalletLayer: 16, // 4×4 on EUR pallet
        maxStackLayers: 6,
        description: 'Piezas pequeñas (tornillos, clips, arandelas) - Vol: ~5.3L'
    },
    {
        id: 'R-KLT-4315',
        name: 'R-KLT 4315',
        lengthMm: 400,
        widthMm: 300,
        heightMm: 147,  // VDA 4500 spec: 147mm (≈10L)
        defaultCapacity: 50,
        category: 'medium',
        stackable: true,
        containersPerPalletLayer: 8, // 4×2 on EUR pallet
        maxStackLayers: 6,
        description: 'Estándar medio (botones, manijas, conectores) - Vol: ~10L'
    },
    {
        id: 'R-KLT-6415',
        name: 'R-KLT 6415',
        lengthMm: 600,
        widthMm: 400,
        heightMm: 150,
        defaultCapacity: 100,
        category: 'large',
        stackable: true,
        containersPerPalletLayer: 4, // 2×2 on EUR pallet
        maxStackLayers: 5,
        description: 'Piezas grandes (molduras, paneles pequeños)'
    },
    {
        id: 'R-KLT-6429',
        name: 'R-KLT 6429',
        lengthMm: 600,
        widthMm: 400,
        heightMm: 280,  // VDA 4500 spec: 280mm (≈48L)
        defaultCapacity: 150,
        category: 'extra-large',
        stackable: true,
        containersPerPalletLayer: 4, // 2×2 on EUR pallet
        maxStackLayers: 4,
        description: 'Alta capacidad (asientos parciales, revestimientos) - Vol: ~48L'
    },
    {
        id: 'GLT-PALLET',
        name: 'GLT (Pallet Box)',
        lengthMm: 1200,
        widthMm: 1000,
        heightMm: 975,
        defaultCapacity: 500,
        category: 'extra-large',
        stackable: false,
        containersPerPalletLayer: 1,
        maxStackLayers: 1,
        description: 'Caja pallet grande para piezas voluminosas'
    }
];

/**
 * Custom container placeholder for user-defined sizes.
 */
export const CUSTOM_CONTAINER: VDAContainer = {
    id: 'CUSTOM',
    name: 'Personalizado',
    lengthMm: 0,
    widthMm: 0,
    heightMm: 0,
    defaultCapacity: 50,
    category: 'custom',
    stackable: true,
    containersPerPalletLayer: 0,
    maxStackLayers: 0,
    description: 'Contenedor con dimensiones personalizadas'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all available containers including custom option.
 */
export function getAllContainers(): VDAContainer[] {
    return [...VDA_CONTAINERS, CUSTOM_CONTAINER];
}

/**
 * Get a container by ID.
 * 
 * @param id - Container ID (e.g., "R-KLT-3215")
 * @returns Container or undefined if not found
 */
export function getContainerById(id: string): VDAContainer | undefined {
    if (id === 'CUSTOM') return CUSTOM_CONTAINER;
    return VDA_CONTAINERS.find(c => c.id === id);
}

/**
 * Calculate how many containers fit on a full EUR pallet.
 * 
 * EUR Pallet dimensions: 1200mm × 800mm × 144mm (height)
 * 
 * @param container - VDA container specification
 * @returns Total containers per pallet (layers × containers per layer)
 */
export function calculateContainersPerPallet(container: VDAContainer): number {
    if (container.category === 'custom' || container.containersPerPalletLayer === 0) {
        return 0; // Can't calculate for custom containers
    }
    return container.containersPerPalletLayer * container.maxStackLayers;
}

/**
 * Calculate total pieces capacity for a full pallet.
 * 
 * @param container - VDA container specification
 * @param piecesPerContainer - Pieces per container (user-defined or default)
 * @returns Total pieces that fit on one pallet
 */
export function calculatePiecesPerPallet(
    container: VDAContainer,
    piecesPerContainer?: number
): number {
    const capacity = piecesPerContainer ?? container.defaultCapacity;
    const containersPerPallet = calculateContainersPerPallet(container);
    return containersPerPallet * capacity;
}

/**
 * Get container category color for UI display.
 */
export function getCategoryColor(category: ContainerCategory): string {
    switch (category) {
        case 'small': return 'bg-blue-100 text-blue-700 border-blue-300';
        case 'medium': return 'bg-green-100 text-green-700 border-green-300';
        case 'large': return 'bg-amber-100 text-amber-700 border-amber-300';
        case 'extra-large': return 'bg-purple-100 text-purple-700 border-purple-300';
        case 'custom': return 'bg-gray-100 text-gray-700 border-gray-300';
    }
}

/**
 * Format container dimensions for display.
 * 
 * @param container - VDA container
 * @returns Formatted string (e.g., "400×300×150 mm")
 */
export function formatDimensions(container: VDAContainer): string {
    if (container.category === 'custom') {
        return 'Definido por usuario';
    }
    return `${container.lengthMm}×${container.widthMm}×${container.heightMm} mm`;
}

// ============================================================================
// v2.0: VOLUME-BASED PIECE SUGGESTION (FacuV4 Enhancement)
// ============================================================================

/**
 * Calculate container internal volume in liters.
 * 
 * Note: This is a gross approximation. Real internal volume is ~85-90%
 * of external dimensions due to wall thickness.
 * 
 * @param container - VDA container specification
 * @returns Volume in liters (1L = 1,000,000 mm³)
 */
export function calculateVolumeL(container: VDAContainer): number {
    if (container.category === 'custom' && (container.lengthMm === 0 || container.widthMm === 0 || container.heightMm === 0)) {
        return 0;
    }
    // Convert mm³ to liters (÷ 1,000,000) and apply ~90% internal factor
    return (container.lengthMm * container.widthMm * container.heightMm) / 1_000_000 * 0.9;
}

/**
 * Suggest number of pieces that fit in a container based on piece dimensions.
 * 
 * Uses a 65% fill factor to account for:
 * - Irregular piece shapes
 * - Padding/protection material
 * - Easy access for picking
 * 
 * @param containerVolumeL - Container volume in liters
 * @param pieceLengthMm - Piece length in mm
 * @param pieceWidthMm - Piece width in mm  
 * @param pieceHeightMm - Piece height in mm
 * @returns Suggested piece count (0 if invalid inputs)
 */
export function suggestPiecesFromVolume(
    containerVolumeL: number,
    pieceLengthMm: number,
    pieceWidthMm: number,
    pieceHeightMm: number
): number {
    if (containerVolumeL <= 0 || pieceLengthMm <= 0 || pieceWidthMm <= 0 || pieceHeightMm <= 0) {
        return 0;
    }

    // Piece volume in liters
    const pieceVolumeL = (pieceLengthMm * pieceWidthMm * pieceHeightMm) / 1_000_000;

    if (pieceVolumeL <= 0) return 0;

    // Apply 65% fill factor for realistic packing
    const fillFactor = 0.65;
    return Math.floor((containerVolumeL / pieceVolumeL) * fillFactor);
}
