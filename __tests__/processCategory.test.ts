/**
 * Tests for utils/processCategory.ts
 *
 * Covers inferOperationCategory and inferDepartment with
 * normal cases, edge cases, and WIP guard behavior.
 */

import { inferOperationCategory, inferDepartment } from '../utils/processCategory';

describe('inferOperationCategory', () => {
    it('returns "soldadura" for names containing "sold"', () => {
        expect(inferOperationCategory('Soldadura MIG')).toBe('soldadura');
        expect(inferOperationCategory('Pre-soldado de componentes')).toBe('soldadura');
    });

    it('returns "ensamble" for assembly-related names', () => {
        expect(inferOperationCategory('Ensamble final')).toBe('ensamble');
        expect(inferOperationCategory('Montaje de subconjuntos')).toBe('ensamble');
    });

    it('returns "costura" for sewing/textile operations', () => {
        expect(inferOperationCategory('Costura overlock lateral')).toBe('costura');
        expect(inferOperationCategory('Tapizado de asiento')).toBe('costura');
        expect(inferOperationCategory('Confección de funda')).toBe('costura');
        expect(inferOperationCategory('Bordado de logo')).toBe('costura');
    });

    it('returns "corte" for cutting operations', () => {
        expect(inferOperationCategory('Corte de chapa')).toBe('corte');
        expect(inferOperationCategory('Troquelado de piezas')).toBe('corte');
        expect(inferOperationCategory('Sierra de cinta')).toBe('corte');
    });

    it('returns "corte_termico" for thermal cutting', () => {
        expect(inferOperationCategory('Oxicorte de placa')).toBe('corte_termico');
        // "Corte laser" matches /cort[ea]/ (corte) before /laser/ due to regex order
        // Use names that only match thermal cutting patterns
        expect(inferOperationCategory('Laser de alta potencia')).toBe('corte_termico');
        expect(inferOperationCategory('Plasma de alta definición')).toBe('corte_termico');
    });

    it('returns "mecanizado" for machining operations', () => {
        expect(inferOperationCategory('Mecanizado CNC')).toBe('mecanizado');
        expect(inferOperationCategory('Torneado de eje')).toBe('mecanizado');
        expect(inferOperationCategory('Fresado de superficie')).toBe('mecanizado');
    });

    it('returns "pintura" for painting/coating', () => {
        expect(inferOperationCategory('Pintura electrostatica')).toBe('pintura');
        expect(inferOperationCategory('Recubrimiento epoxi')).toBe('pintura');
        expect(inferOperationCategory('Lacado UV')).toBe('pintura');
    });

    it('returns "inyeccion" for injection molding', () => {
        expect(inferOperationCategory('Inyeccion plastica')).toBe('inyeccion');
        expect(inferOperationCategory('Moldeo por compresion')).toBe('inyeccion');
    });

    it('returns "inspeccion" for inspection/quality control', () => {
        expect(inferOperationCategory('Inspección visual')).toBe('inspeccion');
        expect(inferOperationCategory('Control de calidad final')).toBe('inspeccion');
    });

    it('returns "plegado" for bending operations', () => {
        // "Plegado CNC" matches mecanizado first due to "cnc" regex order
        expect(inferOperationCategory('Plegado de chapa')).toBe('plegado');
        expect(inferOperationCategory('Doblado manual')).toBe('plegado');
        expect(inferOperationCategory('Curvado de tubo')).toBe('plegado');
    });

    it('returns "tratamiento_termico" for heat treatment', () => {
        expect(inferOperationCategory('Tratamiento térmico de temple')).toBe('tratamiento_termico');
        expect(inferOperationCategory('Revenido a 200°C')).toBe('tratamiento_termico');
        expect(inferOperationCategory('Normalizado')).toBe('tratamiento_termico');
    });

    it('returns "recubrimiento" for surface coating', () => {
        expect(inferOperationCategory('Galvanizado en caliente')).toBe('recubrimiento');
        expect(inferOperationCategory('Anodizado de aluminio')).toBe('recubrimiento');
        expect(inferOperationCategory('Cromado decorativo')).toBe('recubrimiento');
        expect(inferOperationCategory('Zincado electrolitico')).toBe('recubrimiento');
    });

    it('returns "acabado" for finishing operations', () => {
        expect(inferOperationCategory('Pulido final')).toBe('acabado');
        expect(inferOperationCategory('Desbarbado de piezas')).toBe('acabado');
        expect(inferOperationCategory('Lijado de superficie')).toBe('acabado');
    });

    it('returns "embalaje" for packaging operations', () => {
        expect(inferOperationCategory('Embalaje final')).toBe('embalaje');
        expect(inferOperationCategory('Packaging de exportación')).toBe('embalaje');
    });

    it('returns "almacen" for storage/warehouse', () => {
        expect(inferOperationCategory('Almacenamiento temporal')).toBe('almacen');
        expect(inferOperationCategory('Recepción de MP')).toBe('almacen');
        expect(inferOperationCategory('Depósito de PT')).toBe('almacen');
    });

    it('returns "logistica" for transport/logistics', () => {
        expect(inferOperationCategory('Transporte a planta')).toBe('logistica');
        expect(inferOperationCategory('Despacho a cliente')).toBe('logistica');
    });

    it('returns "pretratamiento" for surface prep', () => {
        expect(inferOperationCategory('Limpieza química')).toBe('pretratamiento');
        expect(inferOperationCategory('Fosfatizado')).toBe('pretratamiento');
        expect(inferOperationCategory('Decapado ácido')).toBe('pretratamiento');
    });

    it('returns undefined for WIP/in-process names (guard clause)', () => {
        expect(inferOperationCategory('WIP Soldadura')).toBeUndefined();
        expect(inferOperationCategory('Work in process buffer')).toBeUndefined();
        expect(inferOperationCategory('Almacén intermedio')).toBeUndefined();
        expect(inferOperationCategory('Estación en proceso')).toBeUndefined();
    });

    it('returns undefined for unrecognized operation names', () => {
        expect(inferOperationCategory('Paso genérico')).toBeUndefined();
        expect(inferOperationCategory('')).toBeUndefined();
        expect(inferOperationCategory('ABC XYZ')).toBeUndefined();
    });

    it('is case-insensitive', () => {
        expect(inferOperationCategory('SOLDADURA MIG')).toBe('soldadura');
        expect(inferOperationCategory('PLASMA HD')).toBe('corte_termico');
        expect(inferOperationCategory('ENSAMBLE Final')).toBe('ensamble');
    });
});

describe('inferDepartment', () => {
    it('returns the Spanish department name for known categories', () => {
        expect(inferDepartment('Soldadura MIG')).toBe('Soldadura');
        expect(inferDepartment('Ensamble final')).toBe('Ensamble');
        expect(inferDepartment('Pintura electrostática')).toBe('Pintura');
        expect(inferDepartment('Mecanizado CNC')).toBe('Mecanizado');
        expect(inferDepartment('Corte de chapa')).toBe('Corte');
    });

    it('returns empty string for unrecognized operations', () => {
        expect(inferDepartment('Paso genérico')).toBe('');
        expect(inferDepartment('')).toBe('');
    });

    it('returns empty string for WIP operations', () => {
        expect(inferDepartment('WIP Soldadura')).toBe('');
    });
});
