/**
 * Demo Registry Data
 *
 * Realistic document entries for the Document Hub when running
 * in browser/dev mode (non-Tauri) with no real data.
 *
 * These represent typical Barack Mercosul production documents
 * for automotive parts (AMFE + CP).
 */

import type { DocumentRegistryEntry } from './documentRegistryTypes';

export const DEMO_REGISTRY_ENTRIES: DocumentRegistryEntry[] = [
    // ===== AMFE (Failure Mode Analysis) =====
    {
        id: 'demo-amfe-001',
        type: 'amfe',
        name: 'Subchasis Soldado',
        partNumber: 'BRK-SCH-001',
        partName: 'Subchasis Soldado Delantero',
        client: 'Toyota Argentina',
        responsible: 'Ing. Martínez',
        itemCount: 8,
        updatedAt: '2026-02-26T15:00:00Z',
        meta: { amfeNumber: 'AMFE-001', status: 'En revisión', causeCount: 24, apH: 3, apM: 5 },
    },
    {
        id: 'demo-amfe-002',
        type: 'amfe',
        name: 'Panel de Puerta Interior',
        partNumber: 'BRK-PPU-015',
        partName: 'Panel Interior Puerta Delantera LH',
        client: 'Volkswagen',
        responsible: 'Ing. López',
        itemCount: 5,
        updatedAt: '2026-02-22T13:40:00Z',
        meta: { amfeNumber: 'AMFE-015', status: 'Aprobado', causeCount: 15, apH: 0, apM: 2 },
    },
    {
        id: 'demo-amfe-003',
        type: 'amfe',
        name: 'Soporte Motor Izquierdo',
        partNumber: 'BRK-SMT-042',
        partName: 'Soporte Motor Izquierdo',
        client: 'Ford Pacheco',
        responsible: 'Ing. García',
        itemCount: 4,
        updatedAt: '2026-02-19T08:30:00Z',
        meta: { amfeNumber: 'AMFE-042', status: 'Borrador', causeCount: 12, apH: 2, apM: 3 },
    },
    {
        id: 'demo-amfe-004',
        type: 'amfe',
        name: 'Travesaño Posterior Reforzado',
        partNumber: 'BRK-TVP-008',
        partName: 'Travesaño Posterior Reforzado',
        client: 'Stellantis',
        responsible: 'Ing. Fernández',
        itemCount: 6,
        updatedAt: '2026-02-01T17:10:00Z',
        meta: { amfeNumber: 'AMFE-008', status: 'En revisión', causeCount: 18, apH: 1, apM: 4 },
    },
    {
        id: 'demo-amfe-005',
        type: 'amfe',
        name: 'Columna de Dirección',
        partNumber: 'BRK-CDR-023',
        partName: 'Columna de Dirección Ajustable',
        client: 'Toyota Argentina',
        responsible: 'Ing. Martínez',
        itemCount: 10,
        updatedAt: '2026-02-28T09:45:00Z',
        meta: { amfeNumber: 'AMFE-023', status: 'Aprobado', causeCount: 32, apH: 0, apM: 1 },
    },

    // ===== Control Plans =====
    {
        id: 'demo-cp-001',
        type: 'controlPlan',
        name: 'Subchasis Soldado - Plan de Control',
        partNumber: 'BRK-SCH-001',
        partName: 'Subchasis Soldado Delantero',
        client: 'Toyota Argentina',
        responsible: 'Ing. Martínez',
        itemCount: 14,
        updatedAt: '2026-02-27T10:00:00Z',
        linkedAmfeProject: 'Subchasis Soldado',
        meta: { phase: 'Producción', revision: 'Rev.02', controlPlanNumber: 'CP-001' },
    },
    {
        id: 'demo-cp-002',
        type: 'controlPlan',
        name: 'Panel de Puerta - Plan de Control',
        partNumber: 'BRK-PPU-015',
        partName: 'Panel Interior Puerta Delantera LH',
        client: 'Volkswagen',
        responsible: 'Ing. López',
        itemCount: 9,
        updatedAt: '2026-02-23T14:20:00Z',
        linkedAmfeProject: 'Panel de Puerta Interior',
        meta: { phase: 'Producción', revision: 'Rev.01', controlPlanNumber: 'CP-015' },
    },
    {
        id: 'demo-cp-003',
        type: 'controlPlan',
        name: 'Soporte Motor - Plan de Control',
        partNumber: 'BRK-SMT-042',
        partName: 'Soporte Motor Izquierdo',
        client: 'Ford Pacheco',
        responsible: 'Ing. García',
        itemCount: 7,
        updatedAt: '2026-02-20T11:30:00Z',
        linkedAmfeProject: 'Soporte Motor Izquierdo',
        meta: { phase: 'Pre-lanzamiento', revision: 'Rev.01', controlPlanNumber: 'CP-042' },
    },
    {
        id: 'demo-cp-004',
        type: 'controlPlan',
        name: 'Travesaño Posterior - Plan de Control',
        partNumber: 'BRK-TVP-008',
        partName: 'Travesaño Posterior Reforzado',
        client: 'Stellantis',
        responsible: 'Ing. Fernández',
        itemCount: 11,
        updatedAt: '2026-02-05T15:50:00Z',
        linkedAmfeProject: 'Travesaño Posterior Reforzado',
        meta: { phase: 'Producción', revision: 'Rev.03', controlPlanNumber: 'CP-008' },
    },
    {
        id: 'demo-cp-005',
        type: 'controlPlan',
        name: 'Columna Dirección - Plan de Control',
        partNumber: 'BRK-CDR-023',
        partName: 'Columna de Dirección Ajustable',
        client: 'Toyota Argentina',
        responsible: 'Ing. Martínez',
        itemCount: 16,
        updatedAt: '2026-02-28T10:30:00Z',
        linkedAmfeProject: 'Columna de Dirección',
        meta: { phase: 'Producción', revision: 'Rev.01', controlPlanNumber: 'CP-023' },
    },

];
