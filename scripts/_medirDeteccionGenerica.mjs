/**
 * _medirDeteccionGenerica.mjs — cuantas causas de cada AMFE vivo detectan con un control generico.
 *
 * HOY-22 (Fak, 10/10/2026: "los amfes de hoy tienen controles medio inventados o genericos").
 * Lee los AMFE de Supabase en SOLO LECTURA (`supabaseSoloLectura.mjs`: un update tira) y clasifica
 * el control de deteccion de cada causa con el MISMO criterio del gate 8 del plan de control
 * (`controlCanon.mjs`, catalogo en `planControlCanon.data.json`):
 *   con instrumento · falta en el catalogo (panel, alarma, sensor, ensayo, certificado...) ·
 *   GENERICO («Inspeccion visual», «Visual») · ausencia declarada («Sin ...») · vacio.
 * No escribe nada, no corrige nada: es la medicion.
 *
 * Uso:
 *   node scripts/_medirDeteccionGenerica.mjs               # tabla por AMFE + las 10 frases mas repetidas
 *   node scripts/_medirDeteccionGenerica.mjs --genericas   # las frases genericas, de mayor a menor
 *   node scripts/_medirDeteccionGenerica.mjs --fuera       # lo que nombran y el catalogo no tiene
 *   node scripts/_medirDeteccionGenerica.mjs --amfe 161    # el detalle de un AMFE (numero de la casa o amfe_number)
 */
import { conectarSoloLectura, leerAmfesVivos } from './_lib/supabaseSoloLectura.mjs';
import { parseData } from './_lib/amfeIo.mjs';
import { clasificarControl } from './_lib/controlCanon.mjs';

/** Cuenta por clase los controles de deteccion de un AMFE ya parseado. Pura: la usan los tests. */
export function medirAmfe(doc) {
  const n = { causas: 0, identificado: 0, fuera_del_catalogo: 0, generico: 0, genericoSinFrecuencia: 0, declarado_inexistente: 0, vacio: 0, detalle: [] };
  for (const op of doc.operations || []) for (const we of op.workElements || []) for (const fn of we.functions || []) for (const fa of fn.failures || fn.failureModes || []) for (const c of fa.causes || []) {
    const texto = String(c.detectionControl ?? '').trim();
    const r = clasificarControl(texto);
    n.causas += 1;
    n[r.clase] += 1;
    if (r.clase === 'generico' && !r.frecuencias.length) n.genericoSinFrecuencia += 1;
    n.detalle.push({ op: String(op.operationNumber ?? op.opNumber ?? ''), falla: String(fa.description || ''), causa: String(c.description || c.cause || ''), control: texto, clase: r.clase, fuera: r.fuera, D: c.detection });
  }
  return n;
}

async function main() {
  const arg = (x) => { const i = process.argv.indexOf(x); return i > 0 ? process.argv[i + 1] : ''; };
  const sb = await conectarSoloLectura();
  const filas = (await leerAmfesVivos(sb, { minimo: 1 })).sort((a, b) => String(a.amfe_number).localeCompare(String(b.amfe_number)));
  const medidos = filas.map((f) => { const doc = parseData(f.data); return { amfe: f.amfe_number, casa: String(doc.header?.amfeNumber || ''), proyecto: f.project_name, updated_at: f.updated_at, ...medirAmfe(doc) }; });
  const cuenta = (lista) => { const m = new Map(); for (const t of lista) m.set(t, (m.get(t) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const todos = medidos.flatMap((m) => m.detalle);

  if (arg('--amfe')) {
    const m = medidos.find((x) => x.amfe === arg('--amfe') || x.casa === arg('--amfe'));
    if (!m) { console.error(`no hay un AMFE ${arg('--amfe')} (hay: ${medidos.map((x) => x.casa || x.amfe).join(', ')})`); process.exit(2); }
    console.log(`${m.amfe} (${m.casa}) ${m.proyecto} · updated_at ${m.updated_at}: ${m.causas} causas · ${m.generico} GENERICO · ${m.fuera_del_catalogo} falta en el catalogo · ${m.identificado} con instrumento`);
    for (const d of m.detalle.filter((x) => x.clase === 'generico')) console.log(`  OP ${d.op} · ${d.falla.slice(0, 45)} · ${d.causa.slice(0, 45)} · D${d.D} · "${d.control}"`);
    return;
  }
  if (process.argv.includes('--genericas')) { for (const [t, k] of cuenta(todos.filter((d) => d.clase === 'generico').map((d) => d.control))) console.log(`${k} × ${t}`); return; }
  if (process.argv.includes('--fuera')) { for (const [t, k] of cuenta(todos.filter((d) => d.clase === 'fuera_del_catalogo').map((d) => `${d.control}  => ${d.fuera.join(', ')}`))) console.log(`${k} × ${t}`); return; }

  console.log('| AMFE | Nº casa | Causas | Con instrumento | Falta en el catalogo | GENERICO | de esos, sin frecuencia | «Sin ...» | Vacio |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const m of medidos) console.log(`| ${m.amfe} | ${m.casa} | ${m.causas} | ${m.identificado} | ${m.fuera_del_catalogo} | ${m.generico} | ${m.genericoSinFrecuencia} | ${m.declarado_inexistente} | ${m.vacio} |`);
  const s = (k) => medidos.reduce((a, m) => a + m[k], 0);
  console.log(`| TOTAL (${medidos.length} AMFE) | | ${s('causas')} | ${s('identificado')} | ${s('fuera_del_catalogo')} | ${s('generico')} | ${s('genericoSinFrecuencia')} | ${s('declarado_inexistente')} | ${s('vacio')} |`);
  console.log('\nLas 10 frases de control de deteccion mas repetidas:');
  for (const [t, k] of cuenta(todos.filter((d) => d.control).map((d) => d.control)).slice(0, 10)) console.log(`  ${k} × ${t}  [${clasificarControl(t).clase}]`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) main().catch((e) => { console.error(e.message); process.exit(2); });
