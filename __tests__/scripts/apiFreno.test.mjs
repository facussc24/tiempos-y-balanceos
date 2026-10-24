// @vitest-environment node
/**
 * El freno del ciclo en la PUERTA de la API, por clave (scripts/_lib/claudeApi.mjs: frenoDelCiclo / frenarEnLaPuerta;
 * item 6a del 23/10/2026). Hasta ese dia el tope del ciclo solo lo miraban la noche y el arranque del agente, y la API
 * llego a US$ 372,76 contra 170 (PUNTOS_DEBILES_23-10.md §4): `_apiTarea.mjs` (llamarLargo), `_apiLotes.mjs` (crearLote),
 * llamar() y el bucle del agente no lo consultaban.
 *
 * Sin red: el cliente es el del SDK oficial con `fetch` reemplazado por un doble (si el freno deja pasar, el doble recibe
 * el pedido; si frena, no recibe nada). El ledger, las claves de mentira y el HOME van en carpetas temporales: nada toca
 * el ledger real, el `.env.local` real ni el `~/.claude` real. Se prueba en las dos direcciones.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import * as A from '../../scripts/_lib/claudeApi.mjs';
import { consumirPermiso } from '../../scripts/_lib/escrituraSegura.mjs';
import { correrAgente, clienteGuion, ejecutorSeco, registroEnMemoria, usoDe } from '../../scripts/_lib/agenteApi.mjs';
import { canonPermisos, permisosQueArma } from '../../scripts/_lib/permisoUnUso.mjs';

const CLAVE_PRINCIPAL = 'sk-ant-prueba-PRINCIPAL-0001-abcdefgh';
const CLAVE_DUENO = 'sk-ant-prueba-DUENO-0002-abcdefgh';
const AHORA = new Date(2026, 9, 23, 12, 0, 0);   // 23/10: la principal esta en el ciclo 30/09-29/10; la prestada, desde el 20/10

let dir;
let home;
let apiDirPrevio;
let respaldoClave;
let avisos;
let topeCiclo;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-freno-'));
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'api-freno-home-'));
  fs.mkdirSync(path.join(home, '.claude'));
  apiDirPrevio = process.env.BARACK_API_DIR;
  process.env.BARACK_API_DIR = dir;   // el ledger y el renglon `frenado` caen aca (escrituraSegura)
  const archivoEnv = path.join(dir, 'env.local');
  fs.writeFileSync(archivoEnv, `ANTHROPIC_API_KEY=${CLAVE_PRINCIPAL}\nANTHROPIC_API_KEY_HASTA_20261020=${CLAVE_DUENO}\n`);
  respaldoClave = { env: {}, archivoEnv, dirMarcas: dir };
  avisos = [];
  topeCiclo = { env: { BARACK_API_CICLO_DIA: '30', HOME: home }, avisar: (t) => avisos.push(t), avisados: new Set() };
});
afterEach(() => {
  if (apiDirPrevio === undefined) delete process.env.BARACK_API_DIR; else process.env.BARACK_API_DIR = apiDirPrevio;
});

const fila = (ts, costoUsd, clave) => JSON.stringify({ ts, tarea: 't', modelo: 'claude-opus-5-5', lote: false, costoUsd, ...(clave ? { clave } : {}) });
const ledger = (filas) => fs.writeFileSync(path.join(dir, 'ledger_2026-10.jsonl'), `${filas.join('\n')}\n`);
const lineas = () => fs.readFileSync(path.join(dir, 'ledger_2026-10.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const permiso = () => path.join(home, '.claude', '.api-tope-ok');

/** El fetch de mentira: anota cada pedido y contesta un mensaje chico de Haiku. */
function fetchDoble() {
  const pedidos = [];
  const fetch = async (url, init) => {
    pedidos.push({ url: String(url), cuerpo: JSON.parse(init.body) });
    if (/\/batches/.test(String(url))) {
      return new Response(JSON.stringify({ id: 'msgbatch_x', type: 'message_batch', processing_status: 'in_progress' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      id: `msg_${pedidos.length}`, type: 'message', role: 'assistant', model: 'claude-haiku-5-5', stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'OK' }], usage: { input_tokens: 1000, output_tokens: 10 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, pedidos };
}
const cliente = (clave, doble) => new Anthropic({ apiKey: clave, fetch: doble.fetch, maxRetries: 0 });
const pedir = (c, extra = {}) => A.llamar(c, { modelo: 'haiku', effort: 'low', usuario: 'x', maxTokens: 100, tarea: 'prueba', dirLedger: dir, ahora: AHORA, respaldoClave, topeCiclo, ...extra });
const TEXTO_FRENO = /^tope del ciclo cruzado: US\$ 171,00 de 170,00 para la clave principal; se renueva el 30\/10\/2026; para pasar una vez: ~\/\.claude\/\.api-tope-ok con la frase de Fak$/;

describe('(a) bajo el tope de la clave: llama y anota', () => {
  it('con 100 de 170 gastados por la principal, el doble recibe el pedido y el ledger suma el renglon con su clave', async () => {
    ledger([fila('2026-10-10 10:00:00', 100, 'principal')]);
    const doble = fetchDoble();
    const r = await pedir(cliente(CLAVE_PRINCIPAL, doble));
    expect(r.texto).toBe('OK');
    expect(doble.pedidos).toHaveLength(1);
    const ultima = lineas().at(-1);
    expect(ultima).toMatchObject({ tarea: 'prueba', clave: 'principal' });
    expect(ultima.costoUsd).toBeGreaterThan(0);
    expect(ultima.frenado).toBeUndefined();
    expect(avisos).toEqual([]);   // 58,8 %: todavia no avisa
  });

  it('el borde: con 169,99 pasa; con 170,00 justo ya frena', async () => {
    ledger([fila('2026-10-10 10:00:00', 169.99, 'principal')]);
    const doble = fetchDoble();
    await pedir(cliente(CLAVE_PRINCIPAL, doble));
    expect(doble.pedidos).toHaveLength(1);
    ledger([fila('2026-10-10 10:00:00', 170, 'principal')]);
    await expect(pedir(cliente(CLAVE_PRINCIPAL, doble))).rejects.toMatchObject({ tipo: 'tope' });
    expect(doble.pedidos).toHaveLength(1);
  });
});

describe('(b) sobre el tope de ESA clave: no llama, tira con el texto y deja el renglon frenado', () => {
  it('llamar(): el doble no recibe nada, el error dice cuanto, de cuanto, que clave, cuando se renueva y como pasar', async () => {
    ledger([fila('2026-10-10 10:00:00', 171, 'principal')]);
    const doble = fetchDoble();
    const err = await pedir(cliente(CLAVE_PRINCIPAL, doble)).catch((e) => e);
    expect(err).toBeInstanceOf(A.ErrorApi);
    expect(err.tipo).toBe('tope');
    expect(err.message).toMatch(TEXTO_FRENO);
    expect(doble.pedidos).toHaveLength(0);
    const ultima = lineas().at(-1);
    expect(ultima).toMatchObject({ frenado: true, costoUsd: 0, clave: 'principal', tarea: 'prueba', gastadoCicloUsd: 171, topeUsd: 170 });
    // el renglon frenado no es una llamada ni suma gasto: ni en el resumen, ni en el saldo del tablero, ni en el chequeo de la hora
    const res = A.resumenLedger(lineas());
    expect(res).toMatchObject({ llamadas: 1, frenados: 1, totalUsd: 171 });
    expect(A.saldoPorClave({ dir, env: topeCiclo.env, ahora: AHORA }).claves[0]).toMatchObject({ nombre: 'principal', gastadoUsd: 171 });
    const { ledgerEnVentana } = await import('../../scripts/_orquestador.mjs');
    const ventana = ledgerEnVentana(new Date(2026, 9, 1).getTime(), new Date(2026, 9, 31).getTime(), dir);
    expect(ventana).toMatchObject({ pedidos: 1, usd: 171 });
  });

  it('llamarLargo() (la puerta de _apiTarea.mjs) y crearLote() (la de _apiLotes.mjs --lote) frenan igual, sin tocar la red', async () => {
    ledger([fila('2026-10-10 10:00:00', 171, 'principal')]);
    const doble = fetchDoble();
    const c = cliente(CLAVE_PRINCIPAL, doble);
    await expect(A.llamarLargo(c, { modelo: 'opus', effort: 'high', usuario: 'x', maxTokens: 1000, tarea: 'sesion:borrador', dirLedger: dir, ahora: AHORA, respaldoClave, topeCiclo })).rejects.toThrow(TEXTO_FRENO);
    await expect(A.crearLote(c, [{ id: 'j1', modelo: 'haiku', usuario: 'x', maxTokens: 100 }], { tarea: 'auditoria', dirLedger: dir, ahora: AHORA, respaldoClave, topeCiclo })).rejects.toThrow(TEXTO_FRENO);
    expect(doble.pedidos).toHaveLength(0);
    expect(lineas().filter((l) => l.frenado).map((l) => l.tarea)).toEqual(['sesion:borrador', 'auditoria:lote']);
  });

  it('gemelo verde de crearLote: bajo el tope el lote SI se manda', async () => {
    ledger([fila('2026-10-10 10:00:00', 10, 'principal')]);
    const doble = fetchDoble();
    const creado = await A.crearLote(cliente(CLAVE_PRINCIPAL, doble), [{ id: 'j1', modelo: 'haiku', usuario: 'x', maxTokens: 100 }], { tarea: 'auditoria', dirLedger: dir, ahora: AHORA, respaldoClave, topeCiclo });
    expect(creado.loteId).toBe('msgbatch_x');
    expect(doble.pedidos).toHaveLength(1);
  });

  it('una clave que el ledger no reconoce se le cuenta a la principal (como en saldoPorClave)', async () => {
    ledger([fila('2026-10-10 10:00:00', 171, 'principal')]);
    const doble = fetchDoble();
    await expect(pedir(cliente('sk-ant-prueba-DESCONOCIDA-9999', doble))).rejects.toMatchObject({ tipo: 'tope', clave: 'principal' });
    expect(doble.pedidos).toHaveLength(0);
  });
});

describe('(c) por clave: el tope cruzado de la OTRA clave no frena a esta', () => {
  it('la prestada pasada de su tope frena a la prestada; la principal sigue pasando', async () => {
    ledger([fila('2026-10-21 10:00:00', 200, 'prestada-20261020'), fila('2026-10-10 10:00:00', 10, 'principal')]);
    const doble = fetchDoble();
    await pedir(cliente(CLAVE_PRINCIPAL, doble));
    expect(doble.pedidos).toHaveLength(1);
    await expect(pedir(cliente(CLAVE_DUENO, doble))).rejects.toThrow(/US\$ 200,00 de 170,00 para la clave prestada-20261020; se renueva el 20\/11\/2026/);
    expect(doble.pedidos).toHaveLength(1);
  });

  it('y al reves: la principal pasada no frena a la prestada (antes el semaforo sumaba las dos claves)', async () => {
    ledger([fila('2026-10-10 10:00:00', 250, 'principal'), fila('2026-10-21 10:00:00', 50, 'prestada-20261020')]);
    const doble = fetchDoble();
    await pedir(cliente(CLAVE_DUENO, doble));
    expect(doble.pedidos).toHaveLength(1);
    expect(lineas().at(-1).clave).toBe('prestada-20261020');
    await expect(pedir(cliente(CLAVE_PRINCIPAL, doble))).rejects.toMatchObject({ tipo: 'tope' });
    expect(doble.pedidos).toHaveLength(1);
  });

  it('la prestada renovable cuenta desde su ultima recarga (el 20): lo gastado antes no le cuenta despues', async () => {
    ledger([fila('2026-10-15 10:00:00', 180, 'prestada-20261020'), fila('2026-10-21 10:00:00', 30, 'prestada-20261020')]);
    expect(A.estadoTopeClave('prestada-20261020', { dir, env: topeCiclo.env, ahora: AHORA })).toMatchObject({ gastadoUsd: 30, topeUsd: 170 });
    // el 19/10 (antes de la recarga) la misma prestada estaba frenada
    expect(A.estadoTopeClave('prestada-20261020', { dir, env: topeCiclo.env, ahora: new Date(2026, 9, 19, 12) }).gastadoUsd).toBe(180);
    const doble = fetchDoble();
    await pedir(cliente(CLAVE_DUENO, doble));
    expect(doble.pedidos).toHaveLength(1);
  });

  it('el tope de cada clave sale del canon: la principal de BARACK_API_PRESUPUESTO_USD (o 170), la prestada de TOPES_CLAVE_USD', () => {
    expect(A.topeDeClave('principal', { env: {} })).toBe(170);
    expect(A.topeDeClave('principal', { env: { BARACK_API_PRESUPUESTO_USD: '120' } })).toBe(120);
    expect(A.topeDeClave('prestada-20261020', { env: { BARACK_API_PRESUPUESTO_USD: '120' } })).toBe(170);
    expect(A.TOPES_CLAVE_USD['prestada-20261020']).toBe(170);
  });
});

describe('(d) ~/.claude/.api-tope-ok: pasa UNA vez y se consume', () => {
  it('con el permiso pasa una llamada (el ledger la marca topeSaltado), el archivo desaparece y la siguiente frena', async () => {
    ledger([fila('2026-10-10 10:00:00', 171, 'principal')]);
    fs.writeFileSync(permiso(), '');
    const doble = fetchDoble();
    await pedir(cliente(CLAVE_PRINCIPAL, doble));
    expect(doble.pedidos).toHaveLength(1);
    expect(fs.existsSync(permiso())).toBe(false);
    expect(lineas().at(-1)).toMatchObject({ clave: 'principal', topeSaltado: true });
    expect(avisos.join('\n')).toMatch(/pasa UNA vez con ~\/\.claude\/\.api-tope-ok \(consumido\)/);
    await expect(pedir(cliente(CLAVE_PRINCIPAL, doble))).rejects.toMatchObject({ tipo: 'tope' });
    expect(doble.pedidos).toHaveLength(1);
  });

  it('gemelo rojo: sin el permiso frena, y un permiso en OTRO home no sirve', async () => {
    ledger([fila('2026-10-10 10:00:00', 171, 'principal')]);
    const otroHome = fs.mkdtempSync(path.join(os.tmpdir(), 'api-freno-otro-'));
    fs.mkdirSync(path.join(otroHome, '.claude'));
    fs.writeFileSync(path.join(otroHome, '.claude', '.api-tope-ok'), '');
    const doble = fetchDoble();
    await expect(pedir(cliente(CLAVE_PRINCIPAL, doble))).rejects.toMatchObject({ tipo: 'tope' });
    expect(doble.pedidos).toHaveLength(0);
    expect(fs.existsSync(path.join(otroHome, '.claude', '.api-tope-ok'))).toBe(true);
  });

  it('el HOME de Git Bash (/c/Users/...) se entiende como C:/Users/...', async () => {
    if (process.platform !== 'win32') return;
    ledger([fila('2026-10-10 10:00:00', 171, 'principal')]);
    fs.writeFileSync(permiso(), '');
    const bash = home.replace(/^([A-Za-z]):[\\/]/, (_, l) => `/${l.toLowerCase()}/`).replace(/\\/g, '/');
    const doble = fetchDoble();
    await pedir(cliente(CLAVE_PRINCIPAL, doble), { topeCiclo: { ...topeCiclo, env: { ...topeCiclo.env, HOME: bash } } });
    expect(doble.pedidos).toHaveLength(1);
    expect(fs.existsSync(permiso())).toBe(false);
  });

  it('el permiso esta en el canon de los permisos de Fak: armarlo pide su frase (permiso-un-uso-guard)', () => {
    expect(canonPermisos().de_fak.map((p) => p.archivo)).toContain('.api-tope-ok');
    expect(permisosQueArma(': > ~/.claude/.api-tope-ok')).toEqual(['.api-tope-ok']);
    expect(permisosQueArma('ls ~/.claude/.api-tope-ok')).toEqual([]);
  });

  it('la puerta segura consume solo ese permiso: otro nombre tira, uno que no esta da false', () => {
    expect(() => consumirPermiso('.arb-cerrar-ok', { home })).toThrow(/no es un permiso/);
    expect(consumirPermiso('.api-tope-ok', { home })).toBe(false);
    fs.writeFileSync(permiso(), '');
    expect(consumirPermiso('.api-tope-ok', { home })).toBe(true);
    expect(consumirPermiso('.api-tope-ok', { home })).toBe(false);
  });
});

describe('(e) el ledger nunca tiene la clave', () => {
  it('ni en los renglones pagados, ni en el frenado, ni en el que paso con permiso, ni en el error', async () => {
    const doble = fetchDoble();
    ledger([fila('2026-10-10 10:00:00', 10, 'principal')]);
    await pedir(cliente(CLAVE_PRINCIPAL, doble));
    await pedir(cliente(CLAVE_DUENO, doble));
    fs.appendFileSync(path.join(dir, 'ledger_2026-10.jsonl'), `${fila('2026-10-11 10:00:00', 200, 'principal')}\n`);
    const err = await pedir(cliente(CLAVE_PRINCIPAL, doble)).catch((e) => e);
    fs.writeFileSync(permiso(), '');
    await pedir(cliente(CLAVE_PRINCIPAL, doble));
    const texto = fs.readFileSync(path.join(dir, 'ledger_2026-10.jsonl'), 'utf8');
    expect(lineas().filter((l) => l.frenado)).toHaveLength(1);
    for (const secreto of [CLAVE_PRINCIPAL, CLAVE_DUENO, 'PRINCIPAL-0001', 'DUENO-0002', 'sk-ant']) {
      expect(texto).not.toContain(secreto);
      expect(err.message).not.toContain(secreto);
    }
    expect(new Set(lineas().map((l) => l.clave))).toEqual(new Set(['principal', 'prestada-20261020']));
  });
});

describe('aviso al 60 y al 85 %: una linea, una vez por proceso', () => {
  it('a 61 % avisa una vez; la segunda llamada no repite; al pasar el 85 % avisa otra; bajo el 60 % nada', async () => {
    const doble = fetchDoble();
    ledger([fila('2026-10-10 10:00:00', 50, 'principal')]);
    await pedir(cliente(CLAVE_PRINCIPAL, doble));
    expect(avisos).toEqual([]);
    ledger([fila('2026-10-10 10:00:00', 104, 'principal')]);
    await pedir(cliente(CLAVE_PRINCIPAL, doble));
    await pedir(cliente(CLAVE_PRINCIPAL, doble));
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatch(/^aviso: la API va por el 61 % del tope del ciclo \(US\$ 104,00 de 170,00 para la clave principal; se renueva el 30\/10\/2026\)\.$/);
    ledger([fila('2026-10-10 10:00:00', 150, 'principal')]);
    await pedir(cliente(CLAVE_PRINCIPAL, doble));
    await pedir(cliente(CLAVE_PRINCIPAL, doble));
    expect(avisos).toHaveLength(2);
    expect(avisos[1]).toMatch(/va por el 88 %/);
    expect(doble.pedidos).toHaveLength(5);   // avisar no frena
  });

  it('si arranca ya pasado el 85 %, avisa una sola linea (no la del 60 despues)', async () => {
    const doble = fetchDoble();
    ledger([fila('2026-10-10 10:00:00', 160, 'principal')]);
    await pedir(cliente(CLAVE_PRINCIPAL, doble));
    ledger([fila('2026-10-10 10:00:00', 110, 'principal')]);
    await pedir(cliente(CLAVE_PRINCIPAL, doble));
    expect(avisos).toHaveLength(1);
  });
});

describe('el bucle del agente (no pasa por llamar()) tambien frena', () => {
  const armar = (extra = {}) => {
    const c = { apiKey: CLAVE_PRINCIPAL, ...clienteGuion([{ content: [usoDe('terminar', { entregable: 'x', resumen: 'listo' })] }]) };
    const freno = (cl, o) => A.frenarEnLaPuerta(cl, { ...o, dirLedger: dir, ahora: AHORA, respaldoClave, topeCiclo });
    const op = { cliente: c, modelo: 'sonnet', system: 's', encargo: 'e', carpeta: path.join(dir, 'agente'), corrida: 'test', ejecutor: ejecutorSeco(),
      registro: registroEnMemoria(), guardian: async () => null, registrar: () => {}, freno, ...extra };
    return { c, op };
  };

  it('con el tope de su clave cruzado la corrida corta ANTES del primer paso y el cliente no recibe nada', async () => {
    ledger([fila('2026-10-10 10:00:00', 171, 'principal')]);
    const { c, op } = armar();
    const r = await correrAgente(op);
    expect(r.terminado).toBe(false);
    expect(r.corte).toMatch(TEXTO_FRENO);
    expect(c.llamadas).toHaveLength(0);
    expect(lineas().at(-1)).toMatchObject({ frenado: true, tarea: 'agente:test' });
  });

  it('gemelo verde: bajo el tope corre; con permiso, la corrida entera pasa con un solo uso', async () => {
    ledger([fila('2026-10-10 10:00:00', 10, 'principal')]);
    const bajo = armar();
    expect((await correrAgente(bajo.op)).terminado).toBe(true);
    expect(bajo.c.llamadas).toHaveLength(1);
    ledger([fila('2026-10-10 10:00:00', 171, 'principal')]);
    fs.writeFileSync(permiso(), '');
    const dos = { apiKey: CLAVE_PRINCIPAL, ...clienteGuion([{ content: [usoDe('leer_archivo', { ruta: 'notas.md' })] }, { content: [usoDe('terminar', { entregable: 'x', resumen: 'listo' })] }]) };
    const r = await correrAgente({ ...armar().op, cliente: dos });
    expect(r.terminado).toBe(true);
    expect(dos.llamadas).toHaveLength(2);
    expect(fs.existsSync(permiso())).toBe(false);
  });

  it('un doble sin apiKey (los tests del agente de siempre) no puede gastar: el freno no lo mira', () => {
    expect(A.frenarEnLaPuerta({ beta: {} }, { dirLedger: dir })).toBeNull();
  });
});
