// @vitest-environment node
/**
 * Las dos reglas nuevas de la noche (tanda 5 pieza 6, 17/10/2026; post de Anthropic sobre automatizaciones, 08/10/2026):
 *   - PAUSA POR PRESUPUESTO: el pedido que, con lo ya gastado, pasaria el tope por corrida queda en pausa
 *     (`budget_reached`) ANTES de mandarse; no es un error y los pasos que siguen corren.
 *   - MARCADOR: el resumen largo de novedades lee desde lo ultimo que proceso, no "los ultimos 7 dias"; un marcador
 *     roto es un error (una lectura fallida no es "dia tranquilo"); lo que no entra queda para la proxima.
 * Todo puro: sin red, sin archivos.
 */
import { describe, it, expect } from 'vitest';
import * as N from '../../scripts/_lib/nocturno.mjs';
import { semanal } from '../../scripts/_nocturno.mjs';

describe('nocturno · pausa por presupuesto (budget_reached)', () => {
  it('pausaPorPresupuesto: sin tope o si entra, nada; si no entra, la pausa con el detalle', () => {
    expect(N.pausaPorPresupuesto({ cotaUsd: 99, restanteUsd: null })).toBeNull();
    expect(N.pausaPorPresupuesto({ cotaUsd: 0.5, restanteUsd: 0.5 })).toBeNull();
    const p = N.pausaPorPresupuesto({ cotaUsd: 0.6, restanteUsd: 0.5, que: 'el resumen de 4 mails' });
    expect(p).toMatchObject({ saltado: true, pausa: 'budget_reached' });
    expect(p.detalle).toMatch(/el resumen de 4 mails puede costar hasta \$0,60 y a la corrida le quedan \$0,50/);
    // si ya se paso (restante negativo), lo que queda se dice como $0
    expect(N.pausaPorPresupuesto({ cotaUsd: 1, restanteUsd: -2 }).detalle).toMatch(/le quedan \$0,00/);
  });

  it('cada paso recibe lo que le queda a la corrida; uno en pausa queda saltado, no cuenta como error y los demas siguen', async () => {
    const vistos = [];
    const paso = (nombre, costoUsd, cota) => ({
      nombre,
      correr: async ({ restanteUsd }) => {
        vistos.push([nombre, restanteUsd]);
        return N.pausaPorPresupuesto({ cotaUsd: cota, restanteUsd, que: nombre }) ?? { detalle: 'ok', costoUsd };
      },
    });
    const pasos = await N.correrPasos([
      paso('preauditoria', 6, 7),        // entra (7 <= 8), gasta 6
      paso('mails', 0.01, 3),            // no entra (3 > 2): pausa
      paso('prioridades', 0.05, 1),      // entra (1 <= 2)
      paso('novedades', 0, 0.01),
    ], { topeCorridaUsd: 8, maxErroresSeguidos: 1 });
    expect(vistos).toEqual([['preauditoria', 8], ['mails', 2], ['prioridades', 2], ['novedades', 1.95]]);
    expect(pasos.map((p) => [p.nombre, p.estado, p.pausa ?? null])).toEqual([
      ['preauditoria', 'ok', null], ['mails', 'saltado', 'budget_reached'], ['prioridades', 'ok', null], ['novedades', 'ok', null],
    ]);
    expect(pasos.some((p) => p.corte)).toBe(false);   // con maxErroresSeguidos 1 una pausa contada como error habria cortado
  });

  it('sin tope (--sin-tope) cada paso recibe null y nada se pausa', async () => {
    const vistos = [];
    await N.correrPasos([{ nombre: 'mails', correr: async (c) => { vistos.push(c.restanteUsd); return { detalle: 'ok' }; } }], { topeCorridaUsd: null });
    expect(vistos).toEqual([null]);
  });

  it('el estado guarda la pausa y la linea del tablero la dice (sin "no tocaba")', () => {
    const fin = new Date(2026, 9, 18, 6, 40);
    const pasos = [
      { nombre: 'mails', estado: 'saltado', detalle: 'en pausa (budget_reached): ...', costoUsd: 0, pausa: 'budget_reached' },
      { nombre: 'novedades', estado: 'saltado', detalle: 'en pausa (budget_reached): ...', costoUsd: 0, pausa: 'budget_reached' },
    ];
    const e = N.armarEstado({ inicio: fin, fin, pasos, presupuesto: null });
    expect(e.pasos.map((p) => p.pausa)).toEqual(['budget_reached', 'budget_reached']);
    expect(e.lineaTablero).toMatch(/EN PAUSA por el tope de la corrida: mails, novedades/);
    expect(e.lineaTablero).not.toMatch(/no tocaba/);
  });

  it('un semanal en pausa no se anota como hecho ni suma "incompleta" (ya dice que vuelve)', async () => {
    const correr = semanal('propuestas', { solo: null, ahora: new Date(2026, 9, 18), simular: false, ruta: '/no/existe/semanal.json' },
      async ({ restanteUsd }) => N.pausaPorPresupuesto({ cotaUsd: 5, restanteUsd, que: 'la revisión de skills' }));
    const r = await correr({ restanteUsd: 1 });
    expect(r.pausa).toBe('budget_reached');
    expect(r.detalle).not.toMatch(/incompleta/);
  });
});

describe('nocturno · marcador del resumen largo de novedades', () => {
  const DIA = 86400000;
  const AHORA = Date.UTC(2026, 9, 19, 9, 30);
  const con = (f, ms) => ({ f, ms, texto: `- **@cuenta** algo nuevo en ${f}` });
  const sin = (f, ms) => ({ f, ms, texto: 'sin posteos nuevos' });

  it('leerMarcador: sin registro o sin la entrada es la primera vez; roto es un error', () => {
    expect(N.leerMarcador(null, 'novedadesLargo')).toBeNull();
    expect(N.leerMarcador({}, 'novedadesLargo')).toBeNull();
    expect(N.leerMarcador({ novedadesLargo: { hastaMs: 5, fecha: 'x' } }, 'novedadesLargo')).toEqual({ hastaMs: 5, fecha: 'x' });
    expect(() => N.leerMarcador({ novedadesLargo: { hastaMs: 'ayer' } }, 'novedadesLargo')).toThrow(/roto/);
    expect(() => N.leerMarcador([], 'novedadesLargo')).toThrow(/no es un objeto/);
    expect(() => N.leerMarcador({}, 'otro')).toThrow(/desconocido/);
  });

  it('anotarMarcador no pisa los otros campos y rechaza un hastaMs que no es numero', () => {
    expect(N.anotarMarcador({ otro: 1 }, 'novedadesLargo', { hastaMs: 9, fecha: 'f' })).toEqual({ otro: 1, novedadesLargo: { hastaMs: 9, fecha: 'f' } });
    expect(() => N.anotarMarcador({}, 'novedadesLargo', { hastaMs: NaN })).toThrow(/invalido/);
  });

  it('primera vez (sin marcador): los ultimos 7 dias, como antes', () => {
    const j = N.juntarDesdeMarcador([con('viejo', AHORA - 9 * DIA), con('a', AHORA - 3 * DIA), con('b', AHORA - DIA)], { ahoraMs: AHORA });
    expect(j.incluidos).toBe(2);
    expect(j.texto).not.toMatch(/viejo/);
    expect(j.texto.indexOf('## b')).toBeLessThan(j.texto.indexOf('## a'));   // el mas nuevo primero, como siempre
    expect(j.hastaMs).toBe(AHORA - DIA);
  });

  it('con marcador: todo lo de despues, aunque tenga mas de 7 dias (la notebook estuvo apagada)', () => {
    const marca = AHORA - 12 * DIA;
    const j = N.juntarDesdeMarcador([con('ya-resumido', marca), con('dia10', AHORA - 10 * DIA), con('dia2', AHORA - 2 * DIA)], { desdeMs: marca, ahoraMs: AHORA });
    expect(j.texto).toMatch(/dia10/);
    expect(j.texto).toMatch(/dia2/);
    expect(j.texto).not.toMatch(/ya-resumido/);
    expect(j.hastaMs).toBe(AHORA - 2 * DIA);
  });

  it('un listado sin novedades no va al texto pero se da por leido (el marcador lo pasa)', () => {
    const j = N.juntarDesdeMarcador([con('a', AHORA - 3 * DIA), sin('b', AHORA - DIA)], { desdeMs: AHORA - 5 * DIA, ahoraMs: AHORA });
    expect(j.incluidos).toBe(1);
    expect(j.hastaMs).toBe(AHORA - DIA);
    expect(j.quedan).toBe(0);
  });

  it('si no entra todo, queda afuera lo mas NUEVO (sigue arriba del marcador) y no lo viejo', () => {
    const largo = (f, ms) => ({ f, ms, texto: `- **@c** ${'x'.repeat(60)}` });
    const j = N.juntarDesdeMarcador([largo('d1', AHORA - 3 * DIA), largo('d2', AHORA - 2 * DIA), largo('d3', AHORA - DIA)], { desdeMs: AHORA - 4 * DIA, ahoraMs: AHORA, tope: 160 });
    expect(j.incluidos).toBe(2);
    expect(j.texto).toMatch(/d1/);
    expect(j.texto).not.toMatch(/d3/);
    expect(j.hastaMs).toBe(AHORA - 2 * DIA);   // la proxima corrida arranca despues de d2: d3 no se pierde
    expect(j.quedan).toBe(1);
  });

  it('nada despues del marcador: texto vacio y el marcador no se mueve (hastaMs null)', () => {
    const j = N.juntarDesdeMarcador([con('a', AHORA - 3 * DIA)], { desdeMs: AHORA - DIA, ahoraMs: AHORA });
    expect(j).toMatchObject({ texto: '', hastaMs: null, incluidos: 0, quedan: 0 });
  });
});
