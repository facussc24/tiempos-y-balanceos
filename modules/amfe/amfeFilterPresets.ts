/**
 * AMFE Filter Presets — predefined filter combinations for quick access.
 */

import { AmfeFilterState } from './AmfeFilters';

export interface FilterPreset {
    label: string;
    description: string;
    filters: Partial<AmfeFilterState>;
}

export const FILTER_PRESETS: FilterPreset[] = [
    {
        label: 'Alta Prioridad',
        description: 'Solo causas AP = Alto (H)',
        filters: { ap: 'H' },
    },
    {
        label: 'Acciones Pendientes',
        description: 'Causas con estado Pendiente',
        filters: { status: 'Pendiente' },
    },
    {
        label: 'Riesgo Alto sin Mitigar',
        description: 'AP = Alto sin accion completada',
        filters: { ap: 'H', status: 'Pendiente' },
    },
    {
        label: 'Prioridad Media',
        description: 'Solo causas AP = Medio (M)',
        filters: { ap: 'M' },
    },
];
