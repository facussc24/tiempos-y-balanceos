/**
 * Tests del aviso de ORDEN del cierre (cola H5, 10/10/2026) — scripts/_lib/cierreGuard.mjs, `evaluarOrdenCierre`.
 *
 * La regla (CLAUDE.md): el cierre de una tarea empieza por lo que necesito de Fak, despues que cambio y despues que
 * encontre; con un entregable, su ruta va primero. Es un AVISO adentro del chequeo 5, no un freno nuevo (Fak, 09/10:
 * "me preocupa que tenga muchos bloqueantes"). Por eso aca se prueban TRES cosas:
 *   1. la medicion, en las dos direcciones, con las frases de los cierres reales (canon `cierre_orden`);
 *   2. que el aviso viaja en el freno del chequeo 5 cuando ese freno ya salia;
 *   3. que NO hay freno nuevo: un cierre corto pasa igual, ordenado o no.
 */
import { describe, it, expect } from 'vitest';
import { evaluarOrdenCierre, evaluarPermiso, decidir, CANON } from '../../scripts/_lib/cierreGuard.mjs';

// Frases de cierres reales (sesion + donde estaban), medidas el 10/10/2026.
const ENTERRADOS = [
  ['c66e2969 — "Que necesito de vos" en el parrafo 3 de 5',
    'Quedó publicada la versión 23 del asistente de área.\n\nCambié el instalador y el vigía.\n\n**Qué necesito de vos**\n1. ¿Corrijo el examen con los 16 jueces? Contestame sí o no.\n\nEl examen corre en la PC de prueba.\n\nListo lo demás.'],
  ['c66e2969 — "Una sola cosa necesito que decidas" al final',
    'El instalador quedó probado en las tres PC.\n\nEncontré dos avisos que se repetían.\n\nUna sola cosa necesito que decidas, porque cambia una regla que vos pusiste.'],
  ['f90bdf36 — "Falta tu OK" en el segundo parrafo, sin ruta adelante',
    'Los 2 AMFE y los 2 planes de control quedaron revisados impresos.\n\nEl cambio está listo y probado, pero todavía no escribí nada. Falta tu OK.'],
  ['43d58ff6 — "una decision tuya" en el parrafo 3',
    'Cerré los cuatro puntos de la lista.\n\nEl build pasa.\n\nLo que sigue abierto depende de otros o de una decisión tuya:\n- el número de HO.'],
  ['c66e2969 — "Sigue pendiente de tu lado" al final',
    'La grabación terminó.\n\nSubí los videos a la nube.\n\nSigue pendiente de tu lado:\n1. Tu «estoy» cuando estés frente a la notebook.'],
];

const AL_INICIO = [
  ['arranca por lo que necesita',
    '**Lo que necesito de vos:** el número de HO del hotmelt.\n\nQué cambió: la hoja 3 y la portada.\n\nQué encontré: la foto del paso 4 era de otra pieza.'],
  ['la ruta del entregable primero y enseguida lo que necesita',
    'Quedó en C:\\Users\\x\\Desktop\\tarea\\informe.pdf\n\nDe vos necesito el número de plano del dispositivo.\n\nQué cambió: las cotas de la hoja 2.'],
  ['la ruta y lo que necesita en el mismo primer parrafo',
    'Quedó en `exports/HO_991/HO-991.pptx`. Falta tu OK para escribir la fila en el listado maestro: va en la pestaña INDICE, ¿está bien?\n\nQué cambió: dos pasos.'],
];

const SIN_NADA = [
  ['dice que no necesita nada (y despues nombra una decision que no hizo falta)',
    'De vos no necesito nada.\n\nQué cambió: el canon del cierre.\n\nQué encontré: una decisión tuya del 22/09 ya lo cubría.'],
  ['un cierre comun, que no pide nada',
    'Todo pusheado (`13135b4e`), árbol limpio, discos montados.\n\nEl mail sigue en Borradores, sin enviar.'],
  ['"necesito que" de otra cosa, no de Fak (0e101d1f: falso positivo sacado del canon)',
    'Subí la carpeta.\n\nPara ponerle el permiso necesito que esa carpeta ya esté en la nube.\n\nListo lo demás.'],
];

describe('evaluarOrdenCierre · mide donde esta lo que necesito de Fak', () => {
  it.each(ENTERRADOS)('AVISA: %s', (_, texto) => {
    const r = evaluarOrdenCierre(texto);
    expect(r).toMatchObject({ necesita: true, alInicio: false, aviso: true });
    expect(r.parrafo).toBeGreaterThan(1);
  });

  it.each(AL_INICIO)('NO avisa: %s', (_, texto) => {
    expect(evaluarOrdenCierre(texto)).toMatchObject({ necesita: true, alInicio: true, aviso: false });
  });

  it.each(SIN_NADA)('NO avisa: %s', (_, texto) => {
    expect(evaluarOrdenCierre(texto)).toMatchObject({ necesita: false, aviso: false });
  });

  it('la ruta adelante da un parrafo de gracia, no dos', () => {
    const r = evaluarOrdenCierre('Quedó en C:\\Users\\x\\Desktop\\tarea\\informe.pdf\n\nQué cambió: la hoja 2.\n\nDe vos necesito el número de plano.');
    expect(r).toMatchObject({ necesita: true, aviso: true, parrafo: 3 });
  });

  // Lo que encontro el auditor el 10/10 (negacion, decision ya tomada, "nada" al final, titulo o ruta relativa adelante).
  it.each([
    ['la negacion no es un pedido', 'Cambié la hoja 3.\n\nNo hace falta tu OK para esto.'],
    ['una decision que Fak ya tomo', 'Cambié la hoja 3.\n\nSeguí la decisión tuya del 05/10.'],
    ['"De vos no necesito nada" al FINAL tambien vale', 'Cambié la hoja 3.\n\nEncontré una foto de otra pieza. Una decisión tuya no hizo falta.\n\nDe vos no necesito nada.'],
    ['"tenes que decidir" se saco del canon (c66e2969: texto que no pedia nada)', 'Cambié la hoja 3.\n\nSi mañana tenés que decidir entre las dos, la tabla está en la hoja 2.'],
  ])('NO avisa: %s', (_, texto) => {
    expect(evaluarOrdenCierre(texto).aviso).toBe(false);
  });

  it.each([
    ['un titulo solo adelante no corre el inicio', '## Cierre\n\nDe vos necesito el número de HO.\n\nQué cambió: la hoja 3.'],
    ['la ruta RELATIVA del entregable adelante', 'Quedó en exports/HO_991/HO-991.pptx\n\nFalta tu OK para la fila del listado.\n\nQué cambió: dos pasos.'],
    ['con fin de linea de Windows', '**Qué necesito de vos:** el número.\r\n\r\nQué cambió: la hoja 3.'],
  ])('NO avisa, esta al inicio: %s', (_, texto) => {
    expect(evaluarOrdenCierre(texto)).toMatchObject({ necesita: true, aviso: false });
  });

  it('con fin de linea de Windows, enterrado, AVISA igual', () => {
    expect(evaluarOrdenCierre('Cambié la hoja 3.\r\n\r\nEncontré una foto.\r\n\r\nFalta tu OK.')).toMatchObject({ aviso: true, parrafo: 3 });
  });

  it('vacio o sin texto no rompe', () => {
    expect(evaluarOrdenCierre('')).toMatchObject({ aviso: false });
    expect(evaluarOrdenCierre(undefined)).toMatchObject({ aviso: false });
  });

  it('cada frase del canon trae su fuente (ninguna a ojo)', () => {
    for (const p of CANON.cierre_orden.necesito_re) expect(String(p.fuente || '').length).toBeGreaterThan(10);
  });
});

describe('cierre-guard · el aviso de orden viaja en el chequeo 5 y NO agrega un freno', () => {
  const deps = (extra = {}) => ({
    fueraEnEsteTurno: async () => ({ fuera: false, ultimoMensajeFak: 'dale, cerralo' }),
    pendientes: () => [], enCooldown: () => false, marcar: () => {}, yaReclamado: () => false, reclamar: () => {},
    exportsDelTurno: () => [], ...extra,
  });
  const relleno = Array.from({ length: 40 }, (_, i) => `- Punto ${i + 1}: ${'detalle '.repeat(10)}`).join('\n');

  it('informe largo con lo que necesito ENTERRADO: el freno del chequeo 5 (que ya salia) trae el aviso', async () => {
    const texto = `Qué cambió:\n\n${relleno}\n\n**Qué necesito de vos**\n1. El número de HO.\n\nTodo commiteado y pusheado.`;
    const r = await decidir({ session_id: 's-orden', last_assistant_message: texto }, deps());
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/informe/);
    expect(r.detalle).toMatch(/ADEMAS, el orden/);
    expect(r.detalle).toMatch(/que necesito de vos/i);
    expect(r.detalle).toMatch(/Va PRIMERO/);
  });

  it('informe largo que SI arranca por lo que necesito: el freno sale igual, sin el aviso de orden', async () => {
    const texto = `**Qué necesito de vos:** el número de HO.\n\nQué cambió:\n\n${relleno}\n\nTodo commiteado y pusheado.`;
    const r = await decidir({ session_id: 's-orden', last_assistant_message: texto }, deps());
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/informe/);
    expect(r.detalle).not.toMatch(/ADEMAS, el orden/);
  });

  it('informe largo que no pide nada: sin el aviso de orden', async () => {
    const r = await decidir({ session_id: 's-orden', last_assistant_message: `${relleno}\n\nListo: todo commiteado y pusheado.` }, deps());
    expect(r.ok).toBe(false);
    expect(r.detalle).not.toMatch(/ADEMAS, el orden/);
  });

  it('SIN FRENO NUEVO: un cierre corto con lo que necesito enterrado pasa', async () => {
    const texto = 'Cambié la hoja 3 y la portada.\n\nEncontré una foto de otra pieza.\n\nUna sola decisión tuya: el número de HO. Lo demás quedó commiteado y pusheado.';
    expect(evaluarOrdenCierre(texto).aviso).toBe(true);                       // la medicion lo ve…
    expect((await decidir({ session_id: 's-orden', last_assistant_message: texto }, deps())).ok).toBe(true);   // …y el cierre no frena
  });

  it('SIN FRENO NUEVO: los cinco cierres reales enterrados, cortos, PASAN (ok:true, sin importar el titulo de un freno)', async () => {
    for (const [nombre, texto] of ENTERRADOS) {
      const r = await decidir({ session_id: 's-orden', last_assistant_message: texto }, deps());
      expect(r.ok, nombre).toBe(true);
    }
  });

  it('con el cooldown del chequeo 5 vigente no hay freno ni aviso', async () => {
    const texto = `${relleno}\n\nQué necesito de vos: el número de HO.\n\nTodo commiteado y pusheado.`;
    const r = await decidir({ session_id: 's-orden', last_assistant_message: texto }, deps({ enCooldown: (sid, clave) => clave === 'largo' }));
    expect(r.ok).toBe(true);
  });
});

describe('las formas que CLAUDE.md pide para "lo que necesito" no chocan con el chequeo 1 (pedir permiso)', () => {
  it('"De vos no necesito nada" como cola de un cierre corto no es un pedido de permiso', () => {
    expect(evaluarPermiso('De vos no necesito nada.\n\nQué cambió: el canon. Qué encontré: nada raro.').bloquea).toBe(false);
  });

  it('"esto va aca, ¿esta bien?" con la ruta no es un pedido de permiso', async () => {
    const texto = 'De vos necesito un sí: la fila nueva va en `3- LISTADO\\Listado hojas de proceso.xlsx`, pestaña INDICE, ¿está bien?\n\nQué cambió: la HO-991, dos pasos.';
    expect(evaluarPermiso(texto).bloquea).toBe(false);
    expect(evaluarOrdenCierre(texto)).toMatchObject({ necesita: true, aviso: false });
  });
});
