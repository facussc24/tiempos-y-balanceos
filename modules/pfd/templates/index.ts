/**
 * Zip Templates index
 *
 * Exposes the 5 zip-derived PFD templates portted from the standalone Google
 * AI Studio flowchart app to the modules/pfd module.
 */

import type { PfdTemplateResult } from '../pfdTemplates';
import { zipFlowToPfdSteps, zipHeaderToPfdHeader } from './zipFlowConverter';
import { inyeccionZip } from './zipData/inyeccion';
import { apoyacabezasZip } from './zipData/apoyacabezas';
import { ippadZip } from './zipData/ippad';
import { armrestZip } from './zipData/armrest';
import { baseZip } from './zipData/base';

export type ZipTemplateId = 'inyeccion' | 'apoyacabezas' | 'ippad' | 'armrest' | 'base';

export interface ZipTemplateMeta {
    id: ZipTemplateId;
    label: string;
    description: string;
    stepCount: number;
}

const ZIP_TEMPLATES: Record<ZipTemplateId, { header: typeof inyeccionZip.header; products: typeof inyeccionZip.products; flow: typeof inyeccionZip.flow }> = {
    inyeccion: inyeccionZip,
    apoyacabezas: apoyacabezasZip,
    ippad: ippadZip,
    armrest: armrestZip,
    base: baseZip,
};

export const ZIP_TEMPLATES_META: ZipTemplateMeta[] = [
    {
        id: 'inyeccion',
        label: 'Inyección Plástica',
        description: 'Sector inyección genérico — VW',
        stepCount: zipFlowToPfdSteps(inyeccionZip.flow).length,
    },
    {
        id: 'apoyacabezas',
        label: 'Apoyacabezas',
        description: 'Headrest Patagonia — VWA',
        stepCount: zipFlowToPfdSteps(apoyacabezasZip.flow).length,
    },
    {
        id: 'ippad',
        label: 'IP PAD',
        description: 'IP PAD Patagonia — VW (con líneas paralelas)',
        stepCount: zipFlowToPfdSteps(ippadZip.flow).length,
    },
    {
        id: 'armrest',
        label: 'Armrest Door Panel',
        description: 'Armrest Patagonia — VWA (con líneas paralelas)',
        stepCount: zipFlowToPfdSteps(armrestZip.flow).length,
    },
    {
        id: 'base',
        label: 'Base Reglamentario',
        description: 'Modelo genérico mínimo con retrabajo y bifurcación',
        stepCount: zipFlowToPfdSteps(baseZip.flow).length,
    },
];

export function loadZipTemplate(id: ZipTemplateId): PfdTemplateResult {
    const data = ZIP_TEMPLATES[id];
    if (!data) {
        throw new Error(`Unknown zip template id: ${id}`);
    }
    return {
        steps: zipFlowToPfdSteps(data.flow),
        header: zipHeaderToPfdHeader(data.header, data.products),
    };
}

export { zipFlowToPfdSteps, zipHeaderToPfdHeader } from './zipFlowConverter';
