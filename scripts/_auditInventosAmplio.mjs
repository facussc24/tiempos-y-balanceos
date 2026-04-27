// READ-ONLY: auditoria amplia de inventos en TODOS los AMFE/CP/HO
// 1. Patrones sospechosos expandidos (equipos exoticos, gases, instrumentos lab, espanolismos)
// 2. Detector de OUTLIERS: controles que aparecen 1 sola vez en toda la base
// 3. Reporta por producto/operacion para revision Fak
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local', 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// ------- PATRONES EXPANDIDOS -------
const SUSPECT_PATTERNS = [
  // Equipos/quimicos exoticos (Barack NO usa)
  { pat: /hielo seco|nitr[oó]geno l[ií]quido|helio l[ií]quido|arg[oó]n.*l[ií]quido/i, sev: 'CRITICO', cat: 'GASES_CRIOGENICOS' },
  { pat: /microsc[oó]pio electr[oó]nico|\bSEM\b|\bTEM\b(?!.*[a-z])/, sev: 'CRITICO', cat: 'MICROSCOPIA_EXOTICA' },
  { pat: /cromatograf|gc-ms|\bhplc\b|espectr[oó]metro|\bfid\b|fluorescencia x|\bftir\b|\braman\b/i, sev: 'CRITICO', cat: 'INSTRUMENTAL_LAB_EXOTICO' },
  { pat: /tri[bv]ometro|rugos[ií]metro|perfil[oó]metro|escler[oó]metro|\bcmm\b|coordinate measur|maquina de medici[oó]n por coordenadas/i, sev: 'REVISAR', cat: 'METROLOGIA_3D_CMM' },
  { pat: /aut[oó]clave|liofiliz|centr[ií]fuga(?!.*tela)|incubadora/i, sev: 'CRITICO', cat: 'EQUIPO_BIO_LAB' },
  { pat: /viscos[ií]metro|reol[oó]g|bal[oó]metro|durometro shore [d]\b/i, sev: 'REVISAR', cat: 'METROLOGIA_RARA' },
  { pat: /pist[oó]la de ultrasonido/i, sev: 'ALTO', cat: 'TERMINOLOGIA_INCORRECTA' },

  // Espanolismos peninsulares
  { pat: /\bflex[oó]metro\b/i, sev: 'ALTO', cat: 'ESPANOLISMO' },
  { pat: /\bordenador\b/i, sev: 'ALTO', cat: 'ESPANOLISMO' },
  { pat: /\bfichero\b/i, sev: 'ALTO', cat: 'ESPANOLISMO' },
  { pat: /\brat[oó]n\b(?!.*tela)/i, sev: 'ALTO', cat: 'ESPANOLISMO' },
  { pat: /\bgrifo\b/i, sev: 'MEDIO', cat: 'ESPANOLISMO' },
  { pat: /\bcoger\b/i, sev: 'MEDIO', cat: 'ESPANOLISMO' },
  { pat: /\bvosotros\b|\bvuestr/i, sev: 'MEDIO', cat: 'ESPANOLISMO' },
  { pat: /\bzumo\b|\bpatata\b|\bcoche\b|\baparcamiento\b/i, sev: 'MEDIO', cat: 'ESPANOLISMO' },

  // Frecuencias muy especificas (probables invents)
  { pat: /cada \d+ ?(h|hora|hr|hrs|horas)\b/i, sev: 'REVISAR', cat: 'FRECUENCIA_HORAS' },
  { pat: /cada \d+ ?(min|minuto)/i, sev: 'REVISAR', cat: 'FRECUENCIA_MINUTOS' },
  { pat: /cada \d{4,} pieza/i, sev: 'REVISAR', cat: 'FRECUENCIA_PIEZAS_ALTA' },

  // Adjetivos rebuscados que Fak no usa
  { pat: /residual\b|insuficiencia\b|inadecuad|desalinead|estandariz/i, sev: 'REVISAR', cat: 'LENGUAJE_REBUSCADO' },

  // Otros patrones sospechosos
  { pat: /servomotor de precis|interferometr|hologram|laser scan/i, sev: 'CRITICO', cat: 'ALTA_TECNOLOGIA' },
  { pat: /muestra patr[oó]n calibrada por inta|trazabil.*nist/i, sev: 'REVISAR', cat: 'CERTIFICACION_RARA' },
];

// ------- LECTURA -------
const ID2NAME = new Map();
const allControls = []; // { text, source, kind }

function reg(text, source, kind) {
  if (!text || typeof text !== 'string' || text.length < 4) return;
  const trimmed = text.trim();
  allControls.push({ text: trimmed, source, kind });
}

async function loadTable(tbl) {
  const { data } = await sb.from(tbl).select('id, data, *');
  return data || [];
}

const amfes = await loadTable('amfe_documents');
const cps = await loadTable('cp_documents');
const hos = await loadTable('ho_documents');

function getData(d) {
  let x = d.data;
  if (typeof x === 'string') { try { x = JSON.parse(x); } catch { return {}; } }
  return x || {};
}

for (const d of amfes) {
  const data = getData(d);
  const name = d.amfe_number || data.header?.partName || d.id.slice(0,8);
  ID2NAME.set(d.id, `AMFE ${name}`);
  for (const op of (data.operations || [])) {
    const opLbl = `${name} | OP ${op.opNumber||op.operationNumber} ${op.name||op.operationName}`;
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fail of (fn.failures || [])) {
          for (const c of (fail.causes || [])) {
            reg(c.preventionControl, opLbl, 'PREV');
            reg(c.detectionControl, opLbl, 'DET');
          }
        }
      }
    }
  }
}

for (const d of cps) {
  const data = getData(d);
  const name = data.header?.partName || data.header?.controlPlanNumber || d.id.slice(0,8);
  ID2NAME.set(d.id, `CP ${name}`);
  for (const it of (data.items || [])) {
    const lbl = `${name} | OP ${it.processStepNumber} ${it.processStepName||''}`;
    reg(it.controlMethod, lbl, 'CTRL');
    reg(it.evaluationTechnique, lbl, 'EVAL');
    reg(it.specification, lbl, 'SPEC');
    reg(it.machineDeviceTool, lbl, 'TOOL');
    reg(it.sampleFrequency, lbl, 'FREQ');
    reg(it.reactionPlan, lbl, 'REACT');
  }
}

for (const d of hos) {
  const data = getData(d);
  const name = data.header?.partName || d.id.slice(0,8);
  ID2NAME.set(d.id, `HO ${name}`);
  for (const sh of (data.sheets || [])) {
    const lbl = `${name} | ${sh.operationName||''}`;
    for (const qc of (sh.qcItems || [])) {
      reg(qc.controlMethod, lbl, 'CTRL');
      reg(qc.evaluationTechnique, lbl, 'EVAL');
      reg(qc.frequency, lbl, 'FREQ');
      reg(qc.reactionAction, lbl, 'REACT');
    }
  }
}

// ------- A) PATRONES SOSPECHOSOS -------
console.log('\n========== A) PATRONES SOSPECHOSOS ==========\n');
const byCategory = {};
for (const c of allControls) {
  for (const p of SUSPECT_PATTERNS) {
    if (p.pat.test(c.text)) {
      const k = `${p.sev}/${p.cat}`;
      if (!byCategory[k]) byCategory[k] = [];
      byCategory[k].push(c);
    }
  }
}

const sorted = Object.entries(byCategory).sort((a,b) => {
  const order = { 'CRITICO':0, 'ALTO':1, 'MEDIO':2, 'REVISAR':3 };
  return order[a[0].split('/')[0]] - order[b[0].split('/')[0]];
});

for (const [k, items] of sorted) {
  console.log(`\n--- ${k} (${items.length}) ---`);
  // Dedup
  const uniq = new Map();
  for (const it of items) {
    if (!uniq.has(it.text)) uniq.set(it.text, []);
    uniq.get(it.text).push(it.source);
  }
  for (const [text, sources] of uniq) {
    console.log(`  [${sources.length}x] "${text.slice(0,100)}"`);
    for (const s of sources.slice(0,3)) console.log(`     -> ${s}`);
    if (sources.length > 3) console.log(`     -> ... +${sources.length-3} mas`);
  }
}

// ------- B) OUTLIERS: controles que aparecen 1 sola vez en toda la base -------
console.log('\n\n========== B) OUTLIERS (controles que aparecen 1 sola vez en toda la base) ==========');
console.log('Estos NO son necesariamente inventos — pueden ser controles legitimos especificos.');
console.log('Pero son los candidatos mas probables a inventos puntuales. Revisar visualmente.\n');

const countByText = new Map();
for (const c of allControls) {
  if (!countByText.has(c.text)) countByText.set(c.text, []);
  countByText.get(c.text).push(c);
}

const outliers = [...countByText.entries()].filter(([t,arr]) => arr.length === 1 && t.length > 15);
console.log(`Total controles unicos en toda la base: ${countByText.size}`);
console.log(`Outliers (1 ocurrencia): ${outliers.length}`);

// Filtrar solo los mas largos/sospechosos para presentar (>40 chars y no son de origen claro)
const interesting = outliers.filter(([t]) => {
  if (t.length < 30) return false;
  // Excluir patrones obvios validos
  if (/^certificad|^segun p-\d|^tbd|^pendiente|^autocontrol visual|^inspecci[oó]n visual$|^visual$/i.test(t)) return false;
  return true;
});

console.log(`Outliers "interesantes" (largos y no triviales): ${interesting.length}\n`);

// Agrupar por producto para mostrar
const byProduct = {};
for (const [text, arr] of interesting) {
  const src = arr[0].source.split('|')[0].trim();
  if (!byProduct[src]) byProduct[src] = [];
  byProduct[src].push({ text, source: arr[0].source, kind: arr[0].kind });
}

for (const [prod, items] of Object.entries(byProduct).sort((a,b) => b[1].length - a[1].length)) {
  console.log(`\n### ${prod} (${items.length} outliers)`);
  for (const it of items.slice(0, 15)) {
    console.log(`  [${it.kind}] "${it.text.slice(0,110)}"`);
    console.log(`         ${it.source}`);
  }
  if (items.length > 15) console.log(`  ... +${items.length-15} mas (output limitado)`);
}
