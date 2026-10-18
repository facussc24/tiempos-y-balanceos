/**
 * El paso 0 de los entregables (tanda 16, pieza 1): toda skill que arma un entregable lleva el MISMO parrafo, textual,
 * copiado de la fuente unica `docs/FORMATO_CASA.md` (entre las marcas paso0:inicio y paso0:fin). La lista de skills vive
 * en `scripts/_lib/formatoCasa.data.json`. Dos direcciones: una skill sin el parrafo o con el parrafo cambiado da rojo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(import.meta.url), '../../..');
const leer = (p) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const MARCA = /<!-- paso0:inicio -->\n[\s\S]*?\n<!-- paso0:fin -->/;

/** El bloque del paso 0 de un texto, o null si no lo tiene. */
const bloque = (texto) => (texto.match(MARCA) || [null])[0];
/** null si la skill lleva el bloque igual a la fuente; si no, el motivo. */
const revisarSkill = (texto, fuente) => {
  const b = bloque(texto);
  if (!b) return 'no tiene el paso 0';
  if (b !== fuente) return 'el paso 0 no es igual al de docs/FORMATO_CASA.md';
  return null;
};

const FUENTE = bloque(leer('docs/FORMATO_CASA.md'));
const LISTA = JSON.parse(leer('scripts/_lib/formatoCasa.data.json')).skills_de_entregable.lista;

describe('paso 0 en toda skill de entregable', () => {
  it('la fuente unica existe y nombra los cuatro escalones y los dos modos', () => {
    expect(FUENTE).toBeTruthy();
    for (const frase of ['formulario oficial del SGC', 'plantilla propia', 'compañero ya usa un formato', 'formato de la casa', 'corregir el archivo de otro', 'rearmarlo entero', 'scripts/revisar.py']) {
      expect(FUENTE, frase).toContain(frase);
    }
  });

  it('la lista trae las cinco skills que nombra el encargo', () => {
    for (const s of ['hojas-de-proceso', 'planes-de-control', 'flujogramas', 'amfe-export-oficial', 'cad-design']) expect(LISTA).toContain(s);
  });

  for (const s of LISTA) {
    it(`${s} lleva el paso 0 textual`, () => {
      const p = `.claude/skills/${s}/SKILL.md`;
      expect(existsSync(join(RAIZ, p)), p).toBe(true);
      expect(revisarSkill(leer(p), FUENTE)).toBeNull();
    });
  }

  it('da rojo si a una skill le falta el paso 0 o si lo cambiaron', () => {
    expect(revisarSkill('# skill\n\n## 1. algo\n', FUENTE)).toBe('no tiene el paso 0');
    const cambiado = FUENTE.replace('sin amarillo ni notas', 'con amarillo');
    expect(revisarSkill(`# skill\n\n${cambiado}\n`, FUENTE)).toMatch(/no es igual/);
    expect(revisarSkill(`# skill\n\n${FUENTE}\n`, FUENTE)).toBeNull();
  });
});
