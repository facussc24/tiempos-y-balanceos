/**
 * `_fichaPieza.mjs --registrar`, corrido como lo corren los emisores (_emitirApqp.py, _bomLegajo.py,
 * _exportAmfeOficial.ts), sobre una COPIA de la ficha del Insert en una carpeta temporal
 * (BARACK_FICHAS_DIR): la ficha de verdad no se toca.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(RAIZ, 'scripts', '_fichaPieza.mjs');
const ORIGINAL = path.join(RAIZ, 'data', 'configuracion', 'insert-patagonia.json');
let dir;

const correr = (...args) => execFileSync(process.execPath, [CLI, '--registrar', ...args], { encoding: 'utf8', env: { ...process.env, BARACK_FICHAS_DIR: dir } });
const ficha = () => JSON.parse(fs.readFileSync(path.join(dir, 'insert-patagonia.json'), 'utf8'));
const doc = (id) => ficha().documentos.find((d) => d.id === id);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fichas-'));
  fs.copyFileSync(ORIGINAL, path.join(dir, 'insert-patagonia.json'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('--registrar', () => {
  it('una emision del flujograma 154 deja la letra y el renglon de la emision', () => {
    const antes = (doc('flujograma:154').emisiones || []).length;
    const out = correr('--tipo', 'flujograma', '--nombre', 'FLUJOGRAMA 154 - INSERT - Rev.E', '--destino', 'Y:/prueba', '--fecha', '2026-10-19', '--quien', 'test');
    expect(out).toMatch(/insert-patagonia/);
    const d = doc('flujograma:154');
    expect(d.letra).toBe('E');
    expect(d.emisiones).toHaveLength(antes + 1);
    expect(d.emisiones.at(-1)).toMatchObject({ letra: 'E', fecha: '2026-10-19', destino: 'Y:/prueba', quien: 'test' });
  });
  it('un documento que ninguna ficha tiene: dice «sin ficha», sale 0 y no escribe', () => {
    const antes = fs.readFileSync(path.join(dir, 'insert-patagonia.json'), 'utf8');
    expect(correr('--tipo', 'amfe', '--numero', '999', '--letra', 'A')).toMatch(/sin ficha/);
    expect(fs.readFileSync(path.join(dir, 'insert-patagonia.json'), 'utf8')).toBe(antes);
  });
  it('la BOM del legajo se registra por familia: Insert si, otra familia no', () => {
    expect(correr('--tipo', 'bom', '--numero', 'legajo', '--familia', 'Top Roll', '--destino', 'x')).toMatch(/sin ficha/);
    expect(doc('bom:legajo').emisiones || []).toHaveLength(0);
    correr('--tipo', 'bom', '--numero', 'legajo', '--familia', 'Insert', '--destino', 'x', '--fecha', '2026-10-19');
    expect(doc('bom:legajo').emisiones).toHaveLength(1);
  });
  it('lo que no conoce, frena (lo que escribe no adivina un argumento)', () => {
    expect(() => correr('--tipo', 'amfe', '--numero', '158', '--borrar')).toThrow();
  });
});
