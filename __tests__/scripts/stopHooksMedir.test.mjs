/**
 * stopHooksMedir.test.mjs — el medidor de frenos de los hooks Stop (tanda 9, pieza 11).
 */
import { leerFreno, medirSesion } from '../../scripts/_stopHooksMedir.mjs';

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
