/**
 * Tests for modules/controlPlan/controlPlanDefaults.ts
 *
 * Covers getControlPlanDefaults, inferSpecification,
 * inferReactionPlanOwner, inferProcessEvaluationTechnique,
 * and validateControlPlanForExport.
 */

import {
    getControlPlanDefaults,
    inferSpecification,
    inferReactionPlanOwner,
    inferProcessEvaluationTechnique,
    validateControlPlanForExport,
} from '../modules/controlPlan/controlPlanDefaults';

describe('getControlPlanDefaults', () => {
    it('AP=H: always 100% sample, every piece', () => {
        const result = getControlPlanDefaults({ ap: 'H', severity: 5, phase: 'production' });
        expect(result.sampleSize).toBe('100%');
        expect(result.sampleFrequency).toBe('Cada pieza');
        expect(result.autoFilledFields).toContain('sampleSize');
        expect(result.autoFilledFields).toContain('sampleFrequency');
    });

    it('AP=M, preLaunch: 100% every piece (pre-launch)', () => {
        const result = getControlPlanDefaults({ ap: 'M', severity: 6, phase: 'preLaunch' });
        expect(result.sampleSize).toBe('100%');
        expect(result.sampleFrequency).toContain('Pre-Lanzamiento');
    });

    it('AP=M, production, severity >= 9: 5 pieces every hour', () => {
        const result = getControlPlanDefaults({ ap: 'M', severity: 9, phase: 'production' });
        expect(result.sampleSize).toBe('5 piezas');
        expect(result.sampleFrequency).toBe('Cada hora');
    });

    it('AP=M, production, severity < 9: 5 pieces every shift', () => {
        const result = getControlPlanDefaults({ ap: 'M', severity: 7, phase: 'production' });
        expect(result.sampleSize).toBe('5 piezas');
        expect(result.sampleFrequency).toBe('Cada turno');
    });

    it('AP=L, severity >= 9: 3 pieces every 2 hours', () => {
        const result = getControlPlanDefaults({ ap: 'L', severity: 10, phase: 'production' });
        expect(result.sampleSize).toBe('3 piezas');
        expect(result.sampleFrequency).toBe('Cada 2 horas');
    });

    it('AP=L, severity 5-8: 1 piece every shift', () => {
        const result = getControlPlanDefaults({ ap: 'L', severity: 5, phase: 'production' });
        expect(result.sampleSize).toBe('1 pieza');
        expect(result.sampleFrequency).toBe('Cada turno');
    });

    it('AP=L, severity < 5: no sample defaults', () => {
        const result = getControlPlanDefaults({ ap: 'L', severity: 3, phase: 'production' });
        expect(result.sampleSize).toBe('');
        expect(result.sampleFrequency).toBe('');
        expect(result.autoFilledFields).not.toContain('sampleSize');
    });

    it('AP empty: no sample defaults set', () => {
        const result = getControlPlanDefaults({ ap: '', severity: 8, phase: 'production' });
        expect(result.sampleSize).toBe('');
        expect(result.sampleFrequency).toBe('');
    });

    it('severity >= 9: reaction plan includes "Detener línea"', () => {
        const result = getControlPlanDefaults({ ap: 'H', severity: 9, phase: 'production' });
        expect(result.reactionPlan).toContain('Detener línea');
        expect(result.reactionPlan).toContain('Segregar producto');
        expect(result.autoFilledFields).toContain('reactionPlan');
    });

    it('severity 7-8: reaction plan includes "Contener producto"', () => {
        const result = getControlPlanDefaults({ ap: 'M', severity: 7, phase: 'production' });
        expect(result.reactionPlan).toContain('Contener producto');
    });

    it('severity 4-6: reaction plan includes "Ajustar proceso"', () => {
        const result = getControlPlanDefaults({ ap: 'L', severity: 4, phase: 'production' });
        expect(result.reactionPlan).toContain('Ajustar proceso');
    });

    it('severity < 4: no reaction plan auto-filled', () => {
        const result = getControlPlanDefaults({ ap: 'M', severity: 3, phase: 'production' });
        expect(result.reactionPlan).toBe('');
        expect(result.autoFilledFields).not.toContain('reactionPlan');
    });
});

describe('inferSpecification', () => {
    describe('product rows (from failure description)', () => {
        it('dimensional failure → plano/tolerancia', () => {
            expect(inferSpecification('product', 'Fuera de medida en largo', '')).toContain('tolerancia dimensional');
        });

        it('contamination → libre de contaminación', () => {
            expect(inferSpecification('product', 'Contaminación de grasa', '')).toContain('contaminación visual');
        });

        it('adhesion failure → adhesión completa', () => {
            expect(inferSpecification('product', 'Despegue de adhesivo', '')).toContain('Adhesión completa');
        });

        it('visual/appearance → sin defectos visuales', () => {
            expect(inferSpecification('product', 'Mal aspecto superficial', '')).toContain('defectos visuales');
        });

        it('identification → identificación completa', () => {
            expect(inferSpecification('product', 'Falta de etiqueta', '')).toContain('Identificación completa');
        });

        it('damage → sin daños físicos', () => {
            expect(inferSpecification('product', 'Golpe en cara A', '')).toContain('daños físicos');
        });

        it('color issue → color conforme a muestra', () => {
            expect(inferSpecification('product', 'Diferencia de color', '')).toContain('muestra patrón');
        });

        it('unrecognized failure → empty string', () => {
            expect(inferSpecification('product', 'Algo inesperado', '')).toBe('');
        });
    });

    describe('process rows (from cause description)', () => {
        it('temperature → rango de temperatura', () => {
            expect(inferSpecification('process', '', 'Desviación de temperatura')).toContain('temperatura');
        });

        it('cycle time → tiempos de ciclo', () => {
            expect(inferSpecification('process', '', 'Tiempo de ciclo excesivo')).toContain('Tiempos de ciclo');
        });

        it('pressure → presión según parámetros', () => {
            expect(inferSpecification('process', '', 'Baja presión de inyección')).toContain('Presión');
        });

        it('torque → torque/ajuste según especificación', () => {
            expect(inferSpecification('process', '', 'Torque incorrecto')).toContain('Torque');
        });

        it('unrecognized cause → "Según instrucción de proceso"', () => {
            expect(inferSpecification('process', '', 'Algo raro')).toBe('Según instrucción de proceso');
        });

        it('empty cause → "Según instrucción de proceso"', () => {
            expect(inferSpecification('process', '', '')).toBe('Según instrucción de proceso');
        });
    });
});

describe('inferReactionPlanOwner', () => {
    it('severity >= 9: returns "Líder de Producción / Calidad"', () => {
        expect(inferReactionPlanOwner(9, 'M', 'soldadura')).toBe('Líder de Producción / Calidad');
    });

    it('AP=H with inspection category: returns "Supervisor de Calidad"', () => {
        expect(inferReactionPlanOwner(7, 'H', 'inspeccion')).toBe('Supervisor de Calidad');
        expect(inferReactionPlanOwner(6, 'H', 'control')).toBe('Supervisor de Calidad');
    });

    it('AP=H with non-inspection category: returns "Líder de Producción / Calidad"', () => {
        expect(inferReactionPlanOwner(5, 'H', 'soldadura')).toBe('Líder de Producción / Calidad');
    });

    it('severity 7-8 (non-H AP): returns "Líder de Producción"', () => {
        expect(inferReactionPlanOwner(7, 'M', 'corte')).toBe('Líder de Producción');
        expect(inferReactionPlanOwner(8, 'L', 'ensamble')).toBe('Líder de Producción');
    });

    it('low severity and low AP: returns "Operador de Producción"', () => {
        expect(inferReactionPlanOwner(4, 'L', 'embalaje')).toBe('Operador de Producción');
        expect(inferReactionPlanOwner(3, 'M', '')).toBe('Operador de Producción');
    });
});

describe('inferProcessEvaluationTechnique', () => {
    it('visual → "Inspección visual"', () => {
        expect(inferProcessEvaluationTechnique('Control visual 100%')).toBe('Inspección visual');
    });

    it('audit → "Auditoría de proceso"', () => {
        expect(inferProcessEvaluationTechnique('Auditoría layered')).toBe('Auditoría de proceso');
    });

    it('set-up / puesta → "Verificación de set-up"', () => {
        expect(inferProcessEvaluationTechnique('Verificación de set-up inicial')).toBe('Verificación de set-up');
        expect(inferProcessEvaluationTechnique('Puesta a punto validada')).toBe('Verificación de set-up');
    });

    it('dimensional / calibre → "Control dimensional"', () => {
        expect(inferProcessEvaluationTechnique('Control con calibre pasa/no-pasa')).toBe('Control dimensional');
        expect(inferProcessEvaluationTechnique('Galga de espesores')).toBe('Control dimensional');
    });

    it('sensor / monitor → "Monitoreo automático"', () => {
        expect(inferProcessEvaluationTechnique('Sensor de temperatura')).toBe('Monitoreo automático');
        expect(inferProcessEvaluationTechnique('Monitoreo en línea')).toBe('Monitoreo automático');
    });

    it('poka-yoke → "Poka-Yoke / Dispositivo anti-error"', () => {
        expect(inferProcessEvaluationTechnique('Poka-yoke mecánico')).toBe('Poka-Yoke / Dispositivo anti-error');
        expect(inferProcessEvaluationTechnique('Interlock de seguridad')).toBe('Poka-Yoke / Dispositivo anti-error');
    });

    it('registro / planilla → "Verificación documental"', () => {
        expect(inferProcessEvaluationTechnique('Registro de producción')).toBe('Verificación documental');
    });

    it('generic non-empty text → "Verificación operativa"', () => {
        expect(inferProcessEvaluationTechnique('Revisión del operador')).toBe('Verificación operativa');
    });

    it('empty string → empty string', () => {
        expect(inferProcessEvaluationTechnique('')).toBe('');
    });
});

describe('validateControlPlanForExport', () => {
    it('returns empty array when all items have owners', () => {
        const items = [
            { reactionPlanOwner: 'Operador', reactionPlan: 'Ajustar', sampleSize: '5', controlMethod: 'Visual' },
            { reactionPlanOwner: 'Supervisor', reactionPlan: 'Contener', sampleSize: '3', controlMethod: 'Calibre' },
        ];
        expect(validateControlPlanForExport(items)).toEqual([]);
    });

    it('reports count of items missing reactionPlanOwner', () => {
        const items = [
            { reactionPlanOwner: '', reactionPlan: 'Ajustar', sampleSize: '5', controlMethod: 'Visual' },
            { reactionPlanOwner: '  ', reactionPlan: 'Contener', sampleSize: '3', controlMethod: 'Calibre' },
            { reactionPlanOwner: 'Operador', reactionPlan: 'Contener', sampleSize: '1', controlMethod: 'Visual' },
        ];
        const issues = validateControlPlanForExport(items);
        expect(issues).toHaveLength(1);
        expect(issues[0]).toContain('2 item(s)');
        expect(issues[0]).toContain('sin Responsable');
    });

    it('returns empty array for empty items list', () => {
        expect(validateControlPlanForExport([])).toEqual([]);
    });
});
