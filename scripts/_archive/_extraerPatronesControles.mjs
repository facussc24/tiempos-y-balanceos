// READ-ONLY: extrae patrones reales de controles/frecuencias usados en TODOS los AMFEs Barack
// Para usar como referencia cuando hay que reemplazar inventos.
import { readFileSync } from 'fs';

const SNAP = 'C:/Users/FacundoS-PC/dev/BarackMercosul/backups/2026-04-22T12-08-42';
const amfes = JSON.parse(readFileSync(`${SNAP}/amfe_documents.json`, 'utf8'));
const cps = JSON.parse(readFileSync(`${SNAP}/cp_documents.json`, 'utf8'));
const hos = JSON.parse(readFileSync(`${SNAP}/ho_documents.json`, 'utf8'));

// IDs a EXCLUIR (donde estan los inventos — para no tomarlos como referencia)
const EXCLUDE = new Set(['78eaa89b-ad0b-4342-9046-ab2e9b14d3b3']); // Top Roll - OP 40 contaminada
const TOP_ROLL_ID = '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3';

// Categorias de busqueda
const QUERIES = {
  'MOLDE_LIMPIEZA': [/molde.*limpi|limpi.*molde|moldeo.*manten|manten.*molde/i],
  'ESPESOR': [/espesor|grosor|thickness/i],
  'ANCHO_BOBINA': [/ancho.*(bobin|rollo|tela|lamin)|(bobin|rollo|tela|lamin).*ancho/i],
  'CONTROL_VISUAL_FATIGA': [/inspector|control.*final|fatig|inspecci[oó]n.*visual/i],
  'TERMOFORMADO_VACIO': [/term[oó]form|vac[ií]o|vacuum/i],
};

const results = {};
for (const k of Object.keys(QUERIES)) results[k] = { prev: [], det: [], freq: [] };

function add(category, type, text, source) {
  if (!text || typeof text !== 'string' || text.length < 3) return;
  const arr = results[category][type];
  if (!arr.find(e => e.text === text)) arr.push({ text, source });
}

function matchCategory(haystack) {
  for (const [cat, patterns] of Object.entries(QUERIES)) {
    for (const p of patterns) if (p.test(haystack)) return cat;
  }
  return null;
}

for (const doc of amfes) {
  if (EXCLUDE.has(doc.id)) continue;
  const title = doc.amfe_number || doc.project_name || doc.id.slice(0,8);
  for (const op of (doc.data?.operations || [])) {
    const opName = op.name || op.operationName || '';
    for (const we of (op.workElements || [])) {
      const weName = we.name || '';
      for (const fn of (we.functions || [])) {
        for (const fail of (fn.failures || [])) {
          const failDesc = fail.description || fail.failureDescription || '';
          const haystack = `${opName} ${weName} ${failDesc}`.toLowerCase();
          const cat = matchCategory(haystack);
          if (!cat) continue;
          for (const c of (fail.causes || [])) {
            add(cat, 'prev', c.preventionControl, `${title} | ${opName} | ${failDesc.slice(0,40)}`);
            add(cat, 'det', c.detectionControl, `${title} | ${opName} | ${failDesc.slice(0,40)}`);
          }
        }
      }
    }
  }
}

// CPs - extraer frecuencias comunes
const allFreqs = new Set();
for (const doc of cps) {
  if (doc.id === '69f6daf9-f2aa-49bd-a70a-ff1b02fcec0d') continue; // Top Roll CP - excluido
  for (const it of (doc.data?.items || [])) {
    if (it.sampleFrequency) allFreqs.add(it.sampleFrequency);
  }
}

// HOs - frecuencias comunes
for (const doc of hos) {
  if (doc.id === 'a7201817-...') continue;
  for (const sh of (doc.data?.sheets || [])) {
    for (const qc of (sh.qcItems || [])) {
      if (qc.frequency) allFreqs.add(qc.frequency);
    }
  }
}

console.log('\n========== FRECUENCIAS REALES USADAS EN BARACK (todos los CPs+HOs excepto Top Roll) ==========\n');
const freqArr = [...allFreqs].sort();
for (const f of freqArr) console.log('  -', f);

for (const cat of Object.keys(QUERIES)) {
  console.log(`\n========== ${cat} ==========`);
  console.log(`\n-- preventionControl (${results[cat].prev.length}) --`);
  for (const e of results[cat].prev.slice(0, 12)) console.log(`  • ${e.text.slice(0, 110)}\n      [${e.source}]`);
  console.log(`\n-- detectionControl (${results[cat].det.length}) --`);
  for (const e of results[cat].det.slice(0, 12)) console.log(`  • ${e.text.slice(0, 110)}\n      [${e.source}]`);
}

// Patrones especificos de Top Roll para ver que tiene en OPs NO afectadas
console.log('\n\n========== TOP ROLL — sus propios controles en OPs NO contaminadas (referencia interna) ==========');
const topRoll = amfes.find(d => d.id === TOP_ROLL_ID);
if (topRoll) {
  for (const op of (topRoll.data?.operations || [])) {
    const num = op.opNumber || op.operationNumber;
    if (num === '40') continue; // OP 40 contaminada
    console.log(`\n--- OP ${num}: ${op.name || op.operationName} ---`);
    const sample = new Set();
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fail of (fn.failures || [])) {
          for (const c of (fail.causes || [])) {
            if (c.preventionControl) sample.add(`PREV: ${c.preventionControl.slice(0,90)}`);
            if (c.detectionControl) sample.add(`DET:  ${c.detectionControl.slice(0,90)}`);
          }
        }
      }
    }
    [...sample].slice(0,6).forEach(s => console.log('  ' + s));
  }
}
