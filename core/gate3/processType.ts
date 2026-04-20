/**
 * Tipo de proceso de una estacion Gate 3.
 *
 * El template VW esta pensado para inyeccion plastica (donde "Cavities" = bocas del molde).
 * Para otros procesos (costura, tapizado, etc.) "Cavities" no aplica y se fija en 1.
 * El label en el Excel se adapta segun este tipo.
 *
 * No tocamos `utils/processCategory.ts` (compartido con AMFE/CP/PFD) — usamos un wrapper
 * que ademas separa tapizado/refilado como categorias propias.
 */
import { inferOperationCategory } from '../../utils/processCategory';

export type Gate3ProcessType =
    | 'inyeccion'
    | 'costura'
    | 'tapizado'
    | 'refilado'
    | 'corte'
    | 'troquelado'
    | 'pintura'
    | 'recubrimiento'
    | 'tratamiento_termico'
    | 'mecanizado'
    | 'soldadura'
    | 'ensamble'
    | 'inspeccion'
    | 'embalaje'
    | 'general';

/** Inferencia desde nombre de proceso (extension de inferOperationCategory). */
export function inferGate3ProcessType(name: string | undefined | null): Gate3ProcessType {
    if (!name) return 'general';
    const n = name.toLowerCase();
    // Refinamientos NO cubiertos en processCategory.ts (que colapsa estos)
    if (/tapizad|tapice/.test(n)) return 'tapizado';
    if (/refilad/.test(n)) return 'refilado';
    if (/troquel|estampad|embutid/.test(n)) return 'troquelado';
    const cat = inferOperationCategory(name);
    if (!cat) return 'general';
    // Mapeo categorias del archivo compartido a las del Gate 3
    const map: Record<string, Gate3ProcessType> = {
        inyeccion: 'inyeccion',
        costura: 'costura',
        corte: 'corte',
        corte_termico: 'corte',
        estampado: 'troquelado',
        pintura: 'pintura',
        recubrimiento: 'recubrimiento',
        tratamiento_termico: 'tratamiento_termico',
        mecanizado: 'mecanizado',
        soldadura: 'soldadura',
        ensamble: 'ensamble',
        inspeccion: 'inspeccion',
        embalaje: 'embalaje',
        plegado: 'mecanizado',
        conformado: 'mecanizado',
        fundicion: 'general',
        pretratamiento: 'general',
        acabado: 'general',
        almacen: 'general',
        logistica: 'general',
    };
    return map[cat] ?? 'general';
}

/** Etiquetas humanas en castellano (para UI y para el label del Excel). */
export interface ProcessTypeLabels {
    /** Nombre humano (ej: "Inyeccion plastica"). */
    name: string;
    /** Lo que multiplica capacidad: "Cavidades del molde" (inyeccion) vs "Piezas por jig" (pintura) etc. */
    multiplierLabel: string;
    /** "Maquinas paralelas" — varia por proceso (Inyectoras, Maquinas de costura, Cabinas, etc.) */
    machinesLabel: string;
    /**
     * Si true: "Cavidades" tiene sentido y se permite > 1.
     * Si false: se fija en 1 (no aplica al proceso).
     */
    cavitiesApplies: boolean;
}

export const PROCESS_TYPE_LABELS: Record<Gate3ProcessType, ProcessTypeLabels> = {
    inyeccion: {
        name: 'Inyeccion plastica',
        multiplierLabel: 'Cavidades del molde',
        machinesLabel: 'Inyectoras paralelas',
        cavitiesApplies: true,
    },
    costura: {
        name: 'Costura',
        multiplierLabel: 'No aplica',
        machinesLabel: 'Maquinas de costura',
        cavitiesApplies: false,
    },
    tapizado: {
        name: 'Tapizado',
        multiplierLabel: 'No aplica',
        machinesLabel: 'Puestos de tapizado',
        cavitiesApplies: false,
    },
    refilado: {
        name: 'Refilado',
        multiplierLabel: 'No aplica',
        machinesLabel: 'Puestos de refilado',
        cavitiesApplies: false,
    },
    corte: {
        name: 'Corte',
        multiplierLabel: 'Capas por corte',
        machinesLabel: 'Mesas / cizallas',
        cavitiesApplies: true,
    },
    troquelado: {
        name: 'Troquelado / Estampado',
        multiplierLabel: 'Cavidades del troquel',
        machinesLabel: 'Prensas / troqueladoras',
        cavitiesApplies: true,
    },
    pintura: {
        name: 'Pintura',
        multiplierLabel: 'Piezas por jig',
        machinesLabel: 'Cabinas',
        cavitiesApplies: true,
    },
    recubrimiento: {
        name: 'Recubrimiento (galvanico)',
        multiplierLabel: 'Piezas por bastidor',
        machinesLabel: 'Cubas / lineas',
        cavitiesApplies: true,
    },
    tratamiento_termico: {
        name: 'Tratamiento termico',
        multiplierLabel: 'Piezas por carga',
        machinesLabel: 'Hornos',
        cavitiesApplies: true,
    },
    mecanizado: {
        name: 'Mecanizado / CNC',
        multiplierLabel: 'Piezas por pallet',
        machinesLabel: 'Centros de mecanizado',
        cavitiesApplies: true,
    },
    soldadura: {
        name: 'Soldadura',
        multiplierLabel: 'No aplica',
        machinesLabel: 'Estaciones de soldadura',
        cavitiesApplies: false,
    },
    ensamble: {
        name: 'Ensamble',
        multiplierLabel: 'No aplica',
        machinesLabel: 'Estaciones de ensamble',
        cavitiesApplies: false,
    },
    inspeccion: {
        name: 'Inspeccion / Control',
        multiplierLabel: 'No aplica',
        machinesLabel: 'Puestos de inspeccion',
        cavitiesApplies: false,
    },
    embalaje: {
        name: 'Embalaje',
        multiplierLabel: 'Piezas por bulto',
        machinesLabel: 'Estaciones de embalaje',
        cavitiesApplies: true,
    },
    general: {
        name: 'General / Manual',
        multiplierLabel: 'No aplica',
        machinesLabel: 'Puestos paralelos',
        cavitiesApplies: false,
    },
};
