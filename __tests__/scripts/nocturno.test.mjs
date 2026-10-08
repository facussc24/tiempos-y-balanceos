// @vitest-environment node
/**
 * Tests de scripts/_lib/nocturno.mjs — lo puro de la noche de Claude (scripts/_nocturno.mjs).
 *
 * La noche anterior se apago el 04/08/2026 despues de 47.522 timeouts y un fork bomb. Lo que se
 * prueba aca es lo que la hace distinta: el presupuesto en rojo frena ANTES de arrancar; un paso que
 * falla no tumba a los demas; el estado dice que paso en cada paso; la linea del tablero tiene la
 * forma acordada; la tarea de Windows se registra con StartWhenAvailable a las 06:30; ningun mail se
 * cae del resumen (se etiqueta el area, no se filtra).
 */
import { describe, it, expect } from 'vitest';
import * as N from '../../scripts/_lib/nocturno.mjs';

const verde = { mes: '2026-10', gastadoUsd: 12.3, presupuestoUsd: 100, porcentaje: 12.3, semaforo: 'verde' };
const rojo = { mes: '2026-10', gastadoUsd: 101, presupuestoUsd: 100, porcentaje: 101, semaforo: 'rojo' };

describe('nocturno · arranque y pasos', () => {
  it('presupuesto en rojo frena (salvo --sin-tope); verde y amarillo arrancan', () => {
    expect(N.debeArrancar(rojo)).toMatchObject({ ok: false, motivo: expect.stringMatching(/rojo/) });
    expect(N.debeArrancar(rojo, { sinTope: true }).ok).toBe(true);
    expect(N.debeArrancar(verde).ok).toBe(true);
    expect(N.debeArrancar({ ...verde, semaforo: 'amarillo' }).ok).toBe(true);
  });

  it('un paso con error no tumba a los demas, y su costo cuenta', async () => {
    const corridos = [];
    const pasos = await N.correrPasos([
      { nombre: 'preauditoria', correr: async () => { corridos.push(1); throw Object.assign(new Error('Supabase no contesto'), { costoUsd: 0.02 }); } },
      { nombre: 'mails', correr: async () => { corridos.push(2); return { detalle: '4 mails resumidos', costoUsd: 0.001, datos: [1] }; } },
      { nombre: 'novedades', correr: async () => { corridos.push(3); return { saltado: true, detalle: 'no tocaba' }; } },
    ]);
    expect(corridos).toEqual([1, 2, 3]);
    expect(pasos.map((p) => p.estado)).toEqual(['error', 'ok', 'saltado']);
    expect(pasos[0]).toMatchObject({ detalle: 'Supabase no contesto', costoUsd: 0.02 });
    expect(pasos[1].datos).toEqual([1]);
  });

  it('--solo corre uno y deja los otros como saltados', async () => {
    let corrio = 0;
    const pasos = await N.correrPasos(N.PASOS.map((nombre) => ({ nombre, correr: async () => { corrio++; return { detalle: nombre }; } })), { solo: 'mails' });
    expect(corrio).toBe(1);
    expect(pasos.map((p) => `${p.nombre}:${p.estado}`)).toEqual(['preauditoria:saltado', 'mails:ok', 'novedades:saltado']);
  });
});

describe('nocturno · estado y linea del tablero', () => {
  const fin = new Date(2026, 9, 8, 6, 31, 12);
  const pasos = [
    { nombre: 'preauditoria', estado: 'ok', detalle: 'pre-auditoría AMFE: 3 revisados · 2 hallazgos para verificar (1 nuevo)', costoUsd: 0.4 },
    { nombre: 'mails', estado: 'ok', detalle: '4 mails resumidos', costoUsd: 0.01 },
    { nombre: 'novedades', estado: 'ok', detalle: 'sin cambios', costoUsd: 0 },
  ];

  it('la linea tiene la forma acordada', () => {
    expect(N.lineaTablero({ fin, pasos, costoUsd: 0.41, presupuesto: verde }))
      .toBe('Noche 08/10 06:31 · pre-auditoría AMFE: 3 revisados · 2 hallazgos para verificar (1 nuevo) · 4 mails resumidos · novedades: sin cambios · $0,41 (mes $12,30 de $100, verde)');
  });

  it('un paso con error se ve en la linea; uno que no tocaba tambien', () => {
    const l = N.lineaTablero({ fin, pasos: [{ ...pasos[0], estado: 'error', detalle: 'HTTP 529' }, pasos[1], { nombre: 'novedades', estado: 'saltado', detalle: 'no tocaba' }], costoUsd: 0 });
    expect(l).toMatch(/pre-auditoría AMFE: ERROR \(HTTP 529\)/);
    expect(l).toMatch(/novedades: no tocaba/);
  });

  it('si no arranco, la linea lo dice', () => {
    expect(N.lineaTablero({ fin, noArranco: 'falta la clave de la API', presupuesto: verde })).toBe('Noche 08/10 06:31 · no arrancó: falta la clave de la API · $0,00 (mes $12,30 de $100, verde)');
  });

  it('el JSON de estado tiene fecha local, pasos, costo total, linea y lo que lee la manana', () => {
    const e = N.armarEstado({ inicio: new Date(2026, 9, 8, 6, 30, 0), fin, pasos, presupuesto: verde, mails: [{ asunto: 'x' }], hallazgos: { total: 2 }, reporte: 'reports/staging/PREAUDITORIA_AMFE_20261008.md' });
    expect(e).toMatchObject({ fecha: '2026-10-08', inicio: '2026-10-08 06:30:00', fin: '2026-10-08 06:31:12', costoUsd: 0.41, noArranco: null, hallazgos: { total: 2 } });
    expect(e.pasos).toHaveLength(3);
    expect(e.pasos[0]).toEqual({ nombre: 'preauditoria', estado: 'ok', detalle: pasos[0].detalle, costoUsd: 0.4 });
    expect(e.lineaTablero).toMatch(/^Noche 08\/10 06:31 · /);
    expect(JSON.parse(JSON.stringify(e))).toEqual(e);
    expect(N.edadHoras(e, fin.getTime() + 27 * 3600000)).toBe(27);
    expect(N.edadHoras({}, Date.now())).toBeNull();
  });
});

describe('nocturno · la tarea de Windows', () => {
  it('se registra diaria a las 06:30, con StartWhenAvailable, sin ventana y sin elevar', () => {
    const s = N.comandoAgendar({ raiz: 'C:\\Dev\\BarackMercosul' });
    expect(s).toMatch(/New-ScheduledTaskTrigger -Daily -At '06:30'/);
    expect(s).toMatch(/-StartWhenAvailable/);
    expect(s).toMatch(/-ExecutionTimeLimit \(New-TimeSpan -Hours 1\)/);
    expect(s).toMatch(/-MultipleInstances IgnoreNew/);
    expect(s).toMatch(/conhost\.exe/);
    expect(s).toMatch(/--headless powershell\.exe -NoProfile -ExecutionPolicy Bypass -File "C:\\Dev\\BarackMercosul\\scripts\\_nocturno\.ps1"/);
    expect(s).toMatch(/-LogonType Interactive -RunLevel Limited/);
    expect(s).toMatch(/Register-ScheduledTask -TaskName 'Barack - Noche de Claude \(API\)'/);
    expect(s).not.toMatch(/claude -p/);
  });

  it('una hora con otra forma o sin raiz no se agenda', () => {
    expect(() => N.comandoAgendar({ raiz: 'C:\\x', hora: '6:30am' })).toThrow(/hora invalida/);
    expect(() => N.comandoAgendar({})).toThrow(/raiz/);
  });

  it('leerEstadoTarea entiende las dos salidas', () => {
    expect(N.leerEstadoTarea('NO-AGENDADA\r\n')).toEqual({ agendada: false });
    expect(N.leerEstadoTarea('Ready|09/10 06:30|08/10 06:30|0')).toEqual({ agendada: true, estado: 'Ready', proxima: '09/10 06:30', ultima: '08/10 06:30', resultado: '0' });
    expect(N.comandoEstadoTarea()).toMatch(/Get-ScheduledTaskInfo/);
    expect(N.comandoDesagendar()).toMatch(/Unregister-ScheduledTask .* -Confirm:\$false/);
  });
});

describe('nocturno · mails sin respuesta', () => {
  const clave = (a) => String(a).toLowerCase().replace(/^(re|rv|fw):\s*/g, '').trim();
  const pedidos = [
    { asunto: 'RE: BOM IP Pad', de: 'Pablo', fecha: '2026-10-01 10:00', dias: 7, id: 'm2', hilo: 'bom ip pad' },
    { asunto: 'Codigos 21-9694', de: 'Leo', fecha: '2026-09-28 09:00', dias: 10, id: 'no-esta', hilo: 'codigos 21-9694' },
    { asunto: 'Planos nuevos', de: 'Carlos', fecha: '2026-10-02 09:00', dias: 6, id: '' },
  ];
  const mails = [
    { id: 'm1', asunto: 'BOM IP Pad', carpeta: 'f / Bandeja de entrada', fecha: '2026-09-30 10:00', cuerpo: 'viejo' },
    { id: 'm2', asunto: 'RE: BOM IP Pad', carpeta: 'f / Bandeja de entrada', fecha: '2026-10-01 10:00', cuerpo: 'el ultimo' },
    { id: 'm3', asunto: 'Codigos 21-9694', carpeta: 'f / Bandeja de entrada', fecha: '2026-09-28 09:00', cuerpo: 'por hilo' },
    { id: 'm4', asunto: 'RE: Codigos 21-9694', carpeta: 'f / Elementos enviados', fecha: '2026-09-29 09:00', cuerpo: 'de Fak, no cuenta' },
  ];

  it('elegirPedidos: hasta 12, en el orden de _mails.py', () => {
    expect(N.elegirPedidos(Array.from({ length: 20 }, (_, i) => ({ asunto: `a${i}` })))).toHaveLength(N.TOPE_MAILS);
    expect(N.elegirPedidos(null)).toEqual([]);
  });

  it('emparejarMails: por id; si no esta, el mas nuevo de la Bandeja del mismo hilo; si no hay, null', () => {
    const pares = N.emparejarMails(pedidos, mails, clave);
    expect(pares.map((p) => p.mail?.cuerpo ?? null)).toEqual(['el ultimo', 'por hilo', null]);
  });

  it('recortarCuerpo usa el cuerpo propio y corta en el tope', () => {
    const propio = (t) => t.split('\nDe:')[0];
    expect(N.recortarCuerpo('pedido\n\n\n\nfin\nDe: otro', propio)).toBe('pedido\n\nfin');
    expect(N.recortarCuerpo('x'.repeat(2000), (t) => t)).toHaveLength(N.TOPE_CUERPO + 1);
  });

  it('el pedido a Haiku numera cada mail y avisa cuando no hay cuerpo', () => {
    const { usuario, schema } = N.armarPedidoMails([{ pedido: pedidos[0], cuerpo: 'hola' }, { pedido: pedidos[2], cuerpo: '' }]);
    expect(usuario).toMatch(/### 1\. asunto: RE: BOM IP Pad/);
    expect(usuario).toMatch(/### 2\. asunto: Planos nuevos[\s\S]*no está en el cache/);
    expect(schema.properties.lineas.items.properties.area.enum).toEqual(['ingenieria', 'calidad', 'logistica', 'otra']);
    expect(N.SYSTEM_MAILS).toMatch(/Se etiqueta, no se filtra/);
  });

  it('lineasDeMails: ningun pedido se cae; el que el modelo salteo queda "sin resumen"; area invalida -> otra', () => {
    const lineas = N.lineasDeMails(pedidos, { lineas: [
      { asunto: 'RE: BOM IP Pad', linea: 'pide la BOM del IP Pad actualizada', area: 'ingenieria' },
      { asunto: 'Planos nuevos', linea: 'x'.repeat(200), area: 'compras' },
    ] });
    expect(lineas).toHaveLength(3);
    expect(lineas[0]).toMatchObject({ asunto: 'RE: BOM IP Pad', linea: 'pide la BOM del IP Pad actualizada', area: 'ingenieria', dias: 7 });
    expect(lineas[1].linea).toMatch(/^\(sin resumen/);
    expect(lineas[2].area).toBe('otra');
    expect(lineas[2].linea.length).toBeLessThanOrEqual(120);
    expect(N.lineasDeMails(pedidos, null).every((l) => /^\(sin resumen/.test(l.linea))).toBe(true);
  });
});

describe('nocturno · novedades', () => {
  it('toca los lunes o cuando el aviso semanal dice que paso una semana', () => {
    expect(N.tocaNovedades(new Date(2026, 9, 5), '')).toBe(true);        // lunes 05/10
    expect(N.tocaNovedades(new Date(2026, 9, 8), '')).toBe(false);       // jueves
    expect(N.tocaNovedades(new Date(2026, 9, 8), '[NOVEDADES DE CLAUDE] Pasaron 8 dias')).toBe(true);
  });

  it('un listado sin posteos ni versiones nuevas no vale una llamada', () => {
    expect(N.novedadesSinCambios('# Novedades\n\n## @trq212\n\nSin posteos nuevos desde el 2026-10-01.\n\n## Registro\n\nSin versiones nuevas desde la 2.1.289.\n')).toBe(true);
    expect(N.novedadesSinCambios('## @trq212\n\n- **2026-10-07 10:00 UTC** · 12 me gusta · posteo · https://x.com/1\n')).toBe(false);
    expect(N.novedadesSinCambios('## Registro\n\n### 2.1.293\n- arreglo\n')).toBe(false);
  });
});
