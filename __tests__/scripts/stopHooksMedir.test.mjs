/**
 * stopHooksMedir.test.mjs — el medidor de frenos de los hooks Stop (tanda 9, pieza 11).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFreno, medirSesion, chequeoDe } from '../../scripts/_stopHooksMedir.mjs';

describe('leerFreno', () => {
  it('saca el hook y el motivo del mensaje que deja Claude Code; un mensaje comun no es freno', () => {
    const f = leerFreno('Stop hook feedback:\n[bash "${CLAUDE_PROJECT_DIR}/.claude/hooks/cierre-guard.sh"]: CIERRE-GUARD: el turno termina anunciando trabajo');
    expect(f.hook).toBe('cierre-guard');
    expect(f.motivo).toMatch(/^CIERRE-GUARD: el turno termina/);
    expect(leerFreno('dale segui')).toBeNull();
  });
});

describe('medirSesion', () => {
  const fr = { tipo: 'freno', hook: 'cierre-guard', motivo: 'x' };
  it('trabajo si alguna linea del turno siguiente usa una herramienta, aunque la primera sea solo texto', () => {
    const r = medirSesion([fr, { tipo: 'asistente', herramienta: false }, { tipo: 'asistente', herramienta: true }]);
    expect(r.porHook['cierre-guard']).toEqual({ frenos: 1, trabajo: 1, volvioACerrar: 0 });
  });
  it('volvio a cerrar si llega otro freno o un mensaje de Fak sin herramienta en el medio; la racha y el tope se cuentan', () => {
    const ev = [...Array(8).fill(fr).flatMap((f) => [f, { tipo: 'asistente', herramienta: false }]), { tipo: 'fak' }, fr, { tipo: 'asistente', herramienta: true }];
    const r = medirSesion(ev);
    expect(r.rachaMax).toBe(8);
    expect(r.topes).toBe(1);
    expect(r.porHook['cierre-guard']).toEqual({ frenos: 9, trabajo: 1, volvioACerrar: 8 });
  });
});

describe('por chequeo (tanda 13, item 13: el antes y despues del estilo de salida)', () => {
  it('reconoce el chequeo por el titulo real que imprime cierreGuard.mjs; uno que no conoce da null', () => {
    expect(chequeoDe('CIERRE-GUARD: el turno termina pidiendo permiso para hacer tu propio trabajo')).toBe(1);
    expect(chequeoDe('CIERRE-GUARD: entregaste algo afuera del repo y el cierre no dice DONDE quedo')).toBe(2);
    expect(chequeoDe('CIERRE-GUARD: el mensaje declara cierre y hay pendientes medibles')).toBe(3);
    expect(chequeoDe('CIERRE-GUARD: escribiste un entregable afuera del repo y no lo abriste despues')).toBe(4);
    expect(chequeoDe('CIERRE-GUARD: el cierre es un informe')).toBe(5);
    expect(chequeoDe('CIERRE-GUARD: el turno termina anunciando trabajo que no hiciste')).toBe(6);
    expect(chequeoDe('CIERRE-GUARD: Fak pidio que se lo expliques y contestaste sin cambiar la forma')).toBe(7);
    expect(chequeoDe('CIERRE-GUARD: el mensaje dice que no tenes acceso a los mails de un companero, y esos mails')).toBe(8);
    expect(chequeoDe('CIERRE-GUARD: un documento escrito en este turno dice que lo hizo Claude o una IA')).toBe(9);
    expect(chequeoDe('CIERRE-GUARD: el turno termina en ingles')).toBe(10);
    expect(chequeoDe('HORA-GUARD: no hay latido')).toBeNull();
  });
  it('los titulos del medidor siguen siendo los del cierre-guard (si cambia un titulo, este test lo ve)', () => {
    const src = readFileSync(resolve(fileURLToPath(import.meta.url), '../../../scripts/_lib/cierreGuard.mjs'), 'utf8');
    const titulos = [...src.matchAll(/'(CIERRE-GUARD: [^']+)'/g)].map((m) => m[1]);
    expect(titulos.length).toBeGreaterThanOrEqual(10);
    for (const t of titulos) expect(chequeoDe(t), t).not.toBeNull();
  });
  it('cuenta los frenos de cierre-guard por chequeo y los mensajes de Fak; los de otro hook no entran', () => {
    const ev = [
      { tipo: 'fak' },
      { tipo: 'freno', hook: 'cierre-guard', motivo: 'CIERRE-GUARD: el turno termina en ingles' },
      { tipo: 'asistente', herramienta: true },
      { tipo: 'freno', hook: 'hora-guard', motivo: 'x' },
      { tipo: 'fak' },
      { tipo: 'freno', hook: 'cierre-guard', motivo: 'algo que no se reconoce' },
    ];
    const r = medirSesion(ev);
    expect(r.porChequeo).toEqual({ 10: 1, otro: 1 });
    expect(r.mensajesFak).toBe(2);
  });
});
