/**
 * Tests para scripts/_auditTextQuality.mjs (auditor L2).
 * Plan: warm-plotting-snowflake.md
 *
 * Importa la funcion pura `auditAmfeTextQuality` y la corre contra fixtures
 * en memoria. NO toca Supabase.
 */
import { describe, it, expect } from 'vitest';
import { auditAmfeTextQuality } from '../../scripts/_auditTextQuality.mjs';

/**
 * Helper para construir un AMFE doc minimo con 1 OP, 1 WE, 1 funcion.
 */
function makeDoc({
  opName = 'COSTURA UNION',
  operationFunction = 'Unir piezas de tela garantizando resistencia y alineacion de costuras',
  weName = 'Maquina de coser industrial',
  weType = 'Machine',
  fnDescription = 'Coser uniones controlando tension de hilo y longitud de puntada',
} = {}) {
  return {
    operations: [
      {
        opNumber: 50,
        operationNumber: 50,
        name: opName,
        operationName: opName,
        operationFunction,
        focusElementFunction: 'Func. item placeholder',
        workElements: [
          {
            type: weType,
            name: weName,
            functions: [
              {
                description: fnDescription,
                functionDescription: fnDescription,
                failures: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('auditAmfeTextQuality (L2 — calidad textual 6M)', () => {
  it('1) FN_TOO_SHORT: fn.description muy corta', () => {
    const doc = makeDoc({ fnDescription: 'Costura' });
    const issues = auditAmfeTextQuality(doc, 'AMFE-TEST-1');
    expect(issues.some(i => i.type === 'FN_TOO_SHORT')).toBe(true);
  });

  it('2) FN_NO_VERB: fn.description que no comienza con verbo', () => {
    const doc = makeDoc({
      fnDescription: 'El operador hace algo aqui durante el turno completo',
    });
    const issues = auditAmfeTextQuality(doc, 'AMFE-TEST-2');
    expect(issues.some(i => i.type === 'FN_NO_VERB')).toBe(true);
  });

  it('3) FN_ALL_CAPS_SHORT: fn.description todo mayusculas y <=4 palabras', () => {
    const doc = makeDoc({ fnDescription: 'COSTURA UNION' });
    const issues = auditAmfeTextQuality(doc, 'AMFE-TEST-3');
    expect(issues.some(i => i.type === 'FN_ALL_CAPS_SHORT')).toBe(true);
  });

  it('4) OP_FUNCTION_SEMANTIC_MISMATCH: OP costura vista no debe contener "unir"', () => {
    const doc = makeDoc({
      opName: 'COSTURA VISTA',
      operationFunction: 'Unir partes mediante costura industrial estructural',
    });
    const issues = auditAmfeTextQuality(doc, 'AMFE-TEST-4');
    expect(issues.some(i => i.type === 'OP_FUNCTION_SEMANTIC_MISMATCH')).toBe(true);
  });

  it('5) WE_NAME_FOREIGN_TYPE: cuchilla con type=Material debe ser Machine', () => {
    const doc = makeDoc({
      weName: 'Cuchilla',
      weType: 'Material',
    });
    const issues = auditAmfeTextQuality(doc, 'AMFE-TEST-5');
    expect(issues.some(i => i.type === 'WE_NAME_FOREIGN_TYPE')).toBe(true);
  });

  it('6) bonus: AMFE canonico limpio NO genera issues', () => {
    // OP COSTURA UNION (no matchea reglas semantic), fn descriptiva con verbo,
    // WE Machine con nombre real, sin all-caps cortos.
    const doc = makeDoc({
      opName: 'COSTURA INDUSTRIAL DE PANELES',
      operationFunction: 'Coser paneles textiles cumpliendo especificaciones de resistencia',
      weName: 'Maquina de coser industrial',
      weType: 'Machine',
      fnDescription: 'Coser uniones controlando tension de hilo y longitud de puntada por minuto',
    });
    const issues = auditAmfeTextQuality(doc, 'AMFE-CANONICO');
    expect(issues.length).toBe(0);
  });

  it('handles empty/missing operations sin crash', () => {
    expect(auditAmfeTextQuality({}, 'AMFE-EMPTY')).toEqual([]);
    expect(auditAmfeTextQuality(null, 'AMFE-NULL')).toEqual([]);
    expect(auditAmfeTextQuality({ operations: [] }, 'AMFE-NO-OPS')).toEqual([]);
  });

  it('skip fn.description vacia (no genera FN_TOO_SHORT/FN_NO_VERB falso positivo)', () => {
    const doc = makeDoc({ fnDescription: '' });
    const issues = auditAmfeTextQuality(doc, 'AMFE-EMPTY-FN');
    // No deberia haber issues de tipo FN_*: la fn vacia se skip-ea
    expect(issues.filter(i => i.type.startsWith('FN_')).length).toBe(0);
  });
});
