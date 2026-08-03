import { describe, it, expect } from 'vitest';
import { formatDateAR } from '../../utils/formatting';

describe('formatDateAR', () => {
    it('no corre la fecha un dia al formatear un ISO date-only (bug de zona horaria)', () => {
        // `new Date('2025-04-07')` es medianoche UTC; en Argentina (UTC-3)
        // `.getDate()` devolvia 6. Salia impreso "06/04/2025" en la carátula del
        // AMFE y en el Plan de Control. Una fecha de documento es un dia de
        // calendario, no un instante: no debe pasar por zona horaria.
        expect(formatDateAR('2025-04-07')).toBe('07/04/2025');
        expect(formatDateAR('2025-09-23')).toBe('23/09/2025');
        expect(formatDateAR('2026-01-01')).toBe('01/01/2026');
        expect(formatDateAR('2025-12-31')).toBe('31/12/2025');
    });

    it('respeta el dia de calendario aunque el ISO traiga hora', () => {
        expect(formatDateAR('2025-04-07T00:00:00')).toBe('07/04/2025');
        expect(formatDateAR('2025-04-07 00:00:00')).toBe('07/04/2025');
    });

    it('deja intacto lo que ya viene en formato AR', () => {
        expect(formatDateAR('07/04/2025')).toBe('07/04/2025');
    });

    it('devuelve vacio para nulos y strings vacios', () => {
        expect(formatDateAR('')).toBe('');
        expect(formatDateAR(null)).toBe('');
        expect(formatDateAR(undefined)).toBe('');
        expect(formatDateAR('   ')).toBe('');
    });

    it('ignora anios fuera de rango razonable en vez de inventar una fecha', () => {
        expect(formatDateAR('1800-04-07')).not.toBe('07/04/1800');
    });
});
