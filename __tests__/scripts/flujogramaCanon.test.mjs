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
import { revisarFlujograma, hayRojos, decena, perfilDeSectores, compararConHermanos } from '../../scripts/_lib/flujogramaCanon.mjs';

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

        it('un MURO DE CALIDAD con operacion+inspeccion es un control, no una transformacion', () => {
            // El 159 lo dibuja porque lo exige la carta de nominacion de SMRC; el gate lo marcaba
            // en rojo porque el nombre no dice CONTROL ni INSPECCION.
            // Desde el 23/09/2026 el 159 lo unifica con la inspeccion final ("INSPECCION FINAL /
            // MURO DE CALIDAD", pedido de Fak), asi que el caso se arma aparte: un nodo que se
            // llama SOLO "MURO DE CALIDAD", sin la palabra INSPECCION que ya lo salvaria.
            const conMuro = structuredClone(ACTUAL);
            conMuro.flow.push({ stepId: '115', type: 'op-ins', description: 'MURO DE CALIDAD' });
            expect(reglas(revisarFlujograma(conMuro))).not.toContain('opins-sobre-transformacion');
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

    /**
     * 01/10/2026 — LO QUE FALTA. El flujograma 160 (Upper Trim) salio con el corte sin su
     * control con mylar y el adhesivado sin su control ni su reproceso, y los chequeos de arriba
     * daban verde: no habia nada mal dibujado, faltaban bloques enteros. Fak: "siempre en corte
     * hay control con mylar... debe estar lleno de errores".
     */
    describe('los bloques que no pueden faltar (flujograma 160, 01/10/2026)', () => {
        const U160 = leer('160-UPPER-TRIM-PANEL.json');
        const HERMANOS = fs.readdirSync(DATA).filter((x) => /^\d.*\.json$/.test(x))
            .map((f) => ({ clave: f.replace(/\.json$/, ''), doc: leer(f) }));
        const sin = (clave) => HERMANOS.filter((x) => x.clave !== clave);
        const mutar160 = (fn) => { const c = structuredClone(U160); fn(c); return c; };
        const ramaCorte = (c) => c.flow.find((n) => n.branches).branches[0];

        /** El 160 tal como lo emiti a las 14:45: una sola columna y ningun control intermedio. */
        const PRIMERA_VERSION = {
            header: U160.header, products: U160.products, revisions: U160.revisions,
            flow: [
                { stepId: '10', type: 'operation', description: 'RECEPCIÓN DE MATERIA PRIMA' },
                { type: 'inspection', description: 'INSPECCIÓN DE MATERIA PRIMA' },
                { type: 'condition', labelCondition: '¿MATERIAL CONFORME?', branchSide: { labelNode: 'NO', type: 'terminal', text: 'RECLAMO DE CALIDAD AL PROVEEDOR' } },
                { type: 'transfer', description: 'TRASLADO DE MICROFIBRA AL SECTOR DE MESA DE CORTE' },
                { stepId: '20', type: 'operation', description: 'CORTE DE MICROFIBRA' },
                { type: 'transfer', description: 'TRASLADO DE MICROFIBRA CORTADA Y SUSTRATOS AL SECTOR DE TAPIZADO' },
                { stepId: '30', type: 'operation', description: 'ADHESIVADO DE MICROFIBRA Y SUSTRATO' },
                { stepId: '40', type: 'operation', description: 'ACTIVADO DEL ADHESIVO CON CALOR' },
                { stepId: '41', type: 'operation', description: 'POSICIONADO Y TAPIZADO DE MICROFIBRA SOBRE SUSTRATO' },
                { stepId: '70', type: 'op-ins', description: 'INSPECCIÓN FINAL' },
                { type: 'condition', labelCondition: '¿PRODUCTO CONFORME?', branchSide: { labelNode: 'NO', type: 'terminal', text: 'SCRAP' } },
                { stepId: '80', type: 'operation', description: 'EMBALAJE E IDENTIFICACIÓN' },
                { type: 'storage', description: 'ALMACENADO EN DEPÓSITO DE PRODUCTO TERMINADO' },
            ],
        };

        describe('ROJO', () => {
            it('la primera version del 160: corte sin control con mylar y adhesivado sin control', () => {
                const r = reglas(revisarFlujograma(PRIMERA_VERSION));
                expect(r).toContain('corte-sin-control-mylar');
                expect(r).toContain('adhesivado-sin-control');
            });

            it('contra los hermanos dice QUE falta y en cuales esta', () => {
                const h = revisarFlujograma(PRIMERA_VERSION, { hermanos: sin('160-UPPER-TRIM-PANEL') })
                    .filter((x) => x.regla === 'falta-lo-que-tienen-los-hermanos');
                const texto = h.map((x) => x.detalle).join('\n');
                expect(texto).toMatch(/sector CORTE: \d de \d hermanos lo dibujan con un puesto de CONTROL/);
                expect(texto).toMatch(/sector ADHESIVADO: \d de \d hermanos lo dibujan con al menos un REPROCESO/);
                expect(texto).toMatch(/153/);                // nombra en cuales esta
                expect(texto).toMatch(/FALTA DE ADHESIVO/);  // y como se llama ahi
            });

            it('un control numerado al que le sacan su rombo', () => {
                const d = mutar160((c) => {
                    const r = ramaCorte(c);
                    r.splice(r.findIndex((n) => n.type === 'condition'), 1);
                });
                const r = reglas(revisarFlujograma(d));
                expect(r).toContain('control-sin-rombo');
                expect(r).toContain('corte-sin-control-mylar');   // un mylar sin rombo no decide nada
            });

            it('el embalaje que no es la ultima operacion', () => {
                const d = mutar160((c) => {
                    const i = c.flow.findIndex((n) => n.stepId === '80');
                    c.flow.splice(i + 1, 0, { stepId: '90', type: 'operation', description: 'TROQUELADO DE AGUJEROS' });
                });
                expect(reglas(revisarFlujograma(d))).toContain('embalaje-no-es-la-ultima');
            });

            it('el flujograma que no cierra en un almacenado', () => {
                const d = mutar160((c) => { c.flow.pop(); });
                expect(reglas(revisarFlujograma(d))).toContain('sin-almacenado-final');
            });

            it('el embalaje sin un control final con rombo antes', () => {
                const d = mutar160((c) => {
                    const i = c.flow.findIndex((n) => n.stepId === '70');
                    c.flow.splice(i, 2);     // se van el control final y su rombo
                });
                expect(reglas(revisarFlujograma(d))).toContain('sin-control-final');
            });
        });

        describe('VERDE', () => {
            it('el 160 rehecho pasa limpio, solo y contra sus hermanos', () => {
                expect(reglas(revisarFlujograma(U160))).toEqual([]);
                expect(reglas(revisarFlujograma(U160, { hermanos: sin('160-UPPER-TRIM-PANEL') }))).toEqual([]);
            });

            it.each(['153-ARMREST-DOOR-PANEL', '154-INSERT', '157-IP-PAD', '159-APB-P21-MY2026'])(
                'el %s no suma rojos por la comparacion con sus hermanos', (clave) => {
                    expect(reglas(revisarFlujograma(leer(`${clave}.json`), { hermanos: sin(clave) }))).toEqual([]);
                });

            it('el trimming del Top Roll no es un corte de mesa: no pide mylar', () => {
                expect(reglas(revisarFlujograma(leer('155-TOP-ROLL.json')))).not.toContain('corte-sin-control-mylar');
            });

            it('"ACTIVADO DEL ADHESIVO" y "REACTIVACION DE ADHESIVO" no son un adhesivado', () => {
                const d = mutar160((c) => {
                    const i = c.flow.findIndex((n) => n.stepId === '30');
                    c.flow.splice(i, 3);     // se van el adhesivado, su inspeccion y su rombo
                });
                expect(reglas(revisarFlujograma(d))).not.toContain('adhesivado-sin-control');
            });

            it('una excepcion declarada baja a aviso y dice por que', () => {
                const d151 = leer('151-APB-TRASERO-CENTRAL.json');
                const h = revisarFlujograma(d151);
                expect(reglas(h)).not.toContain('corte-sin-control-mylar');
                const aviso = h.find((x) => x.regla === 'corte-sin-control-mylar');
                expect(aviso?.gravedad).toBe('AVISO');
                expect(aviso.detalle).toMatch(/excepcion declarada/);
                // y sin la declaracion vuelve a ser rojo: la excepcion no apaga la regla
                delete d151._excepciones_canon;
                expect(reglas(revisarFlujograma(d151))).toContain('corte-sin-control-mylar');
            });

            it('"_no_aplica" con su motivo baja la diferencia con los hermanos a aviso', () => {
                const d = structuredClone(PRIMERA_VERSION);
                d._no_aplica = { 'ADHESIVADO.reproceso': 'prueba' };
                const h = revisarFlujograma(d, { hermanos: sin('160-UPPER-TRIM-PANEL') });
                const rojos = h.filter((x) => x.gravedad === 'ROJO').map((x) => x.detalle).join('\n');
                expect(rojos).not.toMatch(/ADHESIVADO: \d de \d hermanos lo dibujan con al menos un REPROCESO/);
                expect(h.some((x) => x.gravedad === 'AVISO' && /no aplica: prueba/.test(x.detalle))).toBe(true);
            });

            it('en una revision posterior a la A la diferencia con los hermanos avisa, no frena', () => {
                const d = structuredClone(PRIMERA_VERSION);
                d.header = { ...d.header, revision: 'B' };
                const r = reglas(revisarFlujograma(d, { hermanos: sin('160-UPPER-TRIM-PANEL') }));
                expect(r).not.toContain('falta-lo-que-tienen-los-hermanos');
                expect(r).toContain('corte-sin-control-mylar');   // el bloque obligatorio frena igual
            });
        });

        it('perfilDeSectores lee el 153 como lo dibuja', () => {
            const p = perfilDeSectores(leer('153-ARMREST-DOOR-PANEL.json'));
            expect(p.CORTE).toMatchObject({ control: true, rombo: true, wip: true });
            expect(p.ADHESIVADO).toMatchObject({ control: true, rombo: true, retrabajo: true, reproceso: true });
            expect(p['CONTROL FINAL']).toMatchObject({ control: true, rombo: true, reproceso: true });
        });

        it('compararConHermanos no inventa diferencias en un hermano que esta completo', () => {
            expect(compararConHermanos(leer('153-ARMREST-DOOR-PANEL.json'), sin('153-ARMREST-DOOR-PANEL'))).toEqual([]);
        });
    });
});
