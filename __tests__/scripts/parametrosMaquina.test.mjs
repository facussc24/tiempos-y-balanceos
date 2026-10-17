/**
 * Tests de `scripts/_lib/parametrosMaquina.mjs` y `scripts/_parametrosMaquina.mjs` — los parametros de una maquina en el
 * tiempo (tanda 13, item 9).
 *
 * Caso de respuesta conocida (memoria `reference_maquina_hotmelt_parametros`): la consigna de los rodillos de la hot
 * melt paso de 195 a 185 °C el 26/08/2026 entre los videos IMG_0383 e IMG_0394. En las dos direcciones: ese salto se
 * marca; una lectura repetida con el mismo valor otro dia no se marca; una lectura sin fuente no se anota.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { historia, revisar, anotarLectura, informe, mismoValor, leerValor, lineaCambio } from '../../scripts/_lib/parametrosMaquina.mjs';
import { leerBloque } from '../../scripts/_lib/seguimientos.mjs';

const RAIZ = resolve(fileURLToPath(import.meta.url), '../../..');
const consigna = () => ({
  campo: 'consigna de los rodillos', pantalla: '设定温度', unidad: '°C',
  lecturas: [
    { fecha: '2026-08-26', valor: 195, fuente: 'video IMG_0383' },
    { fecha: '2026-08-26', valor: 185, fuente: 'video IMG_0394' },
  ],
});

describe('parametros de maquina — el salto de la hot melt del 26/08', () => {
  it('195 -> 185 el mismo dia se marca como CAMBIO, en el orden de los videos', () => {
    const h = historia(consigna());
    expect(h.map((l) => l.valor)).toEqual([195, 185]);
    expect(h[0].cambio).toBeNull();
    expect(h[1].cambio).toMatchObject({ de: 195, a: 185 });
    expect(lineaCambio(consigna(), h[1])).toBe('CAMBIO «consigna de los rodillos»: 195 °C -> 185 °C el 26/08/2026 (video IMG_0394; antes, 26/08/2026, video IMG_0383)');
  });

  it('una lectura posterior con el mismo valor (185,0 escrito con coma) NO se marca', () => {
    const p = consigna();
    p.lecturas.push({ fecha: '2026-09-10', valor: leerValor('185,0'), fuente: 'foto 0836_11' });
    const h = historia(p);
    expect(h[2].cambio).toBeNull();
    expect(informe('hotmelt', { parametros: [p] })).toMatch(/1 cambio\(s\):/);
  });

  it('las lecturas se ordenan por fecha aunque se anoten desordenadas; dentro del dia manda el orden de anotacion', () => {
    const p = { campo: 'x', lecturas: [
      { fecha: '2026-08-28', valor: 160, fuente: 'IMG_9527 f0356' },
      { fecha: '2026-08-25', valor: 180, fuente: 'IMG_0349 f0033' },
    ] };
    const h = historia(p);
    expect(h.map((l) => l.fecha)).toEqual(['2026-08-25', '2026-08-28']);
    expect(h[1].cambio).toMatchObject({ de: 180, a: 160 });
  });

  it('valores de texto (nombre de receta) se comparan sin mayusculas', () => {
    expect(mismoValor('tpo', 'TPO ')).toBe(true);
    expect(mismoValor('kp1', 'tpo')).toBe(false);
    expect(mismoValor(185, 185.0)).toBe(true);
  });
});

describe('parametros de maquina — anotar, y lo mal escrito', () => {
  it('anotar devuelve el cambio contra la lectura anterior; repetir la misma lectura no se anota', () => {
    const datos = { parametros: [consigna()] };
    const r = anotarLectura(datos, 'Consigna de los  rodillos', { fecha: '2026-10-20', valor: '180', fuente: 'video IMG_1000' });
    expect(r.lectura.cambio).toMatchObject({ de: 185, a: 180 });
    expect(() => anotarLectura(datos, 'consigna de los rodillos', { fecha: '2026-10-20', valor: '180', fuente: 'video IMG_1000' })).toThrow(/ya esta anotada/);
  });

  it('sin fuente no se anota (la fecha es la del video: sin video no hay con que comparar)', () => {
    expect(() => anotarLectura({ parametros: [consigna()] }, 'consigna de los rodillos', { fecha: '2026-10-20', valor: 180 })).toThrow(/falta --fuente/);
  });

  it('un campo nuevo se crea con su unidad, y la primera lectura no es un cambio', () => {
    const datos = { parametros: [] };
    const r = anotarLectura(datos, 'proteccion', { fecha: '2026-08-26', valor: 130, fuente: 'video IMG_0383', unidad: '°C' });
    expect(datos.parametros[0]).toMatchObject({ campo: 'proteccion', unidad: '°C' });
    expect(r.lectura.cambio).toBeNull();
  });

  it('un parametro mal escrito se dice y no calla al sano', () => {
    const rev = revisar({ parametros: [{ campo: 'roto', lecturas: [{ fecha: '26/08', valor: 1, fuente: 'x' }] }, consigna()] });
    expect(rev[0].error).toMatch(/fecha invalida/);
    expect(rev[1].hist[1].cambio).not.toBeNull();
    const t = informe('m', { parametros: [{ campo: 'sin-fuente', lecturas: [{ fecha: '2026-08-26', valor: 1 }] }, consigna()] });
    expect(t).toMatch(/ESTA MAL ESCRITO: "sin-fuente", lectura 1 \(2026-08-26\): falta la fuente/);
    expect(t).toMatch(/CAMBIO «consigna de los rodillos»/);
  });
});

describe('parametros de maquina — el comando sobre una carpeta de memorias de prueba', () => {
  const md = (datos) => `---\nname: ficha\n---\n\nFicha.\n\n\`\`\`json\n${JSON.stringify(datos, null, 2)}\n\`\`\`\n\nAbajo.\n`;
  const correr = (dir, ...a) => spawnSync(process.execPath, [join(RAIZ, 'scripts/_parametrosMaquina.mjs'), ...a], {
    encoding: 'utf8', env: { ...process.env, BARACK_MEMORIA_DIR: dir },
  });

  it('lista el cambio de la hot melt, anota una lectura nueva con aviso y respeta el texto de la ficha', () => {
    const dir = mkdtempSync(join(tmpdir(), 'parametros-'));
    try {
      const ficha = join(dir, 'reference_maquina_hotmelt_parametros.md');
      writeFileSync(ficha, md({ parametros: [consigna()] }));
      writeFileSync(join(dir, 'otra_memoria.md'), 'sin bloque');
      const l = correr(dir);
      expect(l.status).toBe(0);
      expect(l.stdout).toMatch(/== reference_maquina_hotmelt_parametros: 1 parametro/);
      expect(l.stdout).toMatch(/CAMBIO «consigna de los rodillos»: 195 °C -> 185 °C el 26\/08\/2026/);
      expect(l.stdout).not.toMatch(/otra_memoria/);

      const a = correr(dir, '--anotar', 'hotmelt', '--campo', 'consigna de los rodillos', '--valor', '185', '--fecha', '2026-10-20', '--fuente', 'video IMG_2000');
      expect(a.status).toBe(0);
      expect(a.stdout).toMatch(/sin cambio contra la lectura anterior/);
      const b = correr(dir, '--anotar', 'hotmelt', '--campo', 'consigna de los rodillos', '--valor', '175', '--fecha', '2026-10-21', '--fuente', 'video IMG_2001');
      expect(b.stdout).toMatch(/CAMBIO «consigna de los rodillos»: 185 °C -> 175 °C el 21\/10\/2026/);
      const texto = readFileSync(ficha, 'utf8');
      expect(texto.startsWith('---\nname: ficha\n---\n\nFicha.')).toBe(true);
      expect(texto.endsWith('\n\nAbajo.\n')).toBe(true);
      expect(leerBloque(texto, 'parametros').datos.parametros[0].lecturas).toHaveLength(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('frena sin escribir: argumento desconocido, --anotar sin fuente, o que no da con una sola ficha', () => {
    const dir = mkdtempSync(join(tmpdir(), 'parametros-'));
    try {
      const ficha = join(dir, 'reference_maquina_hotmelt_parametros.md');
      writeFileSync(ficha, md({ parametros: [consigna()] }));
      writeFileSync(join(dir, 'reference_maquina_hotmelt_otra.md'), md({ parametros: [] }));
      const antes = readFileSync(ficha, 'utf8');
      expect(correr(dir, '--apply').status).toBe(2);
      expect(correr(dir, '--anotar', 'hotmelt_parametros', '--campo', 'c', '--valor', '1', '--fecha', '2026-10-20').status).toBe(2);
      expect(correr(dir, '--valor', '1').status).toBe(2);
      const dos = correr(dir, '--anotar', 'hotmelt', '--campo', 'c', '--valor', '1', '--fecha', '2026-10-20', '--fuente', 'v');
      expect(dos.status).toBe(1);
      expect(dos.stderr).toMatch(/tiene que dar con UNA ficha/);
      expect(readFileSync(ficha, 'utf8')).toBe(antes);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
