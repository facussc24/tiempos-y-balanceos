/**
 * cierre-guard · chequeo 8 (07/10/2026): el mensaje dice que no tengo acceso a los mails de un companero y en el turno no
 * mire la nube del equipo.
 *
 * El caso real: sesion f14f5aae, 07/10/2026. Fak: "como que no esta en la nube bsucaste ne los maisl de carlos?". La
 * respuesta: "Busque en tu correo, que incluye todo lo que Carlos te mando o te copio. El correo de Carlos no lo puedo
 * leer: solo tengo acceso al tuyo." Era falso: los mails de Carlos (cbaptista) y de la PC que era de Marcelo
 * (lucca.tuccio) suben solos a la nube de Ingenieria y `scripts/_mails.py --buscar` los lee. Fak: "si lo podes leer esta
 * en la nube" · "desde cuando no recordas eso?" · "fiajte eso enteonce sosea como evitar que te vuevlas a euqivocar en esto".
 *
 * Se prueba en las dos direcciones, con los textos y mensajes reales: ROJO con la frase del incidente y sus parientes;
 * VERDE con frases que no niegan el acceso a un buzon (un PDF, un servidor, "no hay mails sobre eso") y con el turno que
 * si miro la nube. Medido contra los 16.336 bloques de texto de Claude en 286 transcripts: las seis reglas calzan en UN
 * solo mensaje (el del incidente); sin falsos rojos (cierreCanon, `mails_equipo`).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decidir, relevarTranscript, evaluarMailsEquipo, CANON } from '../../scripts/_lib/cierreGuard.mjs';

// Lo que Fak escribio y lo que se le contesto, textual (transcript f14f5aae, 07/10/2026)
const FAK_1 = 'como que no esta en la nube bsucaste ne los maisl de carlos?';
const FAK_2 = 'si lo podes leer esta en la nube';
const INCIDENTE = 'Busqué en tu correo, que incluye todo lo que Carlos te mandó o te copió. El correo de Carlos no lo puedo leer: solo tengo acceso al tuyo. Vuelvo a bajar tu correo por si llegó recién y busco de nuevo todo lo de Carlos.';

const l = (o) => JSON.stringify(o);
const T = (n) => `2026-10-07T17:${String(n).padStart(2, '0')}:00.000Z`;
const fak = (n, texto) => l({ type: 'user', timestamp: T(n), origin: { kind: 'human' }, message: { role: 'user', content: texto } });
const usa = (n, name, input, id = `toolu_${n}_${name}`) => l({ type: 'assistant', timestamp: T(n), message: { content: [{ type: 'tool_use', id, name, input }] } });
const dice = (n, texto) => l({ type: 'assistant', timestamp: T(n), message: { content: [{ type: 'text', text: texto }] } });
const bash = (n, command) => usa(n, 'Bash', { command });

const archivo = (lineas) => {
  const f = path.join(os.tmpdir(), `cg-mails-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  fs.writeFileSync(f, lineas.join('\n') + '\n');
  return f;
};
const deps = { pendientes: () => [], enCooldown: () => false, marcar: () => {}, yaReclamado: () => false, reclamar: () => {} };
async function cierre(lineas, texto = INCIDENTE, extra = {}) {
  const f = archivo(lineas);
  try { return await decidir({ session_id: 's8', transcript_path: f, last_assistant_message: texto, ...extra }, deps); } finally { fs.unlinkSync(f); }
}
async function relevar(lineas) {
  const f = archivo(lineas);
  try { return await relevarTranscript(f); } finally { fs.unlinkSync(f); }
}

describe('chequeo 8 · ROJO: el incidente del 07/10/2026 tal como paso', () => {
  it('bloquea el mensaje real: "El correo de Carlos no lo puedo leer: solo tengo acceso al tuyo"', async () => {
    const r = await cierre([fak(1, FAK_1), bash(2, 'python scripts/_mails.py --sync'), dice(3, INCIDENTE)]);
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/no tenes acceso a los mails de un companero/);
    expect(r.detalle).toMatch(/El correo de Carlos no lo puedo leer/);          // la frase que lo disparo
    expect(r.detalle).toMatch(/python scripts\/_mails\.py --buzones/);           // donde mirar
    expect(r.detalle).toMatch(/python scripts\/_mails\.py --buscar/);
    expect(r.detalle).toMatch(/cbaptista/);
    expect(r.detalle).toMatch(/lucca\.tuccio/);
    expect(r.detalle).toMatch(/_cuarentena.*no se lee nunca/);                   // y lo que no se toca
    expect(r.detalle).toMatch(/desde cuando no recordas eso/);                   // la cita de Fak
    expect(r.detalle).toMatch(/No aplica mails-del-equipo:/);                    // la salida
  });

  it('bloquea tambien despues del segundo reclamo de Fak (el ultimo mensaje suyo manda el turno)', async () => {
    const r = await cierre([fak(1, FAK_1), dice(2, INCIDENTE), fak(3, FAK_2), dice(4, 'Tenés razón. El correo de Carlos no lo puedo leer desde acá.')]);
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/mails de un companero/);
  });

  it('bloquea aunque haya buscado SOLO en el buzon de Fak (--solo-fak no mira la nube)', async () => {
    const r = await cierre([fak(1, FAK_1), bash(2, 'python scripts/_mails.py --buscar "carlos" --solo-fak'), dice(3, INCIDENTE)]);
    expect(r.ok).toBe(false);
  });

  it('bloquea cuando lo unico que "busco" es un grep que nombra el script, o una carpeta que no es la de la nube', async () => {
    const r1 = await cierre([fak(1, FAK_1), bash(2, 'grep -n "_mails.py --buscar" docs/LECCIONES_APRENDIDAS.md'), dice(3, INCIDENTE)]);
    expect(r1.ok).toBe(false);
    const r2 = await cierre([fak(1, FAK_1), bash(2, 'ls "C:/Users/x/BARACK ARGENTINA SRL/Ingenieria/Claude Barack/mails"'), dice(3, INCIDENTE)]);
    expect(r2.ok).toBe(false);
  });

  it('bloquea si la busqueda en la nube fue en un turno ANTERIOR: se mide el turno de este mensaje', async () => {
    const r = await cierre([fak(1, 'buscame lo de Pablo'), bash(2, 'python scripts/_mails.py --buscar pablo'), dice(3, 'Listo.'), fak(4, FAK_1), dice(5, INCIDENTE)]);
    expect(r.ok).toBe(false);
  });

  // La frase del incidente y sus parientes, cada una con su regla: cada regla de `niega_re` se ve fallar y pasar.
  it.each([
    ['sujeto primero, con "lo"', 'El correo de Carlos no lo puedo leer.'],
    ['sujeto primero, plural', 'Los mails de Marcelo no los puedo ver desde esta PC.'],
    ['no tengo acceso al correo de X', 'No tengo acceso al correo de Carlos.'],
    ['no tengo acceso a los mails de X', 'No tengo acceso a los mails de Federico Kipersain.'],
    ['no tengo acceso al buzon del equipo', 'No tengo acceso al buzón del equipo.'],
    ['no puedo leer el correo de X', 'No puedo leer el correo de Pablo Gamboa.'],
    ['no puedo ver los mails de otros', 'No puedo ver los mails de otros compañeros.'],
    ['no puedo acceder a la casilla de X', 'No puedo acceder a la casilla de Marcelo.'],
    ['solo tengo acceso al tuyo', 'Solo tengo acceso al tuyo.'],
    ['solo tengo acceso a tu correo', 'Por ahora solo tengo acceso a tu correo, no al de Carlos.'],
    ['solo veo tu casilla', 'Solo veo tu casilla.'],
    ['no tengo forma de leer', 'No tengo forma de leer el correo de Carlos.'],
    ['no puedo leer su correo', 'No puedo leer su correo.'],
    ['en el medio de un mensaje largo', 'Revisé el flujograma 153 y los planes de control.\n\nEl correo de Carlos no lo puedo leer, así que el mail del 05/10 no lo vi.\n\nEl flujograma 153 queda como estaba.'],
  ])('bloquea: %s', async (_cual, frase) => {
    const r = await cierre([fak(1, FAK_1), dice(2, frase)], frase);
    expect(r.ok, frase).toBe(false);
    expect(r.titulo).toMatch(/mails de un companero/);
  });
});

describe('chequeo 8 · VERDE: lo que no es negar el acceso a un buzon', () => {
  it.each([
    ['leyo el correo de Carlos en la nube', 'Leí el correo de Carlos en la nube: llega hasta el 05/10 14:00.'],
    ['un PDF que no abre', 'No puedo leer el PDF de Carlos: está escaneado y sin texto.'],
    ['un adjunto (la nube guarda solo los nombres)', 'No puedo abrir el adjunto del mail de Carlos: la nube guarda solo el nombre del archivo.'],
    ['un servidor', 'No tengo acceso al servidor Y: desde esta PC.'],
    ['no hay mails sobre ese tema (busqueda sin resultado)', 'No hay mails de Pablo sobre ese tema en ningún buzón.'],
    ['mandar no es leer', 'No puedo mandar mails desde esta PC: lo manda Fak.'],
    ['el correo del propio Fak', 'No puedo leer el correo de Fak porque Outlook está cerrado.'],
    ['su casilla con vos', 'No puedo leer tu correo ahora: Outlook no responde.'],
    ['llega hasta una fecha (no es una negacion)', 'El correo de Carlos llega hasta el 05/10, no tengo nada posterior.'],
    ['mails de un tercero externo que nunca estuvo en un buzon', 'El mail de Kreiz no está en el hilo.'],
    ['busqueda con resultado', 'Busqué en los buzones de Fak, Carlos y Marcelo: hay dos mails de Pablo, los dos con el plano 0428.'],
    ['una negacion sin mails', 'No puedo ver la pantalla de Fak si no me manda una captura.'],
  ])('pasa: %s', async (_cual, frase) => {
    const r = await cierre([fak(1, 'buscame lo de Carlos'), dice(2, frase)], frase);
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  it('el cierre de esta tarea, que describe la frase prohibida entre comillas y dice que no aplica, pasa con su renglon', async () => {
    const texto = 'Agregué el freno: si digo "no tengo acceso al correo de Carlos" sin mirar la nube, el turno no termina.\nNo aplica mails-del-equipo: describo el freno, no niego ningún acceso.';
    expect(evaluarMailsEquipo(texto, {}).bloquea).toBe(false);
    expect(evaluarMailsEquipo(texto.split('\n')[0], {}).bloquea).toBe(true);        // sin el renglon, esa misma frase frena
  });

  it.each([
    ['--buscar', bash(2, 'python scripts/_mails.py --buscar "HO TAPIZADO APB TRASERO"')],
    ['--buscar con cd y &&', bash(2, 'cd /c/Dev/BarackMercosul && python scripts/_mails.py --buscar "carlos" --desde 2026-10-01')],
    ['--buscar con --buzon', bash(2, 'python scripts/_mails.py --buscar plano --buzon carlos')],
    ['--buzones', bash(2, 'python scripts/_mails.py --buzones')],
    ['--ver con un id de la nube', bash(2, 'python scripts/_mails.py --ver nube:0eebae948dff')],
    ['en PowerShell, con barras de Windows', usa(2, 'PowerShell', { command: 'python scripts\\_mails.py --buscar plano' })],
    ['abrir un archivo de mails\\_entrada', usa(2, 'Read', { file_path: 'C:\\Users\\FacundoS-PC\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - General\\_CUARENTENA_Claude Barack\\mails\\_entrada\\cbaptista\\20261006-140843.jsonl' })],
    ['grep sobre mails/_entrada', usa(2, 'Grep', { pattern: 'tapizado', path: 'C:/Users/FacundoS-PC/BARACK ARGENTINA SRL/Ingeniería y Proyecto - General/_CUARENTENA_Claude Barack/mails/_entrada' })],
  ])('pasa si en el turno miro la nube: %s', async (_cual, uso) => {
    const r = await cierre([fak(1, FAK_1), uso, dice(3, INCIDENTE)]);
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  it('pasa con el renglon "No aplica mails-del-equipo: <motivo>", tambien si esta en un mensaje anterior del mismo turno', async () => {
    const aviso = 'No aplica mails-del-equipo: hablo de Pedro Ergo, que no comparte sus mails y no figura en --buzones.';
    const r1 = await cierre([fak(1, FAK_1), dice(2, `${INCIDENTE}\n${aviso}`)], `${INCIDENTE}\n${aviso}`);
    expect(r1.ok).toBe(true);
    const r2 = await cierre([fak(1, FAK_1), dice(2, aviso), usa(3, 'Read', { file_path: 'a.txt' }), dice(4, INCIDENTE)], INCIDENTE);
    expect(r2.ok).toBe(true);
  });

  it('pasa con stop_hook_active (sin loops: el turno se frena una sola vez)', async () => {
    const r = await cierre([fak(1, FAK_1), dice(2, INCIDENTE)], INCIDENTE, { stop_hook_active: true });
    expect(r.ok).toBe(true);
  });

  it('el relevador anota si el turno miro la nube, y lo reinicia con cada mensaje de Fak', async () => {
    const r = await relevar([fak(1, 'a'), bash(2, 'python scripts/_mails.py --buscar x'), dice(3, 'ok'), fak(4, FAK_1), dice(5, 'ok')]);
    expect(r.mails).toEqual({ busco: false, noAplica: false });
    const s = await relevar([fak(1, FAK_1), bash(2, 'python scripts/_mails.py --buzones'), dice(3, 'No aplica mails-del-equipo: x')]);
    expect(s.mails).toEqual({ busco: true, noAplica: true });
  });
});

describe('chequeo 8 · va en el mismo aviso que otro chequeo (el turno se frena una sola vez)', () => {
  it('con un pedido de permiso al final, el aviso trae las dos cosas', async () => {
    const texto = `${INCIDENTE}\n\nDecime y lo hago.`;
    const r = await cierre([fak(1, FAK_1), dice(2, texto)], texto);
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/permiso/);
    expect(r.detalle).toMatch(/ADEMAS, el mensaje niega el acceso a los mails de un companero/);
    expect(r.detalle).toMatch(/_mails\.py --buzones/);
  });

  it('con un pedido de explicar sin cumplir, tambien', async () => {
    const r = await cierre([fak(1, 'no entiendo nada, explicame mejor lo de los mails de Carlos'), dice(2, INCIDENTE)], INCIDENTE);
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/sin cambiar la forma/);
    expect(r.detalle).toMatch(/ADEMAS, el mensaje niega el acceso a los mails de un companero/);
  });
});

describe('chequeo 8 · las reglas viven en el canon, cada una con su fuente', () => {
  it('seis reglas, todas con fuente, y las tres listas de excepciones definidas', () => {
    const c = CANON.mails_equipo;
    expect(c.niega_re.length).toBe(6);
    for (const p of c.niega_re) {
      expect(p.re.length, p.re).toBeGreaterThan(20);
      expect(p.fuente.length, p.re).toBeGreaterThan(20);
      expect(() => new RegExp(p.re, 'i'), p.re).not.toThrow();
    }
    expect(c.busco_re).toMatch(/_mails/);
    expect(c.busco_excluye_re).toMatch(/solo-fak/);
    expect(c.no_aplica_re).toMatch(/mails-del-equipo/);
  });
});

describe('cierre-guard.sh — el hook de verdad (bash -> node) con el transcript del incidente', () => {
  const HOOK = path.join(process.cwd(), '.claude', 'hooks', 'cierre-guard.sh');
  const correr = (payload) => spawnSync('bash', [HOOK], { input: JSON.stringify(payload), encoding: 'utf8' });
  it('ROJO: exit 2 y el motivo por stderr · VERDE: con la nube mirada, exit 0', () => {
    const rojo = archivo([fak(1, FAK_1), bash(2, 'python scripts/_mails.py --sync'), dice(3, INCIDENTE)]);
    const verde = archivo([fak(1, FAK_1), bash(2, 'python scripts/_mails.py --buscar carlos'), dice(3, INCIDENTE)]);
    try {
      const r = correr({ session_id: 's8', transcript_path: rojo, last_assistant_message: INCIDENTE });
      expect(r.status, r.stderr).toBe(2);
      expect(r.stderr).toMatch(/mails de un companero/);
      expect(r.stderr).toMatch(/_mails\.py --buzones/);
      const v = correr({ session_id: 's8', transcript_path: verde, last_assistant_message: INCIDENTE });
      expect(v.status, v.stderr).toBe(0);
      expect(v.stderr).toBe('');
    } finally { fs.unlinkSync(rojo); fs.unlinkSync(verde); }
  });
});
