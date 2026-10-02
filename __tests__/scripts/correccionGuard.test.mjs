// correccion-guard.sh (UserPromptSubmit) — cuando un entregable vuelve, devuelve el PEDIDO ORIGINAL.
// Origen: 01/10/2026, fotos de las prensas Hot Press: el primer mensaje de Fak ya decia todo y se entregaron tres
// cosas distintas respondiendo solo a la ultima correccion.
//
// Probado en las dos direcciones con mensajes REALES (con sus errores de tipeo). Los casos de la segunda mitad
// salen de la auditoria del 02/10 (avisos que salian de mas, que no salian, y pedidos mal citados).
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CASOS, senales, esCorreccion, esAprobacion, esNeutro, paso, registrarEntrega, claveDe, distancia, normalizar, sanear, atender, leerEntregas, entregasDeLinea } from '../../scripts/_lib/correccionGuard.mjs';

const RAIZ = process.cwd();
const HOOK = path.join(RAIZ, '.claude', 'hooks', 'correccion-guard.sh');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'correccion-guard-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));
const ENV = { ...process.env, CORRECCION_GUARD_DIR: TMP };

const EXP = 'C:\\Dev\\B\\exports\\FOTOS_HOT_PRESS\\';
const BIB = 'C:\\n\\NOVAX\\INSERT\\MAQUINA HOT PRESS BMA101\\.claude\\retocadas\\1.jpg';
const GANCHO = 'C:\\Dev\\x\\exports\\GANCHO\\';
const PEDIDO_GANCHO = 'necesito que diseñes el gancho para colgar la mochila del escritorio con las medidas del caño que te paso en las fotos del calibre, que entre justo';

/** Corre una secuencia: string = mensaje de Fak, array = entrega. Devuelve { e, avisos } (un aviso por mensaje). */
function correr(pasos, e = null) {
  const avisos = [];
  for (const p of pasos) {
    if (Array.isArray(p)) { e = registrarEntrega(e, p); continue; }
    const r = paso(e, p); e = r.estado; avisos.push(r.aviso);
  }
  return { e, avisos };
}

describe('correccionGuard — como corrige Fak (palabras)', () => {
  it('ROJO: las cuatro correcciones del 01/10/2026 y "no te pedi", con sus errores de tipeo', () => {
    for (const t of CASOS.rojos) expect(esCorreccion(t), `${t.slice(0, 50)} -> ${JSON.stringify(senales(t))}`).toBe(true);
  });
  it('VERDE: pedidos, preguntas, aprobaciones y frases de trabajo con "ojo", "te dije" o "corregi" no son correcciones', () => {
    for (const t of CASOS.verdes) expect(esCorreccion(t), `${t.slice(0, 50)} -> ${JSON.stringify(senales(t))}`).toBe(false);
  });
  it('"entendes?" y "entendiste?" son muletilla; "no entenidste" (tipeado rapido) si es correccion', () => {
    expect(esCorreccion('pasame el archivo de la bom entendes? asi lo reviso')).toBe(false);
    expect(esCorreccion('va en el hueco verde del cargador, no? entendiste?')).toBe(false);
    expect(senales('creo que no entenidste lo de las fotos').fuertes).toContain('no_entendiste');
    expect(distancia('entenidste', 'entendiste')).toBe(1);
  });
  it('un insulto suelto no alcanza (muletilla, o va contra un tercero); dos si. "pierda" no es "mierda"', () => {
    expect(esCorreccion('el proveedor es un boludo nunca contesta los mails')).toBe(false);
    expect(esCorreccion('cual es el codigo de la bolsa boludo pasamelo que lo modifico rapido')).toBe(false);
    expect(esCorreccion('pero sos boludo esto es una meirda')).toBe(true);
    expect(senales('que no se pierda el archivo').debiles).not.toContain('enojo');
  });
  it('lo que Fak pega entre comillas o en <pasted_content> no cuenta como palabras suyas; un pegado de megas no demora', () => {
    expect(normalizar('mira "el informe dice que no entendiste nada y que esta todo mal hecho segun el cliente" que opinas')).not.toMatch(/entendiste/);
    expect(esCorreccion('<pasted_content id="a1">no entendiste, esta mal, boludo</pasted_content> resumime este chat')).toBe(false);
    const t0 = Date.now(); esCorreccion('<system-reminder>'.repeat(200000)); expect(Date.now() - t0).toBeLessThan(2000);
  });
  it('aprobar no es arrancar con "si": "si pero el caño sigue enorme" y "listo? yo lo veo igual" NO aprueban', () => {
    for (const ok of ['perfecto gracias', 'ok dale', 'mandalo', 'quedo muy bien', 'si', 'bien']) expect(esAprobacion(ok), ok).toBe(true);
    for (const no of ['si pero el caño sigue enorme', 'bien pero falta el tornillo', 'listo? yo lo veo igual', 'si no entra no sirve']) expect(esAprobacion(no), no).toBe(false);
  });
  it('"abrilo", "pasame la ruta", "cerra la sesion" ni aprueban ni rechazan', () => {
    for (const n of ['abrime el flujograma asi lo reviso', 'abrilo', 'pasame la ruta', 'cerra esta sesion por favor', 'Intentar nuevamente', 'minimizo claude']) { expect(esNeutro(n), n).toBe(true); expect(esAprobacion(n), n).toBe(false); }
  });
});

describe('correccionGuard — la sesion del 01/10/2026, con sus entregas (biblioteca -> exports -> exports)', () => {
  const { e, avisos } = correr([CASOS.pedido, [BIB], CASOS.rojos[0], [`${EXP}v1.pptx`, `${EXP}v1.zip`], CASOS.rojos[1], [`${EXP}v2.pptx`], CASOS.rojos[2]]);
  it('ROJO: 1a correccion -> aviso corto; 2a -> largo; 3a -> largo por entregas; los tres citan el PRIMER mensaje', () => {
    expect(avisos[0]).toBeNull();
    expect(avisos[1]).toMatch(/relee ENTERO/); expect(avisos[1]).toMatch(/hotprees/);
    expect(avisos[2]).toMatch(/correccion N° 2/); expect(avisos[2]).toMatch(/hotprees/);
    expect(avisos[3]).toMatch(/Ya entregaste 2 versiones/); expect(avisos[3]).toMatch(/hotprees/);
    expect(avisos[3]).toMatch(/SE SACA/); expect(avisos[3]).toMatch(/NO se rellena/);
  });
  it('el aviso largo trae lo que Fak dijo despues del pedido (las correcciones de la tanda)', () => {
    expect(avisos[3]).toMatch(/enteinste/); expect(avisos[3]).toMatch(/pataognia/);
  });
  it('un mensaje largo en medio de la tanda NO pisa el pedido ni pone el contador en cero', () => {
    const r = paso(e, 'esta s100% seguro del nombre d elas mauqinas sean esos no? de donde los aquaste? manten la evnidenica a amno digamos pro si me lo llega a preugntar');
    expect(r.estado.pedido).toBe(e.pedido); expect(r.estado.n).toBe(e.n);
  });
  it('paso() no modifica el estado que recibe', () => {
    const antes = JSON.stringify(e); paso(e, 'perfecto gracias'); paso(e, CASOS.rojos[3]);
    expect(JSON.stringify(e)).toBe(antes);
  });
});

describe('correccionGuard — entregas repetidas, sin una sola palabra de correccion', () => {
  it('ROJO: tras la 2a entrega de la misma carpeta, una objecion recibe el pedido que origino esa carpeta', () => {
    const { avisos } = correr([PEDIDO_GANCHO, [`${GANCHO}gancho v1.stl`], 'porque mide 70mm en el medio? si mide cerca de 30mm que paso ahi', [`${GANCHO}_trabajo\\render\\gancho v2.png`], 'el caño no es tan grande revisa las fotos del calibre que te pase', 'y ademas el tornillo no entra en el agujero de arriba']);
    expect(avisos[1]).toBeNull();                                    // una vuelta es normal
    expect(avisos[2]).toMatch(/Ya entregaste 2 versiones/); expect(avisos[2]).toMatch(/mochila/);
    expect(avisos[3]).toBeNull();                                    // la misma entrega no avisa dos veces
  });
  it('VERDE: despues de 2 entregas, "cerra la sesion", "la voz va, genera la narracion" o "quedo muy bien" no avisan', () => {
    const base = correr([PEDIDO_GANCHO, [`${GANCHO}v1.stl`], 'el caño es mas chico que eso, mide cerca de 30 mm', [`${GANCHO}v2.stl`]]).e;
    for (const t of ['cerra esta sesion por favor', 'Intentar nuevamente', 'la voz va, genera la narracion completa', 'cierre de tarea quedo muy bien', 'perfecto gracias', 'minimizo claude']) expect(paso(base, t).aviso, t).toBeNull();
  });
  it('ROJO: "abrilo" no gasta el aviso; el veredicto es el mensaje que sigue', () => {
    const base = correr([PEDIDO_GANCHO, [`${GANCHO}v1.stl`], 'el caño es mas chico que eso, mide cerca de 30 mm', [`${GANCHO}v2.stl`]]).e;
    const { avisos } = correr(['abrime el render asi lo reviso', 'pero el caño sigue enorme, no entra en la mesa'], base);
    expect(avisos[0]).toBeNull(); expect(avisos[1]).toMatch(/2 versiones/);
  });
  it('VERDE: varios archivos en el mismo turno son UNA entrega; carpetas distintas no se suman', () => {
    let { e } = correr([PEDIDO_GANCHO, [`${GANCHO}a.stl`, `${GANCHO}b.png`], [`${GANCHO}c.pdf`]]);
    expect(e.carpetas[claveDe(`${GANCHO}a.stl`)].entregas).toBe(1);
    ({ e } = correr(['ahora pasame el plano del carro giratorio con las cotas del nido y la lista de materiales para mandarlo a cotizar', ['C:\\Dev\\x\\exports\\CARRO\\plano.pdf']], e));
    expect(paso(e, 'el plano no tiene las cotas del nido, porque?').aviso).toBeNull();
  });
  it('la carpeta se normaliza: `_trabajo`, `.claude`, `v2`, `renders` cuentan como la madre; scratchpad y Escritorio no cuentan', () => {
    expect(claveDe('C:\\Dev\\B\\exports\\FOTOS\\_trabajo\\hero\\a.jpg')).toBe(claveDe('C:\\Dev\\B\\exports\\FOTOS\\b.pptx'));
    expect(claveDe('C:/n/NOVAX/APB/MAQUINA/.claude/retocadas/1.jpg')).toBe(claveDe('C:/n/NOVAX/APB/MAQUINA/foto.jpeg'));
    expect(claveDe(`${GANCHO}v2\\a.stl`)).toBe(claveDe(`${GANCHO}renders\\b.png`));
    for (const g of ['C:\\Users\\x\\AppData\\Local\\Temp\\claude\\s\\scratchpad\\a.png', 'C:\\Users\\x\\OneDrive\\Desktop\\b.pdf', 'C:\\a.txt']) expect(claveDe(g), g).toBe('');
    expect(registrarEntrega(null, ['C:\\t\\scratchpad\\a.png']).carpetas).toEqual({});
  });
});

describe('correccionGuard — que pedido se cita y cuando se cierra una tanda', () => {
  it('la aprobacion cierra la tanda: una correccion de OTRO trabajo vuelve a ser la primera y cita el pedido nuevo', () => {
    const otro = 'ahora necesito el listado de codigos de las telas de PWA con el consumo por pieza y la unidad de compra para mandarselo a compras';
    const { avisos } = correr([PEDIDO_GANCHO, [`${GANCHO}v1.stl`], 'no era eso, el gancho va del otro lado', 'perfecto gracias', otro, ['C:\\Dev\\x\\exports\\TELAS\\listado.xlsx'], 'armaste un mail que no te pedi']);
    expect(avisos[1]).toMatch(/relee ENTERO/); expect(avisos[1]).toMatch(/mochila/);
    expect(avisos[4]).toMatch(/relee ENTERO/); expect(avisos[4]).toMatch(/telas de PWA/); expect(avisos[4]).not.toMatch(/mochila/);
  });
  it('trabajo nuevo sin aprobacion de por medio: carpeta nueva + pedido largo sin correcciones -> la tanda arranca de cero', () => {
    const otro = 'bueno ahora pasemos a otra cosa: armame el plano del carro giratorio con las cotas del nido y la lista de materiales para mandarlo a cotizar esta semana';
    const { e } = correr([PEDIDO_GANCHO, [`${GANCHO}v1.stl`], otro, ['C:\\Dev\\x\\exports\\CARRO\\plano.pdf']]);
    expect(e.pedido).toMatch(/carro giratorio/); expect(Object.keys(e.carpetas)).toEqual([claveDe('C:\\Dev\\x\\exports\\CARRO\\plano.pdf')]);
  });
  it('un pedido corto tambien queda registrado', () => {
    const { e } = correr(['perfecto gracias', 'haceme el plano del carro giratorio', ['C:\\Dev\\x\\exports\\CARRO\\plano.pdf']]);
    expect(e.pedido).toMatch(/plano del carro/);
  });
  it('una correccion de algo contestado sin archivo cita lo ultimo que pidio Fak', () => {
    const { avisos } = correr(['decime cuanto pesa el top roll delantero segun el plano del cliente', 'no era eso, te pedi el peso del trasero']);
    expect(avisos[1]).toMatch(/relee ENTERO/); expect(avisos[1]).toMatch(/top roll delantero/);
  });
  it('un aviso automatico (fin de agente, imagen pegada) no cuenta aunque traiga las palabras', () => {
    const e = paso(null, CASOS.pedido).estado;
    for (const t of ['<task-notification> no entendiste nada, esta todo mal hecho boludo mierda </task-notification>', '[SYSTEM NOTIFICATION - NOT USER INPUT] no era eso, seguis haciendo lo mismo', '[Image: original 2010x1144]']) expect(paso(e, t).estado).toEqual(sanear(e));
  });
  it('un estado con la forma rota se sanea en vez de dejar el hook mudo', () => {
    for (const roto of [{ carpetas: null, ultima: 'x' }, { correcciones: 5 }, { desde: 'x', n: 'dos' }, 7, 'texto', null]) {
      expect(() => paso(roto, CASOS.rojos[4])).not.toThrow();
      expect(paso(roto, CASOS.rojos[4]).aviso).toMatch(/relee ENTERO/);
    }
  });
});

describe('correccionGuard — las entregas se leen del transcript, solo el tramo nuevo', () => {
  const linea = (o) => `${JSON.stringify(o)}\n`;
  const entrega = (files, extra = {}) => linea({ type: 'assistant', ...extra, message: { content: [{ type: 'tool_use', name: 'SendUserFile', input: { files } }] } });
  const T = path.join(TMP, 'transcript.jsonl');
  it('saca los archivos de SendUserFile de la sesion principal; ignora subagentes, otras tools y lineas rotas', () => {
    fs.writeFileSync(T, linea({ type: 'user', message: { content: 'hola "SendUserFile" de palabra' } }) + entrega([`${EXP}v1.pptx`]) + entrega(['C:\\x\\exports\\Z\\sub.pdf'], { isSidechain: true })
      + linea({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'echo SendUserFile' } }] } }) + '{"roto": "SendUserFile"\n');
    const r = leerEntregas(T, 0);
    expect(r.archivos).toEqual([`${EXP}v1.pptx`]); expect(r.hasta).toBe(fs.statSync(T).size);
    expect(entregasDeLinea('{"type":"assistant","isSidechain":true,"message":{"content":[{"type":"tool_use","name":"SendUserFile","input":{"files":["a"]}}]}}')).toEqual([]);
  });
  it('la segunda lectura arranca donde termino la primera y no cuenta dos veces; una linea a medio escribir espera', () => {
    const hasta = fs.statSync(T).size;
    fs.appendFileSync(T, entrega([`${EXP}v2.pptx`]) + '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"SendUserFile"');
    const r = leerEntregas(T, hasta);
    expect(r.archivos).toEqual([`${EXP}v2.pptx`]); expect(r.hasta).toBeLessThan(fs.statSync(T).size);
    expect(leerEntregas(path.join(TMP, 'no-existe.jsonl'), 0)).toEqual({ archivos: [], hasta: 0 });
  });
  it('ROJO de punta a punta: pedido, entrega, objecion, entrega, objecion -> aviso con el pedido, leyendo el transcript', () => {
    const TT = path.join(TMP, 't2.jsonl'); fs.writeFileSync(TT, '');
    const dice = (prompt) => atender({ hook_event_name: 'UserPromptSubmit', session_id: 's-punta', transcript_path: TT, prompt }, ENV);
    expect(dice(CASOS.pedido)).toBeNull();
    fs.appendFileSync(TT, entrega([`${EXP}v1.pptx`]));
    expect(dice('la idea era subir las del proceso en funcionamiento, no repetir las mias')).toBeNull();
    fs.appendFileSync(TT, entrega([`${EXP}v2.pptx`]));
    const a = dice('pero me pidieron fotos de la maquina funcionando, no de costura');
    expect(a).toMatch(/2 versiones/); expect(a).toMatch(/hotprees/);
  });
});

describe('correccion-guard.sh — corrido como lo corre Claude Code (bash + JSON por stdin); nunca bloquea', () => {
  function hook(payload, { stdin } = {}) {
    const r = spawnSync('bash', [HOOK], { input: stdin ?? JSON.stringify(payload), encoding: 'utf8', cwd: RAIZ, env: ENV });
    return { exit: r.status, out: r.stdout ?? '' };
  }
  const contexto = (r) => (r.out.trim() ? JSON.parse(r.out).hookSpecificOutput.additionalContext : '');
  const dice = (sid, prompt) => hook({ hook_event_name: 'UserPromptSubmit', session_id: sid, prompt });
  it('ROJO: pedido, correccion, correccion -> el segundo aviso es el largo y cita el pedido; cada sesion lleva su cuenta', () => {
    expect(contexto(dice('s-a', CASOS.pedido))).toBe('');
    expect(contexto(dice('s-a', CASOS.rojos[0]))).toMatch(/relee ENTERO/);
    const r = dice('s-a', CASOS.rojos[1]);
    expect(r.exit).toBe(0); expect(JSON.parse(r.out).hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    expect(contexto(r)).toMatch(/correccion N° 2/); expect(contexto(r)).toMatch(/hotprees/);
    expect(contexto(dice('s-b', CASOS.rojos[1]))).toMatch(/relee ENTERO/);       // en s-b es la PRIMERA
  });
  it('VERDE: un mensaje comun, el mensaje de un subagente y otro evento no reciben nada', () => {
    expect(contexto(dice('s-c', 'arma el mail para Manuel con el listado'))).toBe('');
    expect(hook({ hook_event_name: 'UserPromptSubmit', session_id: 's-c', agent_id: 'ag-1', prompt: CASOS.rojos[4] }).out.trim()).toBe('');
    expect(hook({ hook_event_name: 'PostToolUse', session_id: 's-c', tool_name: 'Bash', prompt: CASOS.rojos[4] }).out.trim()).toBe('');
  });
  it('stdin roto, vacio o con tipos raros: exit 0, sin salida, no rompe el turno', () => {
    for (const stdin of ['{no es json', '', 'null', '{"hook_event_name":"UserPromptSubmit","prompt":{"a":1},"session_id":["x"],"transcript_path":5}']) { const r = hook(null, { stdin }); expect(r.exit).toBe(0); expect(r.out.trim()).toBe(''); }
  });
  it('esta cableado en UserPromptSubmit con ${CLAUDE_PROJECT_DIR}', () => {
    const s = JSON.parse(fs.readFileSync(path.join(RAIZ, '.claude', 'settings.json'), 'utf8'));
    expect(s.hooks.UserPromptSubmit.some((g) => g.matcher === '' && g.hooks.some((h) => h.command === 'bash "${CLAUDE_PROJECT_DIR}/.claude/hooks/correccion-guard.sh"'))).toBe(true);
  });
});

// 02/10/2026: la app le pega adelante al mensaje de Fak un aviso ("The user started your suggested background
// task…") y el hook recibe las dos cosas juntas. Hasta ese dia el mensaje entero se tomaba por automatico:
// 18 mensajes de Fak pasaron sin que ningun hook de mensajes los viera (10 en los dos primeros dias de octubre).
describe('correccionGuard — un mensaje de Fak con un aviso de la app adelante sigue siendo de Fak', () => {
  const AVISO = '<system-reminder>\nThe user started your suggested background task task_eee4ad8a ("Agregar guard") in a separate local session.\n</system-reminder>\n\n';
  it('ROJO: la correccion se ve igual con el aviso adelante (y cuenta como turno de Fak)', () => {
    const r = paso(null, AVISO + CASOS.rojos[4]);
    expect(r.aviso).toMatch(/\[CORRECCION-GUARD\]/);
    expect(r.estado.turno).toBe(1);
    expect(r.aviso).toBe(paso(null, CASOS.rojos[4]).aviso);
  });
  it('VERDE: un mensaje que es solo avisos no es un turno de Fak', () => {
    const r = paso(null, AVISO);
    expect(r.aviso).toBeNull();
    expect(r.estado.turno).toBe(0);
    expect(paso(null, `${AVISO}<task-notification>el agente termino: armaste un mail que no te pedi</task-notification>`).estado.turno).toBe(0);
  });
});
