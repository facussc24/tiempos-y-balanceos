/**
 * Tests de `scripts/_lib/observaciones.mjs` y `scripts/_observaciones.mjs` — el libro de observaciones recibidas
 * (tanda 13, item 5). Caso de respuesta conocida: las 6 observaciones de Carlos al AMFE de ductos (10/08 y 20/08/2026,
 * `docs/ductos-amfe-hallazgos.md`): 5 sobre el AMFE y 1 sobre el flujograma; 1 la caza un control solo, 1 a medias, 4 a
 * mano. En las dos direcciones: una observacion de una clase ya cerrada dice VOLVIO; una de clase nueva, no.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resumen, antesDeMandar, anotar, cerrar, cobertura, validar, textoAntesDeMandar } from '../../scripts/_lib/observaciones.mjs';
import { leerBloque } from '../../scripts/_lib/seguimientos.mjs';

const RAIZ = resolve(fileURLToPath(import.meta.url), '../../..');
const obs = (extra = {}) => ({
  id: 'x', fecha: '2026-08-20', de: 'Carlos Baptista', documento: 'AMFE', que: 'algo', clase: 'c', estado: 'sin-confirmar',
  chequeo: 'mirar algo', gate: null, ...extra,
});
const ductos = () => ({
  observaciones: [
    obs({ id: 'm', fecha: '2026-08-10', clase: 'materiales-vs-bom', gate: 'amfeAutoria.mjs' }),
    obs({ id: '1', clase: 'foto-de-otra-pieza' }),
    obs({ id: '2', clase: 'operacion-que-falta', gate: '_verificarNumeracion.mjs', gate_parcial: true }),
    obs({ id: '3', clase: 'codigos-por-operacion' }),
    obs({ id: '4', clase: 'codigos-solo-corte' }),
    obs({ id: '5', documento: 'flujograma', clase: 'codigos-por-operacion' }),
  ],
});

describe('libro de observaciones — el caso de ductos', () => {
  it('5 sobre AMFE y 1 sobre flujograma; el AMFE: 1 la caza solo, 1 a medias, 3 a mano', () => {
    const r = resumen(ductos());
    expect(r.amfe).toEqual({ total: 5, auto: 1, parcial: 1, manual: 3, abiertas: 5, rotas: 0 });
    expect(r.flujograma).toEqual({ total: 1, auto: 0, parcial: 0, manual: 1, abiertas: 1, rotas: 0 });
  });
  it('antes de mandar un AMFE salen primero las de mirar a mano, despues las de a medias y al final las que caza un control', () => {
    const { observaciones } = antesDeMandar(ductos(), 'amfe');
    expect(observaciones.map(cobertura)).toEqual(['manual', 'manual', 'manual', 'parcial', 'auto']);
    expect(antesDeMandar(ductos(), 'Flujograma').observaciones.map((o) => o.id)).toEqual(['5']);
    expect(textoAntesDeMandar(ductos(), 'hoja de proceso')).toMatch(/No hay observaciones recibidas/);
  });
});

describe('libro de observaciones — VOLVIO (molde D7 de la tanda 9)', () => {
  it('una observacion de una clase que ya se cerro dice VOLVIO; una de clase nueva, no', () => {
    const datos = ductos();
    cerrar(datos, '1', { fecha: '2026-09-01', como: 'la foto sale de la carpeta de la pieza', gate: 'gate de foto' });
    expect(datos.observaciones[1]).toMatchObject({ estado: 'cerrada', gate: 'gate de foto' });
    const v = anotar(datos, { de: 'Calidad', documento: 'AMFE', que: 'otra vez una foto de otra pieza', clase: 'Foto-de-otra-pieza' }, { hoy: '2026-10-17' });
    expect(v.volvio.map((o) => o.id)).toEqual(['1']);
    const n = anotar(datos, { de: 'VW', documento: 'BeOn', que: 'falta el IMDS', clase: 'imds' }, { hoy: '2026-10-17' });
    expect(n.volvio).toEqual([]);
    expect(n.obs).toMatchObject({ estado: 'abierta', chequeo: 'falta el IMDS', fecha: '2026-10-17' });
  });
  it('mal escrita se dice y no se cuenta como cubierta; un estado inventado o una fecha futura no se anotan', () => {
    expect(() => validar(obs({ estado: 'resuelta' }))).toThrow(/estado que no existe/);
    expect(() => validar(obs({ chequeo: '' }))).toThrow(/no tiene "chequeo"/);
    const r = resumen({ observaciones: [obs({ fecha: '20/08' })] });
    expect(r.amfe).toMatchObject({ total: 1, rotas: 1, manual: 0 });
    expect(textoAntesDeMandar({ observaciones: [obs({ id: 'rota', fecha: '20/08' })] }, 'AMFE')).toMatch(/rota: ESTA MAL ESCRITA/);
    expect(() => anotar({ observaciones: [] }, { de: 'a', documento: 'AMFE', que: 'q', clase: 'c', fecha: '2026-12-01' }, { hoy: '2026-10-17' })).toThrow(/futura/);
    expect(() => cerrar(ductos(), 'no-existe', { fecha: '2026-10-17', como: 'x' })).toThrow(/no hay una observacion/);
  });
});

describe('libro de observaciones — el comando', () => {
  const md = (datos) => `---\nname: x\n---\n\nArriba.\n\n\`\`\`json\n${JSON.stringify(datos, null, 2)}\n\`\`\`\n\nAbajo.\n`;
  const correr = (archivo, ...a) => spawnSync(process.execPath, [join(RAIZ, 'scripts/_observaciones.mjs'), ...a], {
    encoding: 'utf8', env: { ...process.env, BARACK_OBSERVACIONES: archivo, BARACK_HOY: '2026-10-17' },
  });

  it('resumen, antes de mandar, anotar con VOLVIO y cerrar; el texto de la memoria se respeta', () => {
    const dir = mkdtempSync(join(tmpdir(), 'observaciones-'));
    const archivo = join(dir, 'obs.md');
    try {
      writeFileSync(archivo, md(ductos()));
      expect(correr(archivo).stdout).toMatch(/amfe\s+5 · las caza un control solo: 1 · a medias: 1 · a mano: 3/);
      expect(correr(archivo, '--antes-de-mandar', 'AMFE').stdout).toMatch(/^Antes de mandar un AMFE: 5 observacion/);
      expect(correr(archivo, '--cerrar', '3', '--como', 'tabla de codigos en el generador').status).toBe(0);
      const a = correr(archivo, '--anotar', '--de', 'Carlos Baptista', '--documento', 'AMFE', '--que', 'de nuevo sin tabla de codigos', '--clase', 'codigos-por-operacion');
      expect(a.status).toBe(0);
      expect(a.stdout).toMatch(/VOLVIO: la clase «codigos-por-operacion» ya se habia cerrado el 2026-10-17/);
      const texto = readFileSync(archivo, 'utf8');
      expect(texto.startsWith('---\nname: x\n---\n\nArriba.')).toBe(true);
      expect(leerBloque(texto, 'observaciones').datos.observaciones).toHaveLength(7);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('frena sin escribir: argumento desconocido, anotar sin clase, cerrar sin --como, dos modos juntos', () => {
    const dir = mkdtempSync(join(tmpdir(), 'observaciones-'));
    const archivo = join(dir, 'obs.md');
    try {
      writeFileSync(archivo, md(ductos()));
      const antes = readFileSync(archivo, 'utf8');
      expect(correr(archivo, '--apply').status).toBe(2);
      expect(correr(archivo, '--anotar', '--de', 'a', '--documento', 'AMFE', '--que', 'q').status).toBe(2);
      expect(correr(archivo, '--cerrar', '1').status).toBe(2);
      expect(correr(archivo, '--cerrar', '1', '--como', 'x', '--antes-de-mandar', 'AMFE').status).toBe(2);
      expect(readFileSync(archivo, 'utf8')).toBe(antes);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
