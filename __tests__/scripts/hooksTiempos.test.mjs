// hooksTiempos: la medicion de tiempos del control de cierre (plan P9, commit C0; 10/10/2026).
// cierre-guard.sh deja INICIO y FIN de cada corrida y, adentro de node, el tiempo de cada fase, en
// <tmp>/claude-hooks-tiempos.jsonl. La regla de este cambio: SOLO mide; no cambia ninguna decision del cierre.
// Dos direcciones: una corrida completa deja inicio + fases + fin; una matada deja inicio sin fin y el lector la cuenta.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as T from '../../scripts/_lib/hooksTiempos.mjs';
import { decidir, evaluarPermiso } from '../../scripts/_lib/cierreGuard.mjs';

const RAIZ = process.cwd();
const HOOK = path.join(RAIZ, '.claude', 'hooks', 'cierre-guard.sh');
let dir; let reg;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-tiempos-')); reg = path.join(dir, 'tiempos.jsonl'); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const correrHook = (payload, registro = reg) => spawnSync('bash', [HOOK], { input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, CLAUDE_HOOKS_TIEMPOS: registro } });
const eventos = () => fs.readFileSync(reg, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
// un registro de conversacion chico pero real en su forma: un mensaje de Fak y una herramienta
const registroDeSesion = () => {
  const t = path.join(dir, 'sesion.jsonl');
  const ahora = new Date().toISOString();
  fs.writeFileSync(t, [
    JSON.stringify({ type: 'user', timestamp: ahora, message: { role: 'user', content: 'fijate el estado de la cola' } }),
    JSON.stringify({ type: 'assistant', timestamp: ahora, message: { content: [{ type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: path.join(RAIZ, 'docs', 'COLA_CAMBIOS_CODIGO.md') } }] } }),
  ].join('\n') + '\n');
  return t;
};
// un mensaje que el cierre deja pasar y uno que frena (la cola pide permiso para trabajo propio: chequeo 1, sin efectos
// secundarios: frena antes de mirar git, marcas o el flag de Supabase)
const PASA = 'Espero el aviso del auditor.';
const FRENA = 'Encontré la causa del desfasaje en el medidor. ¿Querés que lo corrija?';

describe('una corrida completa deja inicio + fases + fin, con el mismo id', () => {
  it('VERDE: el cierre deja pasar (exit 0) y el registro tiene los tres renglones, con el tiempo por fase y los bytes del registro', () => {
    const transcript = registroDeSesion();
    const r = correrHook({ hook_event_name: 'Stop', session_id: 'sesion-de-prueba-0001', transcript_path: transcript, permission_mode: 'default', last_assistant_message: PASA });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toBe('');
    const ev = eventos();
    expect(ev.map((e) => e.ev)).toEqual(['inicio', 'fases', 'fin']);
    expect(new Set(ev.map((e) => e.id)).size).toBe(1);
    expect(ev.every((e) => e.hook === 'cierre-guard')).toBe(true);
    const [inicio, fases, fin] = ev;
    expect(Math.abs(inicio.t - Date.now())).toBeLessThan(120000);      // epoch en milisegundos, de ahora
    expect(fin.rc).toBe(0);
    expect(fin.ms).toBe(fin.t - inicio.t);
    expect(fases).toMatchObject({ sesion: 'sesion-d', modo: 'default', real: false, segundo_stop: false, ok: true, bytes_registro: fs.statSync(transcript).size, bytes_leidos: fs.statSync(transcript).size, subagentes: 0 });
    expect(fases.arranque_ms).toBeGreaterThanOrEqual(0);
    expect(fases.arranque_ms).toBeLessThan(fin.ms + 1);
    expect(Object.keys(fases.fases).sort()).toEqual(['documentos', 'relevar', 'resto']);   // no declara cierre: no hay git, exports ni tanda
    expect(fases.veces).toEqual({ relevar: 1, documentos: 1 });
    expect(fases.total_ms).toBeLessThanOrEqual(fin.ms);
  });

  it('ROJO: el cierre frena (exit 2 y su aviso por stderr) y eso tambien queda medido, con el titulo del freno', () => {
    expect(evaluarPermiso(FRENA).bloquea, 'el texto de prueba tiene que ser uno que el cierre frena').toBe(true);
    const r = correrHook({ hook_event_name: 'Stop', session_id: 'sesion-de-prueba-0002', transcript_path: '', last_assistant_message: FRENA });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/^CIERRE-GUARD: el turno termina pidiendo permiso/);
    const [, fases, fin] = eventos();
    expect(fin.rc).toBe(2);
    expect(fases.ok).toBe(false);
    expect(fases.titulo).toMatch(/^CIERRE-GUARD: el turno termina pidiendo permiso/);
    expect(fases.bytes_registro).toBe(0);
  });

  it('los registros de los subagentes cuentan en los bytes (el cierre los relee en cada pasada)', () => {
    const transcript = registroDeSesion();
    const sub = path.join(transcript.replace(/\.jsonl$/, ''), 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, 'agent-1.jsonl'), `${'x'.repeat(999)}\n`);
    fs.writeFileSync(path.join(sub, 'nota.txt'), 'no cuenta');
    expect(T.bytesDelRegistro(transcript)).toEqual({ bytes: fs.statSync(transcript).size + 1000, subagentes: 1 });
    expect(T.bytesDelRegistro(path.join(dir, 'no-existe.jsonl'))).toEqual({ bytes: 0, subagentes: 0 });
    expect(T.bytesDelRegistro('')).toEqual({ bytes: 0, subagentes: 0 });
  });
});

describe('una prueba que lanza el hook no ensucia el registro de verdad', () => {
  // el hook de verdad escribe en <tmp>/claude-hooks-tiempos.jsonl; aca <tmp> es una carpeta de la prueba
  const env = (extra) => { const e = { ...process.env, TMPDIR: dir, TEMP: dir, TMP: dir }; delete e.CLAUDE_HOOKS_TIEMPOS; Object.assign(e, extra); for (const [k, v] of Object.entries(extra)) if (v === undefined) delete e[k]; return e; };
  const correr = (extra) => spawnSync('bash', [HOOK], { input: JSON.stringify({ hook_event_name: 'Stop', session_id: 's', transcript_path: '', last_assistant_message: PASA }), encoding: 'utf8', env: env(extra) });
  const escrito = () => fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl'));

  it('VERDE: adentro de vitest (VITEST) y sin un archivo propio no se anota nada; con CLAUDE_HOOKS_TIEMPOS=off tampoco', () => {
    expect(correr({ VITEST: 'true' }).status).toBe(0);
    expect(escrito()).toEqual([]);
    expect(correr({ VITEST: undefined, CLAUDE_HOOKS_TIEMPOS: 'off' }).status).toBe(0);
    expect(escrito()).toEqual([]);
  });

  it('ROJO: fuera de una prueba (como lo corre la app) si se anota, en el temporal, con los tres renglones', () => {
    expect(correr({ VITEST: undefined }).status).toBe(0);
    expect(escrito()).toEqual([T.NOMBRE]);
    const ev = fs.readFileSync(path.join(dir, T.NOMBRE), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(ev.map((e) => e.ev)).toEqual(['inicio', 'fases', 'fin']);
    expect(ev[1].real).toBe(false);                   // el registro de conversacion no es el de una sesion: el lector la deja afuera
  });

  it('rutaRegistro: apagada con off y adentro de un test sin archivo propio; el lector siempre sabe donde esta el de verdad', () => {
    expect(T.rutaRegistro({ CLAUDE_HOOKS_TIEMPOS: 'off' })).toBe(null);
    expect(T.rutaRegistro({ CLAUDE_HOOKS_TIEMPOS: 'OFF', VITEST: '1' })).toBe(null);
    expect(T.rutaRegistro({ VITEST: 'true' })).toBe(null);
    expect(T.rutaRegistro({ VITEST: 'true', CLAUDE_HOOKS_TIEMPOS: reg })).toBe(reg);
    expect(T.rutaRegistro({})).toBe(path.join(os.tmpdir(), T.NOMBRE));
    expect(T.rutaRegistroReal()).toBe(path.join(os.tmpdir(), T.NOMBRE));
    expect(T.anotar({ a: 1 }, { ruta: null })).toBe(false);
  });

  it('una corrida es «real» si su registro de conversacion vive en ~/.claude/projects; el resumen deja afuera las que no', () => {
    expect(T.esSesionReal('C:\\Users\\Fak\\.claude\\projects\\C--Dev-BarackMercosul\\abc.jsonl')).toBe(true);
    expect(T.esSesionReal('/c/Users/Fak/.claude/projects/x/abc.jsonl')).toBe(true);
    expect(T.esSesionReal(path.join(dir, 'sesion.jsonl'))).toBe(false);
    expect(T.esSesionReal('')).toBe(false);
    const ev = [
      { ev: 'inicio', hook: 'cierre-guard', id: 'r', t: 1000 }, { ev: 'fases', hook: 'cierre-guard', id: 'r', t: 1100, real: true, fases: { relevar: 200 } }, { ev: 'fin', hook: 'cierre-guard', id: 'r', t: 1500, rc: 0, ms: 500 },
      { ev: 'inicio', hook: 'cierre-guard', id: 'p', t: 2000 }, { ev: 'fases', hook: 'cierre-guard', id: 'p', t: 2100, real: false, fases: { firma: 70000 } }, { ev: 'fin', hook: 'cierre-guard', id: 'p', t: 72000, rc: 2, ms: 70000 },
    ];
    const r = T.resumir(ev, { ahora: 100000 });
    expect(r).toMatchObject({ corridas: 1, completas: 1 });
    expect(r.domina.fase).toBe('relevar');
    expect(r.total.max).toBe(500);
    expect(T.resumir(ev, { ahora: 100000, conPruebas: true })).toMatchObject({ corridas: 2, domina: { fase: 'firma' } });
  });
});

describe('medir no cambia la decision del cierre', () => {
  it('si falta una pieza en lo que recibe el medidor, no tira: esa pieza no se envuelve y decidir usa la suya', async () => {
    const piezas = { fueraEnEsteTurno: async () => ({ fuera: false }) };          // sin firma, pendientes, exports ni tanda
    const r = await T.correrMedido({ decidir: async (p, d) => ({ ok: true, motivo: Object.keys(d).sort().join(',') }), depsReales: piezas, payload: { last_assistant_message: PASA }, env: { CLAUDE_HOOKS_TIEMPOS: reg } });
    expect(r).toEqual({ ok: true, motivo: 'fueraEnEsteTurno,medir' });
    // y con algo roto ANTES de decidir (aca, el pedido es de una forma que el medidor no espera) se decide igual, una sola vez
    let veces = 0;
    const raro = new Proxy({}, { get: (_, k) => { if (k === 'session_id') throw new Error('pedido raro'); return undefined; } });
    const r2 = await T.correrMedido({ decidir: async () => { veces++; return { ok: true }; }, depsReales: piezas, payload: raro, env: { CLAUDE_HOOKS_TIEMPOS: reg } });
    expect(r2).toEqual({ ok: true });
    expect(veces).toBe(1);
  });

  it('con el registro de tiempos ILEGIBLE (es una carpeta) el cierre decide igual: mismo codigo de salida y mismo aviso, sin decir nada del registro', () => {
    const carpeta = path.join(dir, 'es-una-carpeta'); fs.mkdirSync(carpeta);
    for (const [texto, rc] of [[PASA, 0], [FRENA, 2]]) {
      const payload = { hook_event_name: 'Stop', session_id: 'sesion-de-prueba-0003', transcript_path: '', last_assistant_message: texto };
      const bien = correrHook(payload);
      const roto = correrHook(payload, carpeta);
      expect(bien.status).toBe(rc);
      expect(roto.status).toBe(rc);
      expect(roto.stderr).toBe(bien.stderr);
      expect(roto.stdout).toBe('');
    }
    expect(fs.readdirSync(carpeta)).toEqual([]);
  });

  it('correrMedido devuelve EXACTAMENTE lo que devuelve decidir con las mismas piezas (pasa y frena), y les pasa los mismos argumentos', async () => {
    const llamadas = [];
    const piezas = () => ({
      fueraEnEsteTurno: async (p) => { llamadas.push(['relevar', p]); return { fuera: false, ultimoMensajeFak: '', ultimoMensajeFakTs: '' }; },
      firmaIA: (rutas) => { llamadas.push(['firma', rutas]); return []; },
      pendientes: (...a) => { llamadas.push(['pendientes', a.length]); return ['hay 1 archivo(s) sin commitear (x.mjs)']; },
      exportsDelTurno: () => { llamadas.push(['exports']); return []; },
      avisoTanda: () => { llamadas.push(['tanda']); return ''; },
      enCooldown: () => false, marcar: () => {}, yaReclamado: () => true, reclamar: () => {},
    });
    for (const texto of [PASA, FRENA, 'Listo, quedó pusheado.']) {
      const payload = { session_id: 's-1', transcript_path: 'x.jsonl', last_assistant_message: texto };
      llamadas.length = 0;
      const directo = await decidir(payload, piezas());
      const deDirecto = JSON.stringify(llamadas);
      llamadas.length = 0;
      // (las piezas que el medidor no envuelve —marcas y cooldown— llegan por depsReales tal cual en el uso real;
      //  aca se le pasan todas para que las dos corridas usen las mismas)
      const p = piezas();
      const medido = await T.correrMedido({ decidir: (pl, d) => decidir(pl, { ...p, ...d }), depsReales: p, payload, env: { CLAUDE_HOOKS_TIEMPOS: reg } });
      expect(medido, texto).toEqual(directo);
      expect(JSON.stringify(llamadas), texto).toBe(deDirecto);
    }
    // el cierre declarado paso por la fase «pendientes» y quedo medida
    const ultimo = eventos().pop();
    expect(ultimo.ok).toBe(false);
    expect(ultimo.veces.pendientes).toBe(1);
    expect(ultimo.fases).toHaveProperty('tanda');
  });

  it('si decidir tira, correrMedido tira LO MISMO (no se lo traga) y deja el renglon con el error', async () => {
    const piezas = { fueraEnEsteTurno: async () => { throw new Error('registro ilegible'); }, firmaIA: () => [], pendientes: () => [], exportsDelTurno: () => [], avisoTanda: () => '' };
    await expect(T.correrMedido({ decidir, depsReales: piezas, payload: { last_assistant_message: PASA, transcript_path: 'x' }, env: { CLAUDE_HOOKS_TIEMPOS: reg } })).rejects.toThrow('registro ilegible');
    const e = eventos().pop();
    expect(e.ok).toBe(null);
    expect(e.titulo).toBe('ERROR: registro ilegible');
    expect(e.veces.relevar).toBe(1);
  });

  it('el cronometro no cambia lo que envuelve: mismo resultado, misma excepcion, sincronica o con promesa', async () => {
    const c = T.crearCronometro();
    expect(c.envolver('a', (x, y) => x + y)(2, 3)).toBe(5);
    expect(await c.envolver('b', async (x) => x * 2)(4)).toBe(8);
    expect(() => c.envolver('c', () => { throw new Error('boom'); })()).toThrow('boom');
    await expect(c.envolver('d', async () => { throw new Error('bam'); })()).rejects.toThrow('bam');
    expect(c.medir('a', () => 'x')).toBe('x');
    expect(c.veces()).toEqual({ a: 2, b: 1, c: 1, d: 1 });
    expect(Object.keys(c.fases()).sort()).toEqual(['a', 'b', 'c', 'd']);
    // el tiempo se suma por fase
    let reloj = 0;
    const d = T.crearCronometro({ ahora: () => reloj });
    d.envolver('x', () => { reloj += 40; })(); d.envolver('x', () => { reloj += 2.4; })();
    expect(d.fases()).toEqual({ x: 42 });
  });

  it('decidir sin el medidor (como lo llaman los tests y dev-server-guard) sigue igual: `medir` es opcional', async () => {
    const r = await decidir({ last_assistant_message: PASA, transcript_path: '' }, { fueraEnEsteTurno: async () => ({ fuera: false }) });
    expect(r).toEqual({ ok: true });
  });
});

describe('el lector: una corrida matada es un inicio sin fin', () => {
  const AHORA = 1_800_000_000_000;
  const corrida = (id, t, { fin = true, ms = 500, rc = 0, fases = { relevar: 200, firma: 100, resto: 10 }, arranque = 150 } = {}) => [
    { ev: 'inicio', hook: 'cierre-guard', id, t },
    ...(fases ? [{ ev: 'fases', hook: 'cierre-guard', id, t: t + arranque, arranque_ms: arranque, total_ms: ms - arranque, fases, bytes_registro: 4_000_000 }] : []),
    ...(fin ? [{ ev: 'fin', hook: 'cierre-guard', id, t: t + ms, rc, ms }] : []),
  ];

  it('ROJO: un inicio sin fin de hace 10 minutos se cuenta como MATADA; uno de hace 30 segundos esta en curso, no matado', () => {
    const ev = [
      ...corrida('a', AHORA - 3600000),
      ...corrida('b', AHORA - 600000, { fin: false, fases: null }),                 // la app la corto antes de que node anotara
      ...corrida('c', AHORA - 590000, { fin: false, fases: { relevar: 55000 } }),     // node llego a medir y el .sh no volvio
      ...corrida('d', AHORA - 30000, { fin: false }),
    ];
    const r = T.resumir(ev, { ahora: AHORA });
    expect(r).toMatchObject({ corridas: 4, completas: 1, matadas: 2, en_curso: 1 });
    expect(r.matadas_lista.map((m) => m.id)).toEqual(['b', 'c']);
    expect(r.matadas_lista[1].fases).toEqual({ relevar: 55000 });
    expect(T.textoResumen(r)).toContain('2 MATADAS (inicio sin fin)');
  });

  it('VERDE: todas con su fin -> 0 matadas; p50, p90 y maximo por fase, y la fase que domina', () => {
    const ev = [];
    for (let i = 1; i <= 10; i++) ev.push(...corrida(`c${i}`, AHORA - 100000 + i, { ms: i * 1000, rc: i === 10 ? 2 : 0, fases: { relevar: i * 100, firma: i === 10 ? 60000 : 0, resto: 5 } }));
    const r = T.resumir(ev, { ahora: AHORA });
    expect(r).toMatchObject({ corridas: 10, completas: 10, matadas: 0, en_curso: 0, frenadas: 1 });
    expect(r.total).toMatchObject({ n: 10, p50: 5000, p90: 9000, max: 10000 });
    expect(r.fases.relevar).toMatchObject({ n: 10, p50: 500, p90: 900, max: 1000 });
    expect(r.fases.arranque).toMatchObject({ n: 10, p50: 150, max: 150 });
    expect(r.domina.fase).toBe('firma');                                           // una sola corrida de 60 s pesa mas que diez relevar
    expect(T.textoResumen(r)).toContain('OJO: no es «relevar»');
    const soloRelevar = T.resumir(ev.map((e) => (e.fases ? { ...e, fases: { relevar: e.fases.relevar } } : e)), { ahora: AHORA });
    expect(soloRelevar.domina.fase).toBe('relevar');
    expect(T.textoResumen(soloRelevar)).not.toContain('OJO');
  });

  it('--desde deja afuera las corridas anteriores, y otro hook no se mezcla', () => {
    const ev = [...corrida('vieja', AHORA - 86400000 * 3), ...corrida('nueva', AHORA - 60000), { ev: 'inicio', hook: 'otro-hook', id: 'z', t: AHORA - 900000 }];
    expect(T.resumir(ev, { ahora: AHORA }).corridas).toBe(2);
    expect(T.resumir(ev, { ahora: AHORA, desde: AHORA - 86400000 }).corridas).toBe(1);
    expect(T.resumir(ev, { ahora: AHORA, hook: 'otro-hook' })).toMatchObject({ corridas: 1, matadas: 1 });
    expect(T.textoResumen(T.resumir([], { ahora: AHORA }))).toContain('Todavía no hay corridas');
  });

  it('percentil por posicion, y un registro con renglones rotos se lee igual (se cuentan)', () => {
    expect(T.percentil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5)).toBe(5);
    expect(T.percentil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
    expect(T.percentil([7], 0.9)).toBe(7);
    expect(T.percentil([], 0.5)).toBe(null);
    fs.writeFileSync(reg, `${JSON.stringify({ ev: 'inicio', hook: 'cierre-guard', id: 'a', t: 1 })}\n{"ev":"fin","hook":"cierre-g\n\nbasura\n${JSON.stringify({ ev: 'fin', hook: 'cierre-guard', id: 'a', t: 2, rc: 0, ms: 1 })}\n`);
    const l = T.leerRegistro(reg);
    expect(l).toMatchObject({ rotos: 2, existe: true });
    expect(l.eventos).toHaveLength(2);
    expect(T.leerRegistro(path.join(dir, 'no-existe.jsonl'))).toEqual({ eventos: [], rotos: 0, existe: false });
  });

  it('por la linea de comandos: lee un registro real de dos corridas (una matada vieja) y lo resume; un --desde mal escrito sale con 2', () => {
    correrHook({ hook_event_name: 'Stop', session_id: 'sesion-de-prueba-0004', transcript_path: '', last_assistant_message: PASA });
    fs.appendFileSync(reg, `${JSON.stringify({ ev: 'inicio', hook: 'cierre-guard', id: 'matada-vieja', t: Date.now() - 3600000 })}\n`);
    const lector = (...a) => spawnSync('node', [path.join(RAIZ, 'scripts', '_hooksTiempos.mjs'), '--registro', reg, ...a], { encoding: 'utf8' });
    const r = lector('--con-pruebas');
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('cierre-guard: 2 corridas');
    expect(r.stdout).toContain('1 completas · 1 MATADAS (inicio sin fin)');
    expect(r.stdout).toMatch(/relevar\s+1\s/);
    const j = JSON.parse(lector('--json', '--con-pruebas').stdout);
    expect(j).toMatchObject({ corridas: 2, completas: 1, matadas: 1, rotos: 0 });
    // sin --con-pruebas, la corrida que lanzo este test (su registro de conversacion no es el de una sesion) queda afuera
    expect(JSON.parse(lector('--json').stdout)).toMatchObject({ corridas: 1, completas: 0, matadas: 1 });
    // una opcion mal escrita o una fecha que no existe no se ignoran en silencio
    expect(lector('--desd', '2026-10-11').status).toBe(2);
    expect(lector('--desde', '2026-02-30').status).toBe(2);
    expect(JSON.parse(lector('--json', '--con-pruebas', '--desde=2020-01-01').stdout).corridas).toBe(2);
    expect(lector('--desde', 'ayer').status).toBe(2);
    const hoy = new Date(); const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    expect(JSON.parse(lector('--json', '--con-pruebas', '--desde', `${dia} 00:00`).stdout).corridas).toBeGreaterThanOrEqual(1);
  });
});
