/**
 * shellTexto.mjs — limpieza de texto de comandos Bash/PowerShell que comparten los guardianes.
 *
 * Nace el 10/09/2026 sacando `sinCuerposHeredoc` de guardianes.mjs (que la re-exporta) para que
 * cierreGuard.mjs la use sin importar el modulo entero de los 14 guardianes PreToolUse.
 * Lo que un comando ENTREGA se decide sobre la linea de comando, no sobre la prosa que lleva
 * adentro: el cuerpo de un heredoc y el mensaje de un `git commit -m "..."` son texto, no rutas.
 */

/** Port del awk de arb-cerrar-guard: quita los CUERPOS de heredoc, deja las lineas de comando. */
export function sinCuerposHeredoc(cmd) {
  const out = [];
  let fin = '';
  for (const l of String(cmd ?? '').split('\n')) {
    if (fin) { if (l === fin || l.trim().split(/\s+/)[0] === fin) fin = ''; continue; }
    const m = l.match(/<<-?\s*'?([A-Za-z_][A-Za-z0-9_]*)'?/);
    if (m) fin = m[1];
    out.push(l);
  }
  return out.join('\n');
}

/**
 * Quita los argumentos de mensaje y de archivo de mensaje de un `git commit`: `-m "..."`,
 * `-m '...'`, `--message=...`, `-F <ruta>`, `--file=<ruta>`. Un commit cuyo mensaje dice
 * "mover el informe al Escritorio" no entrega nada en el Escritorio (falso positivo del
 * cierre-guard, 05 y 10/09/2026).
 */
export function sinArgumentosDeCommit(cmd) {
  let c = String(cmd ?? '');
  if (!/\bgit\s+commit\b/.test(c)) return c;
  c = c.replace(/(\s)(-m|--message)(=|\s+)"(?:[^"\\]|\\.)*"/g, '$1');
  c = c.replace(/(\s)(-m|--message)(=|\s+)'[^']*'/g, '$1');
  c = c.replace(/(\s)(-m|--message)(=|\s+)\S+/g, '$1');
  c = c.replace(/(\s)(-F|--file)(=|\s+)"[^"]*"/g, '$1');
  c = c.replace(/(\s)(-F|--file)(=|\s+)'[^']*'/g, '$1');
  c = c.replace(/(\s)(-F|--file)(=|\s+)\S+/g, '$1');
  return c;
}

/** Las dos limpiezas juntas: lo que queda son lineas de comando con sus rutas reales. */
export function soloLineasDeComando(cmd) {
  return sinArgumentosDeCommit(sinCuerposHeredoc(cmd));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// A QUE APUNTA un comando (22/09/2026).
//
// POR QUE: escritorio-guard y borrado-masivo-guard buscaban "la zona" y "el verbo de borrar" por
// separado en TODO el comando. Medido en los transcripts 05/09-22/09: ~10 de 19 bloqueos de
// escritorio-guard eran un `rm` sobre el scratchpad o el repo con la palabra Escritorio/Desktop
// en OTRA parte del comando (un `find` que la listaba, el `python -c` de al lado); y el borrado
// masivo frenaba `rm -rf tmp/amfe158` o `.video/clips` porque su excepcion solo veia `/tmp/`.
// Aca se parte el comando en comandos simples (respetando comillas, `$(...)` y heredocs), se
// siguen las variables asignadas en el MISMO comando y los `cd`, y se devuelve a QUE apunta cada
// borrado y cada salida (`--out`, `>`). Lo que no se puede resolver (una variable de un `for`, un
// `$(...)`, un `xargs rm`) vuelve marcado como NO resuelto: el guardian cae a su regla vieja.
// Fallar hacia el lado seguro es resolver de menos, nunca de mas.

// `git -c user.name=x commit -F - <<MSG` tambien es un commit (37c172a1, 07/09).
const HD_DE_GIT_ = /\bgit\s+(?:-[cC]\s+\S+\s+)*(commit|tag|notes)\b|\bgh\s+(pr|issue|release)\b/;
const RE_HEREDOC = /(?<!<)<<-?(?!<)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/;

/** Separa los cuerpos de heredoc de las lineas de comando; marca los que alimentan a git/gh (prosa). */
export function separarHeredocs(cmd) {
  const lineas = [];
  const cuerpos = [];
  let fin = '';
  let actual = null;
  for (const l of String(cmd ?? '').split('\n')) {
    if (fin) {
      if (l === fin || l.trim().split(/\s+/)[0] === fin) { fin = ''; cuerpos.push(actual); actual = null; } else actual.cuerpo += `${l}\n`;
      continue;
    }
    const m = l.match(RE_HEREDOC);
    if (m) { fin = m[2]; actual = { dueno: l, cuerpo: '', deGit: HD_DE_GIT_.test(l) }; }
    lineas.push(l);
  }
  if (actual) cuerpos.push(actual); // heredoc sin cerrar (comando truncado): cuenta igual
  return { lineas: lineas.join('\n'), cuerpos };
}

/** Quita SOLO los cuerpos de heredoc que alimentan a git/gh (un mensaje de commit es prosa). */
export function sinCuerposHeredocDeGit(cmd) {
  const out = [];
  let fin = '';
  let deGit = false;
  for (const l of String(cmd ?? '').split('\n')) {
    if (fin) {
      if (l === fin || l.trim().split(/\s+/)[0] === fin) { fin = ''; if (!deGit) out.push(l); continue; }
      if (!deGit) out.push(l);
      continue;
    }
    const m = l.match(RE_HEREDOC);
    if (m) { fin = m[2]; deGit = HD_DE_GIT_.test(l); }
    out.push(l);
  }
  return out.join('\n');
}

const SQ = '\uE000'; // `$` adentro de comillas simples: literal, no se expande

/** Indice del cierre de una sustitucion `$(...)` o `` `...` `` que arranca en i (tolera comillas adentro). */
function finSustitucion(s, i) {
  if (s[i] === '`') { const k = s.indexOf('`', i + 1); return k < 0 ? s.length - 1 : k; }
  let prof = 0;
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '(') prof++;
    else if (s[j] === ')') { prof--; if (prof === 0) return j; } else if (s[j] === '"' || s[j] === "'") { const k = s.indexOf(s[j], j + 1); if (k > 0) j = k; }
  }
  return s.length - 1;
}

/**
 * Parte una linea de comando (ya sin cuerpos de heredoc) en comandos simples.
 * Cada uno: { palabras, redirs: [{ op, t }], crudo }. Respeta comillas simples y dobles, `$(...)`
 * y backticks. Separan: ; & | salto de linea, y ( ) { } al principio de una palabra (subshell,
 * bloque de bash, scriptblock de PowerShell). Las barras invertidas quedan como estan (una ruta
 * Windows sin comillas se sigue viendo como ruta: para decidir la ZONA, mejor de mas).
 */
export function comandosSimples(texto) {
  const s = String(texto ?? '');
  const cmds = [];
  let palabras = [];
  let redirs = [];
  let w = null;
  let pendiente = null; // operador de redireccion esperando su destino
  let inicio = 0;
  const cerrarPalabra = () => {
    if (w === null) return;
    if (pendiente) { redirs.push({ op: pendiente, t: w }); pendiente = null; } else palabras.push(w);
    w = null;
  };
  const cerrarComando = (i) => {
    cerrarPalabra();
    pendiente = null;
    if (palabras.length || redirs.length) cmds.push({ palabras, redirs, crudo: s.slice(inicio, i) });
    palabras = []; redirs = []; inicio = i + 1;
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'") {
      const j = s.indexOf("'", i + 1);
      const fin = j < 0 ? s.length : j;
      w = (w ?? '') + s.slice(i + 1, fin).replace(/\$/g, SQ);
      i = fin;
    } else if (c === '"') {
      let v = '';
      let j = i + 1;
      for (; j < s.length && s[j] !== '"'; j++) {
        if (s[j] === '\\' && /["\\$`]/.test(s[j + 1] ?? '')) { v += s[j + 1]; j++; } else if (s[j] === '`' || (s[j] === '$' && s[j + 1] === '(')) {
          const k = finSustitucion(s, j); // "$(cygpath -u "$TEMP")/x": las comillas de adentro no cierran
          v += s.slice(j, k + 1);
          j = k;
        } else v += s[j];
      }
      w = (w ?? '') + v;
      i = j;
    } else if (c === '`' || (c === '$' && s[i + 1] === '(')) {
      // sustitucion de comando: entra entera a la palabra (asi queda NO resuelta)
      const j = finSustitucion(s, i);
      w = (w ?? '') + s.slice(i, j + 1);
      i = j;
    } else if (c === '\\') {
      if (s[i + 1] === '\n') { i++; continue; } // continuacion de linea
      w = (w ?? '') + c + (s[i + 1] ?? '');
      i++;
    } else if (c === '\n' || c === ';' || c === '|' || (c === '&' && s[i + 1] !== '>')) {
      cerrarComando(i);
    } else if ((c === '(' || c === ')' || c === '{' || c === '}') && w === null) {
      cerrarComando(i);
    } else if (c === '>' || c === '<' || (c === '&' && s[i + 1] === '>')) {
      if (s[i + 1] === '(' && c !== '&') { w = (w ?? '') + c; continue; } // <( ) >( ): sustitucion de proceso
      if (w !== null && /^\d+$/.test(w)) w = null; // el descriptor (2>) es parte del operador
      else cerrarPalabra();
      let op = c;
      let j = i + 1;
      while (j < s.length && /[<>|&]/.test(s[j])) { op += s[j]; j++; }
      if (/[<>]&$/.test(op) && /[\d-]/.test(s[j] ?? '')) { while (j < s.length && /[\d-]/.test(s[j])) j++; op = ''; } // 2>&1
      i = j - 1;
      if (op) pendiente = op;
    } else if (/\s/.test(c)) {
      cerrarPalabra();
    } else {
      w = (w ?? '') + c;
    }
  }
  cerrarComando(s.length);
  return cmds;
}

const HOME_PH = 'C:/Users/_home_';
const TEMP_PH = 'C:/Users/_home_/AppData/Local/Temp';
/** Variables de entorno que se pueden resolver sin mirar la maquina (y que nunca son el Escritorio). */
const ENV_CONOCIDAS = { HOME: HOME_PH, USERPROFILE: HOME_PH, TEMP: TEMP_PH, TMP: TEMP_PH, TMPDIR: TEMP_PH };

const esAbsoluta = (p) => /^([A-Za-z]:|[\\/]|~)/.test(p);

/** Resuelve una palabra con las variables conocidas. { valor, ok }; ok=false si queda algo sin resolver. */
export function resolverPalabra(w, vars = new Map(), cwd = null) {
  let x = String(w ?? '');
  // $(cygpath -u "X") es X con otras barras: el patron `T="$(cygpath -u "$TEMP")/..."` es comun aca.
  x = x.replace(/\$\(\s*cygpath(?:\s+-[A-Za-z]+)*\s+["']?([^"')]*?)["']?\s*\)/g, '$1');
  if (/\$\(|`/.test(x)) return { valor: x, ok: false };
  if (/^~(?=$|[\\/])/.test(x)) x = HOME_PH + x.slice(1);
  let ok = true;
  x = x.replace(/\$\{([A-Za-z_]\w*)\}|\$env:([A-Za-z_]\w*)|\$([A-Za-z_]\w*)|\$\{[^}]*\}|\$[0-9@*#?!$-]/gi, (m, llave, env, simple) => {
    const n = llave || simple;
    if (env) { const v = ENV_CONOCIDAS[env.toUpperCase()]; if (v !== undefined) return v; ok = false; return m; }
    if (n) {
      if (vars.has(n)) { const v = vars.get(n); if (v === null) { ok = false; return m; } return v; }
      if (n.toUpperCase() === 'PWD' && cwd) return cwd;
      const v = ENV_CONOCIDAS[n.toUpperCase()];
      if (v !== undefined) return v;
    }
    ok = false;
    return m;
  });
  return { valor: x.replace(new RegExp(SQ, 'g'), '$'), ok };
}

/** Una ruta resuelta y, si es relativa, pegada al cwd (sin cwd conocido queda NO resuelta). */
function ruta(w, vars, cwd) {
  const r = resolverPalabra(w, vars, cwd);
  if (!r.ok) return r;
  if (esAbsoluta(r.valor) || r.valor.startsWith(HOME_PH)) return r;
  if (!cwd) return { valor: r.valor, ok: false };
  return { valor: `${cwd.replace(/[\\/]+$/, '')}/${r.valor}`, ok: true };
}

const VERBOS_BORRAR = new Set(['rm', 'rmdir', 'unlink', 'erase', 'del', 'rd', 'ri', 'remove-item', 'clear-content']);
const VERBOS_CD = new Set(['cd', 'pushd', 'chdir', 'set-location', 'sl', 'push-location']);
const INTERPRETES = /^(python[\d.]*|py|pythonw|node|deno|bun|powershell(\.exe)?|pwsh(\.exe)?|bash|sh|zsh|cmd(\.exe)?|perl|ruby|php|Rscript|wsl)$/i;
const FLAG_CODIGO = /^(-c|-e|-p|--eval|--print|-Command|-EncodedCommand|\/c|\/k)$/i;
const ENVOLTORIOS = new Set(['sudo', 'command', 'builtin', 'exec', 'nohup', 'nice', 'time', 'stdbuf', 'then', 'do', 'else', 'elif', 'if', 'while', 'until', '!', '&', '{']);
const LECTORES_O = /^(find|grep|egrep|fgrep|rg|ls|du|df|ps|git)$/i; // su -o no es "salida"

/**
 * Analiza un comando de shell (Bash o PowerShell).
 *   borrados: [{ verbo, objetivos: [{ valor, ok }], sinObjetivo, crudo }]  (comandos que borran)
 *   salidas:  [{ valor, ok }]      (--salida/--out/--output/-o y redirecciones > >>)
 *   residual: texto de todo lo que NO es un borrado reconocido + cuerpos de heredoc que no son de git
 *   embebido: codigo pegado (cuerpos de heredoc no-git + el argumento de python -c / node -e / -Command)
 * `cwd` es el directorio de la sesion (campo `cwd` del payload del hook); los `cd` del comando lo mueven.
 */
export function analizarComando(cmd, { cwd = null } = {}) {
  const { lineas, cuerpos } = separarHeredocs(cmd);
  const vars = new Map();
  let dir = cwd ? String(cwd).replace(/\\/g, '/') : null;
  const borrados = [];
  const salidas = [];
  const residual = [];
  const embebido = [];
  for (const h of cuerpos) if (!h.deGit) { residual.push(h.cuerpo); embebido.push(h.cuerpo); }

  for (const c of comandosSimples(lineas)) {
    for (const r of c.redirs) if (/^&?>/.test(r.op)) salidas.push(ruta(r.t, vars, dir));
    let p = c.palabras.slice();
    // asignaciones sueltas o delante del comando (VAR=x cmd): se registran igual
    while (p.length) {
      const a = p[0].match(/^([A-Za-z_][A-Za-z0-9_]*)(\+?)=([\s\S]*)$/);
      const ps = p[0].match(/^\$([A-Za-z_]\w*)$/) && p[1] === '=' ? p[0].slice(1) : null;
      const ps1 = p[0].match(/^\$([A-Za-z_]\w*)=([\s\S]+)$/);
      if (a) { const r = resolverPalabra(a[3], vars, dir); vars.set(a[1], a[2] || !r.ok ? null : r.valor); p.shift(); continue; }
      if (ps) { const r = p.length === 3 ? resolverPalabra(p[2], vars, dir) : { ok: false }; vars.set(ps, r.ok ? r.valor : null); p = []; break; }
      if (ps1) { const r = resolverPalabra(ps1[2], vars, dir); vars.set(ps1[1], r.ok ? r.valor : null); p = []; break; }
      if (ENVOLTORIOS.has(p[0].toLowerCase())) { p.shift(); continue; }
      if (/^(env|timeout)$/i.test(p[0])) { p.shift(); while (p.length && (/^-/.test(p[0]) || /^\d+[smhd]?$/.test(p[0]))) p.shift(); continue; }
      break;
    }
    if (!p.length) continue;
    // `\rm`, `/usr/bin/rm`, `rm.exe`, `"rm"`: el mismo verbo
    const verbo = p[0].replace(/^.*[\\/]/, '').replace(/\.exe$/i, '').toLowerCase();
    const args = p.slice(1);
    // variables que cambian de valor sin que se sepa a que: for X in ..., read X, foreach ($X in ...)
    if (verbo === 'for' && args[0]) vars.set(args[0], null);
    if (verbo === 'read') for (const x of args) if (/^[A-Za-z_]\w*$/.test(x)) vars.set(x, null);
    for (let k = 0; k < p.length - 1; k++) { const m = p[k].match(/^\(?\$([A-Za-z_]\w*)$/); if (m && /^in$/i.test(p[k + 1])) vars.set(m[1], null); }
    if (/^(export|local|declare|typeset|readonly)$/.test(verbo)) {
      for (const x of args) { const a = x.match(/^([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/); if (a) { const r = resolverPalabra(a[2], vars, dir); vars.set(a[1], r.ok ? r.valor : null); } }
    }
    if (VERBOS_CD.has(verbo)) {
      const dest = args.find((x) => !/^-/.test(x) && !/^\/d$/i.test(x));
      if (dest === undefined) dir = HOME_PH;
      else if (dest === '-') dir = null;
      else { const r = ruta(dest, vars, dir); dir = r.ok ? r.valor : null; }
      residual.push(c.crudo);
      continue;
    }
    if (verbo === 'popd' || verbo === 'pop-location') { dir = null; residual.push(c.crudo); continue; }

    // salidas: --salida X / --out=X / --output X / -o X
    for (let k = 0; k < args.length; k++) {
      const f = args[k].match(/^--(salida|out)[\w-]*(?:=([\s\S]*))?$/i);
      if (f) { const v = f[2] !== undefined ? f[2] : args[k + 1]; if (v !== undefined) salidas.push(ruta(v, vars, dir)); continue; }
      if (args[k] === '-o' && !LECTORES_O.test(verbo) && args[k + 1] !== undefined) salidas.push(ruta(args[k + 1], vars, dir));
    }

    // borrados
    const findBorra = verbo === 'find' && args.some((x, k) => x === '-delete' || (/^-(exec|execdir|ok)$/.test(x) && VERBOS_BORRAR.has(String(args[k + 1] ?? '').toLowerCase())));
    if (findBorra) {
      const inicios = [];
      for (const x of args) { if (/^[-(!\\]/.test(x)) break; inicios.push(x); }
      borrados.push({ verbo, objetivos: (inicios.length ? inicios : ['.']).map((x) => ruta(x, vars, dir)), sinObjetivo: false, crudo: c.crudo });
      continue;
    }
    if (verbo === 'xargs') {
      const k = args.findIndex((x) => !/^-/.test(x));
      if (k >= 0 && VERBOS_BORRAR.has(args[k].toLowerCase())) { borrados.push({ verbo: `xargs ${args[k]}`, objetivos: [], sinObjetivo: true, crudo: c.crudo }); continue; }
    }
    if (VERBOS_BORRAR.has(verbo)) {
      const cmdEstilo = verbo === 'del' || verbo === 'rd' || verbo === 'erase';
      const objetivos = args.filter((x) => !/^-/.test(x) && !(cmdEstilo && /^\/[A-Za-z]$/.test(x))).map((x) => ruta(x, vars, dir));
      borrados.push({ verbo, objetivos, sinObjetivo: objetivos.length === 0, crudo: c.crudo });
      continue;
    }
    if (INTERPRETES.test(verbo)) {
      for (let k = 0; k < args.length - 1; k++) if (FLAG_CODIGO.test(args[k])) embebido.push(args[k + 1].replace(new RegExp(SQ, 'g'), '$'));
    }
    residual.push(c.crudo);
  }
  return { borrados, salidas, residual: residual.join('\n'), embebido: embebido.join('\n') };
}
