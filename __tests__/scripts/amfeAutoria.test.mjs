/**
 * amfeAutoria — los chequeos con los que nace un AMFE nuevo, en las dos direcciones.
 *
 * El ROJO de cada caso es un defecto que el AMFE 174 (Upper Trim, 01-02/10/2026) tuvo de verdad
 * en alguna de sus versiones: "sin control" con una O que no era 10, un defecto que va a scrap
 * con S=5, el AMFE con operaciones que el flujograma no tenia, un material del IP Pad que la BOM
 * de la pieza no respaldaba. El VERDE es el documento sano: si el chequeo lo marcara, terminaria
 * apagado.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
    crearConstructores, chequeosDeAutoria, pasosDelFlujograma, ordenDelFlujograma, controlQueNoExiste,
    parsearBom, materialesContraBom,
} from '../../scripts/_lib/amfeAutoria.mjs';

const FOCO = 'Funcion Interna: entregar la pieza / Funcion del Cliente: armar / Funcion del Usuario Final: aspecto';
const EF_ASPECTO = { s: 5, local: 'Pieza con desvio de aspecto', next: 'Clasificacion en el cliente', end: 'Aspecto por debajo del estandar' };
const EF_SCRAP = { s: 7, local: 'Pieza rechazada en el puesto, se genera scrap', next: 'Reposicion', end: 'Sin efecto en el vehiculo' };

/** Un AMFE minimo y sano: recepcion con dos materiales y un corte. */
function docSano(mutar = () => {}) {
    const { causa, falla, funcion, we, operacion } = crearConstructores({ prefijo: 't', foco: FOCO });
    const partes = {
        causaRecepcion: causa('Variacion entre partidas del proveedor', 'Certificado por partida', 3, 'Control de recepcion, una muestra por lote', 9),
        causaCorte: causa('La cuchilla pierde filo', 'Sin control preventivo', 10, 'Control visual 100% en el control final', 8),
        efCorte: EF_SCRAP,
        nombreCorte: 'CORTE DE TELA',
        funcionCorte: 'Cortar la tela con el contorno del patron',
        funcionElementoCorte: 'Cortar con la calidad de filo que pide el patron',
        requisitoCorte: 'Cuchilla dentro de su medida de uso',
    };
    mutar(partes);
    const ops = [
        operacion('10', 'RECEPCION DE MATERIA PRIMA', 'Recibir y liberar la tela y el adhesivo', [
            we('Material', 'Tela de la pieza', [funcion('Entregar la tela del plano', 'Tela segun plano', [
                falla('Tela con un color distinto del aprobado', EF_ASPECTO, [partes.causaRecepcion]),
            ])]),
            we('Material', 'Adhesivo y reticulante', [funcion('Entregar el adhesivo especificado', 'Adhesivo con certificado', [
                falla('Adhesivo distinto del especificado', EF_SCRAP, [causa('Partida distinta de la pedida', 'Certificado por partida', 3, 'Control de recepcion, una muestra por lote', 9)]),
            ])]),
        ]),
        operacion('20', partes.nombreCorte, partes.funcionCorte, [
            we('Machine', 'Mesa de corte', [funcion(partes.funcionElementoCorte, partes.requisitoCorte, [
                falla('Borde deshilachado', partes.efCorte, [partes.causaCorte]),
            ])]),
        ]),
    ];
    return { header: {}, operations: ops };
}

const FLUJO = {
    flow: [
        { stepId: '10', type: 'operation', description: 'RECEPCIÓN DE MATERIA PRIMA' },
        { type: 'storage', description: 'ALMACENADO' },
        { type: 'transfer', description: 'TRASLADO', branches: [
            [{ stepId: '20', type: 'operation', description: 'CORTE DE TELA' }, { stepId: '22', type: 'storage', description: 'ALMACENAMIENTO EN MEDIOS WIP' }],
        ] },
    ],
};

describe('constructores', () => {
    it('ids estables, S del efecto y AP de la tabla', () => {
        const a = docSano(); const b = docSano();
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        const fm = a.operations[1].workElements[0].functions[0].failures[0];
        expect(fm.severity).toBe(7);
        expect(fm.causes[0].ap).toBe('H');           // S7 O10 D8
        expect(fm.causes[0].actionPriority).toBe('H');
        expect(a.operations[0].focusElementFunction).toBe(FOCO);
    });
    it('un efecto sin S no arma la falla', () => {
        const { causa, falla } = crearConstructores({ prefijo: 't', foco: FOCO });
        expect(() => falla('x', { local: 'a', next: 'b', end: 'c' }, [causa('c', 'p', 3, 'd', 8)])).toThrow(/no trae su S/);
    });
});

describe('chequeos de autoria', () => {
    it('VERDE: el documento sano contra su flujograma no da errores', () => {
        const r = chequeosDeAutoria(docSano(), { flujograma: FLUJO });
        expect(r.errores).toEqual([]);
        expect(r.stats.nCausas).toBe(3);
        expect(r.sinPrevencion).toHaveLength(1);
    });
    it('el almacenado con numero del flujograma no cuenta como operacion', () => {
        expect(pasosDelFlujograma(FLUJO).map((p) => p.n)).toEqual(['10', '20']);
        expect(pasosDelFlujograma(FLUJO)[0].nombre).toBe('RECEPCION DE MATERIA PRIMA');
    });
    it('ROJO: "Sin control preventivo" con una O que no es 10', () => {
        const r = chequeosDeAutoria(docSano((p) => { p.causaCorte.occurrence = 7; }), { flujograma: FLUJO });
        expect(r.errores.join('\n')).toMatch(/prevencion que no existe lleva O=10 y tiene 7/);
    });
    it('ROJO: una deteccion que dice "Sin ..." o "No hay ..." con D distinta de 10', () => {
        for (const texto of ['Sin plan de control de recepcion', 'No hay control posterior']) {
            const r = chequeosDeAutoria(docSano((p) => { p.causaRecepcion.detectionControl = texto; }), { flujograma: FLUJO });
            expect(r.errores.join('\n')).toMatch(/deteccion que no existe lleva D=10 y tiene 9/);
        }
    });
    it('ROJO: el efecto dice scrap y la S queda en banda de retrabajo', () => {
        const r = chequeosDeAutoria(docSano((p) => { p.efCorte = { ...EF_SCRAP, s: 5 }; }), { flujograma: FLUJO });
        expect(r.errores.join('\n')).toMatch(/dice scrap en su efecto y tiene S=5/);
    });
    it('ROJO: la funcion del elemento copia la de la operacion', () => {
        const r = chequeosDeAutoria(docSano((p) => { p.funcionElementoCorte = p.funcionCorte; }), { flujograma: FLUJO });
        expect(r.errores.join('\n')).toMatch(/la funcion del elemento es igual a la de la operacion/);
    });
    it('ROJO: un TBD en cualquier campo', () => {
        const r = chequeosDeAutoria(docSano((p) => { p.requisitoCorte = 'Temperatura TBD'; }), { flujograma: FLUJO });
        expect(r.errores).toContain('hay un TBD en el documento');
    });
    it('ROJO: causa o control de "error de operario" o capacitacion', () => {
        const r1 = chequeosDeAutoria(docSano((p) => { p.causaCorte.cause = p.causaCorte.description = 'Error del operario'; }), { flujograma: FLUJO });
        const r2 = chequeosDeAutoria(docSano((p) => { p.causaRecepcion.preventiveControl = 'Capacitacion del sector'; }), { flujograma: FLUJO });
        expect(r1.errores.join('\n')).toMatch(/error de operario/);
        expect(r2.errores.join('\n')).toMatch(/capacitacion/);
    });
    it('ROJO: el AP escrito a mano no es el de la tabla', () => {
        const doc = docSano();
        doc.operations[1].workElements[0].functions[0].failures[0].causes[0].ap = 'L';
        expect(chequeosDeAutoria(doc, { flujograma: FLUJO }).errores.join('\n')).toMatch(/no es el de la tabla/);
    });
    it('ROJO: el mismo control de conducta con dos O distintas', () => {
        const CONDUCTA = { texto: 'Operarios con practica en la pieza', o: 7 };
        const bien = docSano((p) => { p.causaCorte.preventiveControl = CONDUCTA.texto; p.causaCorte.occurrence = 7; });
        const mal = docSano((p) => { p.causaCorte.preventiveControl = CONDUCTA.texto; p.causaCorte.occurrence = 4; });
        expect(chequeosDeAutoria(bien, { flujograma: FLUJO, controlDeConducta: CONDUCTA }).errores).toEqual([]);
        expect(chequeosDeAutoria(mal, { flujograma: FLUJO, controlDeConducta: CONDUCTA }).errores.join('\n')).toMatch(/control de conducta lleva O=7 y tiene 4/);
    });
    it('ROJO: operaciones que no son las del flujograma, o con otro nombre', () => {
        const otroNombre = chequeosDeAutoria(docSano((p) => { p.nombreCorte = 'CORTE DE VINILO'; }), { flujograma: FLUJO });
        expect(otroNombre.errores.join('\n')).toMatch(/OP 20: el flujograma dice "CORTE DE TELA" y el AMFE "CORTE DE VINILO"/);
        const flujoConMylar = JSON.parse(JSON.stringify(FLUJO));
        flujoConMylar.flow[2].branches[0].splice(1, 0, { stepId: '21', type: 'op-ins', description: 'CONTROL CON MYLAR' });
        const falta = chequeosDeAutoria(docSano(), { flujograma: flujoConMylar });
        expect(falta.errores.join('\n')).toMatch(/no son las del flujograma.*flujograma 10,20,21 \/ AMFE 10,20/);
    });
    it('ROJO: en el mismo camino, una operacion dibujada antes que otra de numero menor', () => {
        const invertido = { flow: [{ stepId: '20', type: 'operation', description: 'CORTE DE TELA' }, { stepId: '10', type: 'operation', description: 'RECEPCION DE MATERIA PRIMA' }] };
        expect(chequeosDeAutoria(docSano(), { flujograma: invertido }).errores.join('\n')).toMatch(/la 10 esta dibujada despues de la 20 en el mismo camino/);
    });
    it('VERDE: ramas paralelas — la del numero mayor dibujada primero, y una operacion repetida en dos ramas', () => {
        const paralelo = { flow: [
            { type: 'transfer', description: 'TRASLADO', branches: [
                [{ stepId: '20', type: 'operation', description: 'CORTE DE TELA' }],
                [{ stepId: '10', type: 'operation', description: 'RECEPCION DE MATERIA PRIMA' }],
                { sequence: [{ stepId: '10', type: 'operation', description: 'RECEPCION DE MATERIA PRIMA' }] },
            ] },
        ] };
        expect(ordenDelFlujograma(paralelo)).toEqual([]);
        expect(chequeosDeAutoria(docSano(), { flujograma: paralelo }).errores).toEqual([]);
    });
    it('VERDE: los flujogramas de la casa no tienen un numero mayor antes que uno menor en el mismo camino', () => {
        const dir = path.join(process.cwd(), 'tools', 'flowchart', 'data');
        const numerados = fs.readdirSync(dir).filter((f) => /^\d{3}-.*\.json$/.test(f));
        expect(numerados.length).toBeGreaterThanOrEqual(8);
        for (const f of numerados) {
            expect(ordenDelFlujograma(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))), f).toEqual([]);
        }
    });
    it('un almacenado con numero no cuenta, tampoco en una rama lateral; un opNumber numerico se compara igual', () => {
        const conLateral = JSON.parse(JSON.stringify(FLUJO));
        conLateral.flow.push({ type: 'condition', branchSide: { stepId: '23', type: 'storage', description: 'WIP' } });
        expect(pasosDelFlujograma(conLateral).map((p) => p.n)).toEqual(['10', '20']);
        const doc = docSano();
        doc.operations[0].opNumber = 10; doc.operations[1].opNumber = 20;
        expect(chequeosDeAutoria(doc, { flujograma: FLUJO }).errores).toEqual([]);
    });
    it('las formas de decir que un control NO existe — y la que parece y no es', () => {
        for (const t of ['Sin control preventivo', 'No existe control preventivo', 'Ninguno', '-', '', ' Sin plan de control de recepcion', 'No hay control posterior', 'No se detecta', 'Sin verificación periódica definida']) {
            expect(controlQueNoExiste(t), t).toBe(true);
        }
        for (const t of ['Sin contacto: sensor optico con interlock', 'Control visual 100% en el control final', 'Certificado por partida']) {
            expect(controlQueNoExiste(t), t).toBe(false);
        }
        const r = chequeosDeAutoria(docSano((p) => { p.causaCorte.preventiveControl = 'Ninguno'; p.causaCorte.occurrence = 3; }), { flujograma: FLUJO });
        expect(r.errores.join('\n')).toMatch(/prevencion que no existe lleva O=10 y tiene 3/);
    });
    it('scrap: tambien en el efecto del cliente, con "se descarta", y sin contar "sin generar scrap"; tbd en minuscula', () => {
        const enCliente = chequeosDeAutoria(docSano((p) => { p.efCorte = { s: 5, local: 'Borde con rebaba', next: 'El lote va a scrap en el cliente', end: 'Sin efecto' }; }), { flujograma: FLUJO });
        expect(enCliente.errores.join('\n')).toMatch(/dice scrap en su efecto y tiene S=5/);
        const descarta = chequeosDeAutoria(docSano((p) => { p.efCorte = { s: 4, local: 'Se descarta la pieza', next: 'Reposicion', end: 'Sin efecto' }; }), { flujograma: FLUJO });
        expect(descarta.errores.join('\n')).toMatch(/dice scrap/);
        const negado = chequeosDeAutoria(docSano((p) => { p.efCorte = { s: 4, local: 'Retrabajo en el puesto, sin generar scrap', next: 'Atraso', end: 'Sin efecto' }; }), { flujograma: FLUJO });
        expect(negado.errores).toEqual([]);
        const tbd = chequeosDeAutoria(docSano((p) => { p.requisitoCorte = 'temperatura tbd'; }), { flujograma: FLUJO });
        expect(tbd.errores).toContain('hay un TBD en el documento');
    });
});

describe('todo generador de AMFE nuevo nace con estos chequeos', () => {
    // Los dos anteriores a la libreria (cada uno con sus chequeos propios, ya emitidos).
    const ANTERIORES = ['_crearAmfe172Ductos.mjs', '_crearAmfe173P21Naranja.mjs'];
    const dir = path.join(process.cwd(), 'scripts');
    const generadores = fs.readdirSync(dir).filter((f) => /^_(crear|nuevo)amfe.*\.(mjs|ts)$/i.test(f) && !ANTERIORES.includes(f));

    // Es una ALARMA contra el olvido, no una prueba de que el generador frena: mira el texto,
    // y un generador que llame a los chequeos y despues ignore el resultado la pasa (auditoria
    // de cierre del 02/10/2026). Lo que prueba que frena son los casos ROJO de arriba, que
    // ejercen la libreria, y la corrida del propio generador antes de escribir.
    it('hay al menos uno, y cada uno usa los chequeos comunes, el flujograma y la BOM', () => {
        expect(ANTERIORES).toHaveLength(2);
        expect(generadores.length).toBeGreaterThanOrEqual(1);
        for (const g of generadores) {
            const src = fs.readFileSync(path.join(dir, g), 'utf8');
            expect(src, `${g}: no usa chequeosDeAutoria`).toMatch(/chequeosDeAutoria\(/);
            expect(src, `${g}: no le pasa el flujograma a los chequeos`).toMatch(/flujograma:\s*\w+/);
            expect(src, `${g}: no cruza los materiales con la BOM del arb`).toMatch(/materialesContraBom\(/);
            expect(src, `${g}: los errores no frenan el --apply`).toMatch(/errores\.length[\s\S]{0,80}process\.exit\(1\)/);
        }
    });
});

describe('materiales contra la BOM del arb', () => {
    const EXPORT = [
        'Artículo\t Rubro\t Medida\t  Descripción\tUnidad\tConsumo\tModulo\tProceso\t',
        'MP1    \t1\tTELA-01        \tTELA DE LA PIEZA NEGRO\tMT2\t0,07240000\tCO\tCUM\t',
        'MP1    \t1\tAD - ADFA15    \tADHESIVO FA X 18 L.\tLTS\t0,02050000\tTAP\tPRDTAP\t',
        'MP1    \t1\tAD - REGV0.6   \tRETICULANTE GV X 0.6 KG\tLTS\t0,00082000\tTAP\tPRDTAP\t',
        'MP1    \t1\tET-SATO-50X20  \tETIQUETA AUTOADHESIVA\tUN\t1,00000000\tTAP\tPRDTAP\t',
        'MP9    \t1\tOTRA-COSA      \tDE OTRO PRODUCTO\tUN\t1,00000000\tTAP\tPRDTAP\t',
    ].join('\r\n');
    const COBERTURA = {
        'TELA-01': 'Tela de la pieza',
        'AD - ADFA15': 'Adhesivo y reticulante',
        'AD - REGV0.6': 'Adhesivo y reticulante',
        'ET-SATO-50X20': { fuera: 'se coloca y se controla en el embalaje' },
    };

    it('lee solo los renglones del producto pedido', () => {
        const bom = parsearBom(EXPORT, ['MP1']);
        expect(bom.map((l) => l.codigo)).toEqual(['TELA-01', 'AD - ADFA15', 'AD - REGV0.6', 'ET-SATO-50X20']);
    });
    it('un producto sin ningun renglon es un error, no una BOM vacia', () => {
        expect(() => parsearBom(EXPORT, ['MP1', 'MP2'])).toThrow(/no trae ningun renglon de MP2/);
    });
    it('VERDE: cada renglon de la BOM tiene su material y cada material su renglon', () => {
        expect(materialesContraBom({ doc: docSano(), bom: parsearBom(EXPORT, ['MP1']), cobertura: COBERTURA })).toEqual([]);
    });
    it('ROJO: la BOM tiene un insumo que el AMFE no nombra', () => {
        const { 'TELA-01': _, ...sinTela } = COBERTURA;
        const e = materialesContraBom({ doc: docSano(), bom: parsearBom(EXPORT, ['MP1']), cobertura: sinTela }).join('\n');
        expect(e).toMatch(/la BOM del arb tiene TELA-01 .* y el AMFE no dice donde lo trata/);
        expect(e).toMatch(/tiene el material "Tela de la pieza" y ningun renglon de la BOM del arb lo respalda/);
    });
    it('ROJO: el AMFE trae un material que la BOM de la pieza no tiene (lo que venia de la pieza vecina)', () => {
        const doc = docSano();
        doc.operations[0].workElements.push({ id: 'x', type: 'Material', name: 'Espuma del IP Pad', functions: [] });
        const e = materialesContraBom({ doc, bom: parsearBom(EXPORT, ['MP1']), cobertura: COBERTURA }).join('\n');
        expect(e).toMatch(/"Espuma del IP Pad" y ningun renglon de la BOM del arb lo respalda/);
    });
    it('ROJO: la cobertura apunta a un material que no existe, o nombra un codigo que ya no esta', () => {
        const e1 = materialesContraBom({ doc: docSano(), bom: parsearBom(EXPORT, ['MP1']), cobertura: { ...COBERTURA, 'TELA-01': 'Tela vieja' } }).join('\n');
        expect(e1).toMatch(/apunta a "Tela vieja", que no es un material de la OP 10/);
        const e2 = materialesContraBom({ doc: docSano(), bom: parsearBom(EXPORT, ['MP1']), cobertura: { ...COBERTURA, 'TELA-00': 'Tela de la pieza' } }).join('\n');
        expect(e2).toMatch(/la cobertura nombra TELA-00, que ya no esta en la BOM del arb/);
    });
    it('ROJO: "fuera" sin decir por que; una cobertura nula; una BOM vacia', () => {
        const e = materialesContraBom({ doc: docSano(), bom: parsearBom(EXPORT, ['MP1']), cobertura: { ...COBERTURA, 'ET-SATO-50X20': {} } }).join('\n');
        expect(e).toMatch(/no dice ni el material ni por que queda fuera/);
        const nula = materialesContraBom({ doc: docSano(), bom: parsearBom(EXPORT, ['MP1']), cobertura: { ...COBERTURA, 'TELA-01': null } }).join('\n');
        expect(nula).toMatch(/la BOM del arb tiene TELA-01/);
        expect(materialesContraBom({ doc: docSano(), bom: [], cobertura: {} })).toEqual(['la BOM del arb vino vacia: no se puede cruzar']);
    });
    it('un tipo "material" en minuscula entra igual al cruce', () => {
        const doc = docSano();
        doc.operations[0].workElements[0].type = 'material';
        expect(materialesContraBom({ doc, bom: parsearBom(EXPORT, ['MP1']), cobertura: COBERTURA })).toEqual([]);
    });

    // El export real trae los subniveles con la columna 0 vacia y el bloque corrido 7 y 14
    // columnas. Renglones copiados en forma del export del 02/10/2026 (una pieza con funda).
    const fila = (cols) => { const a = Array(21).fill(''); for (const [i, v] of Object.entries(cols)) a[i] = v; return a.join('\t'); };
    const MULTINIVEL = [
        fila({ 0: 'PT-1', 1: '1', 2: 'SUS-1', 3: 'SUSTRATO PLASTICO', 4: 'UN', 5: '1,00000000' }),
        fila({ 0: 'PT-1', 1: '1', 2: 'FUN-1', 3: 'FUNDA', 4: 'UN', 5: '1,00000000' }),
        fila({ 7: 'FUN-1', 8: '1', 9: 'HILO-1', 10: 'HILO UNION NEGRO', 11: 'KG', 12: '0,00060000' }),
        fila({ 7: 'FUN-1', 8: '1', 9: 'COR-1', 10: 'CORTE', 11: 'UN', 12: '1,00000000' }),
        '',
        fila({ 14: 'COR-1', 15: '1', 16: 'VIN-1', 17: 'VINILO', 18: 'MTL', 19: '0,09800000' }),
        '',
        fila({ 0: 'PT-2', 1: '1', 2: 'OTRO', 3: 'DE OTRO PRODUCTO', 4: 'UN', 5: '1,00000000' }),
        fila({ 7: 'OTRO', 8: '1', 9: 'AJENO', 10: 'INSUMO DE OTRO PRODUCTO', 11: 'UN', 12: '1,00000000' }),
    ].join('\r\n');

    it('BOM con subniveles: devuelve los insumos de ultimo nivel y no los semielaborados', () => {
        const bom = parsearBom(MULTINIVEL, ['PT-1']);
        expect(bom.map((l) => l.codigo)).toEqual(['SUS-1', 'HILO-1', 'VIN-1']);
        expect(bom.find((l) => l.codigo === 'VIN-1').descripcion).toBe('VINILO');
    });
    it('ROJO: con subniveles, un AMFE sin el hilo ni el vinilo no puede dar verde', () => {
        const doc = docSano();   // sus materiales son "Tela de la pieza" y "Adhesivo y reticulante"
        const e = materialesContraBom({ doc, bom: parsearBom(MULTINIVEL, ['PT-1']), cobertura: { 'SUS-1': { fuera: 'x' } } }).join('\n');
        expect(e).toMatch(/la BOM del arb tiene HILO-1/);
        expect(e).toMatch(/la BOM del arb tiene VIN-1/);
    });
});
