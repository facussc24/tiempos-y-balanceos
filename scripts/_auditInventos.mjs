// READ-ONLY: escanea snapshot local buscando inventos/españolismos/frecuencias inventadas
// No modifica nada. Solo reporta.
import { readFileSync } from 'fs';

const SNAP = 'C:/Users/FacundoS-PC/dev/BarackMercosul/backups/2026-04-22T12-08-42';

// Patrones sospechosos (regex, descripcion, severidad)
const PATTERNS = [
  // Inventos confirmados por Fak
  [/hielo seco/i, 'INVENTO: hielo seco (no se usa en planta)', 'CRITICO'],
  [/pistola de ultrasonido/i, 'TERMINOLOGIA INCORRECTA: pistola → dispositivo', 'ALTO'],
  // Españolismos peninsulares
  [/\bflexómetro\b|\bflexometro\b/i, 'ESPANOLISMO: flexómetro → cinta métrica', 'ALTO'],
  [/\bordenador\b/i, 'ESPANOLISMO: ordenador → computadora/PC', 'ALTO'],
  [/\bmóvil\b(?! en)/i, 'ESPANOLISMO: móvil → celular', 'ALTO'],
  [/\bfichero\b/i, 'ESPANOLISMO: fichero → archivo', 'ALTO'],
  [/\bratón\b/i, 'ESPANOLISMO: ratón → mouse', 'ALTO'],
  [/\bgrifo\b/i, 'ESPANOLISMO: grifo → canilla', 'MEDIO'],
  [/\bcoger\b/i, 'ESPANOLISMO: coger → agarrar/tomar', 'MEDIO'],
  [/\bvosotros\b/i, 'ESPANOLISMO: vosotros → ustedes', 'MEDIO'],
  // Frecuencias sospechosas (probablemente inventadas)
  [/cada \d+ ?(h|hora|hr|hrs|horas)\b/i, 'FRECUENCIA SOSPECHOSA (verificar si es real)', 'REVISAR'],
  [/cada \d+ ?(min|minuto)/i, 'FRECUENCIA SOSPECHOSA (verificar si es real)', 'REVISAR'],
  // Equipos/quimicos exoticos
  [/nitrógeno líquido|nitrogeno liquido/i, 'INVENTO POSIBLE: nitrógeno líquido', 'CRITICO'],
  [/microscopio electrónico/i, 'INVENTO POSIBLE: microscopio electrónico', 'CRITICO'],
  [/láser de \d/i, 'INVENTO POSIBLE: láser específico', 'REVISAR'],
  // Otras invenciones tipicas
  [/cromatograf/i, 'INVENTO POSIBLE: cromatografía (no aplica a tapizados)', 'CRITICO'],
  [/espectrómetro/i, 'INVENTO POSIBLE: espectrómetro', 'CRITICO'],
];

function findInString(str, path, hits) {
  if (typeof str !== 'string' || !str) return;
  for (const [pat, desc, sev] of PATTERNS) {
    if (pat.test(str)) {
      hits.push({ path, value: str, pattern: desc, severity: sev });
    }
  }
}

function walkAmfe(doc, hits) {
  const title = doc.title || doc.amfeNumber || doc.id?.slice(0, 8) || '?';
  for (const op of (doc.data?.operations || [])) {
    const opLabel = `${title} | OP ${op.opNumber || op.operationNumber} ${op.name || op.operationName}`;
    for (const we of (op.workElements || [])) {
      const weLabel = `${opLabel} | WE: ${we.name || '?'}`;
      for (const fn of (we.functions || [])) {
        const fnLabel = `${weLabel} | Fn: ${(fn.description || fn.functionDescription || '').slice(0, 40)}`;
        for (const fail of (fn.failures || [])) {
          const failLabel = `${fnLabel} | FM: ${(fail.description || fail.failureDescription || '').slice(0, 40)}`;
          for (const c of (fail.causes || [])) {
            const causeLabel = `${failLabel} | C: ${(c.cause || c.description || '').slice(0, 40)}`;
            findInString(c.preventionControl, `${causeLabel} -> preventionControl`, hits);
            findInString(c.detectionControl, `${causeLabel} -> detectionControl`, hits);
            findInString(c.cause, `${causeLabel} -> cause`, hits);
          }
        }
      }
    }
  }
}

function walkCp(doc, hits) {
  const title = doc.title || doc.cpNumber || doc.id?.slice(0, 8) || '?';
  for (const it of (doc.data?.items || [])) {
    const lbl = `${title} | OP ${it.processStepNumber} ${it.processStepName} | ${it.productCharacteristic || it.processCharacteristic || ''}`;
    findInString(it.controlMethod, `${lbl} -> controlMethod`, hits);
    findInString(it.evaluationTechnique, `${lbl} -> evaluationTechnique`, hits);
    findInString(it.specification, `${lbl} -> specification`, hits);
    findInString(it.machineDeviceTool, `${lbl} -> machineDeviceTool`, hits);
    findInString(it.sampleFrequency, `${lbl} -> sampleFrequency`, hits);
    findInString(it.reactionPlan, `${lbl} -> reactionPlan`, hits);
  }
}

function walkHo(doc, hits) {
  const title = doc.title || doc.id?.slice(0, 8) || '?';
  for (const sh of (doc.data?.sheets || [])) {
    const lbl = `${title} | Sheet: ${sh.operationName}`;
    for (const st of (sh.steps || [])) {
      findInString(st.description, `${lbl} | Step: ${st.stepNumber} -> description`, hits);
    }
    for (const qc of (sh.qcItems || [])) {
      const qcLbl = `${lbl} | QC: ${qc.characteristic || qc.qcDescription || ''}`;
      findInString(qc.controlMethod, `${qcLbl} -> controlMethod`, hits);
      findInString(qc.evaluationTechnique, `${qcLbl} -> evaluationTechnique`, hits);
      findInString(qc.frequency, `${qcLbl} -> frequency`, hits);
      findInString(qc.reactionAction, `${qcLbl} -> reactionAction`, hits);
    }
  }
}

function walkPfd(doc, hits) {
  const title = doc.title || doc.id?.slice(0, 8) || '?';
  for (const st of (doc.data?.steps || [])) {
    const lbl = `${title} | Step: ${st.stepNumber || ''} ${st.label || st.name || ''}`;
    findInString(st.label, `${lbl} -> label`, hits);
    findInString(st.description, `${lbl} -> description`, hits);
    findInString(st.equipment, `${lbl} -> equipment`, hits);
  }
}

function load(name) {
  return JSON.parse(readFileSync(`${SNAP}/${name}.json`, 'utf8'));
}

const hits = [];
const amfes = load('amfe_documents');
const cps = load('cp_documents');
const hos = load('ho_documents');
const pfds = load('pfd_documents');

console.log(`Loaded ${amfes.length} amfes, ${cps.length} cps, ${hos.length} hos, ${pfds.length} pfds`);

for (const d of amfes) walkAmfe(d, hits);
for (const d of cps) walkCp(d, hits);
for (const d of hos) walkHo(d, hits);
for (const d of pfds) walkPfd(d, hits);

// Group by severity
const groups = { CRITICO: [], ALTO: [], MEDIO: [], REVISAR: [] };
for (const h of hits) groups[h.severity].push(h);

for (const sev of ['CRITICO', 'ALTO', 'MEDIO', 'REVISAR']) {
  console.log(`\n=== ${sev} (${groups[sev].length}) ===`);
  // Dedup by (pattern, value)
  const seen = new Map();
  for (const h of groups[sev]) {
    const key = `${h.pattern} :: ${h.value}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(h.path);
  }
  for (const [key, paths] of seen) {
    console.log(`\n[${paths.length}x] ${key}`);
    for (const p of paths.slice(0, 8)) console.log(`   ${p}`);
    if (paths.length > 8) console.log(`   ... ${paths.length - 8} more`);
  }
}
console.log(`\nTOTAL HITS: ${hits.length}`);
