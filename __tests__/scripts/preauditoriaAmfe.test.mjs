// @vitest-environment node
/**
 * Tests de la pre-auditoria nocturna de AMFE: lo puro (scripts/_lib/preauditoriaAmfe.mjs) y la pasada
 * entera (`correr` de scripts/_preauditarAmfe.mjs) con un cliente de la API y una base FALSOS.
 *
 * Las reglas que se prueban son las de la casa, no gustos: el modelo senala y nunca aprueba; un AP=H
 * con la accion vacia es un estado VALIDO y no es hallazgo aunque el modelo lo diga; un hallazgo sin
 * cita textual no es hallazgo; el refutador que no miro un hallazgo lo descarta. Sin red, sin
 * .env.local: tiene que pasar en el CI.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../../scripts/_lib/preauditoriaAmfe.mjs';
import { correr } from '../../scripts/_preauditarAmfe.mjs';
import { soloLectura } from '../../scripts/_lib/supabaseSoloLectura.mjs';
import { leerLedger } from '../../scripts/_lib/claudeApi.mjs';

/** Un AMFE chico con los DOS juegos de nombres de campo que conviven en los datos reales. */
const DOC = {
  operations: [
    {
      opNumber: '10', name: 'Corte', operationFunction: 'cortar la tela a medida',
      workElements: [{
        type: 'Machine', name: 'Mesa de corte',
        functions: [{
          description: 'Cortar piezas segun molde', requirements: 'tolerancia 2 mm',
          failures: [{
            description: 'Pieza fuera de medida', severity: 7, effectLocal: 'retrabajo', effectNextLevel: 'no entra en costura', effectEndUser: 'arruga visible',
            causes: [
              { cause: 'Molde desgastado', occurrence: 4, detection: 5, ap: 'H', preventionControl: 'Set up segun HO 12', detectionControl: 'Control visual del operario', preventionAction: '', detectionAction: '', optimizationAction: '' },
              { cause: 'Tela mal tendida en la mesa', occurrence: 3, detection: 4, ap: 'M', preventionControl: 'Tendido con guia', detectionControl: 'Medicion con cinta', preventionAction: 'Instalar tope de tendido' },
            ],
          }],
        }],
      }],
    },
    {
      operationNumber: '20', operationName: 'Costura',
      workElements: [{
        type: 'Man', name: 'Operario de costura',
        functions: [{
          functionDescription: 'Coser las piezas',
          failures: [{
            failureMode: 'Costura salteada', severity: 6,
            causes: [{ description: 'Aguja despuntada', occurrence: 5, detection: 6, actionPriority: 'l', preventiveControl: 'Cambio de aguja por turno', detectionControl: 'TBD' }],
          }],
        }],
      }],
    },
  ],
};

const proyeccion = P.proyectarAmfe(DOC, { amfeNumber: 'AMFE-T1', projectName: 'Prueba' });
const h = (ref, tipo, cita, extra = {}) => ({ ref, tipo, cita, por_que: 'no cierra con la falla', confianza: 'alta', ...extra });

describe('preauditoria · proyeccion', () => {
  it('una linea por causa, con ref unica, y lee los dos juegos de nombres de campo', () => {
    expect([...proyeccion.causas.keys()]).toEqual(['O1.W1.F1.X1.C1', 'O1.W1.F1.X1.C2', 'O2.W1.F1.X1.C1']);
    expect(proyeccion.operaciones).toBe(2);
    expect(proyeccion.texto).toMatch(/== OP 20 Costura/);                 // operationNumber / operationName
    expect(proyeccion.texto).toMatch(/F: Coser las piezas/);              // functionDescription
    expect(proyeccion.texto).toMatch(/FALLA: Costura salteada/);          // failureMode
    expect(proyeccion.texto).toMatch(/\[O2\.W1\.F1\.X1\.C1\] CAUSA: Aguja despuntada/);  // description como causa
    expect(proyeccion.texto).toMatch(/control prev: Cambio de aguja por turno/);         // preventiveControl
    const refs = proyeccion.texto.match(/\[O\d+\.W\d+\.F\d+\.X\d+\.C\d+\]/g);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('marca AP (en mayuscula) y si las tres acciones estan vacias', () => {
    expect(proyeccion.causas.get('O1.W1.F1.X1.C1')).toMatchObject({ ap: 'H', accionVacia: true });
    expect(proyeccion.causas.get('O1.W1.F1.X1.C2')).toMatchObject({ ap: 'M', accionVacia: false });
    expect(proyeccion.causas.get('O2.W1.F1.X1.C1')).toMatchObject({ ap: 'L', accionVacia: true });
  });

  it('el pedido al revisor lleva lo ya detectado y el AMFE entero', () => {
    const conocidos = P.conocidosDelValidador(DOC, { amfeNumber: 'AMFE-T1', projectName: 'Prueba' });
    expect(Array.isArray(conocidos.lineas)).toBe(true);
    const { usuario, schema } = P.armarPedidoRevisor({ proyeccion, conocidos });
    expect(usuario).toMatch(/YA DETECTADO/);
    expect(usuario).toContain(proyeccion.texto);
    expect(schema).toBe(P.SCHEMA_HALLAZGOS);
    expect(P.SYSTEM_REVISOR).toMatch(/AP=H con las acciones vacías es un ESTADO VÁLIDO/);
  });
});

describe('preauditoria · filtros duros (codigo, no prompt)', () => {
  it('sin ref, tipo inventado o cita que no esta en el AMFE: afuera', () => {
    const { hallazgos, descartados } = P.filtrarHallazgos([
      h('O9.W1.F1.X1.C1', 'inconsistencia_interna', 'Molde desgastado'),
      h('O1.W1.F1.X1.C1', 'me_parece_feo', 'Molde desgastado'),
      h('O1.W1.F1.X1.C1', 'causa_no_corresponde_a_la_falla', 'una frase que el modelo invento'),
    ], proyeccion);
    expect(hallazgos).toEqual([]);
    expect(descartados).toMatchObject({ sin_ref: 1, tipo_invalido: 1, sin_cita: 1 });
  });

  it('la cita se compara sin tildes, mayusculas ni espacios de mas', () => {
    const { hallazgos } = P.filtrarHallazgos([h('O1.W1.F1.X1.C2', 'control_no_ataca_la_causa', '  TENDIDO   con guía ')], proyeccion);
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].donde).toMatch(/OP 10 Corte \/ Mesa de corte \/ Pieza fuera de medida \/ Tela mal tendida/);
  });

  it('una cita corta de un control de la casa ("HO 12", 5 caracteres) vale; "TBD" (3) no alcanza', () => {
    expect(P.citaSuficiente('ho 12')).toBe(true);
    expect(P.citaSuficiente('abcd')).toBe(true);
    expect(P.citaSuficiente('tbd')).toBe(false);
    const { hallazgos, descartados } = P.filtrarHallazgos([
      h('O1.W1.F1.X1.C1', 'control_no_ataca_la_causa', 'HO 12'),
      h('O2.W1.F1.X1.C1', 'huella_de_ia_o_placeholder', 'TBD'),
    ], proyeccion);
    expect(hallazgos.map((x) => x.cita)).toEqual(['HO 12']);
    expect(descartados.sin_cita).toBe(1);
  });

  it('AP=H con la accion vacia NUNCA es hallazgo, aunque el modelo lo diga', () => {
    const { hallazgos, descartados } = P.filtrarHallazgos([
      h('O1.W1.F1.X1.C1', 'inconsistencia_interna', 'Molde desgastado', { por_que: 'es AP=H y la acción preventiva está vacía' }),
      h('O2.W1.F1.X1.C1', 'inconsistencia_interna', 'Aguja despuntada', { por_que: 'no tiene acción definida' }),
    ], proyeccion);
    expect(hallazgos).toEqual([]);
    expect(descartados.ap_sin_accion).toBe(2);
  });

  it('la misma queja sobre una causa CON accion no la frena ese filtro (no es un AP vacio)', () => {
    const { hallazgos } = P.filtrarHallazgos([h('O1.W1.F1.X1.C2', 'inconsistencia_interna', 'Instalar tope de tendido', { por_que: 'la acción está pendiente de otra área' })], proyeccion);
    expect(hallazgos).toHaveLength(1);
  });

  it('sin duplicados (ref + tipo) y a lo sumo 8, los de mas confianza primero', () => {
    const tipos = P.TIPOS;
    const lista = [
      ...tipos.map((t) => h('O1.W1.F1.X1.C1', t, 'Molde desgastado', { confianza: 'baja' })),
      ...tipos.slice(0, 4).map((t) => h('O1.W1.F1.X1.C2', t, 'Tela mal tendida', { confianza: 'alta' })),
      h('O1.W1.F1.X1.C1', tipos[0], 'Molde desgastado'),
    ];
    const { hallazgos, descartados } = P.filtrarHallazgos(lista, proyeccion);
    expect(hallazgos).toHaveLength(P.TOPE_HALLAZGOS_POR_AMFE);
    expect(descartados.duplicado).toBe(1);
    expect(descartados.tope).toBe(2);
    expect(hallazgos.slice(0, 4).every((x) => x.confianza === 'alta')).toBe(true);
  });
});

describe('preauditoria · refutador y estado entre noches', () => {
  const a = { ...h('O1.W1.F1.X1.C1', 'control_no_ataca_la_causa', 'HO 12') };
  const b = { ...h('O1.W1.F1.X1.C2', 'inconsistencia_interna', 'Tendido con guia') };

  it('sin veredicto se descarta; se_mantiene sobrevive con su motivo', () => {
    const { mantenidos, descartados } = P.aplicarVeredictos([a, b], [{ ref: a.ref, tipo: a.tipo, veredicto: 'se_mantiene', motivo: 'el set up no mide el molde' }]);
    expect(mantenidos.map((x) => x.ref)).toEqual([a.ref]);
    expect(mantenidos[0].motivo_refutador).toBe('el set up no mide el molde');
    expect(descartados[0].motivo).toMatch(/no lo miro/);
  });

  it('amfesACorrer: el que cambio y el nunca visto si; el que no cambio no; --todos y --amfe', () => {
    const filas = [{ amfe_number: 'A', updated_at: '2026-10-02T10:00' }, { amfe_number: 'B', updated_at: '2026-10-01T10:00' }, { amfe_number: 'C', updated_at: '2026-09-01' }];
    const estado = { revisados: { A: { updated_at: '2026-10-01T10:00' }, B: { updated_at: '2026-10-01T10:00' } }, vistos: {} };
    expect(P.amfesACorrer(filas, estado).map((f) => f.amfe_number)).toEqual(['A', 'C']);
    expect(P.amfesACorrer(filas, estado, { todos: true })).toHaveLength(3);
    expect(P.amfesACorrer(filas, estado, { soloAmfe: 'b' }).map((f) => f.amfe_number)).toEqual(['B']);
    expect(P.amfesACorrer(filas, 'estado roto')).toHaveLength(3);
  });

  it('estadoNuevo registra lo revisado (no lo que dio error) y lo visto; marcarNuevos distingue', () => {
    const e = P.estadoNuevo(P.estadoInicial(), [
      { amfe_number: 'A', updated_at: '2026-10-02', mantenidos: [a] },
      { amfe_number: 'C', updated_at: '2026-09-01', mantenidos: [], error: 'se corto' },
    ], { ahora: new Date('2026-10-08T09:31:00Z') });
    expect(Object.keys(e.revisados)).toEqual(['A']);
    expect(e.revisados.A).toMatchObject({ updated_at: '2026-10-02', hallazgos: 1 });
    expect(e.vistos[P.claveHallazgo('A', a)]).toBe('2026-10-08T09:31:00.000Z');
    const marcados = P.marcarNuevos('A', [a, b], e);
    expect(marcados.map((x) => x.nuevo)).toEqual([false, true]);
    expect(P.claveHallazgo('A', a)).not.toBe(P.claveHallazgo('B', a));
  });

  it('el reporte dice para quien es (la sesion, no Fak) y que AP=H sin accion nunca es hallazgo', () => {
    const md = P.armarReporte({
      fecha: '2026-10-08 06:31',
      resultados: [
        { amfe_number: 'AMFE-T1', project_name: 'Prueba', updated_at: '2026-10-07T10:00', operaciones: 2, conocidos: { criticos: 1, avisos: 3 }, propuestos: 3, descartadosCodigo: 1, descartadosRefutador: 1, mantenidos: [{ ...a, nuevo: true, donde: 'OP 10 Corte', motivo_refutador: 'x' }] },
        { amfe_number: 'AMFE-T2', project_name: 'Otra', mantenidos: [], error: 'HTTP 529' },
      ],
      saltados: [{}, {}],
      costoUsd: 0.4123,
      presupuesto: { gastadoUsd: 12.3, presupuestoUsd: 100, semaforo: 'verde' },
    });
    expect(md).toMatch(/no para Fak/);
    expect(md).toMatch(/AP=H sin acción nunca es hallazgo/);
    expect(md).toMatch(/\*\*NUEVO\*\*/);
    expect(md).toMatch(/cita: "HO 12"/);
    expect(md).toMatch(/ERROR: HTTP 529/);
    expect(md).toMatch(/sin cambios desde la última revisión \(no se tocaron\): 2/);
  });

  it('lineaResumen: lo que paso, sin adjetivos', () => {
    expect(P.lineaResumen({ revisados: 3, saltados: 18, hallazgos: 2, nuevos: 1, costoUsd: 0.41 }))
      .toBe('pre-auditoría AMFE: 3 revisados · 18 sin cambios · 2 hallazgos para verificar (1 nuevo) · $0.41');
    expect(P.lineaResumen({ revisados: 1, hallazgos: 0, errores: 1 })).toBe('pre-auditoría AMFE: 1 revisado · sin hallazgos que sobrevivan · 1 con error · $0.00');
  });
});

describe('preauditoria · tokens aproximados, tope por noche y reporte (puro)', () => {
  it('tokensAprox: 3,5 caracteres por token por defecto; BARACK_TOKENS_POR_CARACTER lo calibra; un valor absurdo se ignora', () => {
    const t = 'x'.repeat(350);
    expect(P.tokensAprox(t, { env: {} })).toBe(100);
    expect(P.tokensAprox(t, { env: { BARACK_TOKENS_POR_CARACTER: '2' } })).toBe(175);
    expect(P.tokensAprox(t, { env: { BARACK_TOKENS_POR_CARACTER: '3,5' } })).toBe(100);   // coma decimal, como escribe Fak
    for (const malo of ['0', '-2', 'abc', '50', '']) expect(P.tokensAprox(t, { env: { BARACK_TOKENS_POR_CARACTER: malo } }), malo).toBe(100);
    expect(P.tokensAprox(null, { env: {} })).toBe(0);
    expect(P.caracteresPorToken({})).toBe(P.CARACTERES_POR_TOKEN);
  });

  it('tokensConMargen: el tokenizador nuevo da hasta 30 % mas', () => {
    expect(P.MARGEN_TOKENIZADOR).toBe(1.3);
    expect(P.tokensConMargen(1000)).toBe(1300);
    expect(P.tokensConMargen(7)).toBe(10);
  });

  const filas = [
    { amfe_number: 'C', updated_at: '2026-10-05T10:00' },
    { amfe_number: 'A', updated_at: '2026-09-01T10:00' },
    { amfe_number: 'B', updated_at: '2026-09-20T10:00' },
    { amfe_number: 'D', updated_at: '2026-10-07T10:00' },
  ];

  it('elegirParaNoche: con tope, los de updated_at mas VIEJO primero; el resto queda diferido y sin tocar', () => {
    const { elegidos, diferidos } = P.elegirParaNoche(filas, P.estadoInicial(), { max: 2 });
    expect(elegidos.map((f) => f.amfe_number)).toEqual(['A', 'B']);
    expect(diferidos.map((f) => f.amfe_number)).toEqual(['C', 'D']);
    expect(filas.map((f) => f.amfe_number)).toEqual(['C', 'A', 'B', 'D']);   // no ordena la lista de afuera
  });

  it('elegirParaNoche: sin tope (o con uno invalido) entran todos, en el orden que vinieron', () => {
    for (const max of [null, undefined, 0, -1, 2.5, NaN]) {
      const r = P.elegirParaNoche(filas, P.estadoInicial(), { max });
      expect(r.elegidos.map((f) => f.amfe_number), String(max)).toEqual(['C', 'A', 'B', 'D']);
      expect(r.diferidos).toEqual([]);
    }
    expect(P.elegirParaNoche(filas, P.estadoInicial(), { max: 4 }).diferidos).toEqual([]);   // justo el tope
    expect(P.elegirParaNoche(null, null, { max: 2 })).toEqual({ elegidos: [], diferidos: [] });
    expect(P.TOPE_AMFE_POR_NOCHE).toBe(6);
  });

  it('elegirParaNoche con --todos: los nunca revisados y los revisados hace mas, para que repetir vaya rotando', () => {
    const estado = { revisados: { A: { revisado: '2026-10-08T06:00:00Z' }, B: { revisado: '2026-10-01T06:00:00Z' } }, vistos: {} };
    const { elegidos } = P.elegirParaNoche(filas, estado, { max: 3, todos: true });
    expect(elegidos.map((f) => f.amfe_number)).toEqual(['C', 'D', 'B']);   // C y D nunca; B antes que A
  });

  it('el reporte avisa lo diferido y lo que no termino; la linea del tablero cuenta los diferidos', () => {
    const base = { fecha: '2026-10-08 06:31', resultados: [], costoUsd: 0 };
    const md = P.armarReporte({ ...base, diferidos: filas.slice(0, 2), enCurso: 1, presupuesto: { gastadoUsd: 31, presupuestoUsd: 170, semaforo: 'verde', ciclo: { texto: 'ciclo del 07/09 al 06/10' } } });
    expect(md).toMatch(/Quedaron para la próxima noche \(tope por noche\): 2 \(C, A\)/);
    expect(md).toMatch(/NO terminaron: 1/);
    expect(md).toMatch(/ciclo del 07\/09 al 06\/10: \$31\.00 de \$170 \(verde\)/);
    expect(P.armarReporte(base)).not.toMatch(/próxima noche|NO terminaron/);
    expect(P.lineaResumen({ revisados: 6, saltados: 0, diferidos: 15, hallazgos: 0, costoUsd: 1.2 })).toBe('pre-auditoría AMFE: 6 revisados · 15 para la próxima noche · sin hallazgos que sobrevivan · $1.20');
  });
});

describe('preauditoria · la pasada entera con API y base falsas', () => {
  let dir;
  let dirPrevio;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preauditoria-test-'));
    // estado, reportes y ledger cuelgan de `dir`: la noche solo escribe en carpetas permitidas (escrituraSegura.mjs)
    dirPrevio = process.env.BARACK_PREAUDITORIA_DIR;
    process.env.BARACK_PREAUDITORIA_DIR = dir;
  });
  afterEach(() => {
    if (dirPrevio === undefined) delete process.env.BARACK_PREAUDITORIA_DIR; else process.env.BARACK_PREAUDITORIA_DIR = dirPrevio;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
  });

  const fila = (updated, numero = 'AMFE-T1') => ({ id: `u-${numero}`, amfe_number: numero, project_name: 'Prueba', updated_at: updated, data: JSON.stringify(DOC) });
  const base = (filas) => soloLectura({ from: () => ({ select: async () => ({ data: filas, error: null }) }) });
  const usage = { input_tokens: 5000, output_tokens: 800 };
  const texto = (obj) => [{ type: 'text', text: JSON.stringify(obj) }];

  function apiFalsa({ refutadorRechaza = false } = {}) {
    const pedidos = [];
    return {
      pedidos,
      messages: { countTokens: async () => ({ input_tokens: 4321 }) },
      beta: {
        messages: {
          create: async (p) => {
            pedidos.push(p.model);
            if (p.model === 'claude-sonnet-5-5') {
              return { id: 'r', model: p.model, stop_reason: 'end_turn', usage, content: texto({ hallazgos: [
                h('O1.W1.F1.X1.C1', 'control_no_ataca_la_causa', 'HO 12'),
                h('O1.W1.F1.X1.C1', 'inconsistencia_interna', 'Molde desgastado', { por_que: 'AP=H con la acción vacía' }),
                h('O1.W1.F1.X1.C2', 'texto_incoherente_o_truncado', 'esto no esta en el AMFE'),
              ] }) };
            }
            if (refutadorRechaza) return { id: 'x', model: p.model, stop_reason: 'refusal', stop_details: { category: null }, usage, content: [] };
            return { id: 'x', model: p.model, stop_reason: 'end_turn', usage, content: texto({ veredictos: [{ ref: 'O1.W1.F1.X1.C1', tipo: 'control_no_ataca_la_causa', veredicto: 'se_mantiene', motivo: 'el set up no mide el desgaste' }] }) };
          },
        },
      },
    };
  }

  const opciones = (extra) => ({
    dir: path.join(dir, 'estado'), dirReportes: path.join(dir, 'reportes'), dirLedger: path.join(dir, 'api'),
    ahora: new Date(2026, 9, 8, 6, 31), ...extra,
  });

  it('revisor -> filtro -> refutador -> reporte, estado y ledger; la noche siguiente sin cambios no gasta', async () => {
    const api = apiFalsa();
    const r = await correr(opciones({ cliente: api, sb: base([fila('2026-10-07T10:00')]) }));
    expect(r).toMatchObject({ revisados: 1, saltados: 0, hallazgos: 1, nuevos: 1, errores: 0 });
    expect(api.pedidos).toEqual(['claude-sonnet-5-5', 'claude-opus-5-5']);
    expect(r.costoUsd).toBeGreaterThan(0);
    const md = fs.readFileSync(r.reporte, 'utf8');
    expect(path.basename(r.reporte)).toBe('PREAUDITORIA_AMFE_20261008.md');
    expect(md).toMatch(/\*\*NUEVO\*\*.*control no ataca la causa/);
    expect(md).not.toMatch(/esto no esta en el AMFE/);
    expect(fs.readdirSync(path.join(dir, 'reportes')).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    expect(leerLedger('2026-10', path.join(dir, 'api')).map((e) => e.tarea)).toEqual(['preauditoria:revisor', 'preauditoria:refutador']);

    const api2 = apiFalsa();
    const r2 = await correr(opciones({ cliente: api2, sb: base([fila('2026-10-07T10:00')]) }));
    expect(r2).toMatchObject({ revisados: 0, saltados: 1, hallazgos: 0 });
    expect(api2.pedidos).toEqual([]);

    const r3 = await correr(opciones({ cliente: apiFalsa(), sb: base([fila('2026-10-07T10:00')]), todos: true }));
    expect(r3).toMatchObject({ revisados: 1, hallazgos: 1, nuevos: 0 });
  });

  it('si el refutador rechaza, ese AMFE queda con error (no se lleva nada sin refutar) y el costo cuenta', async () => {
    const r = await correr(opciones({ cliente: apiFalsa({ refutadorRechaza: true }), sb: base([fila('2026-10-07T10:00')]) }));
    expect(r).toMatchObject({ revisados: 0, errores: 1, hallazgos: 0 });
    expect(r.costoUsd).toBeGreaterThan(0);
    expect(fs.readFileSync(r.reporte, 'utf8')).toMatch(/ERROR: la API rechazo/);
  });

  it('--simular no gasta ni escribe: cuenta tokens (gratis) y estima', async () => {
    const api = apiFalsa();
    const r = await correr(opciones({ cliente: api, sb: base([fila('2026-10-07T10:00')]), simular: true }));
    expect(r.simulado).toBe(true);
    expect(api.pedidos).toEqual([]);
    expect(r.estimacion[0]).toMatchObject({ amfe_number: 'AMFE-T1', tokens: 4321, medido: true });
    expect(r.estimadoUsd.tope).toBeGreaterThan(r.estimadoUsd.soloRevisor);
    expect(fs.existsSync(path.join(dir, 'estado'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'reportes'))).toBe(false);
  });

  it('--amfe con un numero que no existe es error de argumento (codigo 2), no "0 revisados"', async () => {
    await expect(correr(opciones({ cliente: apiFalsa(), sb: base([fila('x')]), amfe: 'AMFE-NO' }))).rejects.toMatchObject({ codigo: 2 });
  });

  it('0 AMFE leidos es error (con RLS, nada es "no pude leer")', async () => {
    await expect(correr(opciones({ cliente: apiFalsa(), sb: base([]) }))).rejects.toThrow(/0 fila/);
  });

  // ── A3: tope por noche y estado incremental ────────────────────────────────────────────────────

  /** Un cliente que no encuentra nada que senalar (una sola llamada por AMFE) y cuya llamada N cuelga para siempre. */
  function apiQueSeCuelga({ cuelgaEn = Infinity } = {}) {
    let llamadas = 0;
    return {
      get llamadas() { return llamadas; },
      messages: { countTokens: async () => ({ input_tokens: 100 }) },
      beta: {
        messages: {
          create: async (p) => {
            llamadas += 1;
            if (llamadas >= cuelgaEn) return new Promise(() => {});   // el corte de los 55 minutos: nunca vuelve
            return { id: `r${llamadas}`, model: p.model, stop_reason: 'end_turn', usage, content: texto({ hallazgos: [] }) };
          },
        },
      },
    };
  }
  const esperarHasta = async (cond, ms = 4000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (cond()) return true; await new Promise((r) => setTimeout(r, 15)); }
    return false;
  };
  const leerEstado = () => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'estado', 'estado.json'), 'utf8')); } catch { return null; } };

  it('--max: revisa los 6 mas viejos por updated_at, deja el resto diferido, y la noche siguiente sigue con los que faltaban', async () => {
    const filas = ['G', 'C', 'A', 'F', 'B', 'E', 'D'].map((n, i) => fila(`2026-09-${String(10 + (n.charCodeAt(0) - 65)).padStart(2, '0')}T10:00`, `AMFE-${n}`));
    // A..G con updated_at del 10 al 16 de septiembre: A es el mas viejo y G el mas nuevo
    const api = apiQueSeCuelga();
    const r = await correr(opciones({ cliente: api, sb: base(filas), max: 6 }));
    expect(r).toMatchObject({ revisados: 6, diferidos: 1, saltados: 0, errores: 0 });
    expect(Object.keys(leerEstado().revisados).sort()).toEqual(['AMFE-A', 'AMFE-B', 'AMFE-C', 'AMFE-D', 'AMFE-E', 'AMFE-F']);
    expect(r.linea).toMatch(/6 revisados · 1 para la próxima noche/);
    expect(fs.readFileSync(r.reporte, 'utf8')).toMatch(/Quedaron para la próxima noche \(tope por noche\): 1 \(AMFE-G\)/);
    // la noche siguiente: solo el que quedo
    const api2 = apiQueSeCuelga();
    const r2 = await correr(opciones({ cliente: api2, sb: base(filas), max: 6 }));
    expect(r2).toMatchObject({ revisados: 1, diferidos: 0, saltados: 6 });
    expect(api2.llamadas).toBe(1);
    // gemelo: sin --max entran todos de una vez
    const dirOtro = path.join(dir, 'otra-noche');
    const r3 = await correr(opciones({ cliente: apiQueSeCuelga(), sb: base(filas), dir: path.join(dirOtro, 'estado'), dirReportes: path.join(dirOtro, 'rep'), dirLedger: path.join(dirOtro, 'api') }));
    expect(r3).toMatchObject({ revisados: 7, diferidos: 0 });
  });

  it('--amfe ignora el tope (se pidio ese AMFE) y --simular lo respeta sin gastar', async () => {
    const filas = ['A', 'B', 'C'].map((n, i) => fila(`2026-09-1${i}T10:00`, `AMFE-${n}`));
    const solo = await correr(opciones({ cliente: apiQueSeCuelga(), sb: base(filas), amfe: 'AMFE-C', max: 1 }));
    expect(solo).toMatchObject({ revisados: 1, diferidos: 0 });
    const sim = await correr(opciones({ cliente: apiQueSeCuelga(), sb: base(filas), simular: true, max: 2, dir: path.join(dir, 'sim') }));
    expect(sim.simulado).toBe(true);
    expect(sim.estimacion.map((x) => x.amfe_number)).toEqual(['AMFE-A', 'AMFE-B']);
    expect(sim.diferidos).toBe(1);
    expect(sim.linea).toMatch(/2 AMFE a revisar · .* · 1 quedan para la próxima noche/);
  });

  it('si la corrida se corta (el envoltorio la mata a los 55 min), lo que ya se reviso queda guardado: estado Y reporte, AMFE por AMFE', async () => {
    const filas = ['A', 'B', 'C', 'D'].map((n, i) => fila(`2026-09-1${i}T10:00`, `AMFE-${n}`));
    const api = apiQueSeCuelga({ cuelgaEn: 3 });          // el tercer AMFE nunca vuelve
    const corrida = correr(opciones({ cliente: api, sb: base(filas), concurrencia: 1 }));
    corrida.catch(() => {});
    const llego = await esperarHasta(() => Object.keys(leerEstado()?.revisados ?? {}).length >= 2);
    expect(llego, 'el estado tenia que tener los dos primeros AMFE antes de que termine la corrida').toBe(true);
    expect(Object.keys(leerEstado().revisados).sort()).toEqual(['AMFE-A', 'AMFE-B']);
    // el reporte tambien: un AMFE marcado como revisado cuyo resultado no esta en ningun archivo se perderia
    const reportes = fs.readdirSync(path.join(dir, 'reportes')).filter((f) => f.endsWith('.md'));
    expect(reportes).toHaveLength(1);
    const md = fs.readFileSync(path.join(dir, 'reportes', reportes[0]), 'utf8');
    expect(md).toMatch(/## AMFE-A/);
    expect(md).toMatch(/## AMFE-B/);
    expect(md).not.toMatch(/## AMFE-C/);
    expect(md).toMatch(/NO terminaron: 2/);                // el tercero colgado y el cuarto que no llego a empezar
    expect(fs.readdirSync(path.join(dir, 'estado')).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    // la noche siguiente retoma desde el tercero: los dos primeros no se vuelven a pagar
    const api2 = apiQueSeCuelga();
    const r2 = await correr(opciones({ cliente: api2, sb: base(filas), concurrencia: 1 }));
    expect(r2).toMatchObject({ revisados: 2, saltados: 2 });
    expect(api2.llamadas).toBe(2);
  });

  it('un AMFE que da error (no es el corte: la corrida termina) no entra al estado, y vuelve a revisarse la noche siguiente', async () => {
    const filas = ['A', 'B', 'C'].map((n, i) => fila(`2026-09-1${i}T10:00`, `AMFE-${n}`));
    let llamadas = 0;
    const api = {
      beta: { messages: { create: async (p) => {
        llamadas += 1;
        if (llamadas === 3) throw Object.assign(new Error('sobrecargada'), { status: 529 });   // el tercer AMFE falla
        return { id: `r${llamadas}`, model: p.model, stop_reason: 'end_turn', usage, content: texto({ hallazgos: [] }) };
      } } },
    };
    const r = await correr(opciones({ cliente: api, sb: base(filas), concurrencia: 1 }));
    expect(r).toMatchObject({ revisados: 2, errores: 1 });
    expect(Object.keys(leerEstado().revisados).sort()).toEqual(['AMFE-A', 'AMFE-B']);
    expect(fs.readFileSync(r.reporte, 'utf8')).toMatch(/## AMFE-C[\s\S]*ERROR: .*HTTP 529/);
    const r2 = await correr(opciones({ cliente: apiQueSeCuelga(), sb: base(filas), concurrencia: 1 }));
    expect(r2).toMatchObject({ revisados: 1, saltados: 2, errores: 0 });
  });

  it('un reporte por corrida: una segunda corrida el mismo dia no pisa el de la primera', async () => {
    const filas = [fila('2026-09-10T10:00', 'AMFE-A'), fila('2026-09-11T10:00', 'AMFE-B')];
    const r1 = await correr(opciones({ cliente: apiQueSeCuelga(), sb: base(filas), max: 1 }));
    const r2 = await correr(opciones({ cliente: apiQueSeCuelga(), sb: base(filas), max: 1, ahora: new Date(2026, 9, 8, 14, 5) }));
    expect(path.basename(r1.reporte)).toBe('PREAUDITORIA_AMFE_20261008.md');
    expect(path.basename(r2.reporte)).toBe('PREAUDITORIA_AMFE_20261008_1405.md');
    expect(fs.readFileSync(r1.reporte, 'utf8')).toMatch(/## AMFE-A/);
    expect(fs.readFileSync(r2.reporte, 'utf8')).toMatch(/## AMFE-B/);
  });

  // ── A1: la pasada solo escribe en carpetas permitidas ───────────────────────────────────────────

  it('ROJO: un reporte hacia una carpeta versionada del repo tira y no deja nada', async () => {
    const raiz = path.resolve(fileURLToPath(import.meta.url), '../../..');
    const docs = path.join(raiz, 'docs');
    const antes = fs.readdirSync(docs).filter((f) => /^PREAUDITORIA_AMFE_/.test(f));
    await expect(correr(opciones({ cliente: apiQueSeCuelga(), sb: base([fila('2026-09-10T10:00')]), dirReportes: docs }))).rejects.toThrow(/escrituraSegura: no escribo en/);
    expect(fs.readdirSync(docs).filter((f) => /^PREAUDITORIA_AMFE_/.test(f))).toEqual(antes);
  });

  it('escribirAtomico sigue exportado (para no romper imports) pero es la escritura segura', async () => {
    const { escribirAtomico } = await import('../../scripts/_preauditarAmfe.mjs');
    escribirAtomico(path.join(dir, 'x', 'a.txt'), 'ok');
    expect(fs.readFileSync(path.join(dir, 'x', 'a.txt'), 'utf8')).toBe('ok');
    expect(() => escribirAtomico(path.join(path.resolve(fileURLToPath(import.meta.url), '../../..'), 'scripts', '_nunca.txt'), 'no')).toThrow(/escrituraSegura/);
  });

  // ── A4: el rango de tokens de --simular ─────────────────────────────────────────────────────────

  it('--simular: lo APROXIMADO se muestra como rango x1,0 a x1,3; lo medido con count_tokens no se infla', async () => {
    const filas = [fila('2026-09-10T10:00', 'AMFE-A')];
    const sinRed = { messages: { countTokens: async () => { throw new Error('sin red'); } }, beta: {} };
    const aprox = await correr(opciones({ cliente: sinRed, sb: base(filas), simular: true, dir: path.join(dir, 's1') }));
    const x = aprox.estimacion[0];
    expect(x.medido).toBe(false);
    expect(x.tokens).toBeGreaterThan(100);
    expect(x.tokensMax).toBe(Math.ceil(x.tokens * 1.3));
    expect(aprox.estimadoMaxUsd.tope).toBeGreaterThan(aprox.estimadoUsd.tope);
    const medido = await correr(opciones({ cliente: apiQueSeCuelga(), sb: base(filas), simular: true, dir: path.join(dir, 's2') }));
    expect(medido.estimacion[0]).toMatchObject({ medido: true, tokens: 100, tokensMax: 100 });
    expect(medido.estimadoMaxUsd.tope).toBeCloseTo(medido.estimadoUsd.tope, 8);
  });
});
