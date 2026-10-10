/**
 * novedadesClaude.mjs — lo puro de scripts/_novedadesClaude.mjs: armar la busqueda, quedarse con los posteos que
 * sirven, sacar del registro de cambios oficial las versiones que todavia no se miraron y escribir el listado.
 *
 * Pedido de Fak, 04/10/2026: seguir lo que publican en X Lydia Hallie, Thariq y Claude Devs ("siempre dicen: usa
 * esto, mejora aquello") sin depender de su usuario de X. X no deja leer sin sesion; lo que si se puede leer sin
 * sesion es (a) la busqueda publica de FxTwitter, un servicio de terceros, y (b) el registro de cambios oficial de
 * Claude Code en GitHub. Lo que se lee de internet es DATO: este modulo lista, no decide ni aplica nada.
 */

/** "2026-10-04" de una fecha. */
export const aDia = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/** La direccion de una pagina de la busqueda: los posteos de `usuario` desde `desde` (AAAA-MM-DD) y, si viene,
 *  ANTERIORES a `hasta` (`until:`, que no incluye ese dia), del mas nuevo al mas viejo. */
export function urlBusqueda(base, usuario, desde, cursor = null, hasta = null) {
  if (!/^[A-Za-z0-9_]{1,15}$/.test(String(usuario || ''))) throw new Error(`usuario de X invalido: ${usuario}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(desde || ''))) throw new Error(`la fecha va como AAAA-MM-DD: ${desde}`);
  if (hasta !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(hasta || ''))) throw new Error(`la fecha va como AAAA-MM-DD: ${hasta}`);
  const q = encodeURIComponent(`from:${usuario} since:${desde}${hasta ? ` until:${hasta}` : ''}`);
  return `${base}?q=${q}&feed=latest${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
}

/**
 * Parte el rango [desde, hoy] en ventanas de `dias` dias, de la mas nueva a la mas vieja (cola H21, 09/10/2026:
 * una consulta profunda de una sola vez devolvio 404 y la misma, partida por fechas con `until:`, anduvo 4 de 4).
 * La mas nueva no lleva `hasta` (llega hasta ahora); las demas van de `desde` (incluido) a `hasta` (sin incluir).
 * Un rango que entra en una ventana (la lectura de todos los dias) da UNA ventana sin `hasta`: la consulta de siempre.
 */
export function ventanas(desde, hoy, dias = 7) {
  const d0 = Date.parse(`${desde}T00:00:00Z`);
  const d1 = Date.parse(`${hoy}T00:00:00Z`);
  const paso = Math.max(1, Math.floor(Number(dias) || 7));
  if (!Number.isFinite(d0) || !Number.isFinite(d1)) throw new Error(`la fecha va como AAAA-MM-DD: ${desde} / ${hoy}`);
  const out = [];
  let fin = null;                                   // null = hasta ahora
  let ini = Math.max(d0, d1 - (paso - 1) * 86400000);
  for (;;) {
    out.push({ desde: aDia(new Date(ini)), hasta: fin === null ? null : aDia(new Date(fin)) });
    if (ini <= d0) break;
    fin = ini;
    ini = Math.max(d0, ini - paso * 86400000);
  }
  return out;
}

/**
 * Lee TODO lo de una cuenta desde `desde`, ventana por ventana y pagina por pagina. `traer(url)` se inyecta (en el
 * programa es el fetch; en el test, respuestas guardadas) y devuelve lo que contesta la busqueda.
 * Devuelve { todos, tope, parcial, error }:
 *   - `tope`: alguna ventana llego al tope de paginas y quedaba mas;
 *   - `parcial` + `error`: una pagina fallo DESPUES de haber leido algo. Lo leido no se tira (hasta el 09/10 una
 *     pagina caida perdia las anteriores: R2 #25); la cuenta queda sin avanzar, como con el tope.
 * Si falla la primera pagina de la primera ventana no hay nada que guardar: levanta, y la cuenta sale con error.
 * Un mismo posteo que cae en dos ventanas (el borde de un dia) entra una sola vez.
 */
export async function leerCuenta({ traer, base, usuario, desde, hoy, paginasMaximo = 8, ventanaDias = 7, ventanasMaximo = 10, esperar = async () => {} }) {
  const todos = [];
  const vistos = new Set();
  let tope = false;
  let paginasLeidas = 0;
  // un rango descomunal (--desde 2006-01-01 son mas de mil ventanas) no se lee entero: las `ventanasMaximo` mas
  // nuevas, y se avisa como tope (auditor R6: el programa no tiene reloj propio y la noche le da 10 minutos)
  const todas = ventanas(desde, hoy, ventanaDias);
  if (todas.length > ventanasMaximo) tope = true;
  for (const v of todas.slice(0, ventanasMaximo)) {
    let cursor = null;
    let termino = false;
    for (let p = 0; p < paginasMaximo; p++) {
      let j;
      try {
        j = await traer(urlBusqueda(base, usuario, v.desde, cursor, v.hasta));
        if (!j || j.code !== 200 || !Array.isArray(j.results)) throw new Error(`la busqueda no devolvio una lista (codigo ${j && j.code})`);
      } catch (e) {
        const error = String(e && e.message ? e.message : e);
        if (!paginasLeidas) throw new Error(error);
        return { todos, tope, parcial: true, error: `${error} (ventana desde ${v.desde}${v.hasta ? ` hasta ${v.hasta}` : ''}, pagina ${p + 1})` };
      }
      paginasLeidas++;
      for (const r of j.results) {
        const k = r && r.id ? String(r.id) : null;
        if (k && vistos.has(k)) continue;
        if (k) vistos.add(k);
        todos.push(r);
      }
      const sig = j.cursor && j.cursor.bottom;
      if (!j.results.length || !sig || sig === cursor) { termino = true; break; }
      cursor = sig;
      await esperar(400);
    }
    if (!termino) tope = true;
    await esperar(400);
  }
  return { todos, tope, parcial: false, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Los links de cada posteo (cola H20). Fak, 08/10/2026 20:43: "los links que pasa Claude Devs"
// ─────────────────────────────────────────────────────────────────────────────
// Un posteo de anuncio casi nunca trae la novedad: trae el link al articulo. El link real viene en
// `raw_text.facets` (tipo url, campo `replacement`; el texto solo trae el t.co acortado).

const sinFragmento = (u) => String(u).replace(/#.*$/, '');

/** Los links de un posteo, sin repetir y sin los que vuelven a X. Cada uno: la direccion real, sin `#…`. */
export function linksDe(resultado) {
  const out = [];
  const facetas = (resultado && resultado.raw_text && Array.isArray(resultado.raw_text.facets)) ? resultado.raw_text.facets : [];
  const candidatos = facetas.filter((f) => f && f.type === 'url').map((f) => f.replacement || f.original);
  if (resultado && resultado.card && resultado.card.url) candidatos.push(resultado.card.url);
  for (const c of candidatos) {
    let u;
    try { u = new URL(String(c)); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (/^(x\.com|twitter\.com|t\.co|pic\.x\.com|pic\.twitter\.com)$/.test(host)) continue;
    const limpio = sinFragmento(u.href);
    if (!out.includes(limpio)) out.push(limpio);
  }
  return out;
}

/** ¿El link es de un dominio que se sigue? `dominios`: la lista del canon; vale el dominio y sus subdominios.
 *  Lo que publica una cuenta es DATO de internet: no se abre cualquier direccion que aparezca en un posteo. */
export function seSigue(url, dominios = []) {
  let host;
  try { const u = new URL(String(url)); if (u.protocol !== 'https:') return false; host = u.hostname.toLowerCase().replace(/^www\./, ''); } catch { return false; }
  return (Array.isArray(dominios) ? dominios : []).some((d) => { const x = String(d).toLowerCase(); return host === x || host.endsWith(`.${x}`); });
}

/** Huella corta y estable de un texto (FNV-1a de 32 bits, en hexadecimal): para que dos direcciones distintas no
 *  caigan en el mismo archivo. */
function huella(texto) {
  let h = 0x811c9dc5;
  for (const c of Buffer.from(String(texto), 'utf8')) { h ^= c; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** El nombre del archivo donde se guarda un articulo: dominio y ruta (solo letras, numeros y guiones, hasta 110) y
 *  la huella de la direccion entera. Sin la huella, `/blog/a-b` y `/blog/a/b` daban el mismo nombre y la segunda
 *  salia como "ya estaba" con el titulo de la primera (auditor T3). */
export function nombreArticulo(url) {
  const u = new URL(String(url));
  const base = `${u.hostname.replace(/^www\./, '')}${u.pathname}${u.search}`.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${(base || 'articulo').slice(0, 110).replace(/-+$/, '')}-${huella(u.href)}.md`;
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
const sinEntidades = (t) => String(t)
  .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ' '; } })
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ' '; } })
  .replace(/&([a-z]+);/gi, (m, n) => (Object.prototype.hasOwnProperty.call(ENTIDADES, n.toLowerCase()) ? ENTIDADES[n.toLowerCase()] : m));

/**
 * Saca del HTML cada bloque `<etiqueta …>…</etiqueta>` de la lista. Recorre el texto una sola vez con indexOf: una
 * expresion regular con `[\s\S]*?` sobre aperturas sin cierre es cuadratica (auditor R3: minutos con 2 MB armados a
 * proposito). Una apertura sin su cierre se lleva todo hasta el final (un `<script>` cortado no es texto para leer).
 */
function sinBloques(html, etiquetas) {
  const bajo = html.toLowerCase();
  const out = [];
  let i = 0;
  while (i < html.length) {
    let ini = -1; let etiqueta = null;
    for (const e of etiquetas) {
      let k = bajo.indexOf(`<${e}`, i);
      // `<nav` no es `<navigation-x`: detras de la etiqueta viene un espacio, `>` o `/`
      while (k >= 0 && !/[\s>/]/.test(bajo[k + e.length + 1] || '>')) k = bajo.indexOf(`<${e}`, k + 1);
      if (k >= 0 && (ini < 0 || k < ini)) { ini = k; etiqueta = e; }
    }
    if (ini < 0) { out.push(html.slice(i)); break; }
    out.push(html.slice(i, ini), ' ');
    const fin = bajo.indexOf(`</${etiqueta}`, ini);
    if (fin < 0) break;
    const cierra = bajo.indexOf('>', fin);
    i = cierra < 0 ? html.length : cierra + 1;
  }
  return out.join('');
}

/** Lo que hay entre la PRIMERA apertura de `<etiqueta` y su ULTIMO cierre (un `<article>` adentro de otro no corta
 *  el texto en el primer cierre: auditor R9), o null si no esta. */
function contenidoDe(html, etiqueta) {
  const bajo = html.toLowerCase();
  let a = bajo.indexOf(`<${etiqueta}`);
  while (a >= 0 && !/[\s>]/.test(bajo[a + etiqueta.length + 1] || '')) a = bajo.indexOf(`<${etiqueta}`, a + 1);
  if (a < 0) return null;
  const abre = bajo.indexOf('>', a);
  const b = bajo.lastIndexOf(`</${etiqueta}`);
  if (abre < 0 || b <= abre) return null;
  return html.slice(abre + 1, b);
}

const SALTO = new Set(['br', '/p', '/div', '/h1', '/h2', '/h3', '/h4', '/h5', '/h6', '/li', '/tr', '/section', '/pre', '/blockquote']);
/** Saca las etiquetas y los comentarios en UNA pasada (indexOf, sin expresiones que retrocedan): un cierre de
 *  parrafo o de titulo deja un salto de renglon, `<li>` un guion y `<h1..6>` un `## `. Una etiqueta sin cerrar corta ahi. */
function sinEtiquetas(t) {
  const out = [];
  let i = 0;
  for (;;) {
    const a = t.indexOf('<', i);
    if (a < 0) { out.push(t.slice(i)); break; }
    out.push(t.slice(i, a));
    if (t.startsWith('<!--', a)) { const f = t.indexOf('-->', a + 4); if (f < 0) break; out.push(' '); i = f + 3; continue; }
    const b = t.indexOf('>', a);
    if (b < 0) break;
    const nombre = (/^\/?[a-z0-9]+/.exec(t.slice(a + 1, Math.min(b, a + 16)).toLowerCase()) || [''])[0];
    out.push(SALTO.has(nombre) ? '\n' : nombre === 'li' ? '- ' : /^h[1-6]$/.test(nombre) ? '\n## ' : ' ');
    i = b + 1;
  }
  return out.join('');
}

const HTML_MAXIMO = 1500000;     // caracteres de HTML que se miran: una pagina de articulo real pesa 100 a 500 mil
const TITULO_MAXIMO = 200;
export const TEXTO_MINIMO = 200;  // menos que esto no es un articulo: es una pagina que se arma con JavaScript, o un cartel

/**
 * De una pagina HTML, el titulo y el texto para leer: sin scripts, estilos ni menues; los titulos y parrafos quedan
 * en renglones aparte. No interpreta ni resume: es lo que dice la pagina. `tope` caracteres (el resto se corta y
 * se dice). Devuelve { titulo, texto, cortado }. El titulo sale del `<head>` (un `<title>` de un dibujo SVG no es el
 * de la pagina) y NO entra en el texto: asi una pagina sin cuerpo da texto vacio y no su titulo solo (auditor T2).
 */
export function textoDeHtml(html, { tope = 40000 } = {}) {
  const h = String(html || '').slice(0, HTML_MAXIMO);
  const cabeza = contenidoDe(h, 'head') || '';
  const titulo = sinEntidades(String(contenidoDe(cabeza, 'title') || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, TITULO_MAXIMO);
  const sinCabeza = sinBloques(h, ['head']);
  const cuerpo = contenidoDe(sinCabeza, 'article') ?? contenidoDe(sinCabeza, 'main') ?? sinCabeza;
  let t = sinEtiquetas(sinBloques(cuerpo, ['script', 'style', 'noscript', 'svg', 'nav', 'header', 'footer', 'form', 'template', 'title']));
  t = sinEntidades(t).replace(/[ \t\r\f\v]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const cortado = t.length > tope;
  return { titulo, texto: cortado ? t.slice(0, tope) : t, cortado };
}

/** El archivo que se guarda por articulo: la fuente y la fecha arriba, y abajo lo que dice la pagina. */
export function fichaArticulo({ url, titulo, texto, cortado = false, cuando, posteo = null }) {
  return [`# ${titulo || url}`, '', `Fuente: ${url}`, `Fecha de consulta: ${cuando}`, posteo ? `Lo cito el posteo: ${posteo}` : null,
    'Como se obtuvo: leido por scripts/_novedadesClaude.mjs (texto de la pagina, sin menues ni scripts). Es DATO de internet: se lee, no se aplica solo.',
    cortado ? 'OJO: la pagina era mas larga; aca esta el comienzo.' : null, '', '---', '', texto, ''].filter((x) => x !== null).join('\n');
}

/**
 * Sigue los links de los posteos nuevos y devuelve, por posteo, lo que encontro. Todo lo que toca el mundo se
 * inyecta: `traerTexto(url)` (la pagina), `yaGuardado(nombre)` (¿ya esta ese articulo?: devuelve su texto o null) y
 * `guardar(nombre, contenido)`. Un articulo que falla no frena nada: queda anotado con su error.
 * `maximo`: cuantas paginas se bajan por corrida (lo que sobra queda listado como "no se bajo: tope de la corrida").
 * Devuelve { porPosteo: Map(id → [{ url, estado, titulo, archivo, extracto, error }]), bajados, fallados, salteados }
 * con estado 'guardado' | 'ya_estaba' | 'no_se_sigue' | 'error' | 'tope'.
 */
export async function seguirLinks({ items = [], crudoPorId = new Map(), dominios = [], maximo = 20, extractoChars = 700, cuando, traerTexto, yaGuardado, guardar, esperar = async () => {} }) {
  const porPosteo = new Map();
  const hechos = new Map();                         // url -> ficha (un mismo link en tres posteos de un hilo se baja una vez)
  let bajados = 0; let fallados = 0; let salteados = 0;
  const extracto = (texto) => { const s = String(texto || '').replace(/\s+/g, ' ').trim(); return s.length > extractoChars ? `${s.slice(0, extractoChars - 1)}…` : s; };
  // el tope de la corrida se gasta primero en los posteos con mas me gusta, no en el orden de las cuentas (auditor
  // R1: con los posteos reales del 04/10 los 6 links que quedaban afuera eran todos de la cuenta de anuncios)
  const orden = [...items].sort((a, b) => (Number(b.me_gusta) || 0) - (Number(a.me_gusta) || 0));
  for (const it of orden) {
    const links = linksDe(crudoPorId.get(String(it.id)));
    if (!links.length) continue;
    const fichas = [];
    for (const url of links) {
      if (hechos.has(url)) { fichas.push(hechos.get(url)); continue; }
      let ficha;
      if (!seSigue(url, dominios)) { ficha = { url, estado: 'no_se_sigue' }; salteados++; }
      else {
        const archivo = nombreArticulo(url);
        const previo = yaGuardado(archivo);
        if (previo) {
          const cuerpo = String(previo).split(/\n---\n/).slice(1).join('\n---\n');
          ficha = { url, estado: 'ya_estaba', archivo, titulo: (/^# (.*)$/m.exec(previo) || [null, ''])[1], extracto: extracto(cuerpo),
            leido: (/^Fecha de consulta: (\S+)/m.exec(previo) || [null, ''])[1].slice(0, 10) };
        } else if (bajados + fallados >= maximo) { ficha = { url, estado: 'tope' }; salteados++; }
        else {
          try {
            // `traerTexto` devuelve el HTML, o { html, urlFinal } si siguio una redireccion: el destino tambien tiene
            // que ser de la lista (auditor T1: anthropic.com/discord terminaba en discord.com con la Fuente de anthropic)
            const r = await traerTexto(url);
            const html = r && typeof r === 'object' ? r.html : r;
            const urlFinal = r && typeof r === 'object' && r.urlFinal ? String(r.urlFinal) : url;
            if (urlFinal !== url && !seSigue(urlFinal, dominios)) throw new Error(`redirige a un dominio que no esta en la lista (${urlFinal.slice(0, 80)})`);
            const { titulo, texto, cortado } = textoDeHtml(html);
            if (texto.length < TEXTO_MINIMO) throw new Error(`la pagina no trajo texto para leer (${texto.length} caracteres; puede armarse con JavaScript)`);
            guardar(archivo, fichaArticulo({ url: urlFinal, titulo, texto, cortado, cuando, posteo: it.url }));
            ficha = { url, estado: 'guardado', archivo, titulo, extracto: extracto(texto) };
            bajados++;
          } catch (e) { ficha = { url, estado: 'error', error: String(e && e.message ? e.message : e).slice(0, 160) }; fallados++; }
          await esperar(300);
        }
      }
      hechos.set(url, ficha);
      fichas.push(ficha);
    }
    porPosteo.set(String(it.id), fichas);
  }
  return { porPosteo, bajados, fallados, salteados };
}

/** ¿El id `a` es mas nuevo que `b`? (los ids de X no entran en un numero comun) */
export function idMasNuevo(a, b) {
  try { return BigInt(String(a)) > BigInt(String(b)); } catch { return String(a) > String(b); }
}

/**
 * De lo que devuelve la busqueda, lo que sirve de UNA cuenta: sus posteos, sus hilos (se contesta a si misma) y las
 * respuestas a otros que juntaron `minRespuesta` me gusta o mas. Afuera: lo de otro autor (la busqueda a veces lo
 * trae), lo ya visto (`ultimoId`) y las respuestas sueltas.
 */
export function filtrar(resultados, usuario, { minRespuesta = 50, ultimoId = null } = {}) {
  const yo = String(usuario).toLowerCase();
  const fuera = { otro_autor: 0, ya_visto: 0, respuesta_suelta: 0, sin_forma: 0 };
  const items = [];
  for (const r of Array.isArray(resultados) ? resultados : []) {
    if (!r || r.type !== 'status' || !r.id || !r.author) { fuera.sin_forma++; continue; }
    if (String(r.author.screen_name || '').toLowerCase() !== yo) { fuera.otro_autor++; continue; }
    if (ultimoId && !idMasNuevo(r.id, ultimoId)) { fuera.ya_visto++; continue; }
    const aQuien = r.replying_to && r.replying_to.screen_name ? String(r.replying_to.screen_name) : null;
    const tipo = !aQuien ? 'posteo' : (aQuien.toLowerCase() === yo ? 'hilo' : 'respuesta');
    const meGusta = Number.isFinite(r.likes) ? r.likes : 0;
    if (tipo === 'respuesta' && meGusta < minRespuesta) { fuera.respuesta_suelta++; continue; }
    const medios = [...new Set(((r.media && r.media.all) || []).map((m) => m && m.type).filter(Boolean))];
    items.push({
      id: String(r.id),
      url: r.url || `https://x.com/${usuario}/status/${r.id}`,
      fecha: Number.isFinite(r.created_timestamp) ? new Date(r.created_timestamp * 1000).toISOString() : null,
      tipo,
      a_quien: tipo === 'respuesta' ? aQuien : null,
      me_gusta: meGusta,
      texto: String(r.text || '').trim(),
      cita: r.quote && r.quote.author ? { autor: String(r.quote.author.screen_name || ''), url: r.quote.url || null, texto: String(r.quote.text || '').trim() } : null,
      medios,
      largo: !!r.is_note_tweet,
    });
  }
  items.sort((a, b) => (idMasNuevo(a.id, b.id) ? -1 : 1));
  return { items, fuera };
}

/** -1, 0, 1: compara "2.1.289" con "2.1.283" numero por numero. */
export function compararVersion(a, b) {
  const pa = String(a).split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Las versiones del registro de cambios que son mas nuevas que `ultimaVista` (o las `primeraVez` mas nuevas si nunca
 * se miro). Cada una: { version, cambios: [renglon, ...] }, de la mas nueva a la mas vieja.
 */
export function versionesNuevas(texto, ultimaVista = null, { primeraVez = 6 } = {}) {
  const versiones = [];
  let actual = null;
  for (const linea of String(texto || '').split(/\r?\n/)) {
    const m = /^##\s+v?(\d+\.\d+\.\d+)\s*$/.exec(linea);
    if (m) { actual = { version: m[1], cambios: [] }; versiones.push(actual); continue; }
    if (actual && /^\s*[-*]\s+\S/.test(linea)) actual.cambios.push(linea.replace(/^\s*[-*]\s+/, '').trim());
  }
  versiones.sort((a, b) => compararVersion(b.version, a.version));
  if (!ultimaVista) return versiones.slice(0, primeraVez);
  return versiones.filter((v) => compararVersion(v.version, ultimaVista) > 0);
}

/**
 * El renglon para el arranque de sesion: avisa si paso una semana (o `dias`) desde la ultima lectura, o si nunca se leyo.
 * '' si no toca. Fak, 04/10/2026: que corra solo en SU PC los lunes; que se implementa lo decide el.
 */
export function avisoHook(estado, ahora = new Date(), dias = 7) {
  const ultima = estado && estado.ultima_corrida ? Date.parse(estado.ultima_corrida) : NaN;
  const pasaron = Number.isFinite(ultima) ? Math.floor((ahora.getTime() - ultima) / 86400000) : null;
  if (pasaron !== null && pasaron < dias) return '';
  const cuanto = pasaron === null ? 'Todavia no se leyo nunca' : `Pasaron ${pasaron} dias desde la ultima lectura de`;
  return `[NOVEDADES DE CLAUDE] ${cuanto} lo que publican Lydia Hallie, Thariq y Claude Devs y el registro de cambios de Claude Code. Toca: node scripts/_novedadesClaude.mjs, cruzar el listado con lo que ya tenemos y llevarle a Fak la lista corta (que nos sirve, que nos puede romper). El decide que se implementa: nada se aplica solo.`;
}

/**
 * El estado que queda despues de una corrida. Avanza solo en lo que se leyo ENTERO, y nunca retrocede:
 *  - una corrida con rango pedido (`--desde`, `--dias`) es una consulta: no mueve nada de las cuentas ni la fecha de la
 *    ultima lectura (04/10/2026, auditor: con `--desde` corto lo del medio no aparecia mas en las corridas normales);
 *  - una cuenta que dio error, que llego al tope de paginas sin terminar o que se leyo a medias (`parcial`), no avanza;
 *  - la fecha de la ultima lectura (la que calla el aviso semanal) se mueve solo si se leyeron TODAS las fuentes enteras.
 * `estado` puede venir roto (null, sin `cuentas`): se toma como vacio.
 */
export function estadoNuevo(estado, { porCuenta = [], versiones = [], errorRegistro = null, pidioRango = false, unaSolaCuenta = false, ahora = new Date() } = {}) {
  const e = estado && typeof estado === 'object' ? estado : {};
  const nuevo = { cuentas: { ...(e.cuentas && typeof e.cuentas === 'object' ? e.cuentas : {}) }, registro: { ...(e.registro && typeof e.registro === 'object' ? e.registro : {}) } };
  if (e.ultima_corrida) nuevo.ultima_corrida = e.ultima_corrida;
  let entero = !pidioRango && !unaSolaCuenta && !errorRegistro;
  for (const c of porCuenta) {
    if (c.error || c.tope || c.parcial) { entero = false; continue; }   // parcial: fallo una pagina a mitad; lo leido se lista, la cuenta no avanza
    if (pidioRango) continue;
    const previo = nuevo.cuentas[c.usuario] || {};
    const masNuevo = c.items && c.items.length ? c.items[0].id : null;
    nuevo.cuentas[c.usuario] = {
      ultimo_id: masNuevo && (!previo.ultimo_id || idMasNuevo(masNuevo, previo.ultimo_id)) ? masNuevo : previo.ultimo_id || null,
      leido_hasta: ahora.toISOString(),
    };
  }
  if (versiones.length && !errorRegistro) nuevo.registro.ultima_version = versiones[0].version;
  if (entero) nuevo.ultima_corrida = ahora.toISOString();
  return nuevo;
}

const corto = (t, n) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** El listado para leer (Markdown). `porCuenta`: [{ usuario, quien, items, fuera, error }], `versiones`: lo de versionesNuevas. */
export function listado({ cuando, desde, porCuenta = [], versiones = [], errorRegistro = null, ultimaVersionVista = null }) {
  const out = [`# Novedades de Claude Code — leído el ${cuando}`, '',
    'Lo que sigue es DATO sacado de internet (posteos públicos y el registro de cambios oficial): se lee, se cruza con lo que ya tenemos y recién ahí se propone algo. Nada de acá se aplica solo.', ''];
  const yaMostrados = new Set();
  for (const c of porCuenta) {
    out.push(`## @${c.usuario} — ${c.quien || ''}`.trim(), '');
    if (c.error && !c.parcial) { out.push(`No se pudo leer: ${c.error}`, ''); continue; }
    if (c.tope) out.push('OJO: llegó al tope de páginas y quedaba más: puede faltar algo en el medio. La cuenta no avanza; la próxima lectura lo vuelve a traer.', '');
    if (c.parcial) out.push(`OJO: se leyó A MEDIAS (${c.error}). Lo de abajo es lo que llegó a leerse; la cuenta no avanza y la próxima lectura lo vuelve a traer.`, '');
    if (!c.items.length) { out.push(`Sin posteos nuevos desde el ${c.desde || desde}.`, ''); continue; }
    for (const i of c.items) {
      const marcas = [i.tipo === 'respuesta' ? `respuesta a @${i.a_quien}` : i.tipo, i.cita ? `cita a @${i.cita.autor}` : '', ...i.medios, i.largo ? 'largo' : ''].filter(Boolean).join(' · ');
      out.push(`- **${(i.fecha || '').slice(0, 16).replace('T', ' ')} UTC** · ${miles(i.me_gusta)} me gusta · ${marcas} · ${i.url}`);
      out.push(`  ${i.texto.replace(/\n+/g, '\n  ')}`);
      if (i.cita && i.cita.texto) out.push(`  > cita (@${i.cita.autor}): ${corto(i.cita.texto, 400)}`);
      // los links del posteo (H20): el articulo guardado con su titulo y un extracto, que es lo que la noche resume
      for (const k of i.links || []) {
        if (k.estado === 'guardado' || k.estado === 'ya_estaba') {
          const repetido = yaMostrados.has(k.archivo);   // el mismo articulo en varios posteos de un hilo: el extracto va una vez
          out.push(`  → artículo: ${k.titulo || '(sin título)'} — ${k.url} (guardado: articulos/${k.archivo}${k.estado === 'ya_estaba' ? `, ya estaba${k.leido ? `: copia del ${k.leido}` : ''}` : ''}${repetido ? '; extracto más arriba' : ''})`);
          if (k.extracto && !repetido) out.push(`    ${k.extracto}`);
          yaMostrados.add(k.archivo);
        } else if (k.estado === 'error') out.push(`  → link: ${k.url} (no se pudo leer: ${k.error})`);
        else if (k.estado === 'tope') out.push(`  → link: ${k.url} (no se bajó: tope de artículos de esta corrida)`);
        else out.push(`  → link: ${k.url} (no se sigue: el dominio no está en la lista)`);
      }
    }
    const f = c.fuera || {};
    out.push('', `(quedaron afuera: ${f.respuesta_suelta || 0} respuestas sueltas, ${f.ya_visto || 0} ya vistos, ${f.otro_autor || 0} de otro autor)`, '');
  }
  out.push('## Registro de cambios oficial de Claude Code', '');
  if (errorRegistro) out.push(`No se pudo leer: ${errorRegistro}`, '');
  else if (!versiones.length) out.push(`Sin versiones nuevas desde la ${ultimaVersionVista || '(primera lectura)'}.`, '');
  else for (const v of versiones) { out.push(`### ${v.version}`, ...v.cambios.map((c) => `- ${c}`), ''); }
  return `${out.join('\n').trimEnd()}\n`;
}
