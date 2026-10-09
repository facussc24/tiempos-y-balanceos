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
    expect(pasos.map((p) => `${p.nombre}:${p.estado}`)).toEqual(['preauditoria:saltado', 'mails:ok', 'prioridades:saltado', 'novedades:saltado']);
  });

  it('el orden de la noche: prioridades va despues de mails (usa lo que dejo)', () => {
    expect(N.PASOS).toEqual(['preauditoria', 'mails', 'prioridades', 'novedades']);
  });
});

describe('nocturno · los dos cortes de la noche (tope por corrida y pasos sin resultado)', () => {
  const paso = (nombre, costoUsd, extra = {}, corridos = []) => ({
    nombre,
    correr: async () => { corridos.push(nombre); if (extra.tira) throw Object.assign(new Error(extra.tira), { costoUsd }); return { detalle: `${nombre} hecho`, costoUsd, ...extra }; },
  });

  it('ROJO: lo gastado en la corrida supera el tope -> los pasos que faltan quedan "saltado" con el motivo, y no se ejecutan', async () => {
    const corridos = [];
    const pasos = await N.correrPasos([paso('preauditoria', 5, {}, corridos), paso('mails', 4, {}, corridos), paso('prioridades', 1, {}, corridos), paso('novedades', 1, {}, corridos)], { topeCorridaUsd: 8 });
    expect(corridos).toEqual(['preauditoria', 'mails']);                         // 5 + 4 = 9 > 8: no arranca el tercero
    expect(pasos.map((p) => p.estado)).toEqual(['ok', 'ok', 'saltado', 'saltado']);
    expect(pasos[2]).toMatchObject({ detalle: 'tope por corrida ($9,00 de $8)', corte: 'tope_corrida', costoUsd: 0 });
    expect(pasos[3].corte).toBe('tope_corrida');
  });

  it('VERDE: justo en el tope no corta (supera = mas que), con tope mas alto corren todos y sin tope (--sin-tope) tambien', async () => {
    for (const opciones of [{ topeCorridaUsd: 9 }, { topeCorridaUsd: 20 }, { topeCorridaUsd: null }, {}]) {
      const corridos = [];
      const pasos = await N.correrPasos([paso('a', 5, {}, corridos), paso('b', 4, {}, corridos), paso('c', 3, {}, corridos)], opciones);
      expect(corridos, JSON.stringify(opciones)).toEqual(['a', 'b', 'c']);
      expect(pasos.some((p) => p.corte)).toBe(false);
    }
  });

  it('el costo de un paso que FALLO tambien cuenta para el tope (se cobro)', async () => {
    const corridos = [];
    const pasos = await N.correrPasos([paso('a', 9, { tira: 'se corto' }, corridos), paso('b', 1, {}, corridos)], { topeCorridaUsd: 8 });
    expect(pasos.map((p) => p.estado)).toEqual(['error', 'saltado']);
    expect(corridos).toEqual(['a']);
    expect(pasos[1].corte).toBe('tope_corrida');
  });

  it('ROJO: tres pasos seguidos en error frenan la noche; los que faltan quedan "saltado" y se anota', async () => {
    const corridos = [];
    const pasos = await N.correrPasos([
      paso('preauditoria', 0, { tira: 'sin red' }, corridos), paso('mails', 0, { tira: 'sin red' }, corridos),
      paso('prioridades', 0, { tira: 'sin red' }, corridos), paso('novedades', 0, {}, corridos),
    ]);
    expect(corridos).toEqual(['preauditoria', 'mails', 'prioridades']);
    expect(pasos.map((p) => p.estado)).toEqual(['error', 'error', 'error', 'saltado']);
    expect(pasos[2].corte).toBe('errores_seguidos');                       // el tercero es el que dispara el corte
    expect(pasos[3]).toMatchObject({ corte: 'errores_seguidos', detalle: '3 pasos seguidos en error: se frena la noche' });
  });

  it('VERDE: un paso que anduvo en el medio reinicia la cuenta (error, ok, error, error no corta)', async () => {
    const corridos = [];
    const pasos = await N.correrPasos([
      paso('a', 0, { tira: 'x' }, corridos), paso('b', 0, {}, corridos), paso('c', 0, { tira: 'x' }, corridos), paso('d', 0, { tira: 'x' }, corridos), paso('e', 0, {}, corridos),
    ]);
    expect(corridos).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(pasos.some((p) => p.corte)).toBe(false);
  });

  it('un paso saltado ("no tocaba") ni suma ni reinicia: error, saltado, error, error corta', async () => {
    const corridos = [];
    const pasos = await N.correrPasos([
      paso('a', 0, { tira: 'x' }, corridos), paso('b', 0, { saltado: true }, corridos), paso('c', 0, { tira: 'x' }, corridos),
      paso('d', 0, { tira: 'x' }, corridos), paso('e', 0, {}, corridos),
    ]);
    expect(corridos).toEqual(['a', 'b', 'c', 'd']);
    expect(pasos[4]).toMatchObject({ estado: 'saltado', corte: 'errores_seguidos' });
  });

  it('con --solo los pasos que no se pidieron no cuentan como cortes ni como errores', async () => {
    const corridos = [];
    const pasos = await N.correrPasos([paso('a', 0, { tira: 'x' }, corridos), paso('b', 0, {}, corridos)], { solo: 'b', topeCorridaUsd: 0.0001 });
    expect(corridos).toEqual(['b']);
    expect(pasos.map((p) => p.corte)).toEqual([undefined, undefined]);
  });

  it('la linea del tablero y el JSON de estado anotan el corte', () => {
    const fin = new Date(2026, 9, 8, 6, 31, 12);
    const pasos = [
      { nombre: 'preauditoria', estado: 'ok', detalle: 'pre-auditoría AMFE: 6 revisados', costoUsd: 9 },
      { nombre: 'mails', estado: 'saltado', detalle: 'tope por corrida ($9,00 de $8)', costoUsd: 0, corte: 'tope_corrida', corteDetalle: 'tope por corrida ($9,00 de $8)' },
      { nombre: 'novedades', estado: 'saltado', detalle: 'tope por corrida ($9,00 de $8)', costoUsd: 0, corte: 'tope_corrida', corteDetalle: 'tope por corrida ($9,00 de $8)' },
    ];
    const linea = N.lineaTablero({ fin, pasos, costoUsd: 9, presupuesto: verde });
    expect(linea).toMatch(/ · CORTADA: tope por corrida \(\$9,00 de \$8\) · \$9,00 \(mes/);
    expect(linea).not.toMatch(/novedades: no tocaba/);
    const e = N.armarEstado({ inicio: fin, fin, pasos, presupuesto: verde });
    expect(e.corte).toEqual({ motivo: 'tope_corrida', detalle: 'tope por corrida ($9,00 de $8)' });
    expect(e.pasos[1].corte).toBe('tope_corrida');
    expect(N.armarEstado({ inicio: fin, fin, pasos: [{ nombre: 'mails', estado: 'ok', detalle: 'x', costoUsd: 0 }], presupuesto: verde }).corte).toBeNull();
  });

  it('el presupuesto del ciclo en rojo nombra el ciclo', () => {
    const r = N.debeArrancar({ ...rojo, ciclo: { texto: 'ciclo del 07/09 al 06/10' } });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/del ciclo en rojo \(ciclo del 07\/09 al 06\/10\): \$101\.00 de \$100/);
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

describe('nocturno · novedades todos los dias (Haiku) y el lunes largo (Sonnet)', () => {
  const lunes = new Date(2026, 9, 5, 6, 30);
  const jueves = new Date(2026, 9, 8, 6, 30);
  const CON_POSTEO = '## @trq212\n\n- **2026-10-07 10:00 UTC** · 12 me gusta · posteo · https://x.com/1\n';
  const SIN_NADA = '# Novedades\n\n## @trq212\n\nSin posteos nuevos desde el 2026-10-01.\n\n## Registro\n\nSin versiones nuevas desde la 2.1.289.\n';

  it('el plan: sin nada nuevo se salta; con algo, Haiku low de martes a domingo y Sonnet medium el lunes', () => {
    expect(N.planNovedades(jueves, '', false)).toMatchObject({ accion: 'saltar' });
    expect(N.planNovedades(lunes, '', false)).toMatchObject({ accion: 'saltar' });
    expect(N.planNovedades(jueves, '', true)).toMatchObject({ accion: 'haiku', modelo: 'haiku', effort: 'low', largo: false, tarea: 'nocturno:novedades-diario' });
    expect(N.planNovedades(lunes, '', true)).toMatchObject({ accion: 'sonnet', modelo: 'sonnet', effort: 'medium', largo: true, tarea: 'nocturno:novedades' });
    // pasada una semana sin lectura completa, tambien el largo aunque no sea lunes
    expect(N.planNovedades(jueves, '[NOVEDADES DE CLAUDE] Pasaron 8 dias', true).accion).toBe('sonnet');
    expect(N.planNovedades(jueves, '', true).system).toBe(N.SYSTEM_NOVEDADES_DIARIO);
    expect(N.planNovedades(lunes, '', true).system).toBe(N.SYSTEM_NOVEDADES);
    expect(N.SYSTEM_NOVEDADES_DIARIO).toMatch(/como mucho 4 renglones/);
    expect(N.SYSTEM_NOVEDADES).toMatch(/como mucho 8 renglones/);
  });

  it('resumirNovedades: un dia comun llama a Haiku low; el lunes a Sonnet; sin cambios no llama a nadie', async () => {
    const llamadas = [];
    const llamarModelo = async (o) => { llamadas.push(o); return { texto: '- nos sirve: algo — https://x.com/1', costoUsd: 0.004 }; };
    const diario = await N.resumirNovedades({ plan: N.planNovedades(jueves, '', true), texto: CON_POSTEO, llamarModelo });
    expect(diario).toMatchObject({ llamo: true, modelo: 'haiku', costoUsd: 0.004 });
    expect(llamadas[0]).toMatchObject({ modelo: 'haiku', effort: 'low', usuario: CON_POSTEO, tarea: 'nocturno:novedades-diario' });
    await N.resumirNovedades({ plan: N.planNovedades(lunes, '', true), texto: CON_POSTEO, llamarModelo });
    expect(llamadas[1]).toMatchObject({ modelo: 'sonnet', effort: 'medium', tarea: 'nocturno:novedades' });
    const sin = await N.resumirNovedades({ plan: N.planNovedades(jueves, '', !N.novedadesSinCambios(SIN_NADA)), texto: SIN_NADA, llamarModelo });
    expect(sin).toMatchObject({ llamo: false, resumen: null });
    expect(llamadas).toHaveLength(2);
  });

  it('un resumen vacio es un error con el costo adentro, no un "sin novedades" mudo', async () => {
    await expect(N.resumirNovedades({ plan: N.planNovedades(jueves, '', true), texto: CON_POSTEO, llamarModelo: async () => ({ texto: '  ', costoUsd: 0.002 }) }))
      .rejects.toMatchObject({ costoUsd: 0.002, message: expect.stringMatching(/vacio/) });
  });

  it('juntarListados: el lunes lee la semana (la lectura diaria deja un dia por archivo), sin los que no traen nada ni los de hace mas de 7 dias', () => {
    const ahoraMs = lunes.getTime();
    const dia = (n) => ahoraMs - n * 86400000;
    const juntos = N.juntarListados([
      { f: 'novedades_2026-10-05_0930.md', ms: dia(0), texto: '## @a\n\n- **2026-10-05** · posteo · https://x.com/hoy\n' },
      { f: 'novedades_2026-10-04_0930.md', ms: dia(1), texto: SIN_NADA },
      { f: 'novedades_2026-10-02_0930.md', ms: dia(3), texto: '## @b\n\n- **2026-10-02** · posteo · https://x.com/viernes\n' },
      { f: 'novedades_2026-09-20_0930.md', ms: dia(15), texto: '## @c\n\n- **2026-09-20** · posteo · https://x.com/viejo\n' },
    ], { ahoraMs });
    expect(juntos).toMatch(/x\.com\/hoy/);
    expect(juntos).toMatch(/x\.com\/viernes/);
    expect(juntos).not.toMatch(/x\.com\/viejo/);
    expect(juntos.indexOf('x.com/hoy')).toBeLessThan(juntos.indexOf('x.com/viernes'));       // el mas nuevo primero
    expect(juntos).not.toMatch(/Sin posteos nuevos/);
    // una semana sin nada nuevo -> vacio -> el plan salta
    expect(N.juntarListados([{ f: 'x', ms: dia(0), texto: SIN_NADA }], { ahoraMs })).toBe('');
    expect(N.novedadesSinCambios('')).toBe(true);
    expect(N.juntarListados(null)).toBe('');
  });

  it('juntarListados corta por el tope de caracteres dejando afuera lo mas viejo, pero siempre entra el mas nuevo', () => {
    const ahoraMs = lunes.getTime();
    const largo = (marca) => `## @a\n\n- **2026-10-05** · posteo · https://x.com/${marca}\n${'x'.repeat(500)}\n`;
    const juntos = N.juntarListados([
      { f: 'a', ms: ahoraMs, texto: largo('nuevo') }, { f: 'b', ms: ahoraMs - 1000, texto: largo('medio') }, { f: 'c', ms: ahoraMs - 2000, texto: largo('viejo') },
    ], { ahoraMs, tope: 1300 });
    expect(juntos).toMatch(/nuevo/);
    expect(juntos).toMatch(/medio/);
    expect(juntos).not.toMatch(/viejo/);
    expect(N.juntarListados([{ f: 'a', ms: ahoraMs, texto: largo('solo') }], { ahoraMs, tope: 10 })).toMatch(/solo/);
  });
});

describe('nocturno · prioridades del dia (4 renglones con fuente)', () => {
  const HOOK = [
    '[SEGUIMIENTOS CON FECHA — Fak, 02/10/2026: "no me puedo olvidar de esto". Detalle: memoria project_seguimientos_con_fecha]',
    '- reunion-amfe-calidad: Reunion de AMFE con Calidad. 2 pedido(s) enviados, el ultimo el lunes 05/10; se insiste el viernes 09/10. Se cierra cuando: confirman dia y hora.',
  ].join('\n');
  const cruce = [{ nombre: 'Consumo Sika Top Roll', enEspera: false, desde: new Date(2026, 9, 7).getTime(), nuevos: [{ fecha: '2026-10-08 09:10', de: 'Carlos Baptista', asunto: 'RE: consumo Sika', carpeta: 'f / Bandeja de entrada' }] }];
  const carpetas = [{ nombre: 'BOM IP Pad', dias: 6, enEspera: false }, { nombre: 'Tiempos P21', dias: 40, enEspera: true }];
  const mails = [{ asunto: 'Planos nuevos', de: 'Carlos', dias: 6, estado: 'sin respuesta', linea: 'pide revisar los planos del Upper Trim', area: 'ingenieria' }];
  const fuentes = { seguimientos: () => HOOK, hilos: () => cruce, escritorio: () => carpetas };

  it('reunirEntradas: arma la lista cerrada de fuentes, una por cosa que ya existe', () => {
    const { entradas, avisos } = N.reunirEntradas({ fuentes, mails, pasos: [{ nombre: 'preauditoria', estado: 'ok', detalle: 'x' }], hallazgos: { total: 2, nuevos: 1 } });
    expect(avisos).toEqual([]);
    expect(entradas.map((e) => e.fuente)).toEqual([
      'seguimiento:reunion-amfe-calidad', 'hilo:Consumo Sika Top Roll', 'mail:Planos nuevos', 'escritorio:BOM IP Pad', 'escritorio:Tiempos P21', 'noche:preauditoria',
    ]);
    expect(entradas[0].texto).toMatch(/se insiste el viernes 09\/10/);
    expect(entradas[1].texto).toMatch(/1 mail nuevo del mismo hilo desde el 07\/10.*Carlos Baptista.*RE: consumo Sika/);
    expect(entradas[4].texto).toMatch(/_EN ESPERA/);
    expect(entradas[3].texto).toMatch(/hace 6 días/);
  });

  it('una fuente de datos que falla no tumba a las otras: queda en los avisos; lo que no se pudo leer de seguimientos tambien es una entrada', () => {
    const { entradas, avisos } = N.reunirEntradas({ fuentes: { seguimientos: () => { throw new Error('no existe la memoria'); }, hilos: () => cruce, escritorio: () => { throw new Error('OneDrive no contesta'); } }, mails: [] });
    expect(entradas.map((e) => e.fuente)).toEqual(['hilo:Consumo Sika Top Roll']);
    expect(avisos).toHaveLength(2);
    expect(avisos.join(' ')).toMatch(/seguimientos: no existe la memoria/);
    const roto = N.reunirEntradas({ fuentes: { seguimientos: () => '[SEGUIMIENTOS CON FECHA] NO SE PUDO LEER la memoria: x' } }).entradas;
    expect(roto.map((e) => e.fuente)).toEqual(['noche:seguimientos']);
  });

  it('dos mails con el mismo asunto quedan en una sola entrada', () => {
    const { entradas } = N.reunirEntradas({ mails: [...mails, { ...mails[0], asunto: '  planos NUEVOS ' }] });
    expect(entradas).toHaveLength(1);
  });

  it('un paso de la noche que fallo es una entrada; la pre-auditoria sin hallazgos no', () => {
    const { entradas } = N.reunirEntradas({ pasos: [{ nombre: 'mails', estado: 'error', detalle: 'HTTP 529' }, { nombre: 'preauditoria', estado: 'ok', detalle: 'x' }], hallazgos: { total: 0, nuevos: 0 } });
    expect(entradas.map((e) => e.fuente)).toEqual(['noche:mails']);
  });

  const entradas = N.reunirEntradas({ fuentes, mails }).entradas;
  const llamarCon = (renglones, registro = []) => async (o) => { registro.push(o); return { json: { renglones }, costoUsd: 0.03 }; };

  it('ROJO: un renglon cuya fuente no esta en la entrada se descarta; el que la copia distinta de mayusculas se queda con la del codigo', async () => {
    const r = await N.generarPrioridades({ entradas, fecha: 'jueves 08/10/2026', llamarModelo: llamarCon([
      { fuente: 'seguimiento:reunion-amfe-calidad', texto: 'Insistir hoy con Calidad por el dia de la reunion', porque: 'hoy toca insistir' },
      { fuente: 'mail:Una propuesta que nadie mando', texto: 'Contestar a alguien', porque: 'invento' },
      { fuente: 'HILO:consumo sika top roll', texto: 'Mirar el mail nuevo de Carlos', porque: 'respuesta nueva' },
      { fuente: 'escritorio:Carpeta fantasma', texto: 'Cerrarla', porque: 'x' },
    ]) });
    expect(r.renglones.map((x) => x.fuente)).toEqual(['seguimiento:reunion-amfe-calidad', 'hilo:Consumo Sika Top Roll']);
    expect(r.descartados).toEqual([
      { fuente: 'mail:Una propuesta que nadie mando', motivo: 'su fuente no estaba en la entrada' },
      { fuente: 'escritorio:Carpeta fantasma', motivo: 'su fuente no estaba en la entrada' },
    ]);
    expect(r.detalle).toBe('2 renglones de 5 entradas (2 descartados por el código)');
  });

  it('VERDE: pasan hasta 4; el repetido, el que viene sin texto y el que pasa el tope se descartan', () => {
    const buenos = entradas.map((e) => ({ fuente: e.fuente, texto: `hacer ${e.fuente}`, porque: 'hoy' }));
    const tope = N.filtrarRenglones({ renglones: buenos }, entradas);
    expect(tope.renglones).toHaveLength(N.TOPE_PRIORIDADES);
    expect(tope.descartados).toEqual([{ fuente: entradas[4].fuente, motivo: 'pasaba el tope de 4' }]);
    const raros = N.filtrarRenglones({ renglones: [buenos[0], { ...buenos[0], texto: 'otra vez' }, { ...buenos[1], texto: '   ' }, buenos[2]] }, entradas);
    expect(raros.renglones.map((r) => r.fuente)).toEqual([entradas[0].fuente, entradas[2].fuente]);
    expect(raros.descartados.map((d) => d.motivo)).toEqual(['fuente repetida', 'sin texto']);
    expect(N.filtrarRenglones(null, entradas)).toEqual({ renglones: [], descartados: [] });
  });

  it('sin entradas NO se llama al modelo', async () => {
    const registro = [];
    const r = await N.generarPrioridades({ entradas: [], llamarModelo: llamarCon([{ fuente: 'x', texto: 'y', porque: 'z' }], registro) });
    expect(registro).toHaveLength(0);
    expect(r).toMatchObject({ llamo: false, renglones: [], costoUsd: 0, detalle: '0 entradas: no se llamó al modelo' });
  });

  it('el pedido: Sonnet medium, la lista cerrada de fuentes en el esquema (enum) y en el texto', async () => {
    const registro = [];
    await N.generarPrioridades({ entradas, fecha: 'jueves 08/10/2026', llamarModelo: llamarCon([], registro) });
    expect(registro[0]).toMatchObject({ modelo: 'sonnet', effort: 'medium', tarea: 'nocturno:prioridades', maxTokens: 8000 });
    expect(registro[0].schema.properties.renglones.items.properties.fuente.enum).toEqual(entradas.map((e) => e.fuente));
    expect(registro[0].usuario).toMatch(/Hoy es jueves 08\/10\/2026/);
    expect(registro[0].usuario).toMatch(/\[seguimiento:reunion-amfe-calidad\] Reunion de AMFE/);
    expect(N.SYSTEM_PRIORIDADES).toMatch(/copiada EXACTA/);
  });

  it('una respuesta sin la lista "renglones" es un error con el costo adentro', async () => {
    await expect(N.generarPrioridades({ entradas, llamarModelo: async () => ({ json: {}, costoUsd: 0.02 }) })).rejects.toMatchObject({ costoUsd: 0.02 });
  });

  it('el archivo dice para quien es y cada renglon sale como "1. [fuente] que hacer · por que hoy"', () => {
    const renglones = [{ fuente: 'seguimiento:reunion-amfe-calidad', texto: 'Insistir con Calidad', porque: 'hoy toca insistir' }, { fuente: 'mail:Planos nuevos', texto: 'Mirar los planos', porque: '' }];
    expect(N.lineaRenglon(renglones[0], 0)).toBe('1. [seguimiento:reunion-amfe-calidad] Insistir con Calidad · hoy toca insistir');
    expect(N.lineaRenglon(renglones[1], 1)).toBe('2. [mail:Planos nuevos] Mirar los planos');
    const md = N.textoPrioridades({ renglones, descartados: [{ fuente: 'x', motivo: 'su fuente no estaba en la entrada' }], fecha: '08/10/2026 06:31', avisos: ['Escritorio: OneDrive no contesta'] });
    expect(md).toMatch(/no para Fak/);
    expect(md).toMatch(/^1\. \[seguimiento:reunion-amfe-calidad\]/m);
    expect(md).toMatch(/Descartados por el código: 1/);
    expect(md).toMatch(/Fuentes que no se pudieron leer: Escritorio/);
    expect(N.textoPrioridades({ renglones: [], fecha: 'x' })).toMatch(/Sin prioridades esta noche/);
  });

  it('la linea del tablero suma "prioridades: N" despues de mails; el JSON guarda los renglones; sin el paso la linea no cambia', () => {
    const fin = new Date(2026, 9, 8, 6, 31, 12);
    const pasos = [
      { nombre: 'preauditoria', estado: 'ok', detalle: 'pre-auditoría AMFE: 3 revisados', costoUsd: 0.4 },
      { nombre: 'mails', estado: 'ok', detalle: '4 mails resumidos', costoUsd: 0.01 },
      { nombre: 'prioridades', estado: 'ok', detalle: '4 renglones de 12 entradas', costoUsd: 0.03 },
      { nombre: 'novedades', estado: 'ok', detalle: 'sin cambios', costoUsd: 0 },
    ];
    const prioridades = [1, 2, 3, 4].map((i) => ({ fuente: `mail:${i}`, texto: 't', porque: 'p' }));
    expect(N.lineaTablero({ fin, pasos, costoUsd: 0.44, presupuesto: verde, prioridades }))
      .toBe('Noche 08/10 06:31 · pre-auditoría AMFE: 3 revisados · 4 mails resumidos · prioridades: 4 · novedades: sin cambios · $0,44 (mes $12,30 de $100, verde)');
    expect(N.lineaTablero({ fin, pasos: pasos.filter((p) => p.nombre !== 'prioridades'), costoUsd: 0.41, presupuesto: verde }))
      .toBe('Noche 08/10 06:31 · pre-auditoría AMFE: 3 revisados · 4 mails resumidos · novedades: sin cambios · $0,41 (mes $12,30 de $100, verde)');
    expect(N.lineaTablero({ fin, pasos: [{ ...pasos[2], estado: 'error', detalle: 'HTTP 529' }], presupuesto: verde })).toMatch(/prioridades: ERROR \(HTTP 529\)/);
    const e = N.armarEstado({ inicio: fin, fin, pasos, presupuesto: verde, prioridades });
    expect(e.prioridades).toEqual(prioridades);
    expect(e.lineaTablero).toMatch(/prioridades: 4/);
    expect(N.armarEstado({ inicio: fin, fin, pasos: [], presupuesto: verde }).prioridades).toEqual([]);
  });
});
