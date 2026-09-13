/**
 * scripts/_anotarVitest.mjs — el rojo de vitest tiene que quedar LEGIBLE sin cuenta de
 * GitHub. El fixture `fixtures/vitestRojo.txt` es una corrida en rojo de verdad (capturada
 * el 13/09/2026 con dos tests plantados: un assert que falla y una excepcion que no es
 * assert), no un log escrito a mano.
 *
 * Los casos de ruido y de cupo salen de la PRIMERA corrida real del script en CI (job
 * 103663765832): saco 10 anotaciones y 8 eran console.warn de otros tests que decian
 * "TypeError" adentro de un JSON de log. Un cupo lleno de eso deja afuera el fallo.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lineasDelRojo, paraAnotacion } from '../../scripts/_anotarVitest.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(AQUI, 'fixtures', 'vitestRojo.txt');
const SCRIPT = path.join(AQUI, '..', '..', 'scripts', '_anotarVitest.mjs');

const RUIDO_REAL = "[2026-09-13T03:07:49.244Z] [WARN] [adminRepository] is_admin RPC failed { error: 'TypeError: fetch failed' }";

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
    // \u001b escrito como escape a proposito: el caracter ESC crudo se pierde al copiar el
    // archivo y `includes('')` da true para cualquier texto — el test pasaba a ser ciego.
    expect(lineasDelRojo(log).some((x) => x.includes('\u001b') || /\[\d+m/.test(x))).toBe(false);
  });

  // EL CASO DE LA PRIMERA CORRIDA REAL: un console.warn que NOMBRA un error no es el error.
  it('un log de la app que dice TypeError adentro no cuenta como fallo', () => {
    expect(lineasDelRojo(RUIDO_REAL)).not.toContain(RUIDO_REAL);
    expect(lineasDelRojo(`${RUIDO_REAL}\nstderr | algun test\n  at foo (bar.ts:1:2)\n`))
      .not.toContain(RUIDO_REAL);
  });

  it('el ruido no se come el cupo: el resumen entra igual', () => {
    const ruido = Array.from({ length: 40 }, (_, i) => RUIDO_REAL.replace('49.244', `49.${i}`));
    const l = lineasDelRojo([...ruido, 'FAIL  __tests__/x.test.ts > caso', 'Tests  3 failed | 9 passed (12)'].join('\n'));
    expect(l.some((x) => x.startsWith('FAIL'))).toBe(true);
    expect(l.some((x) => /^Tests\s{2}/.test(x))).toBe(true);
    expect(l.length).toBeLessThanOrEqual(20);
  });

  it('con muchos FAIL, el resumen sigue entrando (cupo por grupo)', () => {
    const fails = Array.from({ length: 30 }, (_, i) => `FAIL  __tests__/x${i}.test.ts > caso ${i}`);
    const l = lineasDelRojo([...fails, 'Test Files  30 failed (30)'].join('\n'));
    expect(l.some((x) => x.startsWith('Test Files'))).toBe(true);
    expect(l.length).toBeLessThanOrEqual(20);
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

  it('ni el fallback reanota lineas del reporter', () => {
    const soloReporter = '::error file=a.ts,title=x::algo\n::error file=b.ts,title=y::otra cosa\n';
    expect(lineasDelRojo(soloReporter).some((x) => x.startsWith('::'))).toBe(false);
  });

  it('un log vacio no revienta', () => {
    expect(Array.isArray(lineasDelRojo(''))).toBe(true);
  });

  it('el % se escapa entero, no cortado por el tope', () => {
    const l = paraAnotacion(`${'x'.repeat(898)}%RESTO`);
    expect(l.endsWith('%2')).toBe(false);
    expect(/%(?!25)/.test(l)).toBe(false);
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
