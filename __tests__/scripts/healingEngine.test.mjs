/**
 * Tests para scripts/_lib/healingEngine.mjs
 *
 * 5 casos Vitest, sin mocks Supabase, fixtures in-memory.
 *
 * Cubre:
 *  1. Step 1 hit live cross-ref (otro AMFE tiene el recurso real)
 *  2. Step 3 hit library fallback (no hay AMFE hermano con info)
 *  3. Step 7 TBD cuando todo falla + invariante value !== ""
 *  4. Priority de CANONICAL_AMFE_NUMBERS sobre hermano arbitrario
 *  5. classifyOpType regression (tabla de 10+ pares input→expected)
 */

import { describe, it, expect } from 'vitest';
import {
  findCanonicalWeName,
  classifyOpType,
  CANONICAL_LIBRARY,
} from '../../scripts/_lib/healingEngine.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para construir fixtures in-memory
// ─────────────────────────────────────────────────────────────────────────────

function makeAmfe(id, amfeNumber, ops) {
  return {
    id,
    amfe_number: amfeNumber,
    operations: ops,
  };
}

function makeOp(opNumber, name, workElements) {
  return {
    opNumber: String(opNumber),
    operationNumber: String(opNumber),
    name,
    operationName: name,
    workElements,
  };
}

function makeWe(type, name, functions = []) {
  return { type, name, functions };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Step 1 hit live cross-ref
// ─────────────────────────────────────────────────────────────────────────────

describe('healingEngine: Step 1 (live-same-optype)', () => {
  it('cross-ref encuentra "Autoelevador" en AMFE-A para target AMFE-B con WE.name="Maquina" generico', () => {
    const amfeA = makeAmfe('id-A', 'AMFE-A', [
      makeOp(10, 'RECEPCION DE MATERIA PRIMA', [
        makeWe('Machine', 'Autoelevador'),
      ]),
    ]);
    const amfeB = makeAmfe('id-B', 'AMFE-B', [
      makeOp(10, 'RECEPCION', [
        makeWe('Machine', 'Maquina'), // generico 6M
      ]),
    ]);

    const result = findCanonicalWeName({
      opName: 'RECEPCION',
      opType: 'recepcion',
      weType: 'Machine',
      allAmfes: [amfeA, amfeB],
      currentAmfeId: 'id-B',
    });

    expect(result.source).toBe('live-same-optype');
    expect(result.value).toBe('Autoelevador');
    expect(result.sourceAmfeNumber).toBe('AMFE-A');
    expect(result.confidence).toBe('high');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Step 3 hit (library fallback)
// ─────────────────────────────────────────────────────────────────────────────

describe('healingEngine: Step 3 (library fallback)', () => {
  it('cae a library cuando no hay AMFE hermano con info', () => {
    const target = makeAmfe('id-B', 'AMFE-B', [
      makeOp(50, 'COSTURA', [
        makeWe('Man', 'Proceso Op 50'),
      ]),
    ]);

    const result = findCanonicalWeName({
      opName: 'COSTURA',
      opType: 'costura',
      weType: 'Man',
      allAmfes: [target], // solo el target, no hay hermanos
      currentAmfeId: 'id-B',
    });

    // El library tiene costura.Man = "Costurera"
    expect(result.source).toBe('library');
    expect(result.confidence).toBe('high');
    expect(result.value).not.toBeNull();
    expect(result.value).not.toBe('');
    // Sanity check contra el dict para que no se rompa si alguien edita CANONICAL_LIBRARY
    expect(result.value).toBe(CANONICAL_LIBRARY.costura.Man);
    expect(result.value).toBe('Costurera');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Step 7 TBD + invariante value !== ""
// ─────────────────────────────────────────────────────────────────────────────

describe('healingEngine: Step 7 (tbd) + invariante value !== ""', () => {
  it('retorna value=null (NO "") cuando library tiene TBD para esa combinacion', () => {
    // mylar.Environment = TBD en CANONICAL_LIBRARY
    const target = makeAmfe('id-B', 'AMFE-B', [
      makeOp(70, 'MYLAR', [
        makeWe('Environment', 'Ambiente'),
      ]),
    ]);

    const result = findCanonicalWeName({
      opName: 'MYLAR',
      opType: 'mylar',
      weType: 'Environment',
      allAmfes: [target],
      currentAmfeId: 'id-B',
    });

    expect(result.source).toBe('tbd');
    // Invariante critico: nunca retornar string vacio. Debe ser null.
    expect(result.value).toBeNull();
    expect(result.value).not.toBe('');
    expect(result.confidence).toBe('low');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: priority de canonico sobre hermano arbitrario
// ─────────────────────────────────────────────────────────────────────────────

describe('healingEngine: prioridad de CANONICAL_AMFE_NUMBERS', () => {
  it('elige AMFE-ARM-PAT sobre AMFE-X cuando ambos tienen candidato', () => {
    const amfeX = makeAmfe('id-X', 'AMFE-X', [
      makeOp(70, 'INYECCION', [
        makeWe('Machine', 'Inyectora vieja'),
      ]),
    ]);
    const amfeArmPat = makeAmfe('id-ARM', 'AMFE-ARM-PAT', [
      makeOp(70, 'INYECCION', [
        makeWe('Machine', 'Inyectora de poliuretano'),
      ]),
    ]);
    const amfeY = makeAmfe('id-Y', 'AMFE-Y', [
      makeOp(70, 'INYECCION', [
        makeWe('Machine', 'Maquina'), // generico
      ]),
    ]);

    const result = findCanonicalWeName({
      opName: 'INYECCION',
      opType: 'inyeccion',
      weType: 'Machine',
      allAmfes: [amfeX, amfeArmPat, amfeY],
      currentAmfeId: 'id-Y',
    });

    expect(result.source).toBe('live-same-optype');
    expect(result.value).toBe('Inyectora de poliuretano');
    expect(result.sourceAmfeNumber).toBe('AMFE-ARM-PAT');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: classifyOpType regression — tabla de pares
// ─────────────────────────────────────────────────────────────────────────────

describe('healingEngine: classifyOpType regression', () => {
  // Pares ajustados al lift directo de getOpType del refine:
  //   - "INYECCION PU" matchea n.includes('inyeccion') primero → "inyeccion"
  //   - "ESPUMADO PU" matchea n.includes('inyeccion') || /\bpu\b/ || espumado → "inyeccion"
  //   - "INSERCION DE VARILLA" matchea n.includes('insercion') && n.includes('varilla') → "varilla"
  // Estos valores son los del lift, NO del diseño aspiracional.
  const cases = [
    ['RECEPCION DE MATERIA PRIMA', 'recepcion'],
    ['RECEPCION', 'recepcion'],
    ['COSTURA UNION', 'costura'],
    ['INYECCION PU', 'inyeccion'],
    ['ESPUMADO PU', 'inyeccion'],
    ['MYLAR', 'mylar'],
    ['TROQUELADO', 'troquelado'],
    ['EMBALAJE FINAL', 'embalaje'],
    ['INSERCION DE VARILLA', 'varilla'],
    ['CONTROL FINAL DE CALIDAD', 'control final'],
    // Bonus para cubrir branches adicionales
    ['CORTE DE TELA', 'corte'],
    ['TAPIZADO', 'tapizado'],
    ['REPROCESO: CORRECCION', 'reproceso'],
    ['OPERACION DESCONOCIDA XYZ', null],
  ];

  for (const [input, expected] of cases) {
    it(`"${input}" → ${expected}`, () => {
      expect(classifyOpType(input)).toBe(expected);
    });
  }
});
