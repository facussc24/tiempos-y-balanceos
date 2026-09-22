/**
 * flujogramaCanon — los dos sentidos.
 *
 * El ROJO es el flujograma 159 Rev.A tal como lo emiti el 21/09/2026: Fak lo abrio y marco
 * ocho cosas, siete de las cuales ya estaban escritas en la skill `flujogramas` — una de
 * ellas con su frase textual del 08/09/2026. El canon existia y yo no lo habia abierto.
 *
 * El VERDE son los flujogramas de la casa que ya estaban bien. Si el gate los marcara, seria
 * inutilizable y terminaria apagado.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { revisarFlujograma, hayRojos, decena } from '../../scripts/_lib/flujogramaCanon.mjs';

const DATA = path.join(process.cwd(), 'tools', 'flowchart', 'data');
const leer = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const reglas = (h) => h.filter((x) => x.gravedad === 'ROJO').map((x) => x.regla);

/** El 159 tal como esta hoy, ya corregido: es el caso VERDE que importa. */
const ACTUAL = leer('159-APB-P21-MY2026.json');

/** Reconstruye los defectos concretos que tenia la Rev.A, uno por uno. */
const conDefecto = (mutar) => {
    const copia = JSON.parse(JSON.stringify(ACTUAL));
    mutar(copia);
    return copia;
};

describe('canon de flujogramas', () => {
    describe('VERDE — lo que ya esta bien pasa', () => {
        it('el 159 corregido no tiene ningun rojo', () => {
            const h = revisarFlujograma(ACTUAL);
            expect(reglas(h)).toEqual([]);
            expect(hayRojos(h)).toBe(false);
        });

        /**
         * Los cuatro hermanos que estaban bien tienen que pasar LIMPIOS. Si el gate los
         * marcara, seria inutilizable: la primera version de la regla de decenas marcaba en
         * rojo a los ocho, incluido el 153, que es el modelo del que se copio el 159.
         */
        it.each(['151-APB-TRASERO-CENTRAL', '153-ARMREST-DOOR-PANEL', '154-INSERT', '157-IP-PAD'])(
            'el %s pasa sin rojos', (nombre) => {
                expect(reglas(revisarFlujograma(leer(`${nombre}.json`)))).toEqual([]);
            });

        it('ningun flujograma dispara decimal-sin-madre: ninguno usa decimales hoy', () => {
            for (const f of fs.readdirSync(DATA).filter((x) => x.endsWith('.json'))) {
                expect(reglas(revisarFlujograma(leer(f))), f).not.toContain('decimal-sin-madre');
            }
        });
    });

    describe('ROJO — cada cosa que Fak marco el 22/09/2026', () => {
        it('un decimal sin su operacion madre (el 90.1 / 90.2 sin 90)', () => {
            // El 159 Rev.A tenia 90.1 ACTIVADO EN HORNO y 90.2 TAPIZADO sin que existiera
            // ninguna operacion 90. Los 3 precedentes de decimal del corpus tienen su madre.
            const d = conDefecto((c) => {
                c.flow.find((n) => n.stepId === '80').stepId = '85.1';
            });
            expect(reglas(revisarFlujograma(d))).toContain('decimal-sin-madre');
        });

        it('un traslado que no cambia de decena: se cruza de sector y la decena se queda', () => {
            const d = conDefecto((c) => {
                const rama = c.flow.find((n) => n.branches)?.branches[0];
                rama.find((n) => n.stepId === '30').stepId = '22';
            });
            expect(reglas(revisarFlujograma(d))).toContain('traslado-sin-cambiar-de-decena');
        });

        it('operacion + inspeccion sobre una operacion de transformacion', () => {
            const d = conDefecto((c) => {
                const rama = c.flow.find((n) => n.branches)?.branches[0];
                rama.find((n) => n.stepId === '20').type = 'op-ins';
            });
            expect(reglas(revisarFlujograma(d))).toContain('opins-sobre-transformacion');
        });

        it('un rombo de conformidad que cuelga de una costura y no de un control', () => {
            const d = conDefecto((c) => {
                const rama = c.flow.find((n) => n.branches)?.branches[0];
                const i = rama.findIndex((n) => n.stepId === '41');
                rama.splice(i + 1, 0, {
                    type: 'condition', labelCondition: '¿COSTURA CONFORME?', labelDown: 'SI',
                    branchSide: { labelNode: 'NO', type: 'terminal', text: 'SCRAP' },
                });
            });
            expect(reglas(revisarFlujograma(d))).toContain('rombo-sin-control');
        });

        it('el retrabajo escrito adentro de una caja terminal', () => {
            const d = conDefecto((c) => {
                const rama = c.flow.find((n) => n.branches)?.branches[0];
                rama.find((n) => n.type === 'condition').branchSide.text = 'SCRAP O RETRABAJO';
            });
            expect(reglas(revisarFlujograma(d))).toContain('retrabajo-en-terminal');
        });

        it('un conector que sale y no aterriza en ningun lado', () => {
            const d = conDefecto((c) => {
                c.flow.push({ type: 'connector', text: 'B', description: 'AL ADHESIVADO' });
            });
            expect(reglas(revisarFlujograma(d))).toContain('conector-huerfano');
        });

        it('un numero de operacion repetido', () => {
            const d = conDefecto((c) => { c.flow.find((n) => n.stepId === '81').stepId = '80'; });
            expect(reglas(revisarFlujograma(d))).toContain('numero-repetido');
        });

        it('un control sin numero', () => {
            const d = conDefecto((c) => { delete c.flow.find((n) => n.stepId === '82').stepId; });
            expect(reglas(revisarFlujograma(d))).toContain('control-sin-numero');
        });

        it('una sigla dibujada que la leyenda no declara', () => {
            const d = conDefecto((c) => { c.flow.find((n) => n.stepId === '82').criticalType = 'cc/x'; });
            expect(reglas(revisarFlujograma(d))).toContain('sigla-sin-leyenda');
        });

        it('la cabecera incompleta', () => {
            const d = conDefecto((c) => { c.header.reviewedBy = ''; });
            expect(reglas(revisarFlujograma(d))).toContain('cabecera-incompleta');
        });
    });

    describe('el gate dice CUAL renglon lo frena', () => {
        it('cada hallazgo nombra el nodo, no solo la regla', () => {
            const d = conDefecto((c) => { c.flow.find((n) => n.stepId === '81').stepId = '80'; });
            const h = revisarFlujograma(d).find((x) => x.regla === 'numero-repetido');
            expect(h.detalle).toMatch(/OP 80/);
        });
    });

    describe('decena()', () => {
        it('sube al numero de sector', () => {
            expect(decena('21')).toBe(20);
            expect(decena('90.2')).toBe(90);
            expect(decena('110')).toBe(110);
        });
    });
});
