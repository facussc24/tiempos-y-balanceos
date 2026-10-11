// permisoGuard: el hook permiso-guard.sh (evento PermissionRequest). Cola P41, si de Fak 09/10/2026 16:55.
// Con una hora fijada por trabajar-hasta para ESA sesion y sin Fak en la ventana, el cartel de permiso se contesta
// solo con deny y el pedido queda anotado en «Lo que necesita a Fak» de la lista. Sin hora, no decide nada.
// ROJO = niega y anota · VERDE = no imprime nada (la app muestra el cartel como siempre). Sale SIEMPRE con 0:
// en este evento el codigo 2 no hace nada (doc oficial de hooks, leida el 10/10/2026).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as H from '../../scripts/_lib/horaGuard.mjs';
import * as P from '../../scripts/_lib/permisoGuard.mjs';

const RAIZ = process.cwd();
let home; let lista;
const LISTA_REAL = [
  '# Lista del orquestador', '', '## Lo pedido, en orden', '', '1. [ ] La cola', '',
  '## Lo que necesita a Fak (para cuando vuelva)', '', '- ~~P84~~ contestada 18:40', '- **CATIA (HOY-20)**: confirmar la licencia', '',
  '## Registro (hora · qué pasó)', '', '- 11:00 · arranqué.', '',
].join('\n');
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'permiso-guard-'));
  lista = path.join(home, 'lista.md');
  fs.writeFileSync(lista, LISTA_REAL);
});
afterEach(() => { fs.rmSync(home, { recursive: true, force: true }); });

const fijar = (sesion, conLista = true) => expect(H.fijar({ sesion, hasta: new Date(Date.now() + 3 * 3600 * 1000), lista: conLista ? lista : null, home }).ok).toBe(true);
const pedido = (extra = {}) => ({ hook_event_name: 'PermissionRequest', session_id: 'prueba-permiso', permission_mode: 'default', tool_name: 'Bash', tool_input: { command: 'git push origin main', description: 'subir' }, ...extra });
const registro = () => { try { return fs.readFileSync(P.rutaRegistro(home), 'utf8'); } catch { return ''; } };
const seccion = () => { const t = fs.readFileSync(lista, 'utf8'); return t.slice(t.indexOf('## Lo que necesita a Fak'), t.indexOf('## Registro')); };
// claves INVENTADAS, armadas por partes para que ningun escaner de secretos las tome por reales al subir el test
const JWT = ['eyJhbGciOiJIUzI1', 'NiJ9.eyJyb2xlIjoi', 'YW5vbiJ9'].join('');
const ANT = ['sk', 'ant', 'api03', 'AbCdEfGh123456'].join('-');
const GOO = ['AI', 'za', 'SyA1234567890abcdefghijklmnopqrstuvw'].join('');
const STR = ['sk', 'live', '51Habcdefghijklmnop'].join('_');
// un mensaje real de Fak (03/10/2026), con sus errores de tipeo
const DE_FAK = 'dejo la tnobook cargandno yo vuevloa ami cas acomo a ala s8pm asi que quedate labruadnoc omo minimo hasta esa hroa';
const registroConFak = (haceMin, texto = DE_FAK) => {
  const t = path.join(home, 'transcript.jsonl');
  fs.writeFileSync(t, `${JSON.stringify({ type: 'user', timestamp: new Date(Date.now() - haceMin * 60000).toISOString(), message: { content: texto } })}\n`);
  return t;
};

describe('permiso-guard — decide (las dos direcciones)', () => {
  it('ROJO: con hora vigente y nadie en la ventana niega con el motivo y anota el pedido en la seccion', () => {
    fijar('prueba-permiso');
    const r = P.decidir(pedido(), { home });
    expect(r.niega).toBe(true);
    const d = r.salida.hookSpecificOutput;
    expect(d.hookEventName).toBe('PermissionRequest');
    expect(d.decision.behavior).toBe('deny');
    expect(d.decision.interrupt).toBeUndefined();                 // no frena a Claude: sigue con otra cosa
    expect(d.decision.message).toContain('No hay nadie en la ventana');
    expect(d.decision.message).toContain('Quedó anotado en «Lo que necesita a Fak»');
    expect(r.anotado).toEqual({ ok: true, como: 'agregado' });
    expect(seccion()).toMatch(/- \*\*Cartel negado \d\d\/\d\d \d\d:\d\d\*\* · Bash: `git push origin main` · sesión prueba-p; no había nadie en la ventana/);
    // el renglon queda ADENTRO de la seccion, despues de lo que ya habia, y el resto de la lista no se toca
    const t = fs.readFileSync(lista, 'utf8');
    expect(t.indexOf('CATIA (HOY-20)')).toBeLessThan(t.indexOf('Cartel negado'));
    expect(t.indexOf('Cartel negado')).toBeLessThan(t.indexOf('## Registro'));
    expect(t.replace(/^- \*\*Cartel negado.*\n/m, '')).toBe(LISTA_REAL);
  });

  it('VERDE: sin hora fijada para esa sesion no decide nada y no toca la lista', () => {
    const r = P.decidir(pedido(), { home });
    expect(r).toEqual({ niega: false, motivo: 'sin_hora' });
    expect(fs.readFileSync(lista, 'utf8')).toBe(LISTA_REAL);
  });

  it('VERDE: la hora fijada es de OTRA sesion, o ya vencio, o se cerro con --terminar', () => {
    fijar('otra-sesion');
    expect(P.decidir(pedido(), { home }).niega).toBe(false);
    fijar('prueba-permiso');
    expect(P.decidir(pedido(), { home, ahora: new Date(Date.now() + 4 * 3600 * 1000) }).motivo).toBe('sin_hora');
    expect(H.terminar({ sesion: 'prueba-permiso', porque: 'Fak dijo que pare, ya esta', home }).ok).toBe(true);
    expect(P.decidir(pedido(), { home }).motivo).toBe('sin_hora');
  });

  it('VERDE: Fak escribio hace 1 minuto en esa sesion -> esta en la ventana, el cartel se le muestra', () => {
    fijar('prueba-permiso');
    const r = P.decidir(pedido({ transcript_path: registroConFak(1) }), { home });
    expect(r.niega).toBe(false);
    expect(r.motivo).toBe('fak_presente');
    expect(fs.readFileSync(lista, 'utf8')).toBe(LISTA_REAL);
  });

  it('ROJO: Fak escribio hace 5 o hace 40 minutos (el caso de los 55 del 04/10) -> ya no esta: niega', () => {
    fijar('prueba-permiso');
    expect(P.CANON.presencia_minutos).toBe(3);
    expect(P.decidir(pedido({ transcript_path: registroConFak(5) }), { home }).niega).toBe(true);
    expect(P.decidir(pedido({ transcript_path: registroConFak(40) }), { home }).niega).toBe(true);
    // un mensaje con la hora en el futuro (reloj corrido) no cuenta como presencia
    expect(P.decidir(pedido({ transcript_path: registroConFak(-30) }), { home }).niega).toBe(true);
  });

  it('VERDE: Fak contesto una pregunta o corto el turno hace 30 segundos, aunque su ultimo mensaje sea de hace 10 minutos -> esta', () => {
    fijar('prueba-permiso');
    const t = path.join(home, 'transcript.jsonl');
    const hace = (seg) => new Date(Date.now() - seg * 1000).toISOString();
    const mensaje = JSON.stringify({ type: 'user', timestamp: hace(600), message: { content: DE_FAK } });
    // la forma real de una respuesta a AskUserQuestion en el registro (sesion 829f7135, 12/09/2026)
    const respuesta = (seg) => JSON.stringify({ type: 'user', timestamp: hace(seg), message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_01', content: 'User has answered your questions' }] }, toolUseResult: { questions: [{ header: 'Caballete' }], answers: { Caballete: 'Sacalo' } } });
    const resultadoComun = JSON.stringify({ type: 'user', timestamp: hace(5), message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_02', content: 'ok' }] }, toolUseResult: { stdout: 'ok' } });
    fs.writeFileSync(t, `${mensaje}\n${resultadoComun}\n`);
    expect(P.decidir(pedido({ transcript_path: t }), { home }).niega, 'el resultado de un comando no es presencia').toBe(true);
    fs.writeFileSync(lista, LISTA_REAL);
    fs.writeFileSync(t, `${mensaje}\n${respuesta(30)}\n${resultadoComun}\n`);
    expect(P.ultimaSenalDeFak(t).que).toBe('respuesta');
    expect(P.decidir(pedido({ transcript_path: t }), { home }).motivo).toBe('fak_presente');
    // la misma respuesta de hace 15 minutos ya no cuenta
    fs.writeFileSync(t, `${mensaje}\n${respuesta(900)}\n`);
    expect(P.decidir(pedido({ transcript_path: t }), { home }).niega).toBe(true);
  });

  it('ROJO: un corte del turno NO cuenta como presencia (otra sesion que frena a esta queda escrita igual que un Esc de Fak)', () => {
    fijar('prueba-permiso');
    const t = path.join(home, 'transcript.jsonl');
    const hace = (seg) => new Date(Date.now() - seg * 1000).toISOString();
    // la forma real (sesion 2762936c, 10/10/2026: el orquestador la freno con stop_session para reenviarle el encargo)
    const corte = JSON.stringify({ type: 'user', timestamp: hace(20), isSidechain: false, userType: 'external', message: { role: 'user', content: [{ type: 'text', text: '[Request interrupted by user]' }] } });
    const encargo = JSON.stringify({ type: 'user', timestamp: hace(15), message: { content: 'Another Claude session sent a message:\n<cross-session-message from="local_x">[ENCARGO E1]</cross-session-message>' } });
    fs.writeFileSync(t, `${corte}\n${encargo}\n`);
    expect(P.ultimaSenalDeFak(t)).toBe(null);
    expect(P.decidir(pedido({ transcript_path: t }), { home }).niega).toBe(true);
  });

  it('el motivo no invita a esquivar el permiso: ni otra herramienta ni tocar la configuracion', () => {
    fijar('prueba-permiso');
    const m = P.decidir(pedido(), { home }).salida.hookSpecificOutput.decision.message;
    expect(m).toContain(P.NO_ESQUIVAR);
    expect(m).toContain('no lo consigas con otra herramienta');
    expect(m).toContain('no toques la configuración de permisos');
    expect(m).not.toMatch(/busc[aá] otro camino/i);
  });

  it('con varios permisos negados seguidos a la misma sesion el motivo lo dice (contados del registro); a otra sesion no le cuentan', () => {
    fijar('prueba-permiso'); fijar('otra-sesion');
    const mensajes = [];
    for (let i = 0; i < P.CANON.aviso_repetidos; i++) mensajes.push(JSON.parse(P.correr(JSON.stringify(pedido({ tool_input: { command: `echo ${i}` } })), { home })).hookSpecificOutput.decision.message);
    expect(mensajes[0]).not.toContain('Ya van');
    expect(mensajes[P.CANON.aviso_repetidos - 1]).toContain(`Ya van ${P.CANON.aviso_repetidos} permisos negados`);
    const otra = JSON.parse(P.correr(JSON.stringify(pedido({ session_id: 'otra-sesion' })), { home })).hookSpecificOutput.decision.message;
    expect(otra).not.toContain('Ya van');
    // los de hace mas de 10 minutos ya no cuentan
    expect(P.negadasRecientes('prueba-permiso', { home, ahora: new Date(Date.now() + 15 * 60000) })).toBe(0);
  });

  it('ROJO: lo ultimo del registro es el encargo de otra sesion o una tarea programada, no Fak -> niega', () => {
    fijar('prueba-permiso');
    for (const texto of ['[SCHEDULED TASK - AUTOMATED FIRING OF A CONFIGURED PROMPT]\nhace tal cosa', 'Another Claude session sent a message:\n<cross-session-message from="local_x">[ENCARGO E1]</cross-session-message>', '<task-notification>\n<task-id>abc</task-id></task-notification>']) {
      fs.writeFileSync(lista, LISTA_REAL);
      expect(P.decidir(pedido({ transcript_path: registroConFak(1, texto) }), { home }).niega, texto.slice(0, 30)).toBe(true);
    }
  });

  it('VERDE: una PREGUNTA a Fak no se contesta sola (AskUserQuestion, ExitPlanMode), aunque no haya nadie', () => {
    fijar('prueba-permiso');
    for (const tool_name of ['AskUserQuestion', 'ExitPlanMode']) {
      const r = P.decidir(pedido({ tool_name, tool_input: { questions: [] } }), { home });
      expect(r.niega, tool_name).toBe(false);
      expect(r.motivo).toBe('es_una_pregunta');
    }
    expect(fs.readFileSync(lista, 'utf8')).toBe(LISTA_REAL);
  });

  it('nunca contesta allow, pase lo que pase en la entrada', () => {
    fijar('prueba-permiso');
    const entradas = [pedido(), pedido({ tool_name: 'Write', tool_input: { file_path: 'C:/x.txt', content: 'allow' } }), pedido({ permission_suggestions: [{ type: 'setMode', mode: 'bypassPermissions', destination: 'session' }] }), pedido({ permission_mode: 'bypassPermissions' })];
    for (const e of entradas) {
      const out = P.correr(JSON.stringify(e), { home });
      expect(out).not.toMatch(/"allow"|updatedPermissions|updatedInput/);
      expect(JSON.parse(out).hookSpecificOutput.decision.behavior).toBe('deny');
    }
  });

  it('un subagente de una sesion con hora tambien se colgaria: se niega igual y el renglon lo dice', () => {
    fijar('prueba-permiso');
    expect(P.decidir(pedido({ agent_id: 'agente-1' }), { home }).niega).toBe(true);
    expect(seccion()).toContain('un subagente; no había nadie en la ventana');
  });
});

describe('permiso-guard — una sesion LANZADA hereda la hora de la que la lanzo (cola P41b)', () => {
  const MADRE = 'madre-con-hora-0001';
  const hija = (extra = {}) => pedido({ session_id: 'hija-lanzada-0001', ...extra });

  it('VERDE: una hija que no se anoto no tiene hora, aunque la madre si: no decide', () => {
    fijar(MADRE);
    expect(P.decidir(hija(), { home })).toEqual({ niega: false, motivo: 'sin_hora' });
  });

  it('ROJO: la hija se anota (--heredar) y un cartel suyo se niega y queda en la lista de la MADRE', () => {
    fijar(MADRE);
    const h = P.heredar({ sesion: 'hija-lanzada-0001', madre: MADRE, home });
    expect(h).toMatchObject({ ok: true, madre: MADRE, hora: { lista: path.resolve(lista) } });
    const r = P.decidir(hija(), { home });
    expect(r.niega).toBe(true);
    expect(r.motivo).toBe('nadie_en_la_ventana_hora_de_la_madre');
    expect(r.salida.hookSpecificOutput.decision.message).toContain('Fak le pidió a la sesión que te lanzó trabajar hasta las');
    expect(seccion()).toMatch(/Cartel negado .* · Bash: `git push origin main` · sesión hija-lan; no había nadie en la ventana/);
    // la hija NO queda con una hora propia: hora-guard no la obliga a seguir hasta la hora de la madre
    expect(H.vigente('hija-lanzada-0001', { home })).toBe(null);
    expect(H.decidirStop({ session_id: 'hija-lanzada-0001', last_assistant_message: 'Terminé. Resumen final.' }, { home }).ok).toBe(true);
  });

  it('la hija sigue a la madre: si la madre termina su hora, la hija deja de negar; si la vuelve a fijar, niega otra vez', () => {
    fijar(MADRE);
    P.heredar({ sesion: 'hija-lanzada-0001', madre: MADRE, home });
    expect(P.decidir(hija(), { home }).niega).toBe(true);
    expect(H.terminar({ sesion: MADRE, porque: 'Fak dijo que pare, ya esta', home }).ok).toBe(true);
    expect(P.decidir(hija({ tool_input: { command: 'echo 2' } }), { home }).motivo).toBe('sin_hora');
    fijar(MADRE);
    expect(P.decidir(hija({ tool_input: { command: 'echo 3' } }), { home }).niega).toBe(true);
  });

  it('VERDE: si Fak le escribe a la hija en SU ventana, esta: el cartel se le muestra', () => {
    fijar(MADRE);
    P.heredar({ sesion: 'hija-lanzada-0001', madre: MADRE, home });
    expect(P.decidir(hija({ transcript_path: registroConFak(1) }), { home }).motivo).toBe('fak_presente');
  });

  it('un solo nivel: la hija de una hija no hereda de la abuela; y la hora propia le gana a la heredada', () => {
    fijar(MADRE);
    P.heredar({ sesion: 'hija-lanzada-0001', madre: MADRE, home });
    P.heredar({ sesion: 'nieta-0001', madre: 'hija-lanzada-0001', home });
    expect(P.horaPara('nieta-0001', { home })).toBe(null);
    fijar('hija-lanzada-0001');
    expect(P.horaPara('hija-lanzada-0001', { home }).heredada_de).toBeUndefined();
  });

  it('la anotacion vence a los 14 dias: una hija vieja no hereda una hora nueva de la madre', () => {
    P.heredar({ sesion: 'hija-lanzada-0001', madre: MADRE, home, ahora: new Date(Date.now() - 15 * 86400000) });
    fijar(MADRE);
    expect(P.horaPara('hija-lanzada-0001', { home })).toBe(null);
    expect(P.decidir(hija(), { home }).motivo).toBe('sin_hora');
    P.heredar({ sesion: 'hija-lanzada-0001', madre: MADRE, home, ahora: new Date(Date.now() - 13 * 86400000) });
    expect(P.horaPara('hija-lanzada-0001', { home }).heredada_de).toBe(MADRE);
  });

  it('ROJO: el cartel es por el PROPIO comando de anotarse (hija en modo normal, sin anotar): el hook la anota y lo dice, no la deja colgada', () => {
    fijar(MADRE);
    const r = P.decidir(hija({ tool_input: { command: `node scripts/_lib/permisoGuard.mjs --heredar ${MADRE}` } }), { home });
    expect(r.niega).toBe(true);
    expect(r.motivo).toBe('anotada_por_el_hook');
    expect(r.salida.hookSpecificOutput.decision).toMatchObject({ behavior: 'deny' });
    expect(r.salida.hookSpecificOutput.decision.message).toContain('ya no hace falta correrlo: quedaste anotada como lanzada por la sesión madre-co');
    expect(P.horaPara('hija-lanzada-0001', { home }).heredada_de).toBe(MADRE);
    expect(fs.readFileSync(lista, 'utf8')).toBe(LISTA_REAL);          // no es un pendiente para Fak: no se anota en la lista
    // el cartel siguiente ya se niega como el de cualquier hija anotada
    expect(P.decidir(hija(), { home }).motivo).toBe('nadie_en_la_ventana_hora_de_la_madre');
  });

  it('VERDE: el comando de anotarse NO anota si la madre no tiene hora, si viene con algo pegado, o si es otro comando que lo nombra', () => {
    const cmd = `node scripts/_lib/permisoGuard.mjs --heredar ${MADRE}`;
    expect(P.decidir(hija({ tool_input: { command: cmd } }), { home }).motivo).toBe('sin_hora');   // la madre sin hora
    fijar(MADRE);
    for (const c of [`${cmd} && git push origin main`, `echo x; ${cmd}`, `${cmd} --sesion otra-sesion-0001`, `cat nota.txt # ${cmd}`, `node otro/permisoGuard.mjs --heredar ${MADRE}`]) {
      expect(P.decidir(hija({ tool_input: { command: c } }), { home }), c).toEqual({ niega: false, motivo: 'sin_hora' });
    }
    expect(fs.existsSync(P.rutaHeredadas(home))).toBe(false);
  });

  it('por la linea de comandos: un punto pegado al id no rompe (el renglon del encargo puede terminar la oracion ahi); otra opcion no es un id', () => {
    fijar(MADRE);
    const env = { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_CODE_SESSION_ID: 'hija-lanzada-0001' };
    const correr = (...args) => spawnSync('node', [path.join(RAIZ, 'scripts', '_lib', 'permisoGuard.mjs'), ...args], { encoding: 'utf8', env });
    expect(correr('--heredar', `${MADRE}.`).status).toBe(0);
    expect(P.horaPara('hija-lanzada-0001', { home }).heredada_de).toBe(MADRE);
    const mal = correr('--heredar', '--sesion', 'otra-sesion-0001');
    expect(mal.status).toBe(1);
    expect(correr('--heredadas').stdout).toContain('hija-lan ← madre-co');
  });

  it('--heredar rechaza lo que no es un id de sesion, y no deja a una sesion ser su propia madre', () => {
    expect(P.heredar({ sesion: '', madre: MADRE, home }).ok).toBe(false);
    expect(P.heredar({ sesion: 'hija-lanzada-0001', madre: '', home }).ok).toBe(false);
    expect(P.heredar({ sesion: 'hija-lanzada-0001', madre: 'abc; rm -rf', home }).ok).toBe(false);
    expect(P.heredar({ sesion: 'hija-lanzada-0001', madre: 'hija-lanzada-0001', home }).ok).toBe(false);
    expect(fs.existsSync(P.rutaHeredadas(home))).toBe(false);
  });

  it('por la linea de comandos, como lo corre la hija: toma su sesion de CLAUDE_CODE_SESSION_ID y despues el hook real la niega', () => {
    fijar(MADRE);
    const env = { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_CODE_SESSION_ID: 'hija-lanzada-0001' };
    const r = spawnSync('node', [path.join(RAIZ, 'scripts', '_lib', 'permisoGuard.mjs'), '--heredar', MADRE], { encoding: 'utf8', env });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('Anotado: te lanzó la sesión madre-co, que tiene hora de trabajo hasta las');
    const hook = spawnSync('bash', [path.join(RAIZ, '.claude', 'hooks', 'permiso-guard.sh')], { input: JSON.stringify(hija()), encoding: 'utf8', env });
    expect(hook.status).toBe(0);
    expect(JSON.parse(hook.stdout).hookSpecificOutput.decision.behavior).toBe('deny');
    expect(seccion()).toContain('sesión hija-lan');
    const sinMadre = spawnSync('node', [path.join(RAIZ, 'scripts', '_lib', 'permisoGuard.mjs'), '--heredar'], { encoding: 'utf8', env });
    expect(sinMadre.status).toBe(1);
  });
});

describe('permiso-guard — el renglon en la lista', () => {
  it('el mismo pedido repetido no suma renglones; uno distinto si', () => {
    fijar('prueba-permiso');
    expect(P.decidir(pedido(), { home }).anotado.como).toBe('agregado');
    const dos = P.decidir(pedido(), { home, ahora: new Date(Date.now() + 5 * 60000) });
    expect(dos.niega).toBe(true);
    expect(dos.anotado.como).toBe('ya_estaba');
    expect(P.decidir(pedido({ tool_input: { command: 'npm install left-pad' } }), { home }).anotado.como).toBe('agregado');
    expect(seccion().match(/Cartel negado/g)).toHaveLength(2);
  });

  it('el mismo pedido ya figura CERRADO (tachado o [x]) o nombrado en una nota: se anota de nuevo, no dice «ya estaba»', () => {
    fijar('prueba-permiso');
    const cerrados = ['- ~~**Cartel negado 10/10 18:00** · Bash: `git push origin main` · sesión prueba-p; no había nadie en la ventana~~ hecho 18:30', '- [x] **Cartel negado 10/10 18:00** · Bash: `git push origin main` · sesión prueba-p', '- nota: lo de · Bash: `git push origin main` ya lo hablamos'];
    for (const viejo of cerrados) {
      fs.writeFileSync(lista, LISTA_REAL.replace('- **CATIA (HOY-20)**', `${viejo}\n- **CATIA (HOY-20)**`));
      const r = P.decidir(pedido(), { home });
      expect(r.anotado.como, viejo.slice(0, 20)).toBe('agregado');
      expect(seccion().match(/^- \*\*Cartel negado/gm), viejo.slice(0, 20)).toHaveLength(1);
    }
  });

  it('una lista vacia: queda el titulo y el renglon, sin un renglon en blanco arriba', () => {
    fs.writeFileSync(lista, '');
    fijar('prueba-permiso');
    expect(P.decidir(pedido(), { home }).anotado.como).toBe('agregado');
    expect(fs.readFileSync(lista, 'utf8')).toMatch(/^## Lo que necesita a Fak \(para cuando vuelva\)\n\n- \*\*Cartel negado [^\n]+\n$/);
  });

  it('el nombre de la herramienta y la sesion no pueden meter Markdown ni renglones en la lista', () => {
    fijar('prueba-permiso');
    const r = P.renglonDe(pedido({ tool_name: 'Bash\n## Lo pedido\n- **x**', session_id: 'a*b`c\nd' }));
    expect(r.renglon.split('\n')).toHaveLength(1);
    expect(r.herramienta).toBe('BashLopedido-x');
    expect(r.renglon).toContain('sesión abcd;');
  });

  it('la lista no tiene la seccion: se crea al final con su titulo', () => {
    fs.writeFileSync(lista, '# Lista\n\n- una cosa\n');
    fijar('prueba-permiso');
    expect(P.decidir(pedido(), { home }).anotado.como).toBe('agregado');
    const t = fs.readFileSync(lista, 'utf8');
    expect(t).toMatch(/^# Lista\n\n- una cosa\n\n## Lo que necesita a Fak \(para cuando vuelva\)\n\n- \*\*Cartel negado [^\n]+\n$/);
  });

  it('la seccion es la ultima del archivo y esta vacia: el renglon queda debajo del titulo', () => {
    fs.writeFileSync(lista, '# Lista\n\n## Lo que necesita a Fak\n');
    fijar('prueba-permiso');
    expect(P.decidir(pedido(), { home }).anotado.como).toBe('agregado');
    expect(fs.readFileSync(lista, 'utf8')).toMatch(/^# Lista\n\n## Lo que necesita a Fak\n\n- \*\*Cartel negado [^\n]+\n$/);
  });

  it('respeta los finales de linea de Windows (CRLF) de la lista', () => {
    fs.writeFileSync(lista, LISTA_REAL.replace(/\n/g, '\r\n'));
    fijar('prueba-permiso');
    expect(P.decidir(pedido(), { home }).anotado.como).toBe('agregado');
    const t = fs.readFileSync(lista, 'utf8');
    expect(t.replace(/\r\n/g, '')).not.toContain('\n');
    expect(t.replace(/\r\n/g, '\n').replace(/^- \*\*Cartel negado.*\n/m, '')).toBe(LISTA_REAL);
  });

  it('ROJO sin archivo de lista: niega igual, lo dice en el motivo y queda en el registro', () => {
    fijar('prueba-permiso', false);
    const out = P.correr(JSON.stringify(pedido()), { home });
    const m = JSON.parse(out).hookSpecificOutput.decision.message;
    expect(m).toContain('No lo pude anotar en la lista');
    expect(m).not.toContain('Quedó anotado');
    expect(registro()).toMatch(/NIEGA\tnadie_en_la_ventana\tprueba-p\tdefault\tBash\tgit push origin main\tlista:sin_lista/);
  });

  it('con el tope de carteles anotados deja de sumar renglones, pero sigue negando', () => {
    fijar('prueba-permiso');
    for (let i = 0; i < P.CANON.tope_renglones; i++) expect(P.decidir(pedido({ tool_input: { command: `echo ${i}` } }), { home }).anotado.como).toBe('agregado');
    const r = P.decidir(pedido({ tool_input: { command: 'echo uno-mas' } }), { home });
    expect(r.niega).toBe(true);
    expect(r.anotado.como).toBe('tope');
    expect(seccion().match(/Cartel negado/g)).toHaveLength(P.CANON.tope_renglones);
  });

  it('lo que anota lo lee tandaReglas como algo abierto que espera a Fak (mismo titulo de seccion)', async () => {
    const T = await import('../../scripts/_lib/tandaReglas.mjs');
    fijar('prueba-permiso');
    const antes = T.preguntasEnLista(lista).length;
    P.decidir(pedido(), { home });
    const despues = T.preguntasEnLista(lista);
    expect(despues).toHaveLength(antes + 1);
    expect(despues[despues.length - 1]).toContain('Cartel negado');
  });
});

describe('permiso-guard — el resumen: una linea, corta y sin secretos (la lista va a un repo publico)', () => {
  it('toma el comando, el archivo o la direccion, nunca el contenido', () => {
    expect(P.resumenDe({ tool_input: { command: 'rm -rf node_modules', description: 'x' } })).toBe('rm -rf node_modules');
    expect(P.resumenDe({ tool_input: { file_path: 'C:\\Dev\\x.md', content: 'TEXTO LARGO QUE NO VA' } })).toBe('C:\\Dev\\x.md');
    expect(P.resumenDe({ tool_input: { url: 'https://ejemplo.com/a?token=abc123&x=1', prompt: 'leelo' } })).toBe('https://ejemplo.com/a?…');
    expect(P.resumenDe({ tool_input: { session_id: 'local_1', mode: 'bypassPermissions', cosas: [1, 2], cfg: { a: 1 } } })).toBe('session_id=local_1 mode=bypassPermissions cosas=(lista) cfg=(objeto)');
    // un texto libre de una herramienta que no conozco (un mensaje a otra sesion, un prompt) no va a la lista
    expect(P.resumenDe({ tool_input: { session_id: 'local_1', message: 'decile a Carlos que el consumo es 0,023' } })).toBe('session_id=local_1 message=(texto)');
    expect(P.resumenDe({ tool_input: {} })).toBe('');
    expect(P.resumenDe({})).toBe('');
  });

  it('una sola linea, sin acentos graves, recortada al tope', () => {
    const r = P.resumenDe({ tool_input: { command: `  echo \`uno\`\t dos   tres ${'palabra '.repeat(60)}\nsegundo renglon` } });
    expect(r).not.toMatch(/[`\n\t]/);
    expect(r.startsWith('echo uno dos tres palabra')).toBe(true);
    expect(r.length).toBe(P.CANON.tope_resumen + 1);
    expect(r.endsWith('…')).toBe(true);
  });

  it('tapa lo que tiene forma de clave', () => {
    const casos = [
      ['curl -H "Authorization: Bearer abcdef1234567890XYZ" https://api.x.com/v1', 'abcdef1234567890XYZ'],
      [`VITE_SUPABASE_ANON_KEY=${JWT}.firma123 node x.mjs`, JWT.slice(0, 20)],
      [`export ANTHROPIC_API_KEY=${ANT}`, ANT],
      ['mysql --password hunter2secreto -u root', 'hunter2secreto'],
      ['git clone https://fak:miClave99@github.com/x/y.git', 'miClave99'],
      ['node x.mjs --clave="la clave de fak" --otro 1', 'la clave de fak'],
      ['echo 0123456789abcdef0123456789abcdef0123456789abcdef', '0123456789abcdef0123456789abcdef0123456789abcdef'],
      ['curl -d \'{"password":"p4ssw0rd!","user":"fak"}\' https://x.com', 'p4ssw0rd!'],
    ];
    for (const [cmd, secreto] of casos) {
      const r = P.resumenDe({ tool_input: { command: cmd } });
      expect(r, cmd).not.toContain(secreto);
      expect(r, cmd).toContain('«tapado»');
    }
  });

  it('tapa las formas que marcaron las dos revisiones del 10/10 (API y auditor)', () => {
    const casos = [
      ['curl -u fak:miClave99 https://x.com/a', 'miClave99'],
      ['sshpass -p secreto123 ssh fak@server', 'secreto123'],
      ['mysql -u root -pHunter2abc base', 'Hunter2abc'],
      ['net use Y: \\\\server\\BARACK ClaveDeRed9 /user:fak', 'ClaveDeRed9'],
      ['$c = ConvertTo-SecureString "MiClave#1" -AsPlainText -Force', 'MiClave#1'],
      ['curl -d \'{"accessToken":"abc123def456","client_secret":"zzz999yyy"}\' https://x.com', 'abc123def456'],
      ['DB_PASS=tr0ub4dor node x.mjs', 'tr0ub4dor'],
      ['curl -H "Authorization: Token 9f8e7d6c5b4a" https://x.com', '9f8e7d6c5b4a'],
      [`curl https://maps.x.com --header "X-Api-Key: ${GOO}"`, GOO],
      [`curl https://maps.x.com/a/${GOO}/b`, GOO],
      [`stripe charges list ${STR}`, STR],
    ];
    for (const [cmd, secreto] of casos) {
      const r = P.resumenDe({ tool_input: { command: cmd } });
      expect(r, cmd).not.toContain(secreto);
      expect(r, cmd).toContain('«tapado»');
    }
  });

  it('de un comando va solo el primer renglon: el contenido de un heredoc no llega a la lista', () => {
    const r = P.resumenDe({ tool_input: { command: 'cat > nota.txt <<EOF\nel consumo del Sika es 0,023 y la clave del server es Pepe123\nEOF' } });
    expect(r).toBe('cat > nota.txt <<EOF');
  });

  it('un pedido enorme no cuelga el hook: 200.000 caracteres en menos de 1 segundo (tardaba mas de 20 y el cartel quedaba colgado)', () => {
    for (const largo of ['a.'.repeat(100000), 'key'.repeat(70000), `https://${'a.'.repeat(100000)}`, 'eyJ-'.repeat(50000), 'ab-'.repeat(70000)]) {
      const t = Date.now();
      const r = P.resumenDe({ tool_input: { command: `node -e ${largo}` } });
      expect(Date.now() - t, largo.slice(0, 12)).toBeLessThan(1000);
      expect(r.length).toBeLessThanOrEqual(P.CANON.tope_resumen + 1);
      const u = Date.now();
      P.resumenDe({ tool_input: { url: largo } }); P.taparSecretos(largo);
      expect(Date.now() - u, `url ${largo.slice(0, 12)}`).toBeLessThan(1000);
    }
  });

  it('no tapa lo que no es una clave: rutas, comandos comunes, nombres de archivo largos e ids de sesion', () => {
    for (const cmd of ['git push origin main', 'node scripts/_lib/permisoGuard.mjs --registro', 'npx vitest run __tests__/scripts/permisoGuard.test.mjs --pool=threads', 'C:\\Dev\\BarackMercosul\\docs\\drafts\\LISTA_ORQUESTADOR_2026-10-10.md',
      'cat memory\\feedback_la_caja_soy_yo_pensar_fuera_de_lo_que_dijo_fak.md', 'cat docs/PLAN_HOY19_SKILLS_FUNCIONES_NUEVAS_2026-10-10.md', 'node x.mjs --sesion local_57bc534e-236d-4b1e-9ad6-7bea5fd3df64', 'node scripts/_apiTarea.mjs --max-tokens=2500 --tarea p41', 'echo $PWD && psql -p 5432 base']) {
      expect(P.resumenDe({ tool_input: { command: cmd } })).toBe(cmd);
    }
  });
});

describe('permiso-guard — si algo se rompe no decide y lo deja en el registro', () => {
  it('JSON roto, vacio o sin herramienta: no imprime nada y deja una linea', () => {
    for (const [crudo, motivo] of [['{esto no es json', 'json_roto'], ['', 'json_roto'], ['[]', 'json_roto'], ['null', 'json_roto'], [JSON.stringify({ hook_event_name: 'PermissionRequest', session_id: 's' }), 'sin_herramienta'], [JSON.stringify(pedido({ hook_event_name: 'Stop' })), 'otro_evento']]) {
      expect(P.correr(crudo, { home }), crudo).toBe('');
      expect(registro().trimEnd().split('\n').pop(), crudo).toContain(`no_decide\t${motivo}`);
    }
  });

  it('leer el registro de la conversacion falla -> Fak cuenta como ausente (no se sabe que este): niega, no cuelga', () => {
    fijar('prueba-permiso');
    const out = P.correr(JSON.stringify(pedido({ transcript_path: 'x' })), { home, ultimoDeFak: () => { throw new Error('se rompio leyendo'); } });
    expect(JSON.parse(out).hookSpecificOutput.decision.behavior).toBe('deny');
  });

  it('una excepcion adentro SIN hora fijada: no decide (VERDE) y queda ERROR en el registro', () => {
    const roto = P.correr(JSON.stringify(pedido()), { home, get ahora() { throw new Error('reloj roto'); } });
    expect(roto).toBe('');
    expect(registro()).toMatch(/ERROR\tse_rompio\tprueba-p\t\tBash\tError: reloj roto/);
  });

  it('una excepcion adentro CON hora fijada: niega igual con un motivo generico (ROJO; no decidir ahi es dejar el cartel colgado)', () => {
    fijar('prueba-permiso');
    const roto = P.correr(JSON.stringify(pedido()), { home, get ahora() { throw new Error('reloj roto'); } });
    const d = JSON.parse(roto).hookSpecificOutput.decision;
    expect(d.behavior).toBe('deny');
    expect(d.message).toContain('El control falló al anotarlo');
    expect(d.message).toContain(P.NO_ESQUIVAR);
    expect(registro()).toContain('ERROR\tse_rompio_niega_igual');
    // una pregunta a Fak no se niega ni asi
    expect(P.correr(JSON.stringify(pedido({ tool_name: 'AskUserQuestion' })), { home, get ahora() { throw new Error('reloj roto'); } })).toBe('');
  });

  it('dos corridas a la vez sobre la misma lista no pierden un renglon (candado), y el candado no queda puesto', async () => {
    fijar('prueba-permiso');
    const { spawn } = await import('node:child_process');
    const una = (i) => new Promise((ok) => {
      const h = spawn('node', [path.join(RAIZ, 'scripts', '_lib', 'permisoGuard.mjs'), '--hook'], { env: { ...process.env, HOME: home, USERPROFILE: home } });
      h.on('close', ok); h.stdin.end(JSON.stringify(pedido({ tool_input: { command: `echo paralelo-${i}` } })));
    });
    await Promise.all([0, 1, 2, 3, 4, 5].map(una));
    expect(seccion().match(/Cartel negado/g)).toHaveLength(6);
    expect(fs.readdirSync(home).filter((n) => /\.lock$|\.tmp$/.test(n))).toEqual([]);
  }, 30000);

  it('el candado se RESPETA: con el candado puesto por otro, la corrida espera a que lo suelten antes de escribir', async () => {
    // (el test de arriba puede dar verde sin candado, porque el arranque de node suele poner las corridas en fila;
    // este no: si anotarEnLista no mirara el candado, escribiria enseguida)
    fijar('prueba-permiso');
    const candado = `${lista}.permiso.lock`;
    fs.writeFileSync(candado, '');
    const { spawn } = await import('node:child_process');
    const t0 = Date.now();
    let anotoA = null;
    const mirar = setInterval(() => { if (anotoA === null && fs.readFileSync(lista, 'utf8').includes('Cartel negado')) anotoA = Date.now() - t0; }, 20);
    setTimeout(() => { try { fs.unlinkSync(candado); } catch { /* ya no estaba */ } }, 900);
    await new Promise((ok) => {
      const h = spawn('node', [path.join(RAIZ, 'scripts', '_lib', 'permisoGuard.mjs'), '--hook'], { env: { ...process.env, HOME: home, USERPROFILE: home } });
      h.on('close', ok); h.stdin.end(JSON.stringify(pedido()));
    });
    clearInterval(mirar);
    expect(seccion()).toContain('Cartel negado');
    expect(anotoA === null ? Date.now() - t0 : anotoA).toBeGreaterThanOrEqual(850);
    expect(fs.existsSync(candado)).toBe(false);
  }, 30000);

  it('un candado viejo (o con fecha del futuro) no traba: se saca y se anota', () => {
    fijar('prueba-permiso');
    const candado = `${lista}.permiso.lock`;
    for (const corrimiento of [-60000, 3600000]) {
      fs.writeFileSync(candado, '');
      const cuando = new Date(Date.now() + corrimiento);
      fs.utimesSync(candado, cuando, cuando);
      const t = Date.now();
      expect(P.decidir(pedido({ tool_input: { command: `echo ${corrimiento}` } }), { home }).anotado.como).toBe('agregado');
      expect(Date.now() - t).toBeLessThan(1500);
      expect(fs.existsSync(candado)).toBe(false);
    }
  });

  it('cada corrida deja su linea: asi se mide si el evento llega de verdad', () => {
    P.correr(JSON.stringify(pedido()), { home });
    fijar('prueba-permiso');
    P.correr(JSON.stringify(pedido()), { home });
    const l = registro().trimEnd().split('\n');
    expect(l).toHaveLength(2);
    expect(l[0]).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d\tno_decide\tsin_hora\tprueba-p\tdefault\tBash/);
    expect(l[1]).toContain('NIEGA\tnadie_en_la_ventana');
  });
});

describe('el wrapper permiso-guard.sh llega a permisoGuard.mjs (bash -> node, como lo corre Claude Code)', () => {
  const correr = (crudo) => spawnSync('bash', [path.join(RAIZ, '.claude', 'hooks', 'permiso-guard.sh')], { input: crudo, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } });

  it('VERDE exit 0 y sin salida cuando no hay hora fijada; ROJO: con hora, deny en stdout y renglon en la lista (exit 0 igual: el 2 no sirve aca)', () => {
    const verde = correr(JSON.stringify(pedido()));
    expect(verde.status).toBe(0);
    expect(verde.stdout).toBe('');
    fijar('prueba-permiso');
    const rojo = correr(JSON.stringify(pedido()));
    expect(rojo.status).toBe(0);
    expect(rojo.status).not.toBe(2);
    const d = JSON.parse(rojo.stdout).hookSpecificOutput;
    expect(d).toMatchObject({ hookEventName: 'PermissionRequest', decision: { behavior: 'deny' } });
    expect(d.decision.message).toContain(P.MARCA);
    expect(seccion()).toContain('Cartel negado');
  });

  it('JSON roto por el wrapper: exit 0, sin salida y una linea en el registro (aunque ~/.claude no exista todavia)', () => {
    expect(fs.existsSync(path.join(home, '.claude'))).toBe(false);
    const r = correr('{roto');
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(registro()).toContain('no_decide\tjson_roto');
  });

  it('si node falla al arrancar (la logica rota), el wrapper sale con 0, sin salida, y el error queda en el registro', () => {
    // una copia del hook que apunta a una logica que tira al importarse
    const raiz = path.join(home, 'repo');
    fs.mkdirSync(path.join(raiz, '.claude', 'hooks'), { recursive: true });
    fs.mkdirSync(path.join(raiz, 'scripts', '_lib'), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, '.claude', 'hooks', 'permiso-guard.sh'), path.join(raiz, '.claude', 'hooks', 'permiso-guard.sh'));
    fs.writeFileSync(path.join(raiz, 'scripts', '_lib', 'permisoGuard.mjs'), "throw new Error('logica rota a proposito');\n");
    const r = spawnSync('bash', [path.join(raiz, '.claude', 'hooks', 'permiso-guard.sh')], { input: JSON.stringify(pedido()), encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(registro()).toContain('logica rota a proposito');
    expect(registro()).toMatch(/ERROR\tpermisoGuard\.mjs salio con codigo 1/);
  });

  it('esta cableado en settings.json bajo PermissionRequest, para todas las herramientas y por ${CLAUDE_PROJECT_DIR}', () => {
    const s = JSON.parse(fs.readFileSync(path.join(RAIZ, '.claude', 'settings.json'), 'utf8'));
    const grupos = s.hooks.PermissionRequest;
    expect(grupos).toHaveLength(1);
    expect(grupos[0].matcher).toBe('');
    expect(grupos[0].hooks.map((h) => h.command)).toEqual(['bash "${CLAUDE_PROJECT_DIR}/.claude/hooks/permiso-guard.sh"']);
  });
});
