/**
 * _fichaPieza.mjs — la ficha de configuracion de una pieza (tanda 13 item 1; plan
 * docs/PLAN_FICHA_CONFIGURACION_PIEZA_2026-10-17.md, si de Fak del 18/10/2026; vive en data/configuracion/).
 *
 * Uso:
 *   node scripts/_fichaPieza.mjs --lista
 *   node scripts/_fichaPieza.mjs --mostrar  <pieza>          que letra esta vigente y que letra vio el cliente
 *   node scripts/_fichaPieza.mjs --comparar <pieza> [--json] si los documentos vigentes dicen lo mismo (sale 1 con un rojo)
 *   node scripts/_fichaPieza.mjs --cambio   <pieza> --atributo adhesivo | --codigo 427ESP001TRO01
 *                                                             que documentos nombran eso + el recordatorio del ECR
 *   node scripts/_fichaPieza.mjs --relevar  <pieza> [--parcial] [--dry-run]
 *                                                             vuelve a leer todos los documentos y reescribe la ficha
 *   node scripts/_fichaPieza.mjs --registrar --tipo flujograma --nombre "FLUJOGRAMA 154 - INSERT - Rev.D"
 *                                --destino <carpeta> [--fecha AAAA-MM-DD] [--quien _emitirApqp]
 *                                                             lo llaman los emisores despues de emitir de verdad
 *
 * SOLO LECTURA sobre todo lo de la empresa: Supabase con el cliente que solo sabe leer, el arb por su
 * export, la nube y Y: leyendo archivos, los mails por el cache local. Lo unico que escribe es el JSON de
 * la ficha (data/configuracion/<pieza>.json), de forma atomica. No edita ningun documento.
 */
import { leerFicha, guardarFicha, listarFichas, fichasCon, resumenComparacion, queTocaUnCambio, registrarDocumento, documentoDeNombre, rutaFicha } from './_lib/fichaPieza.mjs';
import { relevarFicha } from './_lib/fichaRelevar.mjs';

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
const tiene = (n) => argv.includes(n);
const CONOCIDAS = new Set(['--lista', '--mostrar', '--comparar', '--json', '--cambio', '--atributo', '--codigo', '--relevar', '--parcial', '--dry-run', '--registrar', '--tipo', '--nombre', '--numero', '--letra', '--destino', '--fecha', '--quien']);
const desconocidas = argv.filter((a) => a.startsWith('--') && !CONOCIDAS.has(a));
if (desconocidas.length) { console.error(`No conozco ${desconocidas.join(', ')}. Mira el uso arriba del archivo.`); process.exit(2); }

const MARCA = { rojo: 'ROJO ', verde: 'verde', una_fuente: 'UNA FUENTE', a_confirmar: 'A CONFIRMAR' };
const linea = (s = '') => console.log(s);

function mostrar(clave) {
  const f = leerFicha(clave);
  linea(`${f.pieza.nombre} — ficha relevada el ${f.relevado} (${rutaFicha(clave)})`);
  linea('');
  for (const d of f.documentos) {
    const vig = d.vigente === false ? ' [no vigente]' : d.vigente === 'a confirmar' ? ' [vigencia a confirmar]' : '';
    linea(`- ${d.id}  ${d.nombre || ''}${vig}`);
    linea(`    letra vigente: ${d.letra ?? 'a confirmar'}${d.fecha ? ` (${d.fecha})` : ''} · leido en: ${d.donde || '-'}`);
    if (d.maestro) linea(`    maestro: ${d.maestro.ruta}${d.maestro.estado ? ` — ${d.maestro.estado}` : ''}`);
    for (const c of d.cliente || []) linea(`    cliente: ${c.letra ? `letra ${c.letra}${c.inferida ? ' (inferida)' : ''}` : 'a confirmar'} — ${c.donde} ${c.fecha || ''}${c.nota ? ` · ${c.nota}` : ''}`);
    for (const e of d.emisiones || []) linea(`    emitido: letra ${e.letra} el ${e.fecha} → ${e.destino}${e.quien ? ` (${e.quien})` : ''}`);
  }
  const p = f.pendientes || [];
  if (p.length) { linea(''); linea(`Pendientes (${p.length}):`); for (const x of p) linea(`  · [${x.estado}] ${x.documento ? `${x.documento}: ` : ''}${x.que}${x.zanja ? ` — lo zanja: ${x.zanja}` : ''}`); }
}

function comparar(clave) {
  const f = leerFicha(clave);
  const r = resumenComparacion(f);
  if (tiene('--json')) { console.log(JSON.stringify(r, null, 2)); return r.codigoSalida; }
  linea(`${f.pieza.nombre}: ¿los documentos vigentes dicen lo mismo? (ficha relevada el ${f.relevado})`);
  linea('');
  for (const a of r.atributos) {
    linea(`[${MARCA[a.estado]}] ${a.atributo}: ${a.detalle}`);
    if (a.estado === 'rojo') for (const v of a.valores) linea(`        ${v.documento}: «${String(v.texto).slice(0, 110)}» — ${v.fuente}`);
    for (const v of a.sinValor) linea(`        sin valor legible en ${v.documento}: «${String(v.texto).slice(0, 80)}»`);
    for (const v of a.referencias) linea(`        referencia (no decide): ${v.documento} dice ${v.valor}`);
    for (const v of a.fueraDeComparacion) linea(`        fuera de la comparacion (no vigente): ${v.documento} dice ${v.valor}`);
  }
  linea('');
  linea('Lo que vio el cliente contra lo vigente:');
  for (const c of r.cliente) linea(`[${MARCA[c.estado]}] ${c.documento} (vigente ${c.letraVigente ?? 'a confirmar'}): ${c.detalle}`);
  const avisos = (f.pendientes || []).filter((p) => p.estado === 'aviso' || p.estado === 'falla');
  if (avisos.length) { linea(''); for (const a of avisos) linea(`ojo: ${a.documento ? `${a.documento}: ` : ''}${a.que}`); }
  linea('');
  linea(r.rojos ? `${r.rojos} rojo(s). La ficha dice quien dice que; cual vale lo decide el dueño del documento.` : 'Sin rojos.');
  return r.codigoSalida;
}

function cambio(clave) {
  const atributo = flag('--atributo'); const codigo = flag('--codigo');
  if (!atributo && !codigo) { console.error('Falta --atributo <nombre> o --codigo <codigo del arb>'); return 2; }
  const r = queTocaUnCambio(leerFicha(clave), { atributo, codigo });
  linea(`Si cambia «${r.cambio}», estos documentos de la pieza lo nombran:`);
  for (const d of r.documentos) linea(`  - ${d.id} (letra ${d.letra ?? 'a confirmar'}${d.vigente ? '' : ', no vigente'})${d.maestro ? ` · maestro: ${d.maestro.ruta}` : ''}${d.cliente.some((c) => c.letra) ? ' · el cliente tiene una copia' : ''}`);
  if (r.aviso) linea(`  (${r.aviso})`);
  linea('');
  linea(`El SGC manda revisar por SCP: ${r.queNombraElSgc}.`);
  linea(r.recordatorio);
  linea(`(fuente: ${r.fuente})`);
  return 0;
}

async function relevar(clave) {
  const { ficha, fallas } = await relevarFicha(leerFicha(clave), { parcial: tiene('--parcial') });
  for (const f of fallas) console.error(`  ✗ ${f}`);
  if (fallas.length && !tiene('--parcial')) {
    console.error(`\nNO SE ESCRIBIO la ficha: ${fallas.length} fuente(s) sin leer. Una ficha a medias daria verde por falta de papeles.`);
    console.error('Para guardarla igual conservando lo anterior de esas fuentes (con su fecha vieja): --parcial');
    return 1;
  }
  if (tiene('--dry-run')) { linea(`dry-run: ${ficha.atributos.length} valores leidos, ${ficha.pendientes.length} pendientes; no se escribio nada`); return 0; }
  linea(`ficha escrita: ${guardarFicha(clave, ficha)} (${ficha.atributos.length} valores, ${ficha.pendientes.length} pendientes)`);
  return 0;
}

function registrar() {
  const tipo = flag('--tipo');
  const leido = flag('--nombre') ? documentoDeNombre(tipo, flag('--nombre')) : null;
  const numero = flag('--numero') || leido?.numero;
  const letra = flag('--letra') || leido?.letra;
  if (!tipo || !numero) { console.error('ficha: falta --tipo y --numero (o un --nombre con numero y «Rev.X»)'); return 2; }
  const claves = fichasCon(tipo, numero);
  if (!claves.length) { linea(`ficha: ${tipo} ${numero} no esta en ninguna ficha de pieza (sin ficha, no se registra nada)`); return 0; }
  for (const clave of claves) {
    const emision = { fecha: flag('--fecha') || new Date().toISOString().slice(0, 10), destino: flag('--destino') || '-', quien: flag('--quien') || null };
    const nueva = registrarDocumento(leerFicha(clave), { tipo, numero, letra, emision });
    guardarFicha(clave, nueva);
    linea(`ficha ${clave}: ${tipo} ${numero} letra ${letra ?? '(sin letra)'} registrado (${emision.destino})`);
  }
  return 0;
}

async function main() {
  if (tiene('--lista') || !argv.length) { linea(`Fichas: ${listarFichas().join(', ') || '(ninguna)'}`); return 0; }
  if (tiene('--registrar')) return registrar();
  const clave = flag('--mostrar') || flag('--comparar') || flag('--cambio') || flag('--relevar');
  if (!clave) { console.error('Falta la pieza. Ej: --comparar insert-patagonia (--lista dice cuales hay)'); return 2; }
  if (tiene('--mostrar')) { mostrar(clave); return 0; }
  if (tiene('--comparar')) return comparar(clave);
  if (tiene('--cambio')) return cambio(clave);
  if (tiene('--relevar')) return relevar(clave);
  return 2;
}

process.exitCode = await main();
