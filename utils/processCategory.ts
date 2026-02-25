/**
 * Process Category Inference
 *
 * Pure utility function to infer the manufacturing process category
 * from an operation name. Used by both AMFE and Control Plan modules
 * for process-specific AI vocabulary hints.
 */

/** Infer process category from operation name for process-specific AI vocabulary */
export function inferOperationCategory(opName: string): string | undefined {
    const n = opName.toLowerCase();
    if (/sold/.test(n)) return 'soldadura';
    if (/ensambl|montaj/.test(n)) return 'ensamble';
    if (/pintu|recubr|lacad/.test(n)) return 'pintura';
    if (/mecaniz|cnc|torneado|fresado|rectific/.test(n)) return 'mecanizado';
    if (/inyecc|mold/.test(n)) return 'inyeccion';
    if (/inspecc|control.*calidad/.test(n)) return 'inspeccion';
    if (/oxicort/.test(n)) return 'corte_termico';
    if (/cort[ea]|troquel|cizall|sierra/.test(n)) return 'corte';
    if (/laser|plasma/.test(n)) return 'corte_termico';
    if (/estampad|embutid|troquelad/.test(n)) return 'estampado';
    if (/pleg|dobla/.test(n)) return 'plegado';
    if (/trat.*ter|templ|reveni|normaliz|cementac/.test(n)) return 'tratamiento_termico';
    if (/galvaniz|cincad|anodiz|cromad/.test(n)) return 'recubrimiento';
    if (/pulid|desbarb|lijad|desbast/.test(n)) return 'acabado';
    if (/trefilad|extrus|laminad/.test(n)) return 'conformado';
    if (/fundic|colad|moldeo.*arena/.test(n)) return 'fundicion';
    if (/limpiez|desengras|fosfatiz|decapad/.test(n)) return 'pretratamiento';
    if (/curvad|conform|embutici/.test(n)) return 'plegado';
    if (/lapeado|bruñid|honead/.test(n)) return 'acabado';
    if (/zincad/.test(n)) return 'recubrimiento';
    return undefined;
}
