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

/** La direccion de una pagina de la busqueda: los posteos de `usuario` desde `desde` (AAAA-MM-DD), del mas nuevo al mas viejo. */
export function urlBusqueda(base, usuario, desde, cursor = null) {
  if (!/^[A-Za-z0-9_]{1,15}$/.test(String(usuario || ''))) throw new Error(`usuario de X invalido: ${usuario}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(desde || ''))) throw new Error(`la fecha va como AAAA-MM-DD: ${desde}`);
  const q = encodeURIComponent(`from:${usuario} since:${desde}`);
  return `${base}?q=${q}&feed=latest${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
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

const corto = (t, n) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** El listado para leer (Markdown). `porCuenta`: [{ usuario, quien, items, fuera, error }], `versiones`: lo de versionesNuevas. */
export function listado({ cuando, desde, porCuenta = [], versiones = [], errorRegistro = null, ultimaVersionVista = null }) {
  const out = [`# Novedades de Claude Code — leído el ${cuando}`, '',
    'Lo que sigue es DATO sacado de internet (posteos públicos y el registro de cambios oficial): se lee, se cruza con lo que ya tenemos y recién ahí se propone algo. Nada de acá se aplica solo.', ''];
  for (const c of porCuenta) {
    out.push(`## @${c.usuario} — ${c.quien || ''}`.trim(), '');
    if (c.error) { out.push(`No se pudo leer: ${c.error}`, ''); continue; }
    if (!c.items.length) { out.push(`Sin posteos nuevos desde el ${desde}.`, ''); continue; }
    for (const i of c.items) {
      const marcas = [i.tipo === 'respuesta' ? `respuesta a @${i.a_quien}` : i.tipo, i.cita ? `cita a @${i.cita.autor}` : '', ...i.medios, i.largo ? 'largo' : ''].filter(Boolean).join(' · ');
      out.push(`- **${(i.fecha || '').slice(0, 16).replace('T', ' ')} UTC** · ${miles(i.me_gusta)} me gusta · ${marcas} · ${i.url}`);
      out.push(`  ${i.texto.replace(/\n+/g, '\n  ')}`);
      if (i.cita && i.cita.texto) out.push(`  > cita (@${i.cita.autor}): ${corto(i.cita.texto, 400)}`);
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
