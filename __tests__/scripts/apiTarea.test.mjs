// @vitest-environment node
/**
 * Tests de scripts/_apiTarea.mjs — el puente "pedido + adjuntos -> API -> archivo". Sin red: solo las
 * funciones puras y los candados (un secreto o un archivo gordo no se mandan nunca).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { armarMensaje, esSecreto, leerAdjuntos, leerArgumentos, TOPE_ADJUNTO_BYTES } from '../../scripts/_apiTarea.mjs';

describe('_apiTarea · armar el mensaje', () => {
  it('el pedido va primero y cada adjunto entre etiquetas con su ruta', () => {
    const m = armarMensaje({ pedido: 'Revisá esto.\n', adjuntos: [{ ruta: 'a/b.md', texto: 'hola\r\nchau' }] });
    expect(m.startsWith('Revisá esto.')).toBe(true);
    expect(m).toContain('--- 1 archivo(s) adjunto(s) ---');
    expect(m).toContain('<archivo ruta="a/b.md">\nhola\nchau\n</archivo>');
  });
  it('sin adjuntos es solo el pedido', () => {
    expect(armarMensaje({ pedido: ' x ' })).toBe('x');
  });
});

describe('_apiTarea · candados', () => {
  it('ROJO — un archivo de secretos no se manda, con cualquier ruta', () => {
    for (const r of ['.env', '.env.local', 'C:\\Dev\\BarackMercosul\\.env.local', 'sub/.qr-secret', '.ENV.production']) {
      expect(esSecreto(r), r).toBe(true);
      expect(() => leerAdjuntos([r])).toThrow(/secretos/);
    }
  });
  it('VERDE — un archivo comun si se manda, con la ruta relativa y barras normales', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apitarea-'));
    const f = path.join(dir, 'informe.md');
    fs.writeFileSync(f, 'texto\n');
    expect(esSecreto(f)).toBe(false);
    expect(esSecreto('docs/environment.md')).toBe(false);
    const [a] = leerAdjuntos([f], { raiz: dir });
    expect(a).toEqual({ ruta: 'informe.md', texto: 'texto\n' });
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it('ROJO — un adjunto de mas de 2 MB se rechaza antes de leerlo entero', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apitarea-'));
    const f = path.join(dir, 'gordo.txt');
    fs.writeFileSync(f, Buffer.alloc(TOPE_ADJUNTO_BYTES + 1, 97));
    expect(() => leerAdjuntos([f], { raiz: dir })).toThrow(/tope/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it('ROJO — un adjunto que no existe', () => {
    expect(() => leerAdjuntos(['no/existe.md'])).toThrow(/no existe/);
  });
});

describe('_apiTarea · argumentos', () => {
  it('toma varios --adjunto, opus/high/32000 por defecto, y --estimar no exige --salida', () => {
    const op = leerArgumentos(['--tarea', 't', '--pedido', 'p.md', '--adjunto', 'a', '--adjunto', 'b', '--estimar']);
    expect(op.adjuntos).toEqual(['a', 'b']);
    expect(op.modelo).toBe('opus');
    expect(op.effort).toBe('high');
    expect(op.maxTokens).toBe(32000);
    expect(op.estimar).toBe(true);
  });
  it('ROJO — sin --salida (y sin --estimar), con effort max, con un argumento desconocido o un modelo inventado', () => {
    expect(() => leerArgumentos(['--tarea', 't', '--pedido', 'p.md'])).toThrow(/--salida/);
    expect(() => leerArgumentos(['--tarea', 't', '--pedido', 'p.md', '--salida', 's', '--effort', 'max'])).toThrow(/effort/);
    expect(() => leerArgumentos(['--tarea', 't', '--pedido', 'p.md', '--salida', 's', '--raro'])).toThrow(/no conozco/);
    expect(() => leerArgumentos(['--tarea', 't', '--pedido', 'p.md', '--salida', 's', '--modelo', 'gpt'])).toThrow();
  });
});
