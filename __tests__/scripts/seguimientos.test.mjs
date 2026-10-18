/**
 * Tests de `scripts/_lib/seguimientos.mjs` y de `scripts/_seguimientos.mjs` — los seguimientos
 * con fecha (lo que hay que volver a pedir los lunes y viernes hasta que contesten).
 *
 * Pedido de Fak, 02/10/2026: "no me puedo olvidar de esto... a la tercera vez que no me
 * respondan pongo al director en copia". El control se prueba en las dos direcciones: avisa cuando
 * toca y se calla cuando no hay nada abierto (un aviso que suena siempre se deja de leer).
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estadoDe, textoHook, renglonHook, abiertos, aFecha, leerBloque, escribirBloque, anotar, cerrar, nombreDia, TOPE_HOOK, porVencimiento } from '../../scripts/_lib/seguimientos.mjs';

const RAIZ = resolve(fileURLToPath(import.meta.url), '../../..');

const seg = (extra = {}) => ({
  id: 'reunion', que: 'Reunion de prueba', abierto: '2026-10-02', dias: ['lunes', 'viernes'], estado: 'abierto',
  intentos: [], escalar: { despues_de: 3, sumar_cc: ['Director'] }, se_cierra_cuando: 'hay fecha', ...extra,
});
const enviado = (fecha) => ({ fecha, que: 'mail', enviado: true });

describe('seguimientos — que dia toca insistir', () => {
  it('el 02/10/2026 es viernes y el 05/10 lunes (la cuenta de dias no se corre por el huso)', () => {
    expect(nombreDia('2026-10-02')).toBe('viernes');
    expect(nombreDia('2026-10-05')).toBe('lunes');
  });

  it('con el primer mail enviado el viernes, el lunes TOCA y es el pedido 2', () => {
    const e = estadoDe(seg({ intentos: [enviado('2026-10-02')] }), '2026-10-05');
    expect(e.tocaHoy).toBe(true);
    expect(e.proximoNumero).toBe(2);
    expect(e.escala).toBe(false);
  });

  it('un martes NO toca: la proxima es el viernes', () => {
    const e = estadoDe(seg({ intentos: [enviado('2026-10-02'), enviado('2026-10-05')] }), '2026-10-06');
    expect(e.tocaHoy).toBe(false);
    expect(e.proxima).toBe('2026-10-09');
  });

  it('si el lunes nadie insistio, el martes sigue tocando (atrasado), no espera al viernes', () => {
    const e = estadoDe(seg({ intentos: [enviado('2026-10-02')] }), '2026-10-06');
    expect(e.tocaHoy).toBe(true);
    expect(e.atrasado).toBe(true);
  });

  it('lo que ya se hizo hoy no vuelve a tocar hoy', () => {
    const e = estadoDe(seg({ intentos: [enviado('2026-10-02'), enviado('2026-10-05')] }), '2026-10-05');
    expect(e.tocaHoy).toBe(false);
    expect(e.proxima).toBe('2026-10-09');
  });

  it('un borrador sin enviar NO cuenta como pedido', () => {
    const e = estadoDe(seg({ intentos: [{ fecha: '2026-10-02', que: 'borrador', enviado: false }] }), '2026-10-05');
    expect(e.enviados).toBe(0);
    expect(e.sinEnviar).toBe(true);
    expect(e.proximoNumero).toBe(1);
  });
});

describe('seguimientos — la copia al director', () => {
  it('con 2 enviados todavia NO escala', () => {
    const e = estadoDe(seg({ intentos: [enviado('2026-10-02'), enviado('2026-10-05')] }), '2026-10-09');
    expect(e.escala).toBe(false);
    expect(e.cc).toEqual([]);
  });

  it('con 3 enviados sin respuesta, el pedido 4 lleva la copia', () => {
    const e = estadoDe(seg({ intentos: [enviado('2026-10-02'), enviado('2026-10-05'), enviado('2026-10-09')] }), '2026-10-12');
    expect(e.escala).toBe(true);
    expect(e.proximoNumero).toBe(4);
    expect(e.cc).toEqual(['Director']);
  });
});

describe('seguimientos — el texto del arranque', () => {
  it('sin nada abierto no dice nada', () => {
    expect(textoHook({ seguimientos: [seg({ estado: 'cerrado' })] }, '2026-10-05')).toBe('');
    expect(textoHook({ seguimientos: [] }, '2026-10-05')).toBe('');
  });

  it('el dia que toca lo grita, con el numero de pedido y sin autorizar el envio', () => {
    const t = textoHook({ seguimientos: [seg({ intentos: [enviado('2026-10-02')] })] }, '2026-10-05');
    expect(t).toMatch(/HOY TOCA INSISTIR/);
    expect(t).toMatch(/pedido numero 2/);
    expect(t).toMatch(/No se envia sin su OK/);
  });

  it('el dia que no toca dice cuando es la proxima', () => {
    const t = textoHook({ seguimientos: [seg({ intentos: [enviado('2026-10-02'), enviado('2026-10-05')] })] }, '2026-10-06');
    expect(t).not.toMatch(/HOY TOCA/);
    expect(t).toMatch(/se insiste el viernes 09\/10/);
  });

  it('si el primer pedido no salio, eso es lo que dice', () => {
    const t = textoHook({ seguimientos: [seg({ intentos: [{ fecha: '2026-10-02', que: 'borrador', enviado: false }] })] }, '2026-10-03');
    expect(t).toMatch(/TODAVIA NO SALIO/);
  });

  it('al escalar nombra a quien va en copia', () => {
    const t = textoHook({ seguimientos: [seg({ intentos: [enviado('2026-10-02'), enviado('2026-10-05'), enviado('2026-10-09')] })] }, '2026-10-12');
    expect(t).toMatch(/CON Director EN COPIA/);
  });

  it('un dia de insistencia mal escrito es un error, no se ignora', () => {
    expect(() => estadoDe(seg({ dias: ['lunez'] }), '2026-10-05')).toThrow(/no existe/);
  });
});

describe('seguimientos — la memoria (bloque json) y el script', () => {
  const md = (datos) => `---\nname: x\n---\n\nTexto de arriba.\n\n\`\`\`json\n${JSON.stringify(datos, null, 2)}\n\`\`\`\n\nTexto de abajo.\n`;

  it('leer y reescribir el bloque no toca el texto de alrededor', () => {
    const original = md({ seguimientos: [seg()] });
    const b = leerBloque(original);
    anotar(b.datos, 'reunion', { fecha: '2026-10-02', que: 'primer mail', enviado: true });
    const nuevo = escribirBloque(b);
    expect(nuevo.startsWith('---\nname: x\n---\n\nTexto de arriba.')).toBe(true);
    expect(nuevo.endsWith('Texto de abajo.\n')).toBe(true);
    expect(leerBloque(nuevo).datos.seguimientos[0].intentos).toHaveLength(1);
  });

  it('anotar o cerrar un id que no existe falla diciendo cuales hay', () => {
    expect(() => anotar({ seguimientos: [seg()] }, 'otro', { fecha: '2026-10-02', que: 'x' })).toThrow(/hay: reunion/);
    expect(() => cerrar({ seguimientos: [seg()] }, 'reunion', { fecha: '2026-10-02' })).toThrow(/--motivo/);
  });

  it('el script: --hook avisa, --anotar escribe, --cerrar lo calla, y un argumento desconocido no hace nada', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seguimientos-'));
    const archivo = join(dir, 'seg.md');
    writeFileSync(archivo, md({ seguimientos: [seg({ intentos: [enviado('2026-10-02')] })] }));
    const correr = (...a) => spawnSync('node', [join(RAIZ, 'scripts/_seguimientos.mjs'), ...a], {
      encoding: 'utf8', env: { ...process.env, BARACK_SEGUIMIENTOS: archivo, BARACK_HOY: '2026-10-05' },
    });
    try {
      expect(correr('--hook').stdout).toMatch(/HOY TOCA INSISTIR/);

      const antes = readFileSync(archivo, 'utf8');
      const malo = correr('--anotar', 'reunion', '--que', 'x', '--enviar');
      expect(malo.status).toBe(2);
      expect(readFileSync(archivo, 'utf8')).toBe(antes);

      expect(correr('--anotar', 'reunion', '--que', 'segundo pedido', '--enviado').status).toBe(0);
      expect(correr('--hook').stdout).toMatch(/2 pedido\(s\) enviados/);

      expect(correr('--cerrar', 'reunion', '--motivo', 'reunion el 08/10').status).toBe(0);
      expect(correr('--hook').stdout).toBe('');
    } finally {
      unlinkSync(archivo);
      rmdirSync(dir);
    }
  });

  it('el script con --hook y sin archivo no rompe el arranque', () => {
    const r = spawnSync('node', [join(RAIZ, 'scripts/_seguimientos.mjs'), '--hook'], {
      encoding: 'utf8', env: { ...process.env, BARACK_SEGUIMIENTOS: join(tmpdir(), 'no-existe-seguimientos.md') },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });
});

// Auditoria del 02/10/2026: dos formas en que el aviso se CALLABA, mas los bordes que encontro.
describe('seguimientos — el aviso no se calla (auditoria del 02/10/2026)', () => {
  const borrador = (fecha) => ({ fecha, que: 'borrador armado', enviado: false });
  const md = (datos) => `---\nname: x\n---\n\nTexto de arriba.\n\n\`\`\`json\n${JSON.stringify(datos, null, 2)}\n\`\`\`\n\nTexto de abajo.\n`;

  it('un seguimiento mal escrito se avisa y NO calla al sano', () => {
    const sano = seg({ id: 'sano', intentos: [enviado('2026-10-02')] });
    const roto = seg({ id: 'roto', dias: ['lunez'] });
    const t = textoHook({ seguimientos: [roto, sano] }, '2026-10-05');
    expect(t).toMatch(/- roto: ESTA MAL ESCRITO/);
    expect(t).toMatch(/- sano: .*HOY TOCA INSISTIR/);
  });

  it('sin fecha de apertura, con una fecha en otro formato o con dias vacios: mal escrito, no "no toca"', () => {
    expect(renglonHook(seg({ abierto: undefined, intentos: [enviado('2026-10-02')] }), '2026-10-05')).toMatch(/MAL ESCRITO/);
    expect(renglonHook(seg({ intentos: [{ fecha: '05/10/2026', que: 'x', enviado: true }] }), '2026-10-05')).toMatch(/MAL ESCRITO/);
    expect(renglonHook(seg({ dias: [] }), '2026-10-05')).toMatch(/MAL ESCRITO/);
    expect(renglonHook(seg({ dias: 'lunes' }), '2026-10-05')).toMatch(/MAL ESCRITO/);
    expect(() => abiertos({ seguimientos: 'no es una lista' })).toThrow(/seguimientos/);
    expect(() => aFecha('2026-02-31')).toThrow(/no existe/);
  });

  it('un borrador sin enviar del pedido 2 NO apaga el aviso ni cuenta como ultimo pedido', () => {
    const s = seg({ intentos: [enviado('2026-10-02'), borrador('2026-10-05')] });
    const lunes = estadoDe(s, '2026-10-05');
    expect(lunes.tocaHoy).toBe(true);
    expect(lunes.ultimo).toBe('2026-10-02');
    expect(lunes.borradorPendiente).toBe('2026-10-05');
    const martes = estadoDe(s, '2026-10-06');
    expect(martes.tocaHoy).toBe(true);
    expect(martes.atrasado).toBe(true);
    const t = renglonHook(s, '2026-10-06');
    expect(t).toMatch(/pedido numero 2, el ultimo ENVIADO fue el viernes 02\/10/);
    expect(t).toMatch(/borrador de ese pedido armado el lunes 05\/10 SIN ENVIAR: no armar otro/);
  });

  it('el borrador que ya salio deja de avisarse', () => {
    const s = seg({ intentos: [enviado('2026-10-02'), borrador('2026-10-05'), enviado('2026-10-05')] });
    const e = estadoDe(s, '2026-10-06');
    expect(e.borradorPendiente).toBe(null);
    expect(e.tocaHoy).toBe(false);
    expect(e.enviados).toBe(2);
  });

  it('el dia de apertura no toca insistir; los dias se leen con tilde y mayuscula', () => {
    expect(estadoDe(seg({ intentos: [enviado('2026-10-02')] }), '2026-10-02').tocaHoy).toBe(false);
    expect(estadoDe(seg({ dias: ['Miércoles'], intentos: [enviado('2026-10-02')] }), '2026-10-07').tocaHoy).toBe(true);
  });

  it('la copia: despues_de escrito como texto escala igual, y sin destinatario lo dice', () => {
    const tres = [enviado('2026-10-02'), enviado('2026-10-05'), enviado('2026-10-09')];
    expect(estadoDe(seg({ intentos: tres, escalar: { despues_de: '3', sumar_cc: ['Director'] } }), '2026-10-12').escala).toBe(true);
    expect(renglonHook(seg({ intentos: tres, escalar: { despues_de: 3, sumar_cc: [] } }), '2026-10-12')).toMatch(/falta cargar a quien/);
    expect(estadoDe(seg({ intentos: tres, escalar: undefined }), '2026-10-12').escala).toBe(false);
  });

  it('anotar no cuenta dos veces el mismo envio, ni anota en uno cerrado, ni con fecha futura', () => {
    const datos = { seguimientos: [seg({ intentos: [enviado('2026-10-02')] }), seg({ id: 'viejo', estado: 'cerrado' })] };
    expect(() => anotar(datos, 'reunion', { fecha: '2026-10-02', que: 'otra vez', enviado: true, hoy: '2026-10-05' })).toThrow(/no se cuenta dos veces/);
    expect(() => anotar(datos, 'viejo', { fecha: '2026-10-05', que: 'x', enviado: true, hoy: '2026-10-05' })).toThrow(/cerrado/);
    expect(() => anotar(datos, 'reunion', { fecha: '2026-10-20', que: 'x', enviado: true, hoy: '2026-10-05' })).toThrow(/futura/);
    expect(() => anotar(datos, 'reunion', { fecha: '2026-10-05', que: '--enviado', enviado: true, hoy: '2026-10-05' })).toThrow(/--que/);
    expect(datos.seguimientos[0].intentos).toHaveLength(1);
  });

  it('la memoria: toma el bloque que tiene "seguimientos" aunque haya otro antes, y conserva CRLF', () => {
    const ejemplo = '```json\n{ "ejemplo": true }\n```\n\n';
    const b1 = leerBloque(`Arriba.\n\n${ejemplo}\`\`\`json\n${JSON.stringify({ seguimientos: [seg()] }, null, 2)}\n\`\`\`\nAbajo.\n`);
    expect(b1.datos.seguimientos).toHaveLength(1);
    expect(escribirBloque(b1)).toContain(ejemplo);
    const crlf = `Arriba.\r\n\r\n\`\`\`json\r\n${JSON.stringify({ seguimientos: [seg()] }, null, 2).split('\n').join('\r\n')}\r\n\`\`\`\r\nAbajo.\r\n`;
    const b2 = leerBloque(crlf);
    expect(escribirBloque(b2)).toBe(crlf);
    expect(() => leerBloque('sin bloque')).toThrow(/bloque/);
  });

  it('con muchos abiertos el arranque detalla hasta el tope y cuenta el resto, lejos de los 10 KB', () => {
    const muchos = Array.from({ length: TOPE_HOOK + 15 }, (_, i) => seg({ id: `s${i}`, intentos: [enviado('2026-10-02')] }));
    const t = textoHook({ seguimientos: muchos }, '2026-10-05');
    expect(t).toMatch(/y 15 mas/);
    expect(t.length).toBeLessThan(8000);
  });

  it('el script: datos rotos se dicen por la salida normal del arranque, y los argumentos malos no escriben', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seguimientos-'));
    const archivo = join(dir, 'seg.md');
    const correr = (...a) => spawnSync('node', [join(RAIZ, 'scripts/_seguimientos.mjs'), ...a], {
      encoding: 'utf8', env: { ...process.env, BARACK_SEGUIMIENTOS: archivo, BARACK_HOY: '2026-10-05' },
    });
    try {
      // un seguimiento sano al que hoy le toca + uno con un dia mal escrito
      writeFileSync(archivo, md({ seguimientos: [seg({ id: 'roto', dias: ['lunez'] }), seg({ id: 'sano', intentos: [enviado('2026-10-02')] })] }));
      const h = correr('--hook');
      expect(h.status).toBe(0);
      expect(h.stdout).toMatch(/roto: ESTA MAL ESCRITO/);
      expect(h.stdout).toMatch(/sano: .*HOY TOCA INSISTIR/);
      expect(correr().status).toBe(1);

      // el json entero roto, o sin la lista: se dice, con exit 0 en el arranque
      writeFileSync(archivo, '```json\n{ "seguimientos": [ \n```\n');
      expect(correr('--hook').stdout).toMatch(/NO SE PUDO LEER/);
      expect(correr('--hook').status).toBe(0);
      writeFileSync(archivo, md({ seguimientos: 'texto' }));
      expect(correr('--hook').stdout).toMatch(/NO SE PUDO LEER/);

      // argumentos malos: exit 2 y el archivo queda igual
      writeFileSync(archivo, md({ seguimientos: [seg({ intentos: [enviado('2026-10-02')] })] }));
      const antes = readFileSync(archivo, 'utf8');
      for (const malos of [
        ['--anotar', 'reunion', '--que', '--enviado'],
        ['--anotar', 'reunion', '--que', 'x', 'enviado'],
        ['--anotar', 'reunion', '--que', 'x', '--fecha'],
        ['--anotar', 'reunion', '--que', 'x', '--cerrar', 'reunion', '--motivo', 'm'],
      ]) {
        expect(correr(...malos).status).toBe(2);
        expect(readFileSync(archivo, 'utf8')).toBe(antes);
      }
      // el mismo envio anotado dos veces: la segunda no escribe
      expect(correr('--anotar', 'reunion', '--que', 'segundo pedido', '--enviado').status).toBe(0);
      const conDos = readFileSync(archivo, 'utf8');
      expect(correr('--anotar', 'reunion', '--que', 'segundo pedido', '--enviado').status).toBe(1);
      expect(readFileSync(archivo, 'utf8')).toBe(conDos);
    } finally {
      unlinkSync(archivo);
      rmdirSync(dir);
    }
  });
});

describe('vencimientos de Ingenieria (tanda 13, item 4) — el caso de la D7 del 8D 11010843', () => {
  // La D7 de Fak («incorporar el modo de falla de recorte de vinilo» al AMFE) tenia plazo 17/09/2026 y el se entero el
  // 21/09 (memoria project_8d_11010843_tapa_amarok). Estos son datos de prueba: la memoria real no la carga (su
  // estado esta en duda y se mira en Supabase desde la PC principal).
  const d7 = (extra = {}) => ({
    id: 'd7-8d-11010843', que: 'D7 del 8D 11010843: modo de falla del recorte de vinilo en el AMFE', vence: '2026-09-17',
    area: 'ingenieria', estado: 'abierto', fuente: '8D en KPM', ...extra,
  });
  const ppap = { id: 'ppap-calidad', que: 'Entrega del PPAP', vence: '2026-09-15', area: 'Calidad', estado: 'abierto' };
  const md = (datos) => `Arriba.\n\n\`\`\`json\n${JSON.stringify(datos, null, 2)}\n\`\`\`\n`;

  it('el 21/09 dice que la D7 VENCIO hace 4 dias, y el plazo de PPAP (de Calidad) no aparece', () => {
    const t = textoHook({ seguimientos: [], vencimientos: [d7(), ppap] }, '2026-09-21');
    expect(t).toMatch(/\[VENCIMIENTOS DE INGENIERIA/);
    expect(t).toMatch(/d7-8d-11010843: .*VENCIO el jueves 17\/09 \(hace 4 dias\): decirselo a Fak al empezar/);
    expect(t).not.toMatch(/ppap-calidad|PPAP/);
    expect(t).not.toMatch(/SEGUIMIENTOS CON FECHA/); // sin seguimientos abiertos no sale ese encabezado
  });

  it('antes del plazo dice cuantos dias faltan; el mismo dia dice VENCE HOY', () => {
    expect(textoHook({ seguimientos: [], vencimientos: [d7()] }, '2026-09-10')).toMatch(/Vence el jueves 17\/09 \(faltan 7 dias\)/);
    expect(textoHook({ seguimientos: [], vencimientos: [d7()] }, '2026-09-16')).toMatch(/faltan 1 dia\)/);
    expect(textoHook({ seguimientos: [], vencimientos: [d7()] }, '2026-09-17')).toMatch(/VENCE HOY/);
  });

  it('ordena del que vence primero al ultimo; uno cerrado no sale; sin nada abierto, silencio', () => {
    const t = textoHook({ seguimientos: [], vencimientos: [d7({ id: 'tarde', vence: '2026-10-30' }), d7({ id: 'temprano', vence: '2026-10-20' }), d7({ id: 'listo', estado: 'cerrado' })] }, '2026-10-17');
    expect(t.indexOf('temprano')).toBeGreaterThan(0);
    expect(t.indexOf('temprano')).toBeLessThan(t.indexOf('tarde'));
    expect(t).not.toMatch(/listo/);
    expect(textoHook({ seguimientos: [], vencimientos: [d7({ estado: 'cerrado' })] }, '2026-10-17')).toBe('');
    expect(textoHook({ seguimientos: [] }, '2026-10-17')).toBe(''); // memoria vieja, sin la lista: igual que antes
  });

  it('mal escrito se dice y va arriba de todo, sin callar al sano; la lista que no es lista tampoco se calla', () => {
    const t = textoHook({ seguimientos: [], vencimientos: [d7(), { id: 'sin-fecha', que: 'algo', area: 'ingenieria' }, { id: 'sin-area', que: 'x', vence: '2026-10-20' }] }, '2026-09-21');
    expect(t).toMatch(/sin-fecha: ESTA MAL ESCRITO/);
    expect(t).toMatch(/sin-area: ESTA MAL ESCRITO.*de que area es/);
    expect(t).toMatch(/d7-8d-11010843: .*VENCIO/);
    expect(t.indexOf('sin-fecha')).toBeLessThan(t.indexOf('d7-8d-11010843'));
    expect(textoHook({ seguimientos: [], vencimientos: 'texto' }, '2026-09-21')).toMatch(/NO SE PUDO LEER la lista/);
  });

  it('un area mal escrita o un renglon vacio se DICEN en el arranque (auditor 17/10: quedaban afuera en silencio)', () => {
    for (const area of ['ingeneria', 'Ing.', 'ingenieria de procesos', 5]) {
      const t = textoHook({ seguimientos: [], vencimientos: [d7({ id: 'tipeo', area })] }, '2026-09-21');
      expect(t, String(area)).toMatch(/tipeo: ESTA MAL ESCRITO.*area que no conozco/);
    }
    for (const area of ['ingenieria', 'Ingeniería', ' INGENIERIA ']) {
      expect(textoHook({ seguimientos: [], vencimientos: [d7({ area })] }, '2026-09-21'), area).toMatch(/VENCIO el jueves 17\/09/);
    }
    expect(textoHook({ seguimientos: [], vencimientos: [d7({ area: 'logistica' })] }, '2026-09-21')).toBe(''); // de otra area, conocida: no se lleva
    expect(textoHook({ seguimientos: [], vencimientos: [null] }, '2026-09-21')).toMatch(/\(sin id\): ESTA MAL ESCRITO.*vencimiento vacio/);
  });

  it('dos mal escritos empatan (0, no NaN) y quedan arriba en el orden de la memoria; los sanos, del que vence primero', () => {
    const rotoA = { id: 'rotoA', que: 'x', area: 'ingenieria' };          // sin fecha
    const rotoB = { id: 'rotoB', que: 'y', vence: '17/09', area: 'ingenieria' };
    const t = textoHook({ seguimientos: [], vencimientos: [d7({ id: 'tarde', vence: '2026-10-30' }), rotoA, d7({ id: 'temprano', vence: '2026-10-20' }), rotoB] }, '2026-10-17');
    const orden = ['rotoA', 'rotoB', 'temprano', 'tarde'].map((id) => t.indexOf(`- ${id}:`));
    expect(orden.every((p) => p > 0)).toBe(true);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
    expect(porVencimiento({ e: null }, { e: null })).toBe(0);
    expect(porVencimiento({ e: null }, { e: { faltan: -5 } })).toBe(-1);
    expect(porVencimiento({ e: { faltan: 3 } }, { e: { faltan: -5 } })).toBe(1);
  });

  it('seguimientos y vencimientos salen juntos, cada uno con su encabezado', () => {
    const t = textoHook({ seguimientos: [seg({ intentos: [enviado('2026-10-02')] })], vencimientos: [d7()] }, '2026-10-05');
    expect(t).toMatch(/SEGUIMIENTOS CON FECHA[\s\S]*HOY TOCA INSISTIR[\s\S]*VENCIMIENTOS DE INGENIERIA[\s\S]*VENCIO/);
  });

  it('un vencimiento no se anota (no se insiste: vence) pero se cierra', () => {
    const datos = { seguimientos: [seg()], vencimientos: [d7()] };
    expect(() => anotar(datos, 'd7-8d-11010843', { fecha: '2026-09-21', que: 'x', enviado: true, hoy: '2026-09-21' })).toThrow(/es un vencimiento/);
    cerrar(datos, 'd7-8d-11010843', { fecha: '2026-09-21', motivo: 'cargada en el AMFE' });
    expect(datos.vencimientos[0].estado).toBe('cerrado');
    expect(textoHook(datos, '2026-09-22')).not.toMatch(/VENCIMIENTOS/);
  });

  it('el script: --hook avisa la D7 y calla el PPAP; el listado nombra los dos y dice que el de Calidad no se lleva', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vencimientos-'));
    const archivo = join(dir, 'seg.md');
    const correr = (...a) => spawnSync('node', [join(RAIZ, 'scripts/_seguimientos.mjs'), ...a], {
      encoding: 'utf8', env: { ...process.env, BARACK_SEGUIMIENTOS: archivo, BARACK_HOY: '2026-09-21' },
    });
    try {
      writeFileSync(archivo, md({ seguimientos: [], vencimientos: [d7(), ppap] }));
      const h = correr('--hook');
      expect(h.status).toBe(0);
      expect(h.stdout).toMatch(/VENCIO el jueves 17\/09 \(hace 4 dias\)/);
      expect(h.stdout).not.toMatch(/PPAP/);
      const l = correr();
      expect(l.status).toBe(0);
      expect(l.stdout).toMatch(/Vencimientos abiertos: 2/);
      expect(l.stdout).toMatch(/ppap-calidad[\s\S]*no es de ingenieria: no se le lleva a Fak/);
      expect(correr('--anotar', 'd7-8d-11010843', '--que', 'x').status).toBe(1);
      expect(correr('--cerrar', 'd7-8d-11010843', '--motivo', 'cargada').status).toBe(0);
      expect(correr('--hook').stdout).toBe('');
    } finally {
      unlinkSync(archivo);
      rmdirSync(dir);
    }
  });
});

describe('seguimientos — el arranque de sesion lo corre', () => {
  it('session-start-context.sh (modo inicio) llama a _seguimientos.mjs --hook despues del cerebro', () => {
    const sh = readFileSync(join(RAIZ, '.claude/hooks/session-start-context.sh'), 'utf8');
    const cerebro = sh.indexOf('cerebro-guard.sh" 2>/dev/null');
    const seguimientos = sh.indexOf('scripts/_seguimientos.mjs" --hook');
    expect(cerebro).toBeGreaterThan(0);
    expect(seguimientos).toBeGreaterThan(cerebro);
  });
});
