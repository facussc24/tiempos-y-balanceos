/**
 * cerebroLint — lint del "cerebro" de Claude para este repo: memorias auto
 * (~/.claude/projects/<slug>/memory/), su indice MEMORY.md, las reglas de .claude/rules/,
 * CLAUDE.md y LECCIONES_APRENDIDAS.md.
 *
 * POR QUE (auditoria 04/09/2026, Ola 3 del plan de mejoras): ~40 wikilinks rotos (14 hacia
 * memorias archivadas el 20/08), 3 reglas y 7 scripts citados que ya no existian, 5 memorias
 * CERRADAS vivas en el indice, `coordinador.md` listada como "siempre cargada" teniendo
 * `paths:`, y MEMORY.md a 20,5 KB de un tope duro de 25 KB / 200 lineas que nadie media.
 * Un puntero roto no avisa: la sesion lee "ver memoria X", no la encuentra y sigue sin ella.
 *
 * QUE MIDE (cada check devuelve hallazgos { check, nivel, archivo, detalle }):
 *   wikilinks    [[x]] en memorias, reglas, CLAUDE.md y LECCIONES resuelve a una memoria (por
 *                nombre de archivo, por `name:` o con prefijo feedback_/reference_/project_/user_),
 *                a una regla o a un skill. Apuntar a una memoria ARCHIVADA es aviso; roto es falta.
 *   indice       cada memoria figura en MEMORY.md y cada .md citado en MEMORY.md existe;
 *                tamaño: aviso a 22 KB / 180 lineas, falta a 25 KB / 200 (tope documentado).
 *   frontmatter  `---`, name, description y type ∈ {user, feedback, project, reference};
 *                name distinto del nombre de archivo es aviso.
 *   rutas        rutas del repo citadas entre backticks (scripts/, docs/, .claude/, __tests__/…)
 *                existen; "regla `x.md`", "skill `x`", "hook `x.sh`" y "memoria `x`" resuelven.
 *                Un script que se mudo a scripts/archive/ es aviso.
 *   tablas       las dos tablas de reglas de CLAUDE.md coinciden con .claude/rules/: sin `paths:`
 *                en "Siempre cargadas", con `paths:` en la otra, ninguna fantasma ni faltante.
 *   cerradas     memorias project_* que el indice o su description dan por CERRADAS: candidatas
 *                a _archive (aviso: decide quien consolida, no el script).
 *   globales     reglas de ~/.claude/rules/ que duplican una del repo (aviso: borrarlas es de Fak).
 *
 * Solo lee. Lo corre `node scripts/_cerebroLint.mjs` y el paso "Cerebro" de _cierreSesion.mjs.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const TIPOS = new Set(['user', 'feedback', 'project', 'reference']);
export const PREFIJOS = ['feedback', 'reference', 'project', 'user'];
export const LIMITES = {
  indice_aviso_bytes: 22 * 1024, indice_tope_bytes: 25 * 1024,
  indice_aviso_lineas: 180, indice_tope_lineas: 200,
};

// ─────────────────────────────────────────────────────────────── ubicacion
/** Slug que usa Claude Code para la carpeta del proyecto: C:\Dev\X -> C--Dev-X. */
export function slugProyecto(repo) {
  return path.resolve(repo).replace(/[:\\/]/g, '-');
}
export function dirMemoriaDe(repo, home = os.homedir()) {
  return path.join(home, '.claude', 'projects', slugProyecto(repo), 'memory');
}

// ─────────────────────────────────────────────────────────────── lectura
function leerSeguro(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function listar(dir) { try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; } }

/** Frontmatter YAML minimo: name, description, type (arriba o bajo metadata:) y si tiene paths:. */
export function leerFrontmatter(texto) {
  if (!texto || !texto.startsWith('---')) return null;
  const fin = texto.indexOf('\n---', 3);
  if (fin < 0) return null;
  const bloque = texto.slice(3, fin);
  const campo = (k) => {
    const m = bloque.match(new RegExp(`^\\s*${k}:\\s*(.*)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
  };
  return {
    name: campo('name'),
    description: campo('description'),
    type: campo('type'),
    conPaths: /^paths:/m.test(bloque),
    crudo: bloque,
  };
}

/**
 * Releva todo lo que el lint necesita. `repo` es la raiz del repo; `memoria` la carpeta de
 * memorias; `globales` (opcional) la carpeta ~/.claude con rules/ y skills/.
 */
export function relevarCerebro({ repo, memoria, globales = null }) {
  const memorias = [];
  const archivadas = new Set();
  for (const e of listar(memoria)) {
    if (e.isDirectory()) {
      if (e.name.startsWith('_archive')) {
        for (const a of listar(path.join(memoria, e.name))) if (a.name.endsWith('.md')) archivadas.add(a.name.replace(/\.md$/, ''));
      }
      continue;
    }
    if (!e.name.endsWith('.md') || e.name === 'MEMORY.md') continue;
    const texto = leerSeguro(path.join(memoria, e.name)) ?? '';
    memorias.push({ archivo: e.name, stem: e.name.replace(/\.md$/, ''), fm: leerFrontmatter(texto), texto });
  }
  const indiceTexto = leerSeguro(path.join(memoria, 'MEMORY.md')) ?? '';

  const reglas = [];
  for (const e of listar(path.join(repo, '.claude', 'rules'))) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    const texto = leerSeguro(path.join(repo, '.claude', 'rules', e.name)) ?? '';
    reglas.push({ archivo: e.name, stem: e.name.replace(/\.md$/, ''), conPaths: !!leerFrontmatter(texto)?.conPaths, texto, origen: 'repo' });
  }
  const skills = new Set(listar(path.join(repo, '.claude', 'skills')).filter((e) => e.isDirectory()).map((e) => e.name));
  const hooks = new Set(listar(path.join(repo, '.claude', 'hooks')).filter((e) => e.isFile()).map((e) => e.name));

  const reglasGlobales = [];
  if (globales) {
    for (const e of listar(path.join(globales, 'rules'))) {
      if (!e.isFile() || !e.name.endsWith('.md')) continue;
      reglasGlobales.push({ archivo: e.name, stem: e.name.replace(/\.md$/, ''), texto: leerSeguro(path.join(globales, 'rules', e.name)) ?? '', origen: 'global' });
    }
    for (const e of listar(path.join(globales, 'skills'))) if (e.isDirectory()) skills.add(e.name);
    for (const e of listar(path.join(globales, 'hooks'))) if (e.isFile()) hooks.add(e.name);
  }

  return {
    repo, memoria, globales,
    memorias, archivadas,
    memoriaStems: new Set(memorias.map((m) => m.stem)),
    memoriaNames: new Set(memorias.map((m) => m.fm?.name).filter(Boolean)),
    indice: { texto: indiceTexto, bytes: Buffer.byteLength(indiceTexto, 'utf8'), lineas: indiceTexto ? indiceTexto.split('\n').length : 0 },
    reglas, reglasGlobales, skills, hooks,
    claudeMd: leerSeguro(path.join(repo, 'CLAUDE.md')) ?? '',
    lecciones: leerSeguro(path.join(repo, 'docs', 'LECCIONES_APRENDIDAS.md')) ?? '',
    existe: (rel) => fs.existsSync(path.join(repo, rel)),
  };
}

// ─────────────────────────────────────────────────────────────── resolucion
/**
 * A que resuelve un [[wikilink]] o un "memoria `x`": memoria | regla | skill | archivada | null.
 * Orden: nombre de archivo o `name:` exacto → con prefijo (feedback_x…) → regla → skill →
 * un unico archivo que CONTENGA el handle (LECCIONES cita `mail_corto` por
 * `feedback_mail_corto_como_los_de_fak` para entrar en los 600 caracteres; si lo contienen
 * dos, no identifica a ninguno) → archivada.
 */
export function resolverLink(link, c) {
  const l = link.trim().replace(/\.md$/, '');
  if (!l) return null;
  if (c.memoriaStems.has(l) || c.memoriaNames.has(l)) return 'memoria';
  if (PREFIJOS.some((p) => c.memoriaStems.has(`${p}_${l}`))) return 'memoria';
  if (c.reglas.some((r) => r.stem === l) || c.reglasGlobales.some((r) => r.stem === l)) return 'regla';
  if (c.skills.has(l)) return 'skill';
  if (l.length >= 8) {
    let n = 0;
    for (const s of c.memoriaStems) if (s.includes(l) && ++n > 1) break;
    if (n === 1) return 'memoria';
  }
  if (c.archivadas.has(l) || PREFIJOS.some((p) => c.archivadas.has(`${p}_${l}`))) return 'archivada';
  return null;
}

/** Fuentes de texto donde se buscan links y rutas: memorias, reglas, CLAUDE.md, LECCIONES. */
function fuentes(c) {
  return [
    ...c.memorias.map((m) => ({ archivo: `memory/${m.archivo}`, texto: m.texto })),
    ...c.reglas.map((r) => ({ archivo: `.claude/rules/${r.archivo}`, texto: r.texto })),
    { archivo: 'CLAUDE.md', texto: c.claudeMd },
    { archivo: 'docs/LECCIONES_APRENDIDAS.md', texto: c.lecciones },
  ];
}

// ─────────────────────────────────────────────────────────────── checks
export function chequearWikilinks(c) {
  const out = [];
  for (const f of fuentes(c)) {
    const vistos = new Set();
    for (const m of f.texto.matchAll(/\[\[([^\]\n]+?)\]\]/g)) {
      let link = m[1].split('|')[0].trim();
      if (!link || link.startsWith(':')) continue;               // [[:space:]] de una regex, no un link
      if (vistos.has(link)) continue;
      vistos.add(link);
      const r = resolverLink(link, c);
      if (r === null) out.push({ check: 'wikilinks', nivel: 'falta', archivo: f.archivo, detalle: `[[${link}]] no resuelve a ninguna memoria, regla ni skill` });
      else if (r === 'archivada') out.push({ check: 'wikilinks', nivel: 'aviso', archivo: f.archivo, detalle: `[[${link}]] apunta a una memoria ARCHIVADA (_archive*/): reapuntar o sacar el link` });
    }
  }
  return out;
}

export function chequearIndice(c) {
  const out = [];
  const t = c.indice.texto;
  if (!t) return [{ check: 'indice', nivel: 'falta', archivo: 'memory/MEMORY.md', detalle: 'no existe o esta vacio' }];
  // Por tokens, no con una regex `[…]+\.md` sobre todo el texto: esa retrocede caracter por
  // caracter en cada palabra larga y sobre un indice de 25 KB tarda segundos.
  const citados = new Set(t.split(/[^\p{L}\p{N}_.-]+/u).map((tok) => tok.replace(/\.+$/, '')).filter((tok) => tok.endsWith('.md')));
  for (const m of c.memorias) {
    if (!citados.has(m.archivo)) out.push({ check: 'indice', nivel: 'falta', archivo: `memory/${m.archivo}`, detalle: 'no tiene puntero en MEMORY.md (una memoria sin puntero no se recuerda nunca)' });
  }
  for (const nombre of citados) {
    if (nombre === 'MEMORY.md') continue;
    if (!c.memoriaStems.has(nombre.replace(/\.md$/, ''))) {
      const d = c.archivadas.has(nombre.replace(/\.md$/, '')) ? 'esta en _archive*/: sacar el puntero' : 'no existe (puntero fantasma)';
      out.push({ check: 'indice', nivel: 'falta', archivo: 'memory/MEMORY.md', detalle: `cita ${nombre}, que ${d}` });
    }
  }
  const { bytes, lineas } = c.indice;
  const kb = (bytes / 1024).toFixed(1);
  if (bytes > LIMITES.indice_tope_bytes || lineas > LIMITES.indice_tope_lineas) {
    out.push({ check: 'indice', nivel: 'falta', archivo: 'memory/MEMORY.md', detalle: `${kb} KB / ${lineas} lineas: PASO el tope duro (25 KB / 200 lineas) — Claude Code deja de cargarlo entero` });
  } else if (bytes > LIMITES.indice_aviso_bytes || lineas > LIMITES.indice_aviso_lineas) {
    out.push({ check: 'indice', nivel: 'aviso', archivo: 'memory/MEMORY.md', detalle: `${kb} KB / ${lineas} lineas: cerca del tope (25 KB / 200) — acortar ganchos sin borrar punteros` });
  }
  return out;
}

export function chequearFrontmatter(c) {
  const out = [];
  for (const m of c.memorias) {
    const a = `memory/${m.archivo}`;
    if (!m.fm) { out.push({ check: 'frontmatter', nivel: 'falta', archivo: a, detalle: 'sin frontmatter (---)' }); continue; }
    if (!m.fm.name) out.push({ check: 'frontmatter', nivel: 'falta', archivo: a, detalle: 'sin name:' });
    if (!m.fm.description) out.push({ check: 'frontmatter', nivel: 'falta', archivo: a, detalle: 'sin description: (es lo que decide si se recuerda)' });
    if (!m.fm.type || !TIPOS.has(m.fm.type)) out.push({ check: 'frontmatter', nivel: 'falta', archivo: a, detalle: `type "${m.fm.type ?? ''}" fuera de {user, feedback, project, reference}` });
    if (m.fm.name && m.fm.name !== m.stem) out.push({ check: 'frontmatter', nivel: 'aviso', archivo: a, detalle: `name "${m.fm.name}" distinto del archivo "${m.stem}" (los [[links]] se escriben por nombre de archivo)` });
  }
  return out;
}

const RE_RUTA = /^(?:\.\/)?((?:scripts|docs|__tests__|core|modules|utils|tools|components|hooks|types|\.claude\/(?:rules|hooks|skills|agents))\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|py|ts|tsx|md|sh|json|txt|ps1))$/;
export function chequearRutas(c) {
  const out = [];
  const visto = new Set();
  const agregar = (h) => { const k = `${h.archivo}|${h.detalle}`; if (!visto.has(k)) { visto.add(k); out.push(h); } };
  for (const f of fuentes(c)) {
    for (const m of f.texto.matchAll(/`([^`\n]+)`/g)) {
      const tok = m[1].trim().split(/\s+/)[0];
      const r = tok.match(RE_RUTA);
      if (!r) continue;
      const rel = r[1];
      if (c.existe(rel)) continue;
      const base = path.posix.basename(rel);
      const archivo = ['scripts/_archive', 'scripts/archive'].find((d) => c.existe(`${d}/${base}`));
      if (rel.startsWith('scripts/') && archivo) {
        agregar({ check: 'rutas', nivel: 'aviso', archivo: f.archivo, detalle: `\`${rel}\` se mudo a ${archivo}/: actualizar la cita` });
      } else {
        agregar({ check: 'rutas', nivel: 'falta', archivo: f.archivo, detalle: `\`${rel}\` no existe en el repo` });
      }
    }
    for (const m of f.texto.matchAll(/\bregla\s+`([a-z0-9-]+)\.md`/g)) {
      if (!c.reglas.some((r) => r.stem === m[1]) && !c.reglasGlobales.some((r) => r.stem === m[1])) {
        agregar({ check: 'rutas', nivel: 'falta', archivo: f.archivo, detalle: `regla \`${m[1]}.md\` no existe en .claude/rules/` });
      }
    }
    for (const m of f.texto.matchAll(/\bskill\s+`([a-z0-9-]+)`/g)) {
      if (!c.skills.has(m[1])) agregar({ check: 'rutas', nivel: 'falta', archivo: f.archivo, detalle: `skill \`${m[1]}\` no existe en .claude/skills/` });
    }
    for (const m of f.texto.matchAll(/\bhook\s+`([A-Za-z0-9_-]+\.sh)`/g)) {
      if (!c.hooks.has(m[1])) agregar({ check: 'rutas', nivel: 'falta', archivo: f.archivo, detalle: `hook \`${m[1]}\` no existe en .claude/hooks/` });
    }
    // "memoria `x`" y tambien la lista "memorias `a`, `b` y `c`" (asi cita LECCIONES).
    for (const m of f.texto.matchAll(/\bmemorias?\s+(`[a-z0-9_ñáéíóú-]+`(?:\s*(?:,|y|e|·|\+)\s*`[a-z0-9_ñáéíóú-]+`)*)/gi)) {
      for (const h of m[1].matchAll(/`([^`]+)`/g)) {
        const r = resolverLink(h[1], c);
        if (r === null) agregar({ check: 'rutas', nivel: 'falta', archivo: f.archivo, detalle: `memoria \`${h[1]}\` no existe (ni como archivo, ni con prefijo, ni como handle unico)` });
        else if (r === 'archivada') agregar({ check: 'rutas', nivel: 'aviso', archivo: f.archivo, detalle: `memoria \`${h[1]}\` esta archivada` });
      }
    }
  }
  return out;
}

/** Filas de una tabla de CLAUDE.md que arranca con `| <titulo>`: nombres de regla de la primera celda. */
export function reglasDeTabla(claudeMd, tituloRe) {
  const lineas = claudeMd.split('\n');
  const i = lineas.findIndex((l) => tituloRe.test(l));
  if (i < 0) return null;
  const out = [];
  for (let j = i + 2; j < lineas.length && lineas[j].startsWith('|'); j++) {
    const celda = lineas[j].split('|')[1] ?? '';
    for (const m of celda.matchAll(/`([a-z0-9-]+)\.md`/g)) out.push(m[1]);
  }
  return out;
}

export function chequearTablasClaude(c) {
  const out = [];
  const siempre = reglasDeTabla(c.claudeMd, /^\|\s*Siempre cargadas/);
  const conPaths = reglasDeTabla(c.claudeMd, /^\|\s*Con `paths:`/);
  if (!siempre || !conPaths) return [{ check: 'tablas', nivel: 'falta', archivo: 'CLAUDE.md', detalle: 'no encuentro las dos tablas de reglas ("Siempre cargadas" / "Con `paths:`")' }];
  const enTabla = (s) => siempre.includes(s) || conPaths.includes(s);
  for (const r of c.reglas) {
    if (!enTabla(r.stem)) out.push({ check: 'tablas', nivel: 'falta', archivo: 'CLAUDE.md', detalle: `la regla \`${r.archivo}\` no figura en ninguna de las dos tablas` });
    else if (r.conPaths && siempre.includes(r.stem)) out.push({ check: 'tablas', nivel: 'falta', archivo: 'CLAUDE.md', detalle: `\`${r.archivo}\` figura como "siempre cargada" pero tiene paths: (carga solo al tocar su ambito)` });
    else if (!r.conPaths && conPaths.includes(r.stem)) out.push({ check: 'tablas', nivel: 'falta', archivo: 'CLAUDE.md', detalle: `\`${r.archivo}\` figura en la tabla de paths: pero no tiene paths: (carga siempre)` });
  }
  for (const s of [...siempre, ...conPaths]) {
    if (!c.reglas.some((r) => r.stem === s)) out.push({ check: 'tablas', nivel: 'falta', archivo: 'CLAUDE.md', detalle: `la tabla cita \`${s}.md\`, que no existe en .claude/rules/` });
  }
  return out;
}

/** "CERRADO 30/08" en mayusculas es la convencion del indice para una tarea terminada; "lo
 *  cerrado se archiva" (minuscula) no. Y si el gancho dice por que sigue viva, no se propone. */
const CERRADA = /\bCERRAD[OA]\b/;
const SIGUE_VIVA = /\b(no reenviar|backlog|se conserva|sigue viva)\b/i;
export function chequearCerradas(c) {
  const out = [];
  const lineasIndice = c.indice.texto.split('\n');
  for (const m of c.memorias) {
    if (!m.stem.startsWith('project_')) continue;
    const linea = lineasIndice.find((l) => l.includes(m.archivo)) ?? '';
    const gancho = linea.split(m.archivo)[1]?.split('·')[0] ?? '';
    const texto = `${gancho} ${m.fm?.description ?? ''}`;
    if (CERRADA.test(texto) && !SIGUE_VIVA.test(texto)) {
      out.push({ check: 'cerradas', nivel: 'aviso', archivo: `memory/${m.archivo}`, detalle: 'el indice o su description la dan por CERRADA: si no queda nada operativo, va a _archive_<fecha>/ y se saca el puntero (si sigue viva, decir por que en el gancho: "no reenviar", "backlog"…)' });
    }
  }
  return out;
}

export function chequearGlobales(c) {
  const out = [];
  for (const g of c.reglasGlobales) {
    const rep = c.reglas.find((r) => r.stem === g.stem);
    if (rep) out.push({ check: 'globales', nivel: 'aviso', archivo: `~/.claude/rules/${g.archivo}`, detalle: `duplica .claude/rules/${rep.archivo} (las dos se cargan): borrar la global es decision de Fak` });
  }
  return out;
}

export const CHECKS = [chequearWikilinks, chequearIndice, chequearFrontmatter, chequearRutas, chequearTablasClaude, chequearCerradas, chequearGlobales];

export function lintCerebro(c) {
  return CHECKS.flatMap((ch) => ch(c));
}

/** Resumen para _cierreSesion: { estado: ok|aviso|falta, detalle }. */
export function resumir(hallazgos) {
  const faltas = hallazgos.filter((h) => h.nivel === 'falta');
  const avisos = hallazgos.filter((h) => h.nivel === 'aviso');
  const porCheck = (hs) => Object.entries(hs.reduce((a, h) => { a[h.check] = (a[h.check] ?? 0) + 1; return a; }, {})).map(([k, n]) => `${k} ${n}`).join(', ');
  if (faltas.length) {
    return {
      estado: 'falta',
      detalle: `${faltas.length} roto(s) (${porCheck(faltas)})${avisos.length ? ` + ${avisos.length} aviso(s)` : ''} — node scripts/_cerebroLint.mjs\n`
        + faltas.slice(0, 6).map((h) => `      · ${h.archivo}: ${h.detalle}`).join('\n')
        + (faltas.length > 6 ? `\n      … y ${faltas.length - 6} mas` : ''),
    };
  }
  if (avisos.length) return { estado: 'aviso', detalle: `links, indice, rutas y tablas en orden; ${avisos.length} aviso(s) (${porCheck(avisos)}) — node scripts/_cerebroLint.mjs` };
  return { estado: 'ok', detalle: 'wikilinks, indice, frontmatter, rutas citadas y tablas de reglas en orden' };
}
