// Vino del scratchpad de la sesion ae95ec7e (ola por la API, 11/10/2026). Uso: node scripts/_aplicarIntegracion.mjs <integracion.md> [--aplicar] [--solo 1,2]
// aplicar_integracion.mjs <md> [--aplicar]: de una integracion de la API saca los archivos nuevos (bloque cuya
// primera linea es `// ruta`) y los parches ```diff (git apply --check / git apply). Sin --aplicar solo lista.
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const RAIZ = 'C:/Dev/BarackMercosul'; const args = process.argv.slice(2); const md = args[0]; const aplicar = args.includes('--aplicar'); const si = args.indexOf('--solo'); const solo = si >= 0 ? new Set(args[si + 1].split(',').map(Number)) : null;
// Las cercas se buscan al PRINCIPIO de la linea (con la sangria de una lista, que se le saca al cuerpo): una integracion
// puede escribir ``` adentro de la prosa ("sin las cercas ```"). Finales de linea de Windows normalizados.
// Dos defectos vistos el 11/10/2026: (1) una cerca pelada ``` suelta que abre un bloque y la siguiente cerca trae lenguaje
// (se traga el bloque de al lado): se la toma como texto; (2) un bloque sin cerca de cierre: llega hasta el final del archivo.
const lineas = fs.readFileSync(md, 'utf8').replace(/\r\n/g, '\n').split('\n');
let abierto = false;
for (let i = 0; i < lineas.length; i++) {
  const f = /^[ \t]*```(\w*)/.exec(lineas[i]); if (!f) continue;
  if (abierto) { abierto = false; continue; }
  if (!f[1]) { let j = i + 1; while (j < lineas.length && !/^[ \t]*```/.test(lineas[j])) j++; if (/^[ \t]*```\w+/.test(lineas[j] || '')) { lineas[i] = ''; continue; } }
  abierto = true;
}
const s = lineas.join('\n'); const re = /^([ \t]*)```(\w*)([^\n]*)\n([\s\S]*?)(?:^[ \t]*```[ \t]*$|(?![\s\S]))/gm;
// Extensiones de mas larga a mas corta (json antes que js, yaml antes que yml) y sin letra despues: `plugin.json` no es `plugin.js`.
const EXT = 'jsonl|json|mjs|cjs|js|tsx|ts|sh|py|md|ps1|txt|css|html|yaml|yml';
const RUTA_RE = new RegExp(`((?:[\\w.-]+\\/)+(?:[\\w.-]+\\.(?:${EXT})(?![\\w])|\\.gitignore))`);
let m; let n = 0; const parches = []; const nuevos = []; const cmds = [];
while ((m = re.exec(s))) {
  const sangria = m[1]; const lang = m[2]; const info = m[3]; n++; if (solo && !solo.has(n)) continue;
  let cuerpo = sangria ? m[4].split('\n').map((l) => (l.startsWith(sangria) ? l.slice(sangria.length) : l)).join('\n') : m[4];
  if (lang === 'diff' || /^(diff --git|--- a\/)/.test(cuerpo)) { parches.push({ n, cuerpo }); continue; }
  const l1 = cuerpo.split('\n')[0];
  // La ruta puede venir: (a) en la primera linea como comentario, (b) en la linea de la cerca, (c) en la linea de texto
  // justo antes del bloque (un titulo `### \`ruta\`` o `**ruta**`). En (a) esa linea se saca: adentro de un JSON rompe el archivo.
  // (a) primera linea comentario con una ruta adentro (`// ruta`, `// RUTA: ruta (no va en el archivo)`, `// ruta — que es`, `# mods/x/.gitignore`)
  let ruta = /^\s*(\/\/|#(?!!)|<!--|\/\*)/.test(l1) ? (RUTA_RE.exec(l1) || [])[1] : undefined;
  if (ruta) cuerpo = cuerpo.split('\n').slice(1).join('\n').replace(/^\n/, '');
  if (!ruta) ruta = (RUTA_RE.exec(info) || [])[1];
  if (!ruta) { const antes = s.slice(0, m.index).trim().split('\n').pop() || ''; if (!/^\s*[-*\d]/.test(antes) || /^#{1,6} /.test(antes) || /^\*\*/.test(antes)) ruta = (RUTA_RE.exec(antes) || [])[1]; }
  if (ruta && !/^(bash|sh)$/.test(lang)) { nuevos.push({ n, ruta, cuerpo }); continue; }
  if (lang === 'bash' || lang === 'sh') cmds.push(cuerpo.trim());
}
const dir = path.join(path.dirname(md), 'parches_' + path.basename(md, '.md')); fs.mkdirSync(dir, { recursive: true });
for (const p of parches) {
  const f = path.join(dir, `bloque${p.n}.patch`); fs.writeFileSync(f, p.cuerpo.endsWith('\n') ? p.cuerpo : p.cuerpo + '\n');
  // Tres intentos: tal cual, con --recount (los hunks de la API suelen tener mal contados los @@) y ademas sin mirar espacios.
  const variantes = [[], ['--recount'], ['--recount', '--ignore-whitespace']];
  let flags = null; let ultimo = '';
  for (const v of variantes) { const chk = spawnSync('git', ['apply', '--check', ...v, f], { cwd: RAIZ, encoding: 'utf8' }); if (chk.status === 0) { flags = v; break; } ultimo = (chk.stderr || '').trim().split('\n').slice(0, 3).join(' | '); }
  const ok = flags !== null;
  console.log(`parche bloque ${p.n}: ${ok ? 'aplica limpio' + (flags.length ? ' (' + flags.join(' ') + ')' : '') : 'NO aplica: ' + ultimo}`);
  if (aplicar && ok) { const r = spawnSync('git', ['apply', ...flags, f], { cwd: RAIZ, encoding: 'utf8' }); console.log(`   aplicado: ${r.status === 0 ? 'ok' : r.stderr}`); }
}
for (const a of nuevos) {
  const abs = path.join(RAIZ, a.ruta); const existe = fs.existsSync(abs);
  console.log(`archivo bloque ${a.n}: ${a.ruta} (${a.cuerpo.length} chars)${existe ? ' YA EXISTE: no se pisa' : ''}`);
  if (aplicar && !existe) { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, a.cuerpo.endsWith('\n') ? a.cuerpo : a.cuerpo + '\n'); console.log('   escrito'); }
}
console.log(`\n${n} bloques · ${parches.length} parches · ${nuevos.length} archivos nuevos · comandos propuestos:`);
for (const c of cmds) console.log('---\n' + c.slice(0, 1500));
