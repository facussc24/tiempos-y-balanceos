/**
 * _refreshArb.mjs — refresca el cache local del ERP arb desde los exports crudos.
 *
 * El arb exporta por defecto a C:\tmp (ARTICULO.TXT, INSUMOS.TXT, RELACIONES.TXT).
 * Hasta ahora el parseo se reescribia a mano cada vez; este script lo hace una sola vez
 * bien y ademas corre los chequeos de salud que antes se hacian de memoria.
 *
 *   node scripts/_refreshArb.mjs                 # lee C:\tmp, escribe .arb-cache/
 *   node scripts/_refreshArb.mjs --source D:\x   # otra carpeta de origen
 *   node scripts/_refreshArb.mjs --check         # solo diagnostica, no escribe nada
 *   node scripts/_refreshArb.mjs --max-age 3     # avisa si el export tiene mas de 3 dias
 *
 * POR QUE EXISTE (incidentes reales del 2026-07-27):
 *  - El README del cache documentaba el Escritorio como origen; el arb tira a C:\tmp.
 *    Si nadie copia los archivos a mano, se procesan datos viejos sin que nadie se entere.
 *  - El offset del arbol se leyo mal (+9 en vez de +7) y se perdian 858 sub-ensambles.
 *  - Aparecieron 3 pares de codigos con descripcion identica al cortarse en 60 caracteres,
 *    un duplicado por NBSP invisible al final del codigo, y un codigo con 2 unidades.
 *  - 30/09/2026: el INSUMOS.TXT exportado desde el 28/08 es el LISTADO IMPRESO, no el tabulado: el
 *    parser daba 0 insumos y insumos.csv quedo en 25 bytes. Ahora lee los dos formatos; del listado
 *    sale el codigo y la descripcion, y la unidad solo de los que aparecen en alguna BOM.
 *
 * Para CONSULTAR un consumo no hace falta este script: `python scripts/_consumo.py` lee el export
 * directo (parser unico en scripts/_lib/arbRelaciones.py).
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n, def = null) => {
  const i = args.indexOf(n);
  return i === -1 ? def : args[i + 1] ?? true;
};
const SOURCE = flag('--source', 'C:\\tmp');
const CHECK_ONLY = args.includes('--check');
const MAX_AGE_DAYS = Number(flag('--max-age', 7));
const DEST = path.join(process.cwd(), '.arb-cache');

const c = { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', b: '\x1b[34m', d: '\x1b[2m', x: '\x1b[0m' };
const say = (s = '') => console.log(s);
const warn = (s) => console.log(`${c.y}⚠  ${s}${c.x}`);
const bad = (s) => console.log(`${c.r}✗  ${s}${c.x}`);
const ok = (s) => console.log(`${c.g}✓  ${s}${c.x}`);

// ---------------------------------------------------------------- lectura
/** Los TXT del arb vienen en cp1252 (latin-1), no en UTF-8. */
function leerTxt(file) {
  const full = path.join(SOURCE, file);
  if (!fs.existsSync(full)) return null;
  const st = fs.statSync(full);
  const texto = new TextDecoder('windows-1252').decode(fs.readFileSync(full));
  return { full, mtime: st.mtime, size: st.size, lineas: texto.split(/\r?\n/) };
}

const diasDesde = (d) => Math.floor((Date.now() - d.getTime()) / 86400000);
const g = (r, i) => (i < r.length ? r[i].trim() : ''); // acceso seguro: el TXT no paddea
const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));

// ---------------------------------------------------------------- parseo
function parseArticulos(src) {
  const out = [];
  for (const ln of src.lineas.slice(1)) {
    if (!ln.trim()) continue;
    const r = ln.split('\t');
    const cod = g(r, 0);
    if (cod) out.push({ codigo: cod, descripcion: g(r, 1) });
  }
  return out;
}

/**
 * INSUMOS.TXT viene en DOS formatos y el arb elige segun como se exporte:
 *  - 'tabulado': columnas separadas por TAB con U.Medida (el que se necesita).
 *  - 'listado':  el reporte impreso "Listado de Insumos BA" (marcos, "Hoja N", columnas fijas). NO trae
 *                unidad. Es el que quedo exportado desde el 28/08/2026: hasta el 30/09 el parser lo leia
 *                como tabulado, daba 0 insumos y .arb-cache/insumos.csv quedo en 25 bytes (solo la cabecera).
 */
function formatoInsumos(src) {
  const primera = src.lineas.find((l) => l.trim());
  if (!primera) return 'vacio';
  return (primera.match(/\t/g) || []).length >= 4 ? 'tabulado' : 'listado';
}

/**
 * Listado impreso: rubro en las columnas 0-4, codigo en la 5-23, descripcion desde la 24; la descripcion
 * larga sigue en las lineas de abajo. Los marcos son caracteres de cp437 leidos como cp1252: bordes con
 * una tira de A con dieresis y renglones que abren y cierran con ³ (una letra suelta de esa lista en una
 * descripcion, como "M³", NO es un marco). No trae unidad: queda ''.
 */
function parseInsumosListado(src) {
  const out = [];
  let ultimo = null;
  const esMarco = (s) => /Ä{3,}/.test(s) || /^\s*³.*³\s*$/.test(s);
  for (const ln of src.lineas) {
    const s = ln.replace(/\s+$/, '');
    if (!s.trim() || esMarco(s) || s.startsWith('\x1b') || /^\s*Hoja\s+\d+/.test(s)) {
      if (esMarco(s)) ultimo = null;
      continue;
    }
    if (s.length > 24 && /^\s*\d{1,2}\s*$/.test(s.slice(0, 5)) && s.slice(5, 24).trim()) {
      ultimo = { codigo: s.slice(5, 24).trim(), descripcion: s.slice(24).replace(/\r/g, ' ').trim(), unidad: '', rubro: s.slice(0, 5).trim() };
      out.push(ultimo);
    } else if (ultimo) {
      const extra = s.replace(/\r/g, ' ').trim();
      if (extra) ultimo.descripcion = `${ultimo.descripcion} ${extra}`.trim();
    }
  }
  return out;
}

function parseInsumos(src) {
  if (formatoInsumos(src) === 'listado') return parseInsumosListado(src);
  const out = [];
  for (const ln of src.lineas.slice(1)) {
    if (!ln.trim()) continue;
    const r = ln.split('\t');
    // col[0] trae "rubro + codigo" pegados; el codigo limpio esta en col[2]
    const cod = g(r, 2);
    if (cod) out.push({ codigo: cod, descripcion: g(r, 3), unidad: g(r, 5) });
  }
  return out;
}

/**
 * El arbol viene por bloques horizontales con offset +7 EN LOS DATOS
 * (niveles en las columnas 0, 7, 14, 21). OJO: el encabezado usa 0/9/18/27 — layout
 * distinto. Determinar el offset por el encabezado da +9 y pierde 858 sub-ensambles.
 *
 * Ademas hay ~58 filas que son la CONTINUACION de la anterior (descripcion multi-linea):
 * vienen con 4, 6 u 11 columnas y sin codigo. Se fusionan con la fila previa.
 */
const OFFSETS = [0, 7, 14, 21];

function parseRelaciones(src) {
  const filas = [];
  const partidas = [];
  const carry = {};
  let pendiente = null; // fila con codigo a la que le falta unidad/consumo en su propia linea

  const cerrar = () => {
    if (pendiente && pendiente.consumo) filas.push(pendiente);
    else if (pendiente) partidas.push({ tipo: 'descartada_sin_consumo', codigo: pendiente.codigo, linea: pendiente._linea });
    pendiente = null;
  };

  for (let i = 1; i < src.lineas.length; i++) {
    const ln = src.lineas[i];
    if (!ln.trim()) continue;
    const r = ln.split('\t');

    // Una linea es CONTINUACION solo si no trae codigo en NINGUN bloque. Ojo: no alcanza con
    // mirar si trae consumo — hay filas con codigo cuya descripcion se parte y arrastra la
    // unidad y el consumo a la linea siguiente (hay ~29 casos, todos hilos). Tratarlas
    // como fragmento hacia dos daños a la vez: perdia esa fila y le pegaba el texto a otra.
    //
    // Pero pedir SOLO codigo en b+2 tampoco alcanza: la continuacion tiene la forma
    // "<resto de la desc> | <unidad> | <consumo> | <modulo> | <proceso>", o sea que deja el
    // consumo en la columna 2 y el modulo en la 3, y se leia como fila de nivel 0. Causaba dos
    // daños: perdia la fila pendiente y contaminaba carry[0] con el fragmento de descripcion,
    // que aparecia como un prod_raiz inventado. Tampoco alcanza con exigir descripcion en b+3.
    // El discriminador que sirve es la CANTIDAD: la fila real siempre trae un numero en b+1
    // ("1"), la continuacion trae ahi la unidad ("KG"). Verificado sobre RELACIONES.TXT:
    // rescata las 29 filas partidas, descarta las 25 continuaciones, y ninguna fila completa
    // (codigo+consumo) tiene cantidad no numerica. No filtra por el FORMATO del codigo, asi que
    // sigue tomando los codigos que parecen numero decimal (los hay, y son legitimos).
    const esNum = (v) => /^\d+([.,]\d+)?$/.test(v);
    const traeCodigo = OFFSETS.some((b) => g(r, b + 2) && esNum(g(r, b + 1)));
    if (!traeCodigo) {
      const destino = pendiente || filas[filas.length - 1];
      const trozo = r.map((x) => x.trim()).filter(Boolean);
      if (destino && trozo.length) {
        // primer trozo = resto de la descripcion; luego puede venir unidad y consumo
        const [txt, ...resto] = trozo;
        if (txt && !/^[\d.,]+$/.test(txt)) destino.desc = `${destino.desc} ${txt}`.trim();
        for (const v of resto.length ? resto : [txt]) {
          if (/^[\d.,]+$/.test(v) && !destino.consumo) destino.consumo = v;
          else if (!/^[\d.,]+$/.test(v) && !destino.unidad && v !== txt) destino.unidad = v;
        }
        partidas.push({ linea: i + 1, adjuntada_a: destino.codigo });
      }
      if (pendiente && pendiente.consumo) cerrar();
      continue;
    }

    cerrar(); // la fila anterior ya no puede recibir mas fragmentos

    for (let lvl = 0; lvl < OFFSETS.length; lvl++) {
      const b = OFFSETS[lvl];
      const padre = g(r, b);
      const cod = g(r, b + 2);
      if (padre) carry[lvl] = padre;
      if (!cod) continue;
      const fila = {
        prod_raiz: carry[0] || '',
        nivel: lvl,
        padre: carry[lvl] || '',
        codigo: cod,
        desc: g(r, b + 3),
        unidad: g(r, b + 4),
        consumo: g(r, b + 5),
        modulo: lvl === 0 ? g(r, b + 6) : '',
        proceso: lvl === 0 ? g(r, b + 7) : '',
        _linea: i + 1,
      };
      // si ya trae consumo es una fila completa; si no, queda pendiente de la linea siguiente
      if (fila.consumo) filas.push(fila);
      else pendiente = fila;
    }
  }
  cerrar();
  for (const f of filas) delete f._linea;
  return { filas, partidas };
}

// ---------------------------------------------------------------- chequeos de salud
function chequear(articulos, insumos, rel, formato = 'tabulado') {
  const problemas = [];
  const push = (tipo, detalle) => problemas.push({ tipo, detalle });

  // 0. filas con codigo que el parser DESCARTO por quedarse sin consumo. Tiene que dar 0: si no
  //    da 0, el parser esta perdiendo filas en silencio. Este chequeo nace del incidente del
  //    2026-07-29, donde un fix perdia 29 filas y ninguno de los otros chequeos lo detectaba
  //    (todos miran `rel.filas`, o sea lo que SI entro — ninguno miraba lo que se cayo).
  const descartadas = (rel.partidas || []).filter((p) => p.tipo === 'descartada_sin_consumo');
  for (const d of descartadas) {
    push('fila con codigo descartada sin consumo', `${d.codigo} (linea ${d.linea} del TXT)`);
  }

  // 1. mismo codigo con dos unidades distintas
  const porCod = new Map();
  for (const i of insumos) {
    if (!porCod.has(i.codigo)) porCod.set(i.codigo, []);
    porCod.get(i.codigo).push(i);
  }
  for (const [cod, arr] of porCod) {
    const unidades = [...new Set(arr.map((x) => x.unidad))];
    if (unidades.length > 1) push('codigo con 2 unidades', `${cod} → ${unidades.join(' y ')}`);
    else if (arr.length > 1) push('codigo repetido', `${cod} × ${arr.length}`);
  }

  // 2. caracteres invisibles en el codigo (NBSP y compañia) — crean gemelos fantasma
  for (const i of insumos) {
    if (/[\u00A0\u200B\u200E\u200F\uFEFF]/.test(i.codigo) || i.codigo !== i.codigo.trim()) {
      push('codigo con caracter invisible', `${JSON.stringify(i.codigo)} — ${i.descripcion.slice(0, 40)}`);
    }
  }

  // 3. descripciones identicas entre codigos distintos: indistinguibles al cargar una BOM
  const porDesc = new Map();
  for (const i of insumos) {
    const k = i.descripcion.toUpperCase().trim();
    if (!k) continue;
    if (!porDesc.has(k)) porDesc.set(k, new Set());
    porDesc.get(k).add(i.codigo);
  }
  for (const [desc, cods] of porDesc) {
    if (cods.size > 1) push('descripcion indistinguible', `${[...cods].join(' = ')} → "${desc.slice(0, 52)}"`);
  }

  // 4. insumos sin unidad: sus lineas de BOM salen sin unidad
  if (formato === 'listado') {
    // el reporte impreso no tiene la columna: no son 1 por 1 "sin unidad", es un solo hecho
    const sin = insumos.filter((x) => !x.unidad).length;
    push(
      'INSUMOS.TXT es el listado impreso, sin columna de unidad',
      `${sin} de ${insumos.length} insumos sin unidad conocida (solo se completa la de los que estan en alguna BOM); ` +
        're-exportar INSUMOS como tabulado para tener el maestro completo'
    );
  } else {
    for (const i of insumos.filter((x) => !x.unidad)) {
      push('insumo sin unidad', `${i.codigo} — ${i.descripcion.slice(0, 44)}`);
    }
  }

  // 5. BOM que referencia un codigo que no esta en el maestro
  const setIns = new Set(insumos.map((i) => i.codigo));
  const setArt = new Set(articulos.map((a) => a.codigo));
  const huerfanos = [...new Set(rel.filas.filter((f) => !setIns.has(f.codigo) && !setArt.has(f.codigo)).map((f) => f.codigo))];
  for (const h of huerfanos) push('codigo en BOM que no esta en el maestro', h);

  // 6. consumos que no parsean como numero
  const malCon = rel.filas.filter((f) => !Number.isFinite(num(f.consumo)));
  if (malCon.length) push('consumo no numerico', `${malCon.length} lineas`);

  return problemas;
}

// ---------------------------------------------------------------- salida
const csv = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const escribir = (file, header, rows, cols) => {
  const out = [header, ...rows.map((r) => cols.map((k) => csv(r[k])).join(','))].join('\n');
  fs.writeFileSync(path.join(DEST, file), out, 'utf8');
  return out.length;
};

// ---------------------------------------------------------------- main
say(`${c.b}refresh del cache arb${c.x}  ${c.d}origen: ${SOURCE}${c.x}\n`);

const fuentes = {
  ARTICULO: leerTxt('ARTICULO.TXT'),
  INSUMOS: leerTxt('INSUMOS.TXT'),
  RELACIONES: leerTxt('RELACIONES.TXT'),
};

let falta = false;
for (const [n, f] of Object.entries(fuentes)) {
  if (!f) {
    bad(`falta ${n}.TXT en ${SOURCE} — exportalo desde el arb`);
    falta = true;
    continue;
  }
  const dias = diasDesde(f.mtime);
  const cuando = f.mtime.toLocaleString('es-AR');
  const linea = `${n}.TXT  ${String(f.lineas.length - 1).padStart(5)} filas  ${cuando}`;
  if (dias > MAX_AGE_DAYS) warn(`${linea}  — ${dias} dias de antiguedad, ¿reexportaste?`);
  else ok(linea);
}
if (falta) process.exit(1);

// aviso fuerte si los exports no son de la misma tanda
const fechas = Object.values(fuentes).map((f) => f.mtime.getTime());
const spreadHs = (Math.max(...fechas) - Math.min(...fechas)) / 3600000;
if (spreadHs > 24) {
  warn(`los 3 exports difieren en ${Math.round(spreadHs)} h entre si — puede que alguno sea de otra tanda`);
}

const articulos = parseArticulos(fuentes.ARTICULO);
const insumos = parseInsumos(fuentes.INSUMOS);
const rel = parseRelaciones(fuentes.RELACIONES);

// El listado impreso no trae unidad. Se completa con la que el arb imprime en RELACIONES (la llena
// desde el maestro: 0 codigos con dos unidades, ver unidadesArb.mjs). Los insumos que ninguna BOM usa
// quedan SIN unidad, y asi se dicen: no se inventa.
const formatoIns = formatoInsumos(fuentes.INSUMOS);
if (formatoIns === 'listado') {
  const unidadDe = new Map();
  for (const f of rel.filas) if (f.unidad && !unidadDe.has(f.codigo)) unidadDe.set(f.codigo, f.unidad);
  for (const i of insumos) i.unidad = unidadDe.get(i.codigo) ?? '';
}
const insumosConUnidad = insumos.filter((i) => i.unidad).length;

say('');
say(`${c.b}parseo${c.x}`);
say(`   articulos          ${articulos.length}`);
say(
  `   insumos            ${insumos.length}` +
    (formatoIns === 'listado'
      ? `   ${c.d}(listado impreso, sin unidad: completada desde RELACIONES para ${insumosConUnidad})${c.x}`
      : '')
);
say(`   lineas de BOM      ${rel.filas.length}`);
const porNivel = rel.filas.reduce((a, f) => ((a[f.nivel] = (a[f.nivel] || 0) + 1), a), {});
say(`   por nivel          ${JSON.stringify(porNivel)}   ${c.d}(offset +7; con +9 se pierden los niveles 1-2)${c.x}`);
say(`   filas fusionadas   ${rel.partidas.length}   ${c.d}(descripciones multi-linea)${c.x}`);

say('');
say(`${c.b}chequeos de salud${c.x}`);
const problemas = chequear(articulos, insumos, rel, formatoIns);
if (!problemas.length) ok('sin observaciones');
else {
  const porTipo = problemas.reduce((a, p) => ((a[p.tipo] = a[p.tipo] || []).push(p.detalle), a), {});
  for (const [tipo, lista] of Object.entries(porTipo)) {
    warn(`${tipo}: ${lista.length}`);
    for (const d of lista.slice(0, 6)) say(`      ${c.d}${d}${c.x}`);
    if (lista.length > 6) say(`      ${c.d}... y ${lista.length - 6} mas${c.x}`);
  }
}

if (CHECK_ONLY) {
  say(`\n${c.d}--check: no se escribio nada${c.x}`);
  process.exit(problemas.length ? 2 : 0);
}

fs.mkdirSync(DEST, { recursive: true });
escribir('articulos.csv', 'codigo,descripcion', articulos, ['codigo', 'descripcion']);
// Del listado impreso solo se escriben los insumos con unidad conocida. Una fila con la unidad VACIA en este
// csv (que unidadesArb.mjs lee como fuente "mas nueva") taparia la unidad que SI tienen RELACIONES.TXT y el
// maestro del 02/08, y el validador diria "maestro sin unidad" para codigos que la tienen.
const insumosCsv = formatoIns === 'listado' ? insumos.filter((i) => i.unidad) : insumos;
escribir('insumos.csv', 'codigo,descripcion,unidad', insumosCsv, ['codigo', 'descripcion', 'unidad']);
escribir(
  'relaciones_plano.csv',
  'prod_raiz,nivel,padre,codigo,desc,unidad,consumo,modulo,proceso',
  rel.filas,
  ['prod_raiz', 'nivel', 'padre', 'codigo', 'desc', 'unidad', 'consumo', 'modulo', 'proceso']
);
fs.writeFileSync(
  path.join(DEST, 'refresh.json'),
  JSON.stringify(
    {
      generado: new Date().toISOString(),
      origen: SOURCE,
      fuentes: Object.fromEntries(Object.entries(fuentes).map(([k, v]) => [k, { mtime: v.mtime, filas: v.lineas.length - 1 }])),
      conteos: { articulos: articulos.length, insumos: insumos.length, insumos_con_unidad: insumosConUnidad, relaciones: rel.filas.length, porNivel },
      formato_insumos: formatoIns,
      filas_fusionadas: rel.partidas.length,
      problemas,
    },
    null,
    2
  ),
  'utf8'
);

say('');
ok(`cache actualizado en .arb-cache/  ${c.d}(articulos.csv, insumos.csv, relaciones_plano.csv, refresh.json)${c.x}`);
say(`${c.d}   ojo: los CSV son para buscar existencia. Para medir formato o largo de codigos, ir al TXT crudo.${c.x}`);
