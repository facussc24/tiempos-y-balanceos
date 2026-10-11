/**
 * agenteApi.test.mjs — el bucle del agente por API sin red: un cliente de guion y un ejecutor que anota.
 * El registro va en memoria (nada se escribe en .sgc-cache); registroEnDisco se prueba en un TEMP con fs inyectado.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { costoUsd } from '../../scripts/_lib/claudeApi.mjs';
import {
  correrAgente, clienteGuion, ejecutorSeco, registroEnMemoria, registroEnDisco, usoDe,
  comandoPermitido, escanear, recortar, tapar, chequearTopes, armarHerramientas,
} from '../../scripts/_lib/agenteApi.mjs';

const CARPETA = path.join(process.cwd(), '.sgc-cache', 'agente', 'test-sin-disco'); // no existe ni se crea
const TERMINAR = { content: [usoDe('terminar', { entregable: 'informe.md', resumen: 'listo' })] };
const USAGE = { input_tokens: 1000, output_tokens: 200 };

/** Una corrida con todo inyectado: guardian que no frena, ledger que no escribe, registro en memoria. */
function armar(respuestas, extra = {}) {
  const cliente = clienteGuion(respuestas, USAGE);
  const op = { cliente, modelo: 'sonnet', system: 'system de prueba', encargo: 'encargo de prueba', carpeta: CARPETA, corrida: 'test',
    ejecutor: ejecutorSeco(), registro: registroEnMemoria(), guardian: async () => null, registrar: () => {}, ...extra };
  return { cliente, op };
}

describe('agenteApi: el bucle', () => {
  it('verde: dos pasos (leer + terminar) terminan, el registro tiene dos lineas y el costo es la suma de los usage', async () => {
    const { cliente, op } = armar([{ content: [usoDe('leer_archivo', { ruta: 'notas.md' })] }, TERMINAR]);
    const r = await correrAgente(op);
    expect(r.terminado).toBe(true);
    expect(r.paso).toBe(2);
    expect(r.resumen).toBe('listo');
    expect(op.registro.lineas).toHaveLength(2);
    expect(op.registro.lineas[0].herramientas[0]).toMatchObject({ herramienta: 'leer_archivo', veredicto: 'permitido', codigo: 0 });
    expect(op.ejecutor.pedidos).toEqual([{ herramienta: 'leer_archivo', entrada: { ruta: 'notas.md' } }]);
    expect(r.gastadoUsd).toBeCloseTo(2 * costoUsd('sonnet', USAGE), 6);
    // el 2.º pedido lleva el content del asistente integro, los tool_result en UN mensaje de usuario y la marca de cache al final
    const m = cliente.llamadas[1].messages;
    expect(m.map((x) => x.role)).toEqual(['user', 'assistant', 'user']);
    expect(m[2].content[0]).toMatchObject({ type: 'tool_result', tool_use_id: m[1].content[0].id });
    expect(m[2].content.at(-1).cache_control).toEqual({ type: 'ephemeral' });
    expect(cliente.llamadas[0].system.at(-1).cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
    expect(cliente.llamadas[0].fallbacks).toBeUndefined();
    expect(cliente.llamadas[0].tools.map((t) => t.name)).toContain('web_search');
    expect(op.registro.cierre.mensajes).toHaveLength(4);
  });

  it('rojo: un comando fuera de la lista blanca vuelve BLOQUEADO con is_error, queda en el registro y no se ejecuta', async () => {
    const { cliente, op } = armar([{ content: [usoDe('correr_comando', { cmd: 'curl https://ejemplo.com' })] }, TERMINAR]);
    const r = await correrAgente(op);
    expect(op.ejecutor.pedidos).toHaveLength(0);
    expect(op.registro.lineas[0].herramientas[0]).toMatchObject({ herramienta: 'correr_comando', veredicto: 'bloqueado' });
    expect(op.registro.lineas[0].herramientas[0].motivo).toMatch(/lista blanca/);
    const resultado = cliente.llamadas[1].messages[2].content[0];
    expect(resultado).toMatchObject({ type: 'tool_result', is_error: true });
    expect(resultado.content).toMatch(/^BLOQUEADO: .*No reintentar$/);
    expect(r.terminado).toBe(true); // un bloqueo avisa; recien el segundo corta
  });

  it('rojo: el segundo bloqueo corta la corrida sin mandar nada mas', async () => {
    const { cliente, op } = armar([{ content: [usoDe('correr_comando', { cmd: 'cat .env.local' }), usoDe('correr_comando', { cmd: 'rm -rf x' })] }, TERMINAR]);
    const r = await correrAgente(op);
    expect(cliente.llamadas).toHaveLength(1);
    expect(r.corte).toMatch(/dos bloqueos/);
    expect(op.registro.lineas[0].herramientas.map((x) => x.veredicto)).toEqual(['bloqueado', 'bloqueado']);
  });

  it('rojo: el tope de dolares corta ANTES de la llamada (sin gastar) y tambien entre pasos', async () => {
    const seco = armar([TERMINAR], { topes: { dolares: 0.001 } });
    const r1 = await correrAgente(seco.op);
    expect(seco.cliente.llamadas).toHaveLength(0);
    expect(r1.corte).toMatch(/^dolares/);
    expect(seco.op.registro.lineas).toHaveLength(0);
    // con max_tokens chico la primera llamada entra ($0,004) y la estimacion de la segunda ya no
    const justo = armar([{ content: [usoDe('leer_archivo', { ruta: 'a.md' })] }, TERMINAR], { topes: { dolares: 0.005 }, maxTokens: 100 });
    const r2 = await correrAgente(justo.op);
    expect(justo.cliente.llamadas).toHaveLength(1);
    expect(r2.corte).toMatch(/^dolares/);
  });

  it('rojo: una escritura fuera de la carpeta de trabajo se niega (relativa con .. y absoluta del repo)', async () => {
    const afuera = [{ ruta: '../afuera.txt', texto: 'hola' }, { ruta: path.join(process.cwd(), 'package.json'), texto: '{}' }];
    const { op } = armar([{ content: afuera.map((e) => usoDe('escribir_archivo', e)) }, TERMINAR]);
    const r = await correrAgente(op);
    expect(op.ejecutor.pedidos).toHaveLength(0);
    for (const x of op.registro.lineas[0].herramientas) { expect(x.veredicto).toBe('bloqueado'); expect(x.motivo).toMatch(/fuera de la carpeta de trabajo/); }
    expect(r.corte).toMatch(/dos bloqueos/);
  });

  it('rojo: lo que escribe adentro se escanea, y dos end_turn sin terminar() cortan', async () => {
    const malo = armar([{ content: [usoDe('escribir_archivo', { ruta: 'x.py', texto: 'from supabase import create_client' })] }, TERMINAR]);
    await correrAgente(malo.op);
    expect(malo.op.registro.lineas[0].herramientas[0].motivo).toMatch(/Supabase/);
    const charla = armar([{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'listo' }] }, { stop_reason: 'end_turn', content: [{ type: 'text', text: 'listo' }] }]);
    const r = await correrAgente(charla.op);
    expect(r.terminado).toBe(false);
    expect(r.corte).toMatch(/sin terminar/);
    expect(charla.cliente.llamadas[1].messages[2].content[0].text).toMatch(/terminar\(/);
  });
});

describe('agenteApi: la politica, pura', () => {
  it('lista blanca de comandos', () => {
    for (const c of ['ls -la', 'git log -3 --oneline', 'python x.py --salida a.json', 'grep -n foo a.txt | head -5', 'python -m pytest tests']) expect(comandoPermitido(c, { carpeta: CARPETA }), c).toBeNull();
    for (const c of ['rm -rf x', 'git push', 'python -c "print(1)"', 'node -e 1', 'ls; cat x', 'echo $HOME', 'cat .env.local', 'cat x > y', 'curl http://a', '', 'node scripts/_tokens.mjs', `python ${path.join(os.tmpdir(), 'x.py')}`]) expect(comandoPermitido(c, { carpeta: CARPETA }), c).toBeTruthy();
  });

  it('escaneo de lo escrito, recorte, tapador, topes de pasos y reloj, herramienta de busqueda', () => {
    expect(escanear('ws = openpyxl.load_workbook(p)')).toBeNull();
    for (const t of ['from supabase import x', 'Outlook.Application', 'taskkill /IM CNEXT.exe', 'open(r"\\\\servidor\\x")', 'import requests']) expect(escanear(t), t).toBeTruthy();
    const largo = 'a'.repeat(3000) + 'MEDIO' + 'z'.repeat(3000);
    const corto = recortar(largo, 'salidas/paso-1-1.txt');
    expect(corto.length).toBeLessThan(largo.length); expect(corto).not.toContain('MEDIO'); expect(corto).toContain('salidas/paso-1-1.txt');
    expect(tapar('clave sk-ant-api03-ABCDEFGHIJKLMNOP\nSUPABASE_KEY=eyJabc')).toBe('clave sk-ant-***\nSUPABASE_KEY= ***');
    const topes = { pasos: 60, minutos: 120, dolares: 6 };
    expect(chequearTopes({ paso: 60, inicio: 0, gastadoUsd: 0, ultimaEntrada: 0 }, topes, { modelo: 'sonnet', maxTokens: 100, ahora: 0 })).toMatch(/^pasos/);
    expect(chequearTopes({ paso: 1, inicio: 0, gastadoUsd: 0, ultimaEntrada: 0 }, topes, { modelo: 'sonnet', maxTokens: 100, ahora: 121 * 60000 })).toMatch(/^tiempo/);
    expect(armarHerramientas(7).at(-1)).toEqual({ type: 'web_search_20250305', name: 'web_search', max_uses: 7 });
  });

  it('registroEnDisco: una linea JSONL por paso, la salida completa aparte y mensajes.json al cerrar', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agente-'));
    const plano = (r, t) => { fs.mkdirSync(path.dirname(r), { recursive: true }); fs.writeFileSync(r, t); };
    const reg = registroEnDisco(dir, { escribirFs: plano, agregarFs: (r, t) => { fs.mkdirSync(path.dirname(r), { recursive: true }); fs.appendFileSync(r, t); } });
    reg.agregar({ n: 1 }); reg.agregar({ n: 2 });
    const ruta = reg.guardarSalida(1, 1, 'salida completa');
    reg.cerrar({ estado: { paso: 2 }, mensajes: [] });
    expect(fs.readFileSync(path.join(dir, 'registro.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l).n)).toEqual([1, 2]);
    expect(fs.readFileSync(ruta, 'utf8')).toBe('salida completa');
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'mensajes.json'), 'utf8')).estado.paso).toBe(2);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
