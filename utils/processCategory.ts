/**
 * Process Category Inference
 *
 * Pure utility functions to infer the manufacturing process category
 * and department/sector from an operation name.
 * Used by AMFE, Control Plan, and PFD modules.
 */

/** Infer process category from operation name for process-specific AI vocabulary */
export function inferOperationCategory(opName: string): string | undefined {
    const n = opName.toLowerCase();
    // WIP/in-process guard: intermediate packaging/storage is NOT a sector change
    if (/\bwip\b|work.in.process|en.proceso|intermedi[oa]/.test(n)) return undefined;
    if (/sold/.test(n)) return 'soldadura';
    if (/ensambl|montaj/.test(n)) return 'ensamble';
    if (/costur|coser|overlock|confecci|bordad/.test(n)) return 'costura';
    if (/tapizad|tapice/.test(n)) return 'costura';
    if (/pintu|recubr|lacad/.test(n)) return 'pintura';
    if (/mecaniz|cnc|torneado|fresado|rectific/.test(n)) return 'mecanizado';
    if (/inyecc|mold/.test(n)) return 'inyeccion';
    if (/inspecc|control.*calidad/.test(n)) return 'inspeccion';
    if (/oxicort/.test(n)) return 'corte_termico';
    if (/cort[ea]|troquel|cizall|sierra/.test(n)) return 'corte';
    if (/laser|plasma/.test(n)) return 'corte_termico';
    if (/estampad|embutid|troquelad/.test(n)) return 'estampado';
    if (/pleg|dobla/.test(n)) return 'plegado';
    if (/trat.*t[eé]r|templ|reveni|normaliz|cementac/.test(n)) return 'tratamiento_termico';
    if (/galvaniz|cincad|anodiz|cromad/.test(n)) return 'recubrimiento';
    if (/pulid|desbarb|rebab|lijad|desbast/.test(n)) return 'acabado';
    if (/trefilad|extrus|laminad/.test(n)) return 'conformado';
    if (/fundic|colad|moldeo.*arena/.test(n)) return 'fundicion';
    if (/limpiez|desengras|fosfatiz|decapad/.test(n)) return 'pretratamiento';
    if (/curvad|conform|embutici/.test(n)) return 'plegado';
    if (/lapeado|bruñid|honead/.test(n)) return 'acabado';
    if (/zincad/.test(n)) return 'recubrimiento';
    if (/adhesiv|pegad|etiquetad|rotulad/.test(n)) return 'ensamble';
    if (/embalaj|empaque|emblistado|packaging/.test(n)) return 'embalaje';
    if (/almacen|stock|dep[oó]sito|recep|acopio/.test(n)) return 'almacen';
    if (/transport|traslad|despacho|log[ií]stic/.test(n)) return 'logistica';
    return undefined;
}

/** Map from process category to human-readable department/sector name */
const CATEGORY_TO_DEPARTMENT: Record<string, string> = {
    soldadura: 'Soldadura',
    ensamble: 'Ensamble',
    costura: 'Costura',
    pintura: 'Pintura',
    mecanizado: 'Mecanizado',
    inyeccion: 'Inyección',
    inspeccion: 'Inspección',
    corte_termico: 'Corte Térmico',
    corte: 'Corte',
    estampado: 'Estampado',
    plegado: 'Plegado',
    tratamiento_termico: 'Trat. Térmico',
    recubrimiento: 'Recubrimiento',
    acabado: 'Acabado',
    conformado: 'Conformado',
    fundicion: 'Fundición',
    pretratamiento: 'Pretratamiento',
    embalaje: 'Embalaje',
    almacen: 'Almacén',
    logistica: 'Logística',
};

/**
 * Infer department/sector name from operation name.
 * Used by PFD generator for auto-populating the "Área" column
 * and for cross-sector transport logic per ASME Y15.3 / AIAG APQP.
 *
 * Returns empty string if the sector cannot be determined.
 */
export function inferDepartment(opName: string): string {
    const category = inferOperationCategory(opName);
    if (!category) return '';
    return CATEGORY_TO_DEPARTMENT[category] || '';
}
