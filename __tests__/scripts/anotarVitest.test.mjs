/**
 * scripts/_anotarVitest.mjs — el rojo de vitest tiene que quedar LEGIBLE sin cuenta de
 * GitHub. El fixture `fixtures/vitestRojo.txt` es una corrida en rojo de verdad (capturada
 * el 13/09/2026 con dos tests plantados: un assert que falla y una excepcion que no es
 * assert), no un log escrito a mano.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lineasDelRojo } from '../../scripts/_anotarVitest.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(AQUI, 'fixtures', 'vitestRojo.txt');
const SCRIPT = path.join(AQUI, '..', '..', 'scripts', '_anotarVitest.mjs');

describe('_anotarVitest', () => {
  const log = fs.readFileSync(FIXTURE, 'utf8');

  it('nombra el archivo, el test y el motivo', () => {
    const l = lineasDelRojo(log);
    expect(l.some((x) => x.includes('FAIL') && x.includes('_tmpRojoCalibracion'))).toBe(true);
    expect(l.some((x) => x.startsWith('AssertionError'))).toBe(true);
    expect(l.some((x) => x.startsWith('TypeError'))).toBe(true);
    expect(l.some((x) => /^Tests\s{2}.*failed/.test(x))).toBe(true);
  });

  it('no reanota las lineas del reporter github-actions', () => {
    expect(lineasDelRojo(log).some((x) => x.startsWith('::'))).toBe(false);
  });

  it('sin color: los codigos ANSI no entran en la anotacion', () => {
    expect(lineasDelRojo(log).some((x) => x.includes('') || /\[\d+m/.test(x))).toBe(false);
  });

  // EL CASO QUE LO MOTIVO. El 11 y el 13/09 el job quedo con CERO anotaciones de test: el
  // reporter anota asserts, y una corrida que muere de otra forma no pasa por ahi. Un log
  // que no matchea ningun patron NO puede salir sin anotacion, que es justo cuando menos
  // se sabe que paso.
  it('un log sin ningun patron conocido igual deja anotacion', () => {
    const raro = 'levantando workers\nEl proceso termino solo\nexit code 1\n';
    const l = lineasDelRojo(raro);
    expect(l.length).toBeGreaterThan(0);
    expect(l).toContain('exit code 1');
  });

  it('un log vacio no revienta', () => {
    expect(Array.isArray(lineasDelRojo(''))).toBe(true);
  });

  it('corriendolo de verdad, imprime anotaciones y sale con 0', () => {
    const out = execFileSync(process.execPath, [SCRIPT, FIXTURE], { encoding: 'utf8' });
    const anot = out.split('\n').filter((l) => l.startsWith('::error title=vitest::'));
    expect(anot.length).toBeGreaterThanOrEqual(4);
    expect(anot.every((l) => !l.slice(22).includes('%') || l.includes('%25'))).toBe(true);
  });

  it('un log que no existe se anota como tal, no rompe el paso', () => {
    const out = execFileSync(process.execPath, [SCRIPT, path.join(AQUI, 'no-existe.log')], { encoding: 'utf8' });
    expect(out).toMatch(/::error title=vitest::no se pudo leer el log/);
  });
});
