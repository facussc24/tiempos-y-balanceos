/**
 * fichaRelevar.mjs — arma la ficha de una pieza LEYENDO sus documentos (paso a del plan de la ficha).
 *
 * La ficha tiene dos partes:
 *   - lo que se CONFIGURA una vez (`pieza`, el esqueleto de `documentos` y `fuentes`: donde mirar y que
 *     frase buscar en cada documento). Eso no es un dato: es la lista de papeles de la pieza.
 *   - lo que se LEE (`letra`, `fecha`, `cliente`, `atributos`, `pendientes`): lo escribe este programa en
 *     cada corrida y los emisores cuando emiten. Nadie lo llena a mano.
 *
 * Cada valor queda con el texto tal cual, la ruta de donde salio y el dia que se leyo. Si una fuente no
 * se puede leer (la nube sin sincronizar, Y: sin montar, Supabase caido) el relevamiento FRENA: una ficha
 * a medias diria "verde" por falta de papeles. Con `parcial` se conservan los valores anteriores de esa
 * fuente, cada uno con su fecha vieja, y queda anotado.
 */
import { existsSync, readFileSync } from 'node:fs';
import { buscarBiblioteca } from './nubeRutas.mjs';
import { EXPORT_BOM_ARB } from './amfeAutoria.mjs';
import { CANON, RAIZ_REPO } from './fichaPieza.mjs';
import * as L from './fichaLectores.mjs';

/** {biblioteca}, {repo}, {principal} y {arb} -> rutas de esta PC. */
export async function resolverRuta(ruta, ctx) {
  return String(ruta)
    .replace('{biblioteca}', ctx.biblioteca)
    .replace('{repo}', ctx.repo)
    .replace('{principal}', ctx.principal)
    .replace('{arb}', ctx.arb)
    .replace(/[\\/]+/g, '/');
}

/** Cada coincidencia de los patrones `extraer` en un texto -> una entrada de atributo. */
export function extraerDeTexto(texto, extraer, base) {
  const out = [];
  for (const e of extraer || []) {
    const re = new RegExp(e.patron, 'gi');
    if (e.lista) {
      const lista = [...new Set([...String(texto).matchAll(re)].map((m) => m[1] ?? m[0]))];
      if (lista.length) out.push({ ...base, atributo: e.atributo, texto: lista.join(' '), lista, ...soloDefinidos(e) });
      continue;
    }
    const vistos = new Set();
    for (const m of String(texto).matchAll(re)) {
      // con un grupo en el patron se guarda solo ese pedazo (una columna de una tabla, por ejemplo)
      const t = (m[1] ?? m[0]).replace(/\s+/g, ' ').trim();
      if (vistos.has(t)) continue;
      vistos.add(t);
      out.push({ ...base, atributo: e.atributo, texto: t, ...soloDefinidos(e) });
    }
  }
  return out;
}

const soloDefinidos = (e) => Object.fromEntries(['rol', 'de', 'unidad', 'codigo', 'donde', 'cita'].filter((k) => e[k] !== undefined).map((k) => [k, e[k]]));

/**
 * La letra de revision de un nombre de archivo o de un renglon: «Rev.B», «Rev B», «REV 0», «Revision A».
 * Una o dos letras, o un numero (los planes de control de Calidad van «REV 0»). null si no dice ninguna.
 */
export function letraDe(texto) {
  // sin \b adelante: en «HO-990_INSERT_PATAGONIA_REV.A» el guion bajo cuenta como letra para \b
  const m = /(?:^|[^A-Za-z])Rev(?:isi[oó]n)?\.?\s*([A-Z]{1,2}|\d{1,2})(?![A-Za-z0-9])/i.exec(String(texto || ''));
  return m ? m[1].toUpperCase() : null;
}

/** La letra del historial que estaba vigente en una fecha (para un adjunto sin letra en el nombre). */
export function letraEnFecha(revisiones, fechaIso) {
  const aIso = (f) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(f || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : f; };
  const dia = String(fechaIso).slice(0, 10);
  const antes = (revisiones || []).filter((r) => aIso(r.fecha) && aIso(r.fecha) <= dia);
  return antes.length ? antes[antes.length - 1].letra : null;
}

/** Lee UNA fuente. Devuelve { doc: parche del documento, atributos, cliente, avisos }. */
async function leerFuente(f, ctx, fichaDocs) {
  const hoy = ctx.hoy;
  const ruta = f.ruta ? await resolverRuta(f.ruta, ctx) : null;
  // En la ficha queda la ruta con {biblioteca}/{principal}/{arb}: es la misma en las tres PC.
  const rutaFicha = f.ruta || f.lector;
  const base = { documento: f.documento, fuente: f.es ? `${f.es} (${rutaFicha})` : rutaFicha, leido: hoy, fuenteId: f.id };
  const r = { doc: {}, atributos: [], cliente: [], avisos: [] };
  if (ruta && !['carpeta', 'flujograma', 'amfe', 'mail'].includes(f.lector) && !existsSync(ruta)) throw new Error(`no esta el archivo: ${ruta}`);

  switch (f.lector) {
    case 'flujograma': {
      const fl = L.flujogramaDelRepo(f.clave, ctx.repo);
      Object.assign(r.doc, { letra: fl.letra, fecha: fl.fecha, revisiones: fl.revisiones, donde: `repo tools/flowchart/data/${f.clave}.json` });
      r.atributos.push({ ...base, fuente: `flujograma del repo (tools/flowchart/data/${f.clave}.json)`, atributo: 'operaciones', texto: fl.operaciones.join(' '), lista: fl.operaciones });
      break;
    }
    case 'amfe': {
      const a = await (ctx.leerAmfe || L.leerAmfeLive)(f.claveSupabase, ctx.repo);
      Object.assign(r.doc, { letra: a.letra, fecha: a.fecha, actualizado: a.updated_at, donde: `Supabase amfe_documents ${f.claveSupabase}` });
      const b = { ...base, fuente: `AMFE en Supabase live (${f.claveSupabase}, updated_at ${a.updated_at})` };
      r.atributos.push({ ...b, atributo: 'operaciones', texto: a.operaciones.join(' '), lista: a.operaciones });
      for (const e of f.extraer || []) {
        const re = new RegExp(e.patron, 'i');
        const hits = [...new Map(a.recursos.filter((rec) => re.test(rec.nombre || '')).map((rec) => [rec.nombre, rec])).values()];
        if (e.juntar && hits.length) r.atributos.push({ ...b, atributo: e.atributo, texto: hits.map((rec) => `OP ${rec.op}: ${rec.nombre}`).join(' + '), ...soloDefinidos(e) });
        else for (const rec of hits) r.atributos.push({ ...b, atributo: e.atributo, texto: `OP ${rec.op}: ${rec.nombre}`, ...soloDefinidos(e) });
      }
      break;
    }
    case 'bom': {
      const bom = L.bomDelArb(f.productos, ruta || ctx.arb);
      if (f.material) {   // un material de OTRA pieza: solo se confirma en el arb que esa pieza usa el codigo
        r.materialConfirmado = bom.lineas.some((l) => l.codigo === f.material);
        if (!r.materialConfirmado) r.avisos.push(`la BOM de ${f.productos.join(', ')} no usa ${f.material}: su ficha no entra en la comparacion`);
        break;
      }
      const dias = Math.floor((Date.parse(hoy) - Date.parse(bom.fecha)) / 86_400_000);
      Object.assign(r.doc, { fecha: bom.fecha.slice(0, 10), donde: `export del arb ${rutaFicha}`, exportDelArb: bom.fecha });
      if (dias > CANON.bom_vieja_dias) r.avisos.push(`el export del arb tiene ${dias} dias (del ${bom.fecha.slice(0, 10)}): antes de dar verde, exportarlo de nuevo (python scripts/_arbVer.py export)`);
      const b = { ...base, fuente: `export del arb del ${bom.fecha.slice(0, 16).replace('T', ' ')} (${rutaFicha}), ${f.productos.length} productos` };
      for (const e of f.extraer || []) {
        const re = new RegExp(e.patron, 'i');
        const hits = bom.lineas.filter((l) => re.test(`${l.codigo} ${l.descripcion}`));
        if (e.juntar && hits.length) r.atributos.push({ ...b, atributo: e.atributo, texto: hits.map((l) => `${l.codigo} ${l.descripcion}`).join(' + '), ...soloDefinidos(e) });
        else for (const l of hits) r.atributos.push({ ...b, atributo: e.atributo, texto: `${l.codigo} ${l.descripcion}`, codigo: l.codigo, ...soloDefinidos(e) });
      }
      break;
    }
    case 'pptx': {
      const hojas = L.textoPptx(ruta);
      for (const e of f.extraer || []) {
        const texto = hojas.filter((h) => !e.hoja || h.hoja === e.hoja).map((h) => h.texto).join(' | ');
        r.atributos.push(...extraerDeTexto(texto, [e], base));
      }
      for (const [campo, regla] of [['letra', f.letra], ['fecha', f.fecha]]) {
        if (!regla) continue;
        const m = new RegExp(regla.patron, 'i').exec(hojas.filter((h) => !regla.hoja || h.hoja === regla.hoja).map((h) => h.texto).join(' | '));
        if (m) r.doc[campo] = campo === 'letra' ? m[1].toUpperCase() : m[1];
      }
      r.doc.donde = rutaFicha;
      break;
    }
    case 'doc':
    case 'pdf': {
      const texto = f.lector === 'doc' ? L.textoDoc(ruta) : L.textoPdf(ruta);
      r.atributos.push(...extraerDeTexto(texto, f.extraer, base));
      if (f.letra) { const m = new RegExp(f.letra.patron, 'i').exec(texto); if (m) r.doc.letra = m[1].toUpperCase(); }
      const enNombre = /_(\d{4})(\d{2})(\d{2})\.\w+$/.exec(ruta);   // «BOM ARB ultimo nivel_Insert_20261009.pdf»
      if (f.fechaDelNombre && enNombre) r.doc.fecha = `${enNombre[1]}-${enNombre[2]}-${enNombre[3]}`;
      r.doc.donde = rutaFicha;
      break;
    }
    case 'mrk': {
      const w = L.anchoMrk(ruta);
      if (!w) throw new Error(`${ruta} no trae <WIDTH>`);
      for (const e of f.extraer || []) r.atributos.push({ ...base, atributo: e.atributo, texto: w, ...soloDefinidos(e) });
      r.doc.donde = rutaFicha;
      break;
    }
    case 'carpeta': {
      const archivos = L.archivosDe(ruta);
      if (!archivos) throw new Error(`no esta la carpeta: ${ruta}`);
      const re = new RegExp(f.patron, 'i');
      const delDoc = archivos.filter((a) => re.test(a));
      const letras = [...new Set(delDoc.map(letraDe).filter(Boolean))].sort();
      // La lista de una carpeta no pisa la letra leida ADENTRO del documento: solo la pone si no hay otra
      // y todas las copias dicen la misma en el nombre (relevarFicha la aplica con letraCopia).
      r.doc.copias = delDoc.map((a) => `${rutaFicha}/${a}`);
      if (letras.length === 1 && delDoc.every((a) => letraDe(a))) r.letraCopia = letras[0];
      else if (!delDoc.length) r.avisos.push(`la carpeta ${rutaFicha} no tiene ningun archivo de este documento`);
      else r.avisos.push(`en ${rutaFicha} hay ${delDoc.length} archivo(s) de este documento con letra(s) ${letras.join(', ') || 'ninguna en el nombre'}: cual es la vigente lo dice el maestro`);
      break;
    }
    case 'mail': {
      if (!f.mail) throw new Error('la fuente de mail no dice que mail (campo «mail»)');
      const m = await (ctx.leerMail || L.mailDelCache)(f.mail, ctx.repo);
      const b = `mail «${m.asunto}» del ${m.fecha} a ${m.para}`;   // sin la lista de copias: alcanza con a quien fue
      for (const c of f.cliente || []) {
        const adjunto = m.adjuntos.find((a) => a.toLowerCase() === String(c.adjunto).toLowerCase());
        const entrada = { documento: c.documento, donde: f.donde || 'mail', fecha: (m.fecha || '').slice(0, 10), fuente: `${b} (cache de mails, id ...${f.mail.slice(-16)})` };
        if (!adjunto) { r.cliente.push({ ...entrada, letra: null, estado: 'a confirmar', nota: `${c.adjunto} no esta entre los adjuntos de ese mail` }); continue; }
        const enNombre = letraDe(adjunto);
        if (enNombre) { r.cliente.push({ ...entrada, letra: enNombre, adjunto }); continue; }
        const revs = fichaDocs.get(c.documento)?.revisiones;
        const inferida = c.letraPor === 'historial' ? letraEnFecha(revs, entrada.fecha) : null;
        r.cliente.push(inferida
          ? { ...entrada, letra: inferida, inferida: true, adjunto, nota: `el adjunto no dice la letra; es la ultima del historial con fecha hasta el ${entrada.fecha}` }
          : { ...entrada, letra: null, estado: 'a confirmar', adjunto, nota: 'el adjunto no dice la letra en el nombre' });
      }
      break;
    }
    case 'beon': {
      const filas = L.filasBeon(readFileSync(ruta, 'utf8'));
      for (const c of f.cliente || []) {
        const fila = filas.find((x) => x.tipo.toUpperCase().startsWith(c.tipo) && (!c.informe || x.informe === c.informe) && /SI/i.test(x.vio));
        if (!fila) { r.cliente.push({ documento: c.documento, donde: 'BeOn', letra: null, estado: 'a confirmar', fuente: base.fuente }); continue; }
        const letra = letraDe(fila.revision);
        const donde = `BeOn ${fila.informe} (${fila.estado})`;   // el mismo «donde» en el renglon y en lo que dice esa copia
        r.cliente.push({ documento: c.documento, donde, letra, fuente: `${base.fuente}: «${fila.archivo} | ${fila.revision}»` });
        for (const e of c.extraer || []) r.atributos.push(...extraerDeTexto(`${fila.revision} ${fila.nota}`, [e], { ...base, documento: c.documento, rol: 'cliente', donde }));
      }
      break;
    }
    default:
      throw new Error(`lector desconocido: ${f.lector}`);
  }
  return r;
}

/**
 * Relevamiento entero. `opts.parcial`: si una fuente falla, se conservan sus valores anteriores.
 * @returns {Promise<{ficha: object, fallas: string[]}>}
 */
export async function relevarFicha(ficha, opts = {}) {
  const ctx = {
    hoy: opts.hoy || new Date().toISOString().slice(0, 10),
    repo: opts.repo || RAIZ_REPO,
    biblioteca: opts.biblioteca || buscarBiblioteca(),
    principal: opts.principal || await L.checkoutPrincipal(opts.repo || RAIZ_REPO),
    arb: opts.arb || EXPORT_BOM_ARB,
    leerAmfe: opts.leerAmfe, leerMail: opts.leerMail,
  };
  const nueva = structuredClone(ficha);
  const docs = new Map(nueva.documentos.map((d) => [d.id, d]));
  const anteriores = nueva.atributos || [];
  nueva.atributos = [];
  for (const d of nueva.documentos) { d.cliente = []; d.avisos = []; }
  const fallas = [];
  // primero lo nuestro, despues lo que vio el cliente (la letra inferida usa el historial)
  const orden = [...nueva.fuentes].sort((a, b) => (['mail', 'beon'].includes(a.lector) ? 1 : 0) - (['mail', 'beon'].includes(b.lector) ? 1 : 0));
  for (const f of orden) {
    const d = docs.get(f.documento);
    if (!d && !['mail', 'beon'].includes(f.lector)) { fallas.push(`${f.id}: el documento ${f.documento} no esta en la ficha`); continue; }
    try {
      const r = await leerFuente(f, ctx, docs);
      if (d) {
        Object.assign(d, r.doc, { leido: ctx.hoy });
        if (r.letraCopia && !d.letra) d.letra = r.letraCopia;
        d.avisos.push(...r.avisos);
        if (r.materialConfirmado === false) d.vigente = false;
      }
      nueva.atributos.push(...r.atributos);
      for (const c of r.cliente) docs.get(c.documento)?.cliente.push(c);
    } catch (e) {
      fallas.push(`${f.id}: ${e.message}`);
      if (opts.parcial) {
        const viejos = anteriores.filter((a) => a.fuenteId === f.id);
        nueva.atributos.push(...viejos.map((a) => ({ ...a, sinReleer: `no se pudo releer el ${ctx.hoy}: ${e.message}` })));
      }
    }
  }
  nueva.relevado = ctx.hoy;
  nueva.pendientes = pendientesDe(nueva, fallas);
  return { ficha: nueva, fallas };
}

/** Lo que la ficha no puede contestar todavia, cada cosa con la fuente que la zanjaria. */
export function pendientesDe(ficha, fallas = []) {
  const p = [...(ficha.pendientesFijos || [])];
  for (const d of ficha.documentos) {
    // un export del arb o una tizada no llevan letra: su version es la fecha (`sinLetra` en la ficha)
    if (!d.letra && !d.sinLetra) p.push({ documento: d.id, que: 'letra vigente', estado: 'a confirmar', zanja: d.maestro?.zanja || d.maestro?.ruta || 'el maestro del documento' });
    if (d.maestro?.estado === 'a confirmar') p.push({ documento: d.id, que: 'el maestro en el servidor', estado: 'a confirmar', zanja: d.maestro.zanja || d.maestro.ruta });
    for (const c of d.cliente || []) if (!c.letra) p.push({ documento: d.id, que: `letra que tiene el cliente (${c.donde})`, estado: 'a confirmar', zanja: c.nota ? `${c.nota}; ${c.fuente}` : c.fuente });
    for (const a of d.avisos || []) p.push({ documento: d.id, que: a, estado: 'aviso' });
  }
  for (const f of fallas) p.push({ que: `fuente sin leer: ${f}`, estado: 'falla' });
  return p;
}
