import { describe, it, expect } from 'vitest';
import { inferOperationCategory, inferDepartment } from '../../utils/processCategory';

describe('inferOperationCategory', () => {
    it('detects soldadura', () => {
        expect(inferOperationCategory('Soldadura MIG')).toBe('soldadura');
        expect(inferOperationCategory('Proceso de soldado')).toBe('soldadura');
    });

    it('detects ensamble', () => {
        expect(inferOperationCategory('Ensamble final')).toBe('ensamble');
        expect(inferOperationCategory('Montaje de componentes')).toBe('ensamble');
    });

    it('detects pintura', () => {
        expect(inferOperationCategory('Pintura electrostatica')).toBe('pintura');
        expect(inferOperationCategory('Recubrimiento zinc')).toBe('pintura');
        expect(inferOperationCategory('Lacado UV')).toBe('pintura');
    });

    it('detects mecanizado', () => {
        expect(inferOperationCategory('Mecanizado CNC')).toBe('mecanizado');
        expect(inferOperationCategory('Torneado de eje')).toBe('mecanizado');
        expect(inferOperationCategory('Fresado 5 ejes')).toBe('mecanizado');
        expect(inferOperationCategory('Rectificado plano')).toBe('mecanizado');
    });

    it('detects inyeccion', () => {
        expect(inferOperationCategory('Inyeccion plastica')).toBe('inyeccion');
        expect(inferOperationCategory('Moldeo por inyeccion')).toBe('inyeccion');
    });

    it('detects inspeccion', () => {
        expect(inferOperationCategory('Inspeccion visual')).toBe('inspeccion');
        expect(inferOperationCategory('Control de calidad')).toBe('inspeccion');
    });

    it('detects corte', () => {
        expect(inferOperationCategory('Corte laser')).toBe('corte');
        expect(inferOperationCategory('Troquelado de chapa')).toBe('corte');
        expect(inferOperationCategory('Sierra de cinta')).toBe('corte');
        expect(inferOperationCategory('Cizalla hidraulica')).toBe('corte');
    });

    it('detects estampado', () => {
        expect(inferOperationCategory('Estampado en frio')).toBe('estampado');
        expect(inferOperationCategory('Embutido profundo')).toBe('estampado');
        expect(inferOperationCategory('Estampado progresivo')).toBe('estampado');
    });

    it('detects plegado', () => {
        expect(inferOperationCategory('Plegado hidraulico')).toBe('plegado');
        expect(inferOperationCategory('Doblado de chapa')).toBe('plegado');
    });

    it('detects tratamiento_termico', () => {
        expect(inferOperationCategory('Tratamiento termico')).toBe('tratamiento_termico');
        expect(inferOperationCategory('Temple y revenido')).toBe('tratamiento_termico');
        expect(inferOperationCategory('Normalizado')).toBe('tratamiento_termico');
        expect(inferOperationCategory('Cementacion')).toBe('tratamiento_termico');
    });

    it('detects recubrimiento', () => {
        expect(inferOperationCategory('Galvanizado en caliente')).toBe('recubrimiento');
        expect(inferOperationCategory('Cincado electrolítico')).toBe('recubrimiento');
        expect(inferOperationCategory('Anodizado')).toBe('recubrimiento');
        expect(inferOperationCategory('Cromado duro')).toBe('recubrimiento');
    });

    it('detects acabado', () => {
        expect(inferOperationCategory('Pulido espejo')).toBe('acabado');
        expect(inferOperationCategory('Desbarbado manual')).toBe('acabado');
        expect(inferOperationCategory('Lijado fino')).toBe('acabado');
        expect(inferOperationCategory('Desbaste grueso')).toBe('acabado');
    });

    it('detects conformado', () => {
        expect(inferOperationCategory('Trefilado de alambre')).toBe('conformado');
        expect(inferOperationCategory('Extrusion de perfil')).toBe('conformado');
    });

    it('detects fundicion', () => {
        expect(inferOperationCategory('Fundicion en arena')).toBe('fundicion');
        expect(inferOperationCategory('Colada continua')).toBe('fundicion');
    });

    it('detects corte_termico', () => {
        expect(inferOperationCategory('Corte laser CO2')).toBe('corte');
        // "laser" alone (without "corte") → corte_termico
        expect(inferOperationCategory('Proceso laser')).toBe('corte_termico');
        expect(inferOperationCategory('Plasma de alta definicion')).toBe('corte_termico');
        expect(inferOperationCategory('Oxicorte manual')).toBe('corte_termico');
    });

    it('detects pretratamiento', () => {
        expect(inferOperationCategory('Limpieza ultrasonica')).toBe('pretratamiento');
        expect(inferOperationCategory('Desengrase alcalino')).toBe('pretratamiento');
        expect(inferOperationCategory('Fosfatizado de zinc')).toBe('pretratamiento');
        expect(inferOperationCategory('Decapado acido')).toBe('pretratamiento');
    });

    it('detects conformado with laminado', () => {
        expect(inferOperationCategory('Laminado en frio')).toBe('conformado');
    });

    it('detects acabado with lapeado and bruñido', () => {
        expect(inferOperationCategory('Lapeado de cilindros')).toBe('acabado');
        expect(inferOperationCategory('Bruñido de camisa')).toBe('acabado');
    });

    it('detects recubrimiento with zincado', () => {
        expect(inferOperationCategory('Zincado electrolitico')).toBe('recubrimiento');
    });

    it('detects plegado with curvado', () => {
        expect(inferOperationCategory('Curvado de tubo')).toBe('plegado');
    });

    it('detects logistica', () => {
        expect(inferOperationCategory('Logistica')).toBe('logistica');
    });

    it('detects embalaje', () => {
        expect(inferOperationCategory('Empaque')).toBe('embalaje');
        expect(inferOperationCategory('Embalaje final')).toBe('embalaje');
    });

    it('detects adhesivado as ensamble', () => {
        expect(inferOperationCategory('Adhesivado de etiqueta')).toBe('ensamble');
        expect(inferOperationCategory('Etiquetado de producto')).toBe('ensamble');
    });

    it('detects costura', () => {
        expect(inferOperationCategory('Costura de funda')).toBe('costura');
        expect(inferOperationCategory('Coser lateral')).toBe('costura');
        expect(inferOperationCategory('Overlock de borde')).toBe('costura');
    });

    it('detects tapizado as costura', () => {
        expect(inferOperationCategory('Tapizado de asiento')).toBe('costura');
    });

    it('detects rebabado as acabado', () => {
        expect(inferOperationCategory('Rebabado manual')).toBe('acabado');
    });

    it('WIP guard: returns undefined for in-process operations', () => {
        expect(inferOperationCategory('Embalaje de medos WIP')).toBeUndefined();
        expect(inferOperationCategory('Almacenamiento WIP')).toBeUndefined();
        expect(inferOperationCategory('Empaque intermedio')).toBeUndefined();
        expect(inferOperationCategory('Stock en proceso')).toBeUndefined();
    });

    it('returns undefined for unknown processes', () => {
        expect(inferOperationCategory('Proceso especial XYZ')).toBeUndefined();
        expect(inferOperationCategory('Actividad genérica')).toBeUndefined();
    });

    it('is case-insensitive', () => {
        expect(inferOperationCategory('SOLDADURA MIG')).toBe('soldadura');
        expect(inferOperationCategory('CORTE LASER')).toBe('corte');
    });
});

// ============================================================================
// inferDepartment
// ============================================================================

describe('inferDepartment', () => {
    it('returns human-readable department name for known operations', () => {
        expect(inferDepartment('Soldadura MIG')).toBe('Soldadura');
        expect(inferDepartment('Mecanizado CNC')).toBe('Mecanizado');
        expect(inferDepartment('Pintura electrostática')).toBe('Pintura');
        expect(inferDepartment('Corte de chapa')).toBe('Corte');
        expect(inferDepartment('Ensamble final')).toBe('Ensamble');
    });

    it('returns empty string for unknown operations', () => {
        expect(inferDepartment('Proceso especial XYZ')).toBe('');
        expect(inferDepartment('Actividad genérica')).toBe('');
    });

    it('maps adhesivado/etiquetado to Ensamble', () => {
        expect(inferDepartment('Adhesivado de etiqueta')).toBe('Ensamble');
        expect(inferDepartment('Etiquetado de producto')).toBe('Ensamble');
    });

    it('maps almacen/recepcion to Almacén', () => {
        expect(inferDepartment('Recepción de material')).toBe('Almacén');
        expect(inferDepartment('Almacenamiento temporal')).toBe('Almacén');
    });

    it('maps costura to Costura', () => {
        expect(inferDepartment('Costura de funda')).toBe('Costura');
        expect(inferDepartment('Tapizado de asiento')).toBe('Costura');
    });

    it('returns empty for WIP operations', () => {
        expect(inferDepartment('Embalaje de medos WIP')).toBe('');
        expect(inferDepartment('Almacenamiento WIP')).toBe('');
    });

    it('maps embalaje to Embalaje', () => {
        expect(inferDepartment('Embalaje final')).toBe('Embalaje');
        expect(inferDepartment('Empaque de producto')).toBe('Embalaje');
    });

    it('maps tratamiento termico correctly', () => {
        expect(inferDepartment('Tratamiento térmico')).toBe('Trat. Térmico');
        expect(inferDepartment('Temple y revenido')).toBe('Trat. Térmico');
    });

    it('is case-insensitive', () => {
        expect(inferDepartment('SOLDADURA MIG')).toBe('Soldadura');
        expect(inferDepartment('MECANIZADO CNC')).toBe('Mecanizado');
    });
});
