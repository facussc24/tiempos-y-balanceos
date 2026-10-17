/**
 * retirosVencidos.test.mjs — retiro con vencimiento (tanda 9, pieza 7): cada hook y cada regla del disco tiene su
 * renglon con fecha y razon, los dos retiros ya decididos aparecen, y el conteo de firmas no confunde un hook con otro.
 */
import fs from 'node:fs';
import { DATOS, piezasEnDisco, evaluarRetiros, contarFirmas, etiquetaDe } from '../../scripts/_retirosVencidos.mjs';

const datos = JSON.parse(fs.readFileSync(DATOS, 'utf8'));

describe('el registro cubre el disco', () => {
  it('ROJO si un hook o una regla nueva no tiene renglon (entra con su fecha y su razon en la misma sesion)', () => {
    const r = evaluarRetiros(datos, piezasEnDisco(), '2026-10-17');
    expect(r.sinRenglon).toEqual([]);
    expect(r.sinArchivo).toEqual([]);
    for (const [id, p] of Object.entries(datos.piezas)) {
      expect(p.revisar, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.justifica.length, id).toBeGreaterThan(10);
    }
  });
  it('detecta una pieza en el disco sin renglon y un renglon sin archivo', () => {
    const r = evaluarRetiros({ piezas: { 'hook:viejo': { revisar: '2026-11-17', justifica: 'x' } } }, ['hook:nuevo'], '2026-10-17');
    expect(r.sinRenglon).toEqual(['hook:nuevo']);
    expect(r.sinArchivo).toEqual(['hook:viejo']);
  });
});

describe('vencimientos', () => {
  it('el 17/10 los dos retiros decididos (camino B y la espera de _hijaEstado) vencen en los proximos 7 dias; el 23/10 estan vencidos', () => {
    const a = evaluarRetiros(datos, piezasEnDisco(), '2026-10-17');
    expect(a.proximos.map((f) => f.id).sort()).toEqual(['hijaEstado:espera-modelo', 'lanzar-sesion-hija:camino-b']);
    expect(a.vencidos).toEqual([]);
    const b = evaluarRetiros(datos, piezasEnDisco(), '2026-10-23');
    expect(b.vencidos.map((f) => f.id).sort()).toEqual(['hijaEstado:espera-modelo', 'lanzar-sesion-hija:camino-b']);
  });
  it('una razon TBD se lista como sin razon', () => {
    const r = evaluarRetiros({ piezas: { 'regla:x': { revisar: '2026-11-17', justifica: 'TBD: nadie lo dijo' } } }, ['regla:x'], '2026-10-17');
    expect(r.sinRazon).toEqual(['regla:x']);
  });
});

describe('el paso del cierre (evaluarRetirosCierre)', () => {
  it('los vencidos se nombran el viernes como aviso; los otros dias se cuentan en ok; una pieza sin renglon avisa siempre', async () => {
    const { evaluarRetirosCierre } = await import('../../scripts/_cierreSesion.mjs');
    const r = evaluarRetiros(datos, piezasEnDisco(), '2026-10-23');
    expect(evaluarRetirosCierre(r, { viernes: true }).estado).toBe('aviso');
    expect(evaluarRetirosCierre(r, { viernes: true }).detalle).toMatch(/lanzar-sesion-hija:camino-b/);
    expect(evaluarRetirosCierre(r, { viernes: false }).estado).toBe('ok');
    expect(evaluarRetirosCierre({ ...r, sinRenglon: ['hook:nuevo'] }, { viernes: false }).estado).toBe('aviso');
    expect(evaluarRetirosCierre(null).estado).toBe('aviso');
  });
});

describe('conteo de firmas', () => {
  it('cuenta la firma de cada hook y no confunde cierre-guard con session-close-guard', () => {
    const t = '[CIERRE-GUARD] frena · CIERRE-GUARD: el turno · [SESSION-CLOSE-GUARD] viejo · [ESCRITORIO-GUARD — RECORDATORIO';
    const c = contarFirmas(t, ['hook:cierre-guard', 'hook:session-close-guard', 'hook:escritorio-guard', 'hook:mail-guard']);
    expect(c).toEqual({ 'hook:cierre-guard': 2, 'hook:session-close-guard': 1, 'hook:escritorio-guard': 1, 'hook:mail-guard': 0 });
    expect(etiquetaDe('hook:nube-personal-guard')).toBe('NUBE-PERSONAL-GUARD');
    // las otras formas de firmar, medidas en los registros del 17/10
    const u = contarFirmas('AVISO (agentes-guard, P5): este Sonnet · [COMMIT-RUTAS] BLOQUEADO · hablo de agentes-guard en un texto', ['hook:agentes-guard', 'hook:commit-rutas-guard']);
    expect(u).toEqual({ 'hook:agentes-guard': 1, 'hook:commit-rutas-guard': 1 });
  });
});
