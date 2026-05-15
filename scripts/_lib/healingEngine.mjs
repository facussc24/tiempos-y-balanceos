/**
 * healingEngine.mjs — Motor PURO (sin I/O) para sugerir nombres canonicos de
 * WE.name y fn.description en AMFEs Barack.
 *
 * Algoritmo jerarquico (paro en la primera fuente que da resultado valido):
 *   Step 1 (live-same-optype): cross-reference contra otros AMFEs Supabase con la misma OP type
 *   Step 2 (live-same-family): SKIP por ahora (TODO — requiere info de familia en allAmfes)
 *   Step 3 (library):          biblioteca canonica migrada del refine
 *   Step 7 (tbd):              ultimo recurso, value=null, source=tbd
 *
 * Implementa la regla `amfe-placeholder-last-resort.md` — agotar fuentes antes
 * de poner placeholder.
 *
 * Modulo PURO:
 *   - NO abre Supabase
 *   - NO escribe archivos
 *   - NO console.log salvo en error claro (no aplica aca)
 *
 * Reusa de _lib/genericLabels.mjs y _lib/amfeIo.mjs (NO duplica logica).
 *
 * Exporta:
 *   findCanonicalWeName(args)         → { value, source, sourceAmfeNumber, sourceOpNumber, confidence, reason }
 *   findCanonicalFnDescription(args)  → mismo shape
 *   classifyOpType(opName)            → string|null  (lift directo de _refineAmfeWeNamesFromLibrary.mjs)
 *   getDefaultSourceAmfes(opType)     → string[]
 *   CANONICAL_LIBRARY                 → dict op_type -> we_type -> string|'TBD'
 *   CANONICAL_AMFE_NUMBERS            → Set<string>
 *
 * Invariantes:
 *   - NUNCA retorna value: "" (string vacio). Siempre string no vacio o null.
 *   - Step 3 (library): si la entrada es vacia, 'TBD' o falsy → tratar como no-match.
 */

import {
  isGeneric6MLabel,
  classifyWeNameVsType,
  getOpTags,
} from './genericLabels.mjs';
import { normalizeText } from './amfeIo.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL_LIBRARY — migrado integro de scripts/_refineAmfeWeNamesFromLibrary.mjs
// Source: 6 agents Explore (sesion 2026-05-14) — ARM-PAT, INS-PAT, AMFE-1,
// AMFE-2, AIAG-VDA externos + cross-reference de 12 AMFEs Supabase.
// Regla 1M por linea: cada celda es UN solo recurso (NO agrupar con "/").
// ─────────────────────────────────────────────────────────────────────────────

const TBD = 'TBD';

export const CANONICAL_LIBRARY = {
  'recepcion': {
    'Machine': 'Autoelevador',
    'Man': 'Inspector de recepcion',
    'Material': 'Etiquetas de identificacion de materia prima',
    'Method': 'Procedimiento de recepcion P-14',
    'Measurement': 'Calibre',
    'Environment': 'Sector de recepcion',
  },
  'corte': {
    'Machine': 'Mesa de corte',
    'Man': 'Operador de corte',
    'Material': 'Cuchilla de corte',
    'Method': 'Programa de corte',
    'Measurement': 'Cinta metrica',
    'Environment': 'Sector de corte',
  },
  'mylar': {
    'Machine': TBD,
    'Man': 'Operador de control',
    'Material': TBD,
    'Method': 'Procedimiento de control dimensional',
    'Measurement': 'Plantilla mylar de control',
    'Environment': TBD,
  },
  'costura': {
    'Machine': 'Maquina de coser industrial',
    'Man': 'Costurera',
    'Material': 'Hilo de costura',
    'Method': 'Configuracion de puntada',
    'Measurement': 'Muestra patron de costura',
    'Environment': 'Iluminacion del puesto de costura',
  },
  'enfundado': {
    'Machine': TBD,
    'Man': 'Operador de tapizado',
    'Material': TBD,
    'Method': 'Procedimiento de enfundado',
    'Measurement': TBD,
    'Environment': TBD,
  },
  'varilla': {
    'Machine': TBD,
    'Man': 'Operador de insercion de varilla',
    'Material': 'Varilla metalica',
    'Method': 'Procedimiento de insercion de varilla',
    'Measurement': TBD,
    'Environment': TBD,
  },
  'insercion': {
    'Machine': TBD,
    'Man': 'Operador de insercion',
    'Material': 'Componente a insertar',
    'Method': 'Procedimiento de insercion',
    'Measurement': TBD,
    'Environment': TBD,
  },
  'inyeccion': {
    'Machine': 'Inyectora de poliuretano',
    'Man': 'Operador de inyectora',
    'Material': 'Mezcla de poliol e isocianato',
    'Method': 'Hoja de parametros de inyeccion',
    'Measurement': 'Balanza de dosificacion',
    'Environment': 'Temperatura de molde',
  },
  'pu': {
    'Machine': 'Inyectora de poliuretano',
    'Man': 'Operador de inyectora',
    'Material': 'Mezcla de poliol e isocianato',
    'Method': 'Hoja de parametros de inyeccion',
    'Measurement': 'Balanza de dosificacion',
    'Environment': 'Temperatura de molde',
  },
  'espumado': {
    'Machine': 'Inyectora de poliuretano',
    'Man': 'Operador de inyectora',
    'Material': 'Mezcla de poliol e isocianato',
    'Method': 'Hoja de parametros de inyeccion',
    'Measurement': 'Balanza de dosificacion',
    'Environment': 'Temperatura de molde',
  },
  'pre-inyeccion': {
    'Machine': 'Pistola etiquetadora',
    'Man': 'Operador de produccion',
    'Material': 'Bolsa para molde',
    'Method': 'Procedimiento de carga al molde',
    'Measurement': TBD,
    'Environment': TBD,
  },
  'control final': {
    'Machine': 'Mesa de control final',
    'Man': 'Inspector de calidad',
    'Material': TBD,
    'Method': 'Procedimiento de control final',
    'Measurement': 'Patron visual de referencia',
    'Environment': 'Iluminacion estandarizada',
  },
  'reproceso': {
    'Machine': TBD,
    'Man': 'Operador de reproceso',
    'Material': 'Hilo de retrabajo',
    'Method': 'Instruccion de reproceso',
    'Measurement': TBD,
    'Environment': TBD,
  },
  'embalaje': {
    'Machine': 'Pistola etiquetadora',
    'Man': 'Operador de embalaje',
    'Material': 'Embalaje KLT',
    'Method': 'Instructivo de embalaje y etiquetado',
    'Measurement': 'Verificacion de etiqueta de identificacion',
    'Environment': 'Iluminacion del sector',
  },
  'tapizado': {
    'Machine': TBD,
    'Man': 'Operador de tapizado',
    'Material': TBD,
    'Method': 'Procedimiento de tapizado',
    'Measurement': TBD,
    'Environment': TBD,
  },
  'troquelado': {
    'Machine': 'Troqueladora',
    'Man': 'Operador de troquelado',
    'Material': 'Cuchilla de troquel',
    'Method': 'Set-up de troquel',
    'Measurement': 'Galga de control post-corte',
    'Environment': TBD,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL_AMFE_NUMBERS — AMFEs Barack "gold standard" para priorizar en Step 1
// Source: regla amfe-placeholder-last-resort.md jerarquia step 3.
// ─────────────────────────────────────────────────────────────────────────────

export const CANONICAL_AMFE_NUMBERS = new Set([
  'AMFE-ARM-PAT',
  'AMFE-INS-PAT',
  'AMFE-1',
  'AMFE-MAESTRO-INY-001',
  'AMFE-MAESTRO-LOG-REC-001',
]);

// ─────────────────────────────────────────────────────────────────────────────
// classifyOpType — lift directo de getOpType() de _refineAmfeWeNamesFromLibrary.mjs
// Misma heuristica de specificidad descendente. NO reinventar.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clasifica una OP por su nombre.
 * Lift directo de scripts/_refineAmfeWeNamesFromLibrary.mjs::getOpType (lineas 171-189).
 *
 * @param {string} opName
 * @returns {'recepcion'|'corte'|'mylar'|'costura'|'enfundado'|'varilla'|'insercion'|'inyeccion'|'pu'|'espumado'|'pre-inyeccion'|'control final'|'reproceso'|'embalaje'|'tapizado'|'troquelado'|null}
 */
export function classifyOpType(opName) {
  const n = normalize(opName);
  // Orden de specificidad descendente (lift directo del refine)
  if (n.includes('control final')) return 'control final';
  if (n.includes('mylar') || n.includes('plantilla')) return 'mylar';
  if (n.includes('inyeccion') || /\bpu\b/.test(n) || n.includes('espumado')) return 'inyeccion';
  if (n.includes('precinto') || n.includes('bolsa') || n.includes('cierre del molde')) return 'pre-inyeccion';
  if (n.includes('insercion') && n.includes('varilla')) return 'varilla';
  if (n.includes('insercion')) return 'insercion';
  if (n.includes('enfundado') || n.includes('enfundar')) return 'enfundado';
  if (n.includes('costura')) return 'costura';
  if (n.includes('corte')) return 'corte';
  if (n.includes('troquelado')) return 'troquelado';
  if (n.includes('tapizado')) return 'tapizado';
  if (n.includes('reproceso') || n.includes('retrabajo')) return 'reproceso';
  if (n.includes('embalaje')) return 'embalaje';
  if (n.includes('recepcion')) return 'recepcion';
  return null;
}

// Helper local — misma normalizacion que usa el refine (mas chica que normalizeText
// de amfeIo: no colapsa whitespace interno, suficiente para classifyOpType).
function normalize(s) {
  return (s || '').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// getDefaultSourceAmfes — mapping op_type → AMFEs canonicos sugeridos
// Source: .claude/skills/amfe-cookbook/SKILL.md lineas 76-87 + complementado
// con CANONICAL_AMFE_NUMBERS.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SOURCE_AMFES = {
  'recepcion':   ['AMFE-MAESTRO-LOG-REC-001', 'AMFE-ARM-PAT'],
  'costura':     ['AMFE-ARM-PAT', 'AMFE-1'],
  'mylar':       ['AMFE-1'],
  'inyeccion':   ['AMFE-MAESTRO-INY-001', 'AMFE-ARM-PAT', 'AMFE-INS-PAT'],
  'pu':          ['AMFE-ARM-PAT'],
  'espumado':    ['AMFE-ARM-PAT'],
  'troquelado':  ['AMFE-INS-PAT'],
  'embalaje':    ['AMFE-INS-PAT', 'AMFE-1'],
  'corte':       ['AMFE-INS-PAT', 'AMFE-ARM-PAT'],
  'control final': ['AMFE-INS-PAT', 'AMFE-1'],
  'tapizado':    ['AMFE-ARM-PAT'],
  'enfundado':   ['AMFE-ARM-PAT'],
  'insercion':   ['AMFE-INS-PAT'],
  'varilla':     ['AMFE-INS-PAT'],
  'reproceso':   ['AMFE-ARM-PAT'],
  'pre-inyeccion': ['AMFE-ARM-PAT'],
};

/**
 * Devuelve la lista de AMFEs canonicos sugeridos como fuente para un op_type.
 * Si no hay mapping, devuelve [].
 * @param {string} opType
 * @returns {string[]}
 */
export function getDefaultSourceAmfes(opType) {
  return DEFAULT_SOURCE_AMFES[opType] || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos para el algoritmo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrae el array `operations` de un AMFE doc, manejando el caso de que
 * venga embebido en doc.data (estructura Supabase) o sea el doc raw.
 */
function getOperations(amfe) {
  if (!amfe) return [];
  if (Array.isArray(amfe.operations)) return amfe.operations;
  if (amfe.data && Array.isArray(amfe.data.operations)) return amfe.data.operations;
  return [];
}

function getAmfeId(amfe) {
  return amfe?.id || amfe?.amfeId || amfe?.amfe_number || amfe?.amfeNumber || null;
}

function getAmfeNumber(amfe) {
  return amfe?.amfe_number || amfe?.amfeNumber || null;
}

function getOpName(op) {
  return op?.name || op?.operationName || '';
}

function getOpNumber(op) {
  return op?.opNumber || op?.operationNumber || null;
}

/**
 * Filtra candidatos: descarta vacios, genericos 6M, y los que no matchean el weType.
 * @returns {boolean} true si el candidato es valido
 */
function isValidWeNameCandidate(name, weType) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (isGeneric6MLabel(trimmed)) return false;
  if (trimmed === TBD) return false;
  // Detectar placeholders "Proceso Op X" (residuo de renumeracion)
  if (/^proceso\s+op\s*\d*$/i.test(trimmed)) return false;
  // Detectar "Pendiente definicion equipo APQP" (placeholder valido SOLO para actions)
  if (/^pendiente\s+definicion\s+equipo\s+apqp$/i.test(trimmed)) return false;
  // Filtro extra: WE.name vs WE.type
  if (weType) {
    const cls = classifyWeNameVsType(trimmed, weType);
    if (cls && cls.ok === false) return false;
  }
  return true;
}

/**
 * Step 1: busca en todos los AMFEs (excluyendo currentAmfeId) WEs con la misma
 * opType y el mismo weType, recolecta candidatos validos para we.name.
 */
function findStep1WeNameCandidates({ opType, weType, allAmfes, currentAmfeId }) {
  const candidates = [];
  for (const amfe of allAmfes || []) {
    const amfeId = getAmfeId(amfe);
    if (amfeId === currentAmfeId) continue;
    const amfeNumber = getAmfeNumber(amfe);
    for (const op of getOperations(amfe)) {
      const thisOpType = classifyOpType(getOpName(op));
      if (thisOpType !== opType) continue;
      for (const we of (op.workElements || [])) {
        if (we.type !== weType) continue;
        const name = (we.name || '').trim();
        if (!isValidWeNameCandidate(name, weType)) continue;
        candidates.push({
          value: name,
          amfeNumber,
          opNumber: getOpNumber(op),
        });
      }
    }
  }
  return candidates;
}

/**
 * Deduplica candidatos por valor normalizado, prefiriendo los de AMFEs canonicos.
 * @returns {{value, source, sourceAmfeNumber, sourceOpNumber, confidence, reason}|null}
 */
function pickBestCandidate(candidates, source) {
  if (candidates.length === 0) return null;

  // Agrupar por valor normalizado
  const byNorm = new Map();
  for (const c of candidates) {
    const key = normalizeText(c.value);
    if (!byNorm.has(key)) byNorm.set(key, []);
    byNorm.get(key).push(c);
  }

  const uniqueValues = Array.from(byNorm.keys());

  if (uniqueValues.length === 1) {
    // Solo 1 valor unico tras dedup → confidence high
    const group = byNorm.get(uniqueValues[0]);
    // Preferir el de un AMFE canonico si existe
    const canonical = group.find(c => CANONICAL_AMFE_NUMBERS.has(c.amfeNumber));
    const pick = canonical || group[0];
    return {
      value: pick.value,
      source,
      sourceAmfeNumber: pick.amfeNumber,
      sourceOpNumber: pick.opNumber,
      confidence: 'high',
      reason: `${candidates.length} candidato(s), 1 valor unico tras dedup`,
    };
  }

  // 2+ valores unicos: preferir canonico
  for (const c of candidates) {
    if (CANONICAL_AMFE_NUMBERS.has(c.amfeNumber)) {
      return {
        value: c.value,
        source,
        sourceAmfeNumber: c.amfeNumber,
        sourceOpNumber: c.opNumber,
        confidence: 'high',
        reason: `${candidates.length} candidato(s), ${uniqueValues.length} valores distintos, prefer canonico ${c.amfeNumber}`,
      };
    }
  }

  // Sin canonico, empate → confidence medium, primer candidato
  const first = candidates[0];
  return {
    value: first.value,
    source,
    sourceAmfeNumber: first.amfeNumber,
    sourceOpNumber: first.opNumber,
    confidence: 'medium',
    reason: `${candidates.length} candidato(s), ${uniqueValues.length} valores distintos, sin canonico — primer match`,
  };
}

/**
 * Step 3: busca en CANONICAL_LIBRARY.
 */
function findStep3WeNameFromLibrary({ opType, weType }) {
  if (!opType) return null;
  const cell = CANONICAL_LIBRARY[opType]?.[weType];
  // Tratar vacio, TBD, undefined como no-match
  if (!cell || typeof cell !== 'string') return null;
  const trimmed = cell.trim();
  if (!trimmed || trimmed === TBD) return null;
  return {
    value: trimmed,
    source: 'library',
    sourceAmfeNumber: null,
    sourceOpNumber: null,
    confidence: 'high',
    reason: `CANONICAL_LIBRARY[${opType}][${weType}]`,
  };
}

/**
 * Step 7: TBD final.
 */
function step7Tbd(reason = 'Steps 1-3 fallan, requiere Fak') {
  return {
    value: null,
    source: 'tbd',
    sourceAmfeNumber: null,
    sourceOpNumber: null,
    confidence: 'low',
    reason,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// findCanonicalWeName — funcion principal para WE.name
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca el nombre canonico para un WE segun la jerarquia de fuentes.
 *
 * @param {object} args
 * @param {string} args.opName - Nombre de la operacion donde vive el WE
 * @param {string} args.opType - opType ya clasificado (puede pasarse o se infiere de opName)
 * @param {string} args.weType - 'Machine'|'Man'|'Material'|'Method'|'Measurement'|'Environment'
 * @param {object[]} args.allAmfes - Lista de AMFEs (incluye el current)
 * @param {string} args.currentAmfeId - id del AMFE target (se excluye en Step 1)
 * @param {number[]} [args.hierarchy=[1,2,3,7]] - Orden de pasos a aplicar
 * @returns {{value: string|null, source: 'live-same-optype'|'live-same-family'|'library'|'tbd', sourceAmfeNumber: string|null, sourceOpNumber: string|number|null, confidence: 'high'|'medium'|'low', reason: string}}
 */
export function findCanonicalWeName(args) {
  const {
    opName,
    weType,
    allAmfes = [],
    currentAmfeId,
    hierarchy = [1, 2, 3, 7],
  } = args || {};

  // Inferir opType si no se paso
  const opType = args?.opType || classifyOpType(opName);

  for (const step of hierarchy) {
    if (step === 1) {
      if (!opType) continue; // sin opType, Step 1 no aplica
      const candidates = findStep1WeNameCandidates({ opType, weType, allAmfes, currentAmfeId });
      const pick = pickBestCandidate(candidates, 'live-same-optype');
      if (pick) return pick;
    } else if (step === 2) {
      // TODO Step 2 (live-same-family): SKIP por ahora. allAmfes no trae info de familia
      // en este motor; se podria agregar con familyId / productName matching en el futuro.
      continue;
    } else if (step === 3) {
      const pick = findStep3WeNameFromLibrary({ opType, weType });
      if (pick) return pick;
    } else if (step === 7) {
      return step7Tbd(`Pasos ${hierarchy.join(',')} fallan para opType=${opType || 'unknown'} weType=${weType}`);
    }
  }

  // Si hierarchy no incluye 7, devolver TBD igualmente (invariante)
  return step7Tbd('hierarchy agotada sin step 7 explicito');
}

// ─────────────────────────────────────────────────────────────────────────────
// findCanonicalFnDescription — para fn.description (function-level)
// ─────────────────────────────────────────────────────────────────────────────

const MIN_FN_DESC_LENGTH = 10;

function isValidFnDescriptionCandidate(desc) {
  if (!desc || typeof desc !== 'string') return false;
  const trimmed = desc.trim();
  if (!trimmed) return false;
  if (trimmed.length < MIN_FN_DESC_LENGTH) return false;
  if (isGeneric6MLabel(trimmed)) return false;
  if (/^pendiente\s+definicion\s+equipo\s+apqp$/i.test(trimmed)) return false;
  if (trimmed === TBD) return false;
  return true;
}

function findStep1FnDescCandidates({ opType, weType, weName, allAmfes, currentAmfeId }) {
  const candidates = [];
  const targetWeName = normalizeText(weName || '');

  for (const amfe of allAmfes || []) {
    const amfeId = getAmfeId(amfe);
    if (amfeId === currentAmfeId) continue;
    const amfeNumber = getAmfeNumber(amfe);

    for (const op of getOperations(amfe)) {
      const thisOpType = classifyOpType(getOpName(op));
      if (thisOpType !== opType) continue;

      // Primero, intentar match exacto del weName (mismo recurso en AMFE hermano)
      const wesSameType = (op.workElements || []).filter(we => we.type === weType);
      const wesSameName = targetWeName
        ? wesSameType.filter(we => normalizeText(we.name) === targetWeName)
        : [];

      // Si hay match exacto del weName, usar SOLO esos. Si no, fallback a wesSameType.
      const wesToScan = wesSameName.length > 0 ? wesSameName : wesSameType;
      const matchKind = wesSameName.length > 0 ? 'same-weName' : 'any-weType';

      for (const we of wesToScan) {
        for (const fn of (we.functions || [])) {
          const desc = (fn.description || fn.functionDescription || '').trim();
          if (!isValidFnDescriptionCandidate(desc)) continue;
          candidates.push({
            value: desc,
            amfeNumber,
            opNumber: getOpNumber(op),
            matchKind,
          });
        }
      }
    }
  }
  return candidates;
}

/**
 * Busca la descripcion canonica de funcion para un WE en una OP.
 * Mismo flujo jerarquico que findCanonicalWeName, con un filtro extra:
 *   - El WE.name del candidato debe matchear (normalizado) el weName del target.
 *   - Si no hay match exacto de weName, intenta cualquier WE del mismo weType.
 *
 * @param {object} args
 * @param {string} args.opName
 * @param {string} [args.opType]
 * @param {string} args.weType
 * @param {string} args.weName - WE.name del target (para match exacto en hermano)
 * @param {object[]} args.allAmfes
 * @param {string} args.currentAmfeId
 * @param {number[]} [args.hierarchy=[1,2,3,7]]
 * @returns {{value: string|null, source: string, sourceAmfeNumber: string|null, sourceOpNumber: string|number|null, confidence: string, reason: string}}
 */
export function findCanonicalFnDescription(args) {
  const {
    opName,
    weType,
    weName,
    allAmfes = [],
    currentAmfeId,
    hierarchy = [1, 2, 3, 7],
  } = args || {};

  const opType = args?.opType || classifyOpType(opName);

  for (const step of hierarchy) {
    if (step === 1) {
      if (!opType) continue;
      const candidates = findStep1FnDescCandidates({ opType, weType, weName, allAmfes, currentAmfeId });
      const pick = pickBestCandidate(candidates, 'live-same-optype');
      if (pick) return pick;
    } else if (step === 2) {
      // TODO Step 2 (live-same-family): SKIP.
      continue;
    } else if (step === 3) {
      // Para fn.description, la library no tiene contenido (la library canonica es de we.name).
      // Por ahora, no hay fallback library para fn.description. Continuar a step 7.
      continue;
    } else if (step === 7) {
      return step7Tbd(`Pasos ${hierarchy.join(',')} fallan para fn.description opType=${opType || 'unknown'} weType=${weType} weName=${weName || ''}`);
    }
  }

  return step7Tbd('hierarchy agotada sin step 7 explicito (fn.description)');
}
