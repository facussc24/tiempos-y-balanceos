/**
 * _limpiarVocabularioResidual.mjs — segunda pasada de vocabulario sobre los AMFE de Patagonia.
 *
 * POR QUE EXISTE: la purga del 19-20/08 saco la jerga tecnica en ingles (gap & flush, squeak &
 * rattle, fit & finish) pero dejo pasar palabras sueltas del cuerpo. Las encontro la auditoria
 * externa del 21/08: `checklist` en los 8, `armrest` 23 veces en el AMFE 150 —justo el documento
 * cuyo archivo se llama "APOYABRAZOS TRASERO"—, `Headrest` en los tres apoyacabezas y `(tooling)`
 * entre parentesis, que la regla amfe.md §11 prohibe explicitamente.
 *
 * CRITERIO — que se traduce y que NO:
 *   SI  -> palabras que describen NUESTRO proceso o NUESTRA pieza y tienen equivalente en la
 *          planta: armrest/headrest (el titulo del mismo documento ya dice apoyabrazos /
 *          apoyacabezas), checklist (la casa dice "Set up" o "lista de verificacion"),
 *          ingles entre parentesis.
 *   NO  -> nombres de pieza o material como figuran en la BOM y los planos del cliente
 *          ("Armrest Door Panel" es el nombre del producto en el proyecto 161, "Upper decorative
 *          plate skeleton" sale de la lista de materiales, "TPU Foam barrier tape" idem), ni
 *          codigos de tablero ("Button Reset E32"), ni terminos de industria (SCRAP, NOK, KLT,
 *          PPAP, WIP, peeling, hot melt, torque, airbag, set-up). Esos van al reporte para Fak,
 *          no se tocan por cuenta propia.
 *
 * Ademas limpia dos cosas de la CARATULA que un cliente no tiene por que leer:
 *   - el disparador interno "(ASAICHI 10-11/08/2026)" y la referencia a una reunion interna,
 *   - un typo impreso ("REUNON") y el calco "CONTROLES DETECTIVOS" -> "CONTROLES DE DETECCION".
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR } = parseSafeArgs();

// [regex, reemplazo, docs a los que aplica (null = todos)]
const REEMPLAZOS = [
  // --- ingles entre parentesis (prohibido por amfe.md §11)
  [/\s*\(tooling\)/gi, '', null],
  [/Lista de verificaci[oó]n \(checklist\)/gi, 'Lista de verificacion', null],

  // --- checklist -> el termino de la casa
  [/Checklists\s+obligatorias/gi, 'Listas de verificacion obligatorias', null],
  [/Checklist\s+de\s+arranque/gi, 'Set up de arranque', null],
  [/Checklist\s+diaria/gi, 'Set up diario', null],
  [/Instruccion\/checklist/gi, 'Instruccion', null],
  [/Checklist\s+de\s+recepcion/gi, 'Lista de verificacion de recepcion', null],
  [/seg[uú]n\s+checklist/gi, 'segun lista de verificacion', null],
  [/\+\s*checklist/gi, '+ lista de verificacion', null],
  [/checklist\s+y\s+mantenimiento/gi, 'lista de verificacion y mantenimiento', null],

  // --- nombre de NUESTRA pieza (solo donde el titulo del documento ya esta en espanol)
  [/ARMREST REAR CENTER/g, 'APOYABRAZOS TRASERO CENTRAL', ['150']],
  [/\bArmrest\b/g, 'Apoyabrazos', ['150']],
  [/\barmrest\b/g, 'apoyabrazos', ['150']],
  [/\bHeadrest\b/g, 'apoyacabezas', ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT']],
];

// Caratula: el log de revisiones no nombra reuniones internas ni lleva typos.
const REV_REEMPLAZOS = [
  [/\s*\(ASAICHI\s*10-11\/08\/2026\)/g, ''],
  [/SE ACTUALIZAN LOS CONTROLES PREVENTIVOS Y DETECTIVOS TRAS REUN[OÓ]N CON EL INSPECTOR DE CALIDAD DE MATERIA PRIMA/g,
   'SE ACTUALIZAN LOS CONTROLES DE PREVENCION Y DE DETECCION DE LA OPERACION 10'],
];

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: rows, error } = await sb.from('amfe_documents')
  .select('id, amfe_number, project_name, data, revisions').ilike('project_name', '%patagonia%');
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== 8) { console.error(`Esperaba 8, hay ${rows.length}`); process.exit(1); }

const plan = [], pendientes = [];

for (const row of rows.sort((a, b) => a.project_name.localeCompare(b.project_name))) {
  const original = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
  let texto = original;
  const detalle = [];

  for (const [re, rep, docs] of REEMPLAZOS) {
    if (docs && !docs.includes(row.amfe_number)) continue;
    const n = (texto.match(re) || []).length;
    if (n) { texto = texto.replace(re, rep); detalle.push(`${n}x ${re.source} -> "${rep}"`); }
  }

  let revs = row.revisions;
  const revsOriginal = revs;
  for (const [re, rep] of REV_REEMPLAZOS) {
    const n = (String(revs || '').match(re) || []).length;
    if (n) { revs = String(revs).replace(re, rep); detalle.push(`caratula: ${n}x ${re.source}`); }
  }

  if (texto === original && revs === revsOriginal) continue;

  // El JSON tiene que seguir siendo valido y con la misma cantidad de operaciones.
  const antes = JSON.parse(original), despues = JSON.parse(texto);
  if ((antes.operations?.length ?? 0) !== (despues.operations?.length ?? 0)) {
    console.error(`${row.amfe_number}: cambio la cantidad de operaciones — abortar`); process.exit(1);
  }
  JSON.parse(revs || '[]');   // valida la caratula

  console.log(`\n  ${row.amfe_number}:`);
  detalle.forEach(d => console.log(`     ${d}`));

  plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name,
              before: antes, after: despues });
  pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: texto, revisions: revs });
}

await runWithValidation(plan, APLICAR, async () => {
  for (const p of pendientes) {
    const { error: e } = await sb.from('amfe_documents')
      .update({ data: p.data, revisions: p.revisions, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }
    const { data: check } = await sb.from('amfe_documents').select('data').eq('id', p.id).single();
    const doc = JSON.parse(check.data);
    if (!Array.isArray(doc.operations)) { console.error(`${p.amfeNumber}: operations no es array`); process.exit(1); }
    console.log(`  ${p.amfeNumber}: OK (${doc.operations.length} operaciones, JSON valido)`);
  }
});
