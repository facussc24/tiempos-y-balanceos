/**
 * fichaPieza.mjs — la ficha de configuracion de una pieza: que letra de cada documento esta vigente,
 * que letra vio el cliente y si los documentos vigentes dicen lo mismo.
 *
 * POR QUE EXISTE (plan docs/PLAN_FICHA_CONFIGURACION_PIEZA_2026-10-17.md, tanda 13 item 1, si de Fak del
 * 18/10/2026). Lo que se le escapa a Barack hacia el cliente casi nunca es un documento mal hecho: es que
 * dos documentos de la misma pieza dicen cosas distintas (la HO-990 dice SikaMelt y la BOM y el AMFE
 * Fenoclor; el rollo de espuma del Insert aparece con 1400, 1200, 1150 y 1350 mm), o que se trabajo sobre
 * una version que no era la vigente (el error del 14/10).
 *
 * QUE HAY ACA. Todo puro (sin red, sin Supabase, sin la nube) salvo leer y guardar el JSON de la ficha:
 *   - normalizar()          el texto de un documento -> un valor comparable (marca, numero, "6 en 25"...)
 *   - compararAtributos()   paso (b): entre los documentos VIGENTES, rojo donde no cierran
 *   - compararCliente()     paso (a): la letra que vio el cliente contra la vigente
 *   - queTocaUnCambio()     paso (c): que documentos de la pieza nombran un atributo o un codigo + el ECR
 *   - registrarDocumento()  lo que llama un emisor despues de emitir (nunca a mano)
 * Los lectores de archivos reales viven aparte (fichaLectores.mjs) y el comando es scripts/_fichaPieza.mjs.
 *
 * LO QUE NO HACE: no edita ningun documento, no escribe en Supabase, el arb, Outlook ni el servidor, no
 * decide cual de dos valores es el correcto (dice quien dice que) y no inventa: un texto que no se puede
 * normalizar queda "sin valor" y se lista, no se completa.
 *
 * Forma de la ficha (data/configuracion/<clave>.json):
 *   { pieza, relevado, fuentes: [...], documentos: [{ id: 'tipo:numero', tipo, numero, letra, fecha,
 *     vigente, donde, maestro, copias, cliente: [{ letra, inferida, donde, fecha, fuente }], emisiones }],
 *     atributos: [{ atributo, documento, texto, fuente, rol: 'declara'|'tope'|'referencia'|'cliente',
 *     de, unidad, lista, codigo }], pendientes: [...] }
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ_REPO = resolve(AQUI, '..', '..');
export const CANON = JSON.parse(readFileSync(join(AQUI, 'fichaPieza.data.json'), 'utf8'));
export const CARPETA_FICHAS = join(RAIZ_REPO, 'data', 'configuracion');

// ---------------------------------------------------------------------------
// normalizar
// ---------------------------------------------------------------------------

const numero = (s) => Number(String(s).replace(',', '.'));
const FACTOR_A_MM = { mm: 1, cm: 10, m: 1000 };

function aMm(valor, unidad) {
  const f = FACTOR_A_MM[String(unidad || 'mm').toLowerCase()];
  return f ? Math.round(valor * f) : null;
}

function normalizarAdhesivo(texto) {
  const marcas = CANON.adhesivos.filter((a) => a.patrones.some((p) => new RegExp(p, 'i').test(texto))).map((a) => a.marca);
  if (marcas.length === 1) return { valor: marcas[0] };
  if (marcas.length > 1) return { valor: null, nota: `nombra mas de una marca (${marcas.join(', ')})` };
  return { valor: null, nota: 'no nombra ninguna marca del canon (fichaPieza.data.json)' };
}

function normalizarAncho(texto, unidad) {
  const tag = /<WIDTH>\s*([\d.,]+)\s*<\/WIDTH>/i.exec(texto);
  if (tag) return { valor: aMm(numero(tag[1]), unidad || 'cm') };
  const espesorPorAncho = /\d+(?:[.,]\d+)?\s*[xX]\s*(\d{3,4})\b/.exec(texto);   // "1,1X1400" del arb
  if (espesorPorAncho) return { valor: aMm(numero(espesorPorAncho[1]), 'mm') };
  const conUnidad = /(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/i.exec(texto);
  if (conUnidad) return { valor: aMm(numero(conUnidad[1]), conUnidad[2]) };
  const pelado = /(\d+(?:[.,]\d+)?)/.exec(texto);
  if (pelado) return { valor: aMm(numero(pelado[1]), unidad || 'mm') };
  return { valor: null, nota: 'no trae un ancho' };
}

function normalizarDensidad(texto) {
  const m = /(\d+(?:[.,]\d+)?)\s*kg\s*\/\s*m\s*(?:3|³)/i.exec(texto);
  return m ? { valor: numero(m[1]) } : { valor: null, nota: 'no trae una densidad en kg/m3' };
}

function normalizarPuntada(texto) {
  const m = /(\d+)\s*(?:puntadas?\s*)?(?:±\s*[\d.,]+\s*)?en\s*(\d+)\s*(?:mm)?/i.exec(texto);
  return m ? { valor: `${m[1]} en ${m[2]}` } : { valor: null, nota: 'no trae puntadas por largo' };
}

function normalizarLetra(texto) {
  const m = /\bRev(?:isi[oó]n)?\.?\s*([A-Z])\b/.exec(texto);
  return m ? { valor: m[1] } : { valor: null, nota: 'no trae una letra de revision' };
}

function normalizarCodigos(texto) {
  const codigos = [...new Set(String(texto).toUpperCase().match(/\bFX\d{3}[A-Z0-9-]*/g) || [])].sort();
  return codigos.length ? { valor: codigos.join(' + ') } : { valor: null, nota: 'no trae un codigo de hilo' };
}

/**
 * @param {string} atributo  'adhesivo', 'espuma.densidad', 'espuma.ancho_rollo', 'costura.vista.puntada',
 *                           'cita.flujograma', 'hilo.union', 'operaciones'...
 * @param {string} texto     lo que dice el documento, tal cual
 * @param {{unidad?: string, lista?: string[]}} [opts]
 * @returns {{valor: string|number|string[]|null, nota?: string}}
 */
export function normalizar(atributo, texto, opts = {}) {
  const t = String(texto ?? '');
  if (atributo === 'operaciones') {
    const lista = opts.lista || t.split(/[\s,;|]+/).filter((x) => /^\d+$/.test(x));
    return lista.length ? { valor: [...new Set(lista.map(String))].sort((a, b) => Number(a) - Number(b)) } : { valor: null, nota: 'sin operaciones' };
  }
  if (atributo === 'adhesivo') return normalizarAdhesivo(t);
  if (atributo.startsWith('cita.')) return normalizarLetra(t);
  if (/\.densidad$/.test(atributo)) return normalizarDensidad(t);
  if (/\bancho/.test(atributo)) return normalizarAncho(t, opts.unidad);
  if (/puntada$/.test(atributo)) return normalizarPuntada(t);
  if (atributo.startsWith('hilo')) return normalizarCodigos(t);
  const limpio = t.trim();
  return limpio ? { valor: limpio.toUpperCase() } : { valor: null, nota: 'vacio' };
}

// ---------------------------------------------------------------------------
// comparar
// ---------------------------------------------------------------------------

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const mostrar = (v) => (Array.isArray(v) ? v.join(' ') : String(v));

function indiceDocumentos(ficha) {
  return new Map((ficha.documentos || []).map((d) => [d.id, d]));
}

function conValor(a, docs) {
  const d = docs.get(a.documento);
  const n = normalizar(a.atributo, a.texto, { unidad: a.unidad, lista: a.lista });
  const v = { documento: a.documento, valor: n.valor, texto: a.texto, fuente: a.fuente };
  if (n.nota) v.nota = n.nota;
  if (d?.pieza) v.otraPieza = d.pieza;
  if (d?.porMaterial) v.porMaterial = d.porMaterial;
  return v;
}

/** Quien dice que, en una frase: "ho:990 dice SikaMelt; bom:insert y amfe:158 dicen Fenoclor FA". */
function quienDiceQue(valores) {
  const grupos = [];
  for (const v of valores) {
    const g = grupos.find((x) => igual(x.valor, v.valor));
    if (!g) grupos.push({ valor: v.valor, docs: [v.documento] });
    else if (!g.docs.includes(v.documento)) g.docs.push(v.documento);
  }
  return grupos.map((g) => `${g.docs.join(' y ')} ${g.docs.length > 1 ? 'dicen' : 'dice'} ${mostrar(g.valor)}`).join('; ');
}

function detalleOperaciones(valores) {
  const union = [...new Set(valores.flatMap((v) => v.valor))].sort((a, b) => Number(a) - Number(b));
  return valores
    .map((v) => ({ doc: v.documento, faltan: union.filter((n) => !v.valor.includes(n)) }))
    .filter((x) => x.faltan.length)
    .map((x) => `${x.doc} no tiene ${x.faltan.join(', ')}`)
    .join('; ');
}

/**
 * Paso (b). Para cada atributo, el valor que dice cada documento VIGENTE y el estado:
 *   rojo        dos documentos vigentes dicen distinto (o una tizada no entra en el rollo declarado)
 *   verde       dos o mas dicen lo mismo
 *   una_fuente  un solo papel con valor: no hay con que comparar (ni verde ni rojo)
 * Un documento con `vigente: false` queda en `fueraDeComparacion`; una `referencia` (un pedido por mail)
 * se muestra y no decide; lo que dijo el cliente (`rol: 'cliente'`) lo mira compararCliente().
 */
export function compararAtributos(ficha) {
  const docs = indiceDocumentos(ficha);
  // 'menciona' = nombra el material sin dar un valor: sirve para el paso (c), no se compara.
  const propiasDeLaFicha = (ficha.atributos || []).filter((a) => a.rol !== 'cliente' && a.rol !== 'menciona');
  // Una cita («Flujograma Base 154 Rev. B») se compara contra la letra vigente del documento citado.
  const citados = [...new Set(propiasDeLaFicha.filter((a) => a.cita && docs.get(a.cita)?.letra).map((a) => `${a.atributo}|${a.cita}`))]
    .map((k) => { const [atributo, cita] = k.split('|'); return { atributo, documento: cita, texto: `Rev. ${docs.get(cita).letra} (letra vigente)`, fuente: `letra vigente de ${cita} en esta ficha` }; });
  const entradas = [...propiasDeLaFicha, ...citados];
  const nombres = [...new Set(entradas.map((a) => a.atributo))];
  const declarados = (atributo) => entradas
    .filter((a) => a.atributo === atributo && (a.rol || 'declara') === 'declara' && docs.get(a.documento)?.vigente !== false)
    .map((a) => conValor(a, docs)).filter((v) => v.valor !== null);

  return nombres.map((atributo) => {
    const propias = entradas.filter((a) => a.atributo === atributo);
    const fuera = propias.filter((a) => docs.get(a.documento)?.vigente === false).map((a) => conValor(a, docs));
    const vigentes = propias.filter((a) => docs.get(a.documento)?.vigente !== false);
    const referencias = vigentes.filter((a) => a.rol === 'referencia').map((a) => conValor(a, docs));
    const topes = vigentes.filter((a) => a.rol === 'tope').map((a) => ({ ...conValor(a, docs), de: a.de }));
    const declara = vigentes.filter((a) => (a.rol || 'declara') === 'declara').map((a) => conValor(a, docs));
    const valores = [...declara, ...topes].filter((v) => v.valor !== null);
    const sinValor = [...declara, ...topes].filter((v) => v.valor === null);
    const r = { atributo, estado: 'una_fuente', valores, sinValor, referencias, fueraDeComparacion: fuera, detalle: '' };

    if (topes.length) {
      const base = declarados(topes[0].de);
      if (!base.length) { r.detalle = `no hay ${topes[0].de} declarado contra que medir`; return r; }
      const minimo = Math.min(...base.map((b) => b.valor));
      const pasados = topes.filter((t) => t.valor !== null && t.valor > minimo);
      r.estado = pasados.length ? 'rojo' : 'verde';
      r.detalle = pasados.length
        ? `${pasados.map((t) => `${t.documento} usa ${t.valor}`).join('; ')}, mas que el ${topes[0].de} mas chico declarado (${minimo})`
        : `entra en el ${topes[0].de} declarado (${minimo})`;
      return r;
    }
    if (valores.length < 2) {
      r.detalle = valores.length ? `solo ${valores[0].documento} lo dice` : 'ningun documento vigente trae un valor legible';
      return r;
    }
    const distintos = valores.filter((v, i) => valores.findIndex((w) => igual(w.valor, v.valor)) === i);
    r.estado = distintos.length > 1 ? 'rojo' : 'verde';
    r.detalle = atributo === 'operaciones' && r.estado === 'rojo' ? detalleOperaciones(valores) : quienDiceQue(valores);
    const compartidos = valores.filter((v) => v.otraPieza);
    if (compartidos.length) {
      r.detalle += ` (${compartidos.map((v) => `${v.documento} es de la pieza ${v.otraPieza}${v.porMaterial ? `: comparte el material ${v.porMaterial}` : ''}`).join('; ')})`;
    }
    return r;
  });
}

/**
 * Paso (a), la mitad del cliente. Por documento con algo dicho de lo que vio el cliente:
 *   rojo        el cliente tiene otra letra, o la misma letra con otro contenido
 *   verde       misma letra y nada distinto a la vista
 *   a_confirmar no se sabe que letra tiene (nunca verde por falta de dato)
 */
export function compararCliente(ficha) {
  const docs = indiceDocumentos(ficha);
  const atributos = ficha.atributos || [];
  return (ficha.documentos || []).filter((d) => (d.cliente || []).length).map((d) => {
    const lineas = [];
    let estado = 'verde';
    const peor = (e) => { if (e === 'rojo' || (e === 'a_confirmar' && estado === 'verde')) estado = e; };
    for (const c of d.cliente) {
      const donde = [c.donde, c.fecha].filter(Boolean).join(' ');
      if (!c.letra) { peor('a_confirmar'); lineas.push(`no se sabe que letra tiene el cliente${donde ? ` (${donde})` : ''}: lo zanja ${c.fuente || 'una fuente que falta nombrar'}`); continue; }
      const marca = c.inferida ? ' (inferida, no leida en el documento)' : '';
      if (!d.letra) {
        peor('a_confirmar');
        lineas.push(`el cliente tiene la ${c.letra}${marca}${donde ? ` (${donde})` : ''} y la letra vigente nuestra esta a confirmar`);
        continue;
      }
      if (c.letra !== d.letra) {
        peor('rojo');
        lineas.push(`el cliente tiene la ${c.letra}${marca}${donde ? ` (${donde})` : ''} y la vigente es la ${d.letra}`);
        continue;
      }
      const delCliente = atributos.filter((a) => a.documento === d.id && a.rol === 'cliente' && (!a.donde || !c.donde || a.donde === c.donde));
      const distintos = delCliente.map((a) => {
        const suyo = normalizar(a.atributo, a.texto, { unidad: a.unidad }).valor;
        const nuestros = atributos.filter((b) => b.documento === d.id && b.atributo === a.atributo && (b.rol || 'declara') === 'declara')
          .map((b) => normalizar(b.atributo, b.texto, { unidad: b.unidad }).valor).filter((v) => v !== null);
        return nuestros.length && suyo !== null && !nuestros.some((n) => igual(n, suyo)) ? `${a.atributo}: lo del cliente dice ${mostrar(suyo)} y lo vigente ${nuestros.map(mostrar).join(' / ')}` : null;
      }).filter(Boolean);
      if (distintos.length) { peor('rojo'); lineas.push(`misma letra ${c.letra}${donde ? ` (${donde})` : ''} pero distinto contenido: ${distintos.join('; ')}`); }
      else lineas.push(`el cliente tiene la misma letra ${c.letra}${marca}${donde ? ` (${donde})` : ''}`);
    }
    return { documento: d.id, letraVigente: d.letra ?? null, estado, cliente: d.cliente, detalle: lineas.join(' · '), vigente: docs.get(d.id)?.vigente !== false };
  });
}

/** Las dos mitades juntas, con el codigo de salida del comando (1 si hay algun rojo). */
export function resumenComparacion(ficha) {
  const atributos = compararAtributos(ficha);
  const cliente = compararCliente(ficha);
  const rojos = atributos.filter((r) => r.estado === 'rojo').length + cliente.filter((r) => r.estado === 'rojo').length;
  return { atributos, cliente, rojos, codigoSalida: rojos ? 1 : 0 };
}

// ---------------------------------------------------------------------------
// paso (c)
// ---------------------------------------------------------------------------

/**
 * Dado un cambio (un atributo como 'adhesivo' o 'espuma', o un codigo del arb), los documentos de la
 * pieza que lo nombran y el recordatorio del circuito de la casa. Solo LISTA: no edita nada.
 */
export function queTocaUnCambio(ficha, { atributo, codigo } = {}) {
  const docs = indiceDocumentos(ficha);
  const nombra = (a) => {
    if (atributo && (a.atributo === atributo || a.atributo.startsWith(`${atributo}.`))) return true;
    if (codigo) {
      // sin espacios ni guiones: el AMFE escribe «427-ESP-001-TRO-01» y el arb «427ESP001TRO01»
      const plano = (s) => String(s || '').toUpperCase().replace(/[\s-]+/g, '');
      const c = plano(codigo);
      return plano(a.codigo) === c || plano(a.texto).includes(c);
    }
    return false;
  };
  const ids = [...new Set((ficha.atributos || []).filter((a) => a.rol !== 'cliente' && a.rol !== 'referencia' && !a.cita && nombra(a)).map((a) => a.documento))];
  const documentos = ids.map((id) => {
    const d = docs.get(id) || { id };
    return { id, tipo: d.tipo, numero: d.numero, letra: d.letra ?? null, vigente: d.vigente !== false, donde: d.donde || null, maestro: d.maestro || null, cliente: d.cliente || [] };
  });
  const r = { cambio: atributo || codigo, documentos, recordatorio: CANON.ecr.recordatorio.join('\n'), queNombraElSgc: CANON.ecr.documentos_que_nombra_el_sgc, fuente: CANON.ecr.fuente };
  if (!documentos.length) r.aviso = `ningun documento de la ficha nombra «${atributo || codigo}»: o no se releva todavia o el nombre del atributo es otro`;
  return r;
}

// ---------------------------------------------------------------------------
// lo que llaman los emisores
// ---------------------------------------------------------------------------

/** "FLUJOGRAMA 154 - INSERT - Rev.D" -> { tipo, numero: '154', letra: 'D' }; null si no se lee. */
export function documentoDeNombre(tipo, nombre) {
  const m = /(\d{2,4})\b.*\bRev\.?\s*([A-Z]{1,2})\s*$/i.exec(String(nombre || ''));
  return m ? { tipo, numero: m[1], letra: m[2].toUpperCase() } : null;
}

/**
 * Agrega una emision al documento `tipo:numero` de la ficha y le pone la letra emitida. Devuelve una
 * ficha NUEVA (no toca la que recibe) o null si la ficha no tiene ese documento: el emisor dice
 * «sin ficha» y sigue (nunca frena una emision por esto).
 */
export function registrarDocumento(ficha, { tipo, numero, letra, fecha, emision }) {
  const id = `${tipo}:${numero}`;
  const nueva = structuredClone(ficha);
  const d = (nueva.documentos || []).find((x) => x.id === id);
  if (!d) return null;
  if (letra) d.letra = letra;
  if (fecha) d.fecha = fecha;
  if (emision) (d.emisiones ||= []).push({ letra: letra || d.letra, ...emision });
  return nueva;
}

// ---------------------------------------------------------------------------
// leer y guardar la ficha
// ---------------------------------------------------------------------------

export const rutaFicha = (clave, carpeta = CARPETA_FICHAS) => join(carpeta, `${clave}.json`);

export function leerFicha(clave, carpeta = CARPETA_FICHAS) {
  const ruta = rutaFicha(clave, carpeta);
  if (!existsSync(ruta)) throw new Error(`no hay ficha de «${clave}» en ${ruta}`);
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

/** Atomico: a un .tmp al lado y despues renombrar. Un corte a mitad nunca deja la ficha a medias. */
export function guardarFicha(clave, ficha, carpeta = CARPETA_FICHAS) {
  mkdirSync(carpeta, { recursive: true });
  const ruta = rutaFicha(clave, carpeta);
  const tmp = `${ruta}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(ficha, null, 2)}\n`, 'utf8');
  renameSync(tmp, ruta);
  return ruta;
}

export function listarFichas(carpeta = CARPETA_FICHAS) {
  return existsSync(carpeta) ? readdirSync(carpeta).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort() : [];
}

/** Las fichas que tienen el documento `tipo:numero` (un mismo flujograma puede ser de una sola pieza). */
export function fichasCon(tipo, numero, carpeta = CARPETA_FICHAS) {
  return listarFichas(carpeta).filter((clave) => (leerFicha(clave, carpeta).documentos || []).some((d) => d.id === `${tipo}:${numero}`));
}
