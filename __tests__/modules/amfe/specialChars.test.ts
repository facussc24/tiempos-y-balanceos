import { describe, it, expect } from 'vitest';
import {
    nivelDeCaracteristica,
    esCritica,
    esSignificativa,
    esMarcaDesconocida,
    convertirSimbologia,
    SIMBOLOGIA,
} from '../../../modules/amfe/specialChars';

/**
 * Las siglas de caracteristica especial NO son universales en Barack: conviven la del
 * instructivo del SGC (I-AC-005: CC / CS), la del manual AIAG-VDA (∇ / SC / OS / HI) y la del
 * cliente VW (D/TLD / W). Fuentes verificadas el 08/09/2026, memoria
 * `caracteristicas_especiales_notacion_barack`. Estos tests fijan que las tres se leen igual.
 */
describe('specialChars — las tres notaciones significan lo mismo', () => {
    it('reconoce la CRITICA en las tres fuentes', () => {
        for (const sigla of ['CC', '∇', '▽', 'D', 'D/TLD', 'TLD']) {
            expect(nivelDeCaracteristica(sigla), sigla).toBe('CRITICA');
            expect(esCritica(sigla), sigla).toBe(true);
            expect(esSignificativa(sigla), sigla).toBe(false);
        }
    });

    it('reconoce la SIGNIFICATIVA, incluida la CS del instructivo que nadie escribe', () => {
        for (const sigla of ['SC', 'CS', 'W', 'Wichtig']) {
            expect(nivelDeCaracteristica(sigla), sigla).toBe('SIGNIFICATIVA');
            expect(esSignificativa(sigla), sigla).toBe(true);
            expect(esCritica(sigla), sigla).toBe(false);
        }
    });

    it('reconoce OS y HI, que estan en el manual pero no en el instructivo', () => {
        expect(nivelDeCaracteristica('OS')).toBe('SEGURIDAD_OPERADOR');
        expect(nivelDeCaracteristica('HI')).toBe('ALTO_IMPACTO');
    });

    it('el numero de la caracteristica no es parte de la sigla', () => {
        // En el I-PY-001.7 las filas se numeran SC1..SC43 y D/TLD 1..5.
        expect(nivelDeCaracteristica('SC 1')).toBe('SIGNIFICATIVA');
        expect(nivelDeCaracteristica('SC12')).toBe('SIGNIFICATIVA');
        expect(nivelDeCaracteristica('D/TLD 3')).toBe('CRITICA');
    });

    it('tolera espacios y minusculas', () => {
        expect(esCritica('  cc  ')).toBe(true);
        expect(esSignificativa('w')).toBe(true);
    });

    // ── En rojo: lo que NO tiene que pasar por caracteristica especial ──────────────
    it('la celda vacia no es una caracteristica y tampoco es desconocida', () => {
        for (const vacio of ['', '   ', '-', undefined, null]) {
            expect(esCritica(vacio as string)).toBe(false);
            expect(esSignificativa(vacio as string)).toBe(false);
        }
        expect(nivelDeCaracteristica('')).toBeNull();
        expect(esMarcaDesconocida('')).toBe(false);
        // El guion SI es texto: es "sin caracteristica" escrito, pero no lo define ninguna
        // fuente como sigla, asi que cae en desconocida y se ve.
        expect(esMarcaDesconocida('-')).toBe(true);
    });

    it('una sigla que ninguna fuente define NO se adivina', () => {
        // PV2005 aparecio tipeado en la columna de clasificacion de un plan de control real.
        for (const basura of ['PV2005', 'XX', 'Clave', 'YC']) {
            expect(nivelDeCaracteristica(basura), basura).toBeNull();
            expect(esMarcaDesconocida(basura), basura).toBe(true);
        }
    });

    it('YC/YS son de AMFE de DISEÑO (pag. 128) y no entran en el de proceso', () => {
        expect(nivelDeCaracteristica('YC')).toBeNull();
        expect(nivelDeCaracteristica('YS')).toBeNull();
    });
});

describe('specialChars — conversion a la simbologia del cliente', () => {
    it('interna -> VW segun la tabla del I-PY-001.7', () => {
        expect(convertirSimbologia('CC', 'VW')).toBe('D/TLD');
        expect(convertirSimbologia('SC', 'VW')).toBe('W');
        expect(convertirSimbologia('∇', 'VW')).toBe('D/TLD');
        expect(convertirSimbologia('CS', 'VW')).toBe('W');
    });

    it('VW -> interna, y la vuelta es estable', () => {
        expect(convertirSimbologia('D/TLD', 'INTERNA')).toBe('CC');
        expect(convertirSimbologia('W', 'INTERNA')).toBe('SC');
        expect(convertirSimbologia(convertirSimbologia('SC', 'VW'), 'INTERNA')).toBe('SC');
        expect(convertirSimbologia(convertirSimbologia('CC', 'VW'), 'INTERNA')).toBe('CC');
    });

    it('conserva el numero de la caracteristica al convertir', () => {
        expect(convertirSimbologia('SC 7', 'VW')).toBe('W 7');
        expect(convertirSimbologia('D/TLD 3', 'INTERNA')).toBe('CC 3');
    });

    it('OS y HI no tienen equivalente VW: se quedan como estan', () => {
        expect(convertirSimbologia('OS', 'VW')).toBe('OS');
        expect(convertirSimbologia('HI', 'VW')).toBe('HI');
    });

    it('lo que no reconoce lo deja intacto, no lo borra ni lo inventa', () => {
        expect(convertirSimbologia('PV2005', 'VW')).toBe('PV2005');
        expect(convertirSimbologia('', 'VW')).toBe('');
    });

    it('la tabla de simbologia cubre los cuatro niveles', () => {
        for (const destino of ['INTERNA', 'VW'] as const) {
            expect(Object.keys(SIMBOLOGIA[destino]).sort()).toEqual(
                ['ALTO_IMPACTO', 'CRITICA', 'SEGURIDAD_OPERADOR', 'SIGNIFICATIVA'],
            );
        }
    });
});
