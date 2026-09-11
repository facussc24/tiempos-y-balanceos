import { describe, it, expect } from 'vitest';
import {
    nivelDeCaracteristica,
    esCritica,
    esSignificativa,
    esSinMarca,
    esMarcaDesconocida,
    nivelPorCriterio,
    siglaSugerida,
    marcaCoherenteConCriterio,
    convertirSimbologia,
    leyendaDeMarcas,
    CRITERIO,
    SIMBOLOGIA,
} from '../../../modules/amfe/specialChars';
import canon from '../../../core/amfe/caracteristicasEspeciales.data.json';

/**
 * Las siglas de caracteristica especial NO son universales en Barack: conviven la del
 * instructivo del SGC (I-AC-005: CC / CS), la del manual AIAG-VDA (∇ / SC / OS / HI) y la del
 * cliente VW (D/TLD para la critica; VW no tiene sigla de significativa y se escribe SC).
 * Fuentes verificadas el 08, 09 y 11/09/2026 — regla always-on `caracteristicas-especiales.md`,
 * fuente unica `core/amfe/caracteristicasEspeciales.data.json`. Estos tests fijan que las tres
 * se leen igual, que la W no existe, y que el criterio es S y O de la causa (I-AC-005 punto 5).
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
        for (const sigla of ['SC', 'CS']) {
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
        expect(esSignificativa('sc')).toBe(true);
    });

    // ── En rojo: lo que NO tiene que pasar por caracteristica especial ──────────────
    it('la celda vacia no es una caracteristica y tampoco es desconocida', () => {
        for (const vacio of ['', '   ', undefined, null]) {
            expect(esCritica(vacio as string)).toBe(false);
            expect(esSignificativa(vacio as string)).toBe(false);
            expect(esMarcaDesconocida(vacio as string)).toBe(false);
        }
        expect(nivelDeCaracteristica('')).toBeNull();
    });

    it('el guion, la raya y N/A son "sin caracteristica" escrito: ni nivel ni desconocida', () => {
        // Hasta el 11/09/2026 el guion caia en "desconocida". Con SIGLA_DESCONOCIDA como CRITICAL
        // eso bloquearia un AMFE por escribir "-" en la columna, que es lo que hace planta.
        for (const sin of ['-', '—', 'N/A', ' - ']) {
            expect(esSinMarca(sin), sin).toBe(true);
            expect(nivelDeCaracteristica(sin), sin).toBeNull();
            expect(esMarcaDesconocida(sin), sin).toBe(false);
        }
        expect(esSinMarca('SC')).toBe(false);
    });

    it('una sigla que ninguna fuente define NO se adivina', () => {
        // PV2005 aparecio tipeado en la columna de clasificacion de un plan de control real.
        for (const basura of ['PV2005', 'XX', 'Clave', 'YC']) {
            expect(nivelDeCaracteristica(basura), basura).toBeNull();
            expect(esMarcaDesconocida(basura), basura).toBe(true);
        }
    });

    it('la W / Wichtig NO existe en ninguna norma VW (Fak 09/09/2026): es desconocida, no significativa', () => {
        // El 09/09 la escribi para VW sin abrir la norma y se propago a codigo y flujogramas.
        // Salia de una tabla interna (I-PY-001.7, hoy en OBSOLETOS), no de VW.
        for (const w of ['W', 'w', 'WICHTIG', 'Wichtig (W)']) {
            expect(nivelDeCaracteristica(w), w).toBeNull();
            expect(esSignificativa(w), w).toBe(false);
            expect(esMarcaDesconocida(w), w).toBe(true);
        }
        expect(canon.aliases.SIGNIFICATIVA).not.toContain('W');
        expect(canon.aliases.SIGNIFICATIVA).not.toContain('WICHTIG');
    });

    it('YC/YS son de AMFE de DISEÑO (pag. 128) y no entran en el de proceso', () => {
        expect(nivelDeCaracteristica('YC')).toBeNull();
        expect(nivelDeCaracteristica('YS')).toBeNull();
    });
});

describe('specialChars — el criterio es S y O de ESA causa (I-AC-005 punto 5; Fak 11/09/2026)', () => {
    it('la tabla del instructivo esta en la fuente unica: critica S 9-10, significativa S 5-8 y O >= 4', () => {
        expect(CRITERIO.CRITICA.severidad_min).toBe(9);
        expect(CRITERIO.CRITICA.severidad_max).toBe(10);
        expect(CRITERIO.SIGNIFICATIVA.severidad_min).toBe(5);
        expect(CRITERIO.SIGNIFICATIVA.severidad_max).toBe(8);
        expect(CRITERIO.SIGNIFICATIVA.ocurrencia_min).toBe(4);
    });

    it('S 9 o 10 es CRITICA con cualquier O', () => {
        expect(nivelPorCriterio(9, 1)).toBe('CRITICA');
        expect(nivelPorCriterio(10, 3)).toBe('CRITICA');
        expect(nivelPorCriterio('9', undefined)).toBe('CRITICA');
    });

    it('S 5 a 8 CON O >= 4 es SIGNIFICATIVA; con O 3 no es nada', () => {
        expect(nivelPorCriterio(5, 4)).toBe('SIGNIFICATIVA');
        expect(nivelPorCriterio(8, 10)).toBe('SIGNIFICATIVA');
        expect(nivelPorCriterio(7, 3)).toBeNull();      // el caso real: costura S7 O3 no es D/TLD
        expect(nivelPorCriterio(8, 2)).toBeNull();      // AMFE 158 OP 110, marcada SC por error
        expect(nivelPorCriterio(4, 9)).toBeNull();      // S 4 no entra aunque la O sea alta
        expect(nivelPorCriterio(7, undefined)).toBeNull();
        expect(nivelPorCriterio(undefined, 5)).toBeNull();
        expect(nivelPorCriterio(0, 5)).toBeNull();
    });

    it('la sugerencia habla en la simbologia del destinatario y NO asigna', () => {
        expect(siglaSugerida(9, 3)).toBe('CC');
        expect(siglaSugerida(9, 3, 'VW')).toBe('D/TLD');
        expect(siglaSugerida(7, 5)).toBe('SC');
        expect(siglaSugerida(7, 5, 'VW')).toBe('SC');
        expect(siglaSugerida(7, 3)).toBeNull();
    });

    it('marcaCoherenteConCriterio: la marca escrita tiene que salir de S y O', () => {
        expect(marcaCoherenteConCriterio('D/TLD', 7, 3)).toBe(false);   // el caso del 11/09
        expect(marcaCoherenteConCriterio('D/TLD', 9, 3)).toBe(true);
        expect(marcaCoherenteConCriterio('SC', 5, 5)).toBe(true);
        expect(marcaCoherenteConCriterio('SC', 8, 2)).toBe(false);
        expect(marcaCoherenteConCriterio('SC', 9, 5)).toBe(false);     // S 9 es CC, no SC
        // Lo que este criterio no juzga: vacio, guion, OS/HI.
        expect(marcaCoherenteConCriterio('', 7, 3)).toBe(true);
        expect(marcaCoherenteConCriterio('-', 7, 3)).toBe(true);
        expect(marcaCoherenteConCriterio('OS', 5, 2)).toBe(true);
    });
});

describe('specialChars — conversion a la simbologia del cliente', () => {
    it('interna -> VW: la critica es D/TLD y la significativa sigue siendo SC', () => {
        expect(convertirSimbologia('CC', 'VW')).toBe('D/TLD');
        expect(convertirSimbologia('SC', 'VW')).toBe('SC');
        expect(convertirSimbologia('∇', 'VW')).toBe('D/TLD');
        expect(convertirSimbologia('CS', 'VW')).toBe('SC');
        expect(SIMBOLOGIA.VW.SIGNIFICATIVA).not.toBe('W');
    });

    it('VW -> interna, y la vuelta es estable', () => {
        expect(convertirSimbologia('D/TLD', 'INTERNA')).toBe('CC');
        expect(convertirSimbologia('SC', 'INTERNA')).toBe('SC');
        expect(convertirSimbologia(convertirSimbologia('SC', 'VW'), 'INTERNA')).toBe('SC');
        expect(convertirSimbologia(convertirSimbologia('CC', 'VW'), 'INTERNA')).toBe('CC');
    });

    it('conserva el numero de la caracteristica al convertir', () => {
        expect(convertirSimbologia('SC 7', 'VW')).toBe('SC 7');
        expect(convertirSimbologia('D/TLD 3', 'INTERNA')).toBe('CC 3');
    });

    it('OS y HI no tienen equivalente VW: se quedan como estan', () => {
        expect(convertirSimbologia('OS', 'VW')).toBe('OS');
        expect(convertirSimbologia('HI', 'VW')).toBe('HI');
    });

    it('lo que no reconoce lo deja intacto, no lo borra ni lo inventa', () => {
        expect(convertirSimbologia('PV2005', 'VW')).toBe('PV2005');
        expect(convertirSimbologia('W', 'VW')).toBe('W');
        expect(convertirSimbologia('', 'VW')).toBe('');
    });

    it('la tabla de simbologia cubre los cuatro niveles y sale del JSON', () => {
        for (const destino of ['INTERNA', 'VW'] as const) {
            expect(Object.keys(SIMBOLOGIA[destino]).sort()).toEqual(
                ['ALTO_IMPACTO', 'CRITICA', 'SEGURIDAD_OPERADOR', 'SIGNIFICATIVA'],
            );
            expect(SIMBOLOGIA[destino]).toEqual(canon.simbologia[destino]);
        }
    });
});

describe('specialChars — la leyenda imprimible no cita normas (Fak 08/09/2026)', () => {
    it('cada sigla dice solo que nivel es: CARACTERISTICA CRITICA / SIGNIFICATIVA', () => {
        const leyenda = leyendaDeMarcas(['SC', 'D/TLD', 'SC 2']);
        expect(leyenda).toEqual([
            { mark: 'D/TLD', meaning: 'CARACTERISTICA CRITICA' },
            { mark: 'SC', meaning: 'CARACTERISTICA SIGNIFICATIVA' },
        ]);
        for (const l of leyenda) expect(l.meaning).not.toMatch(/VW|AIAG|I-AC-005|manual|instructivo|Formel|pag/i);
    });

    it('el guion no genera renglon; una sigla desconocida se lista como NO DEFINIDA', () => {
        expect(leyendaDeMarcas(['-', '', null])).toEqual([]);
        expect(leyendaDeMarcas(['W'])).toEqual([{ mark: 'W', meaning: 'SIGLA NO DEFINIDA — VERIFICAR.' }]);
    });
});
