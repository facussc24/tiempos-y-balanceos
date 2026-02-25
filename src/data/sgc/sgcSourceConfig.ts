/**
 * SGC Source Configuration
 *
 * Reference to the company's Quality Management System documentation
 * located on the network drive Y:\
 *
 * IMPORTANT: This is READ-ONLY reference data.
 * The source path points to sacred company files — NEVER modify originals.
 * This config enables future sync checks to detect updated documents.
 *
 * Last cataloged: 2026-02-19
 */

export const SGC_SOURCE_CONFIG = {
    /** Network path to the SGC root folder */
    sourcePath: 'Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\SISTEMA\\SISTEMA SGC',

    /** Date when this catalog was last synchronized */
    lastCataloged: '2026-02-19',

    /** Company info */
    company: 'Barack Mercosul',

    /** Standards the SGC complies with */
    standards: ['IATF 16949:2016', 'ISO 9001:2015', 'ISO 14001:2015'],

    /** Top-level folder structure */
    rootFolders: [
        'Ayudas Visuales',
        'FACTIBILIDAD',
        'Formularios',
        'IDENTIFICACIONES',
        'Instructivos',
        'Manual de funciones',
        'Manual del SGC',
        'MEDIO AMBIENTE',
        'Obsoleto',
        'Procedimientos',
        'Resposable de seguridad del producto',
    ],

    /** Root-level standalone files */
    rootFiles: [
        'Biblia de defectos Proyecto APB PATAGONIA.pptx',
        'Biblia de defectos Proyecto INSERTO PATAGONIA.pptx',
        'Biblia de defectos Proyecto IP PATAGONIA VW.pptx',
        'Catalogo SGC  - con responsables.xlsx',
        'Catalogo SGC.xlsx',
    ],
} as const;
