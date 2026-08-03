/**
 * _gateRepoPublico.mjs — candado del repo PUBLICO.
 *
 * El repo facussc24/tiempos-y-balanceos es publico. Este gate falla (exit 1) si
 * alguna de las dos fugas verificadas el 2026-07-30 vuelve a entrar:
 *
 *   CHECK-1  credenciales de dev-login en el env de un workflow de CI.
 *            Vite inlinea todo `import.meta.env.VITE_*` como literal dentro del
 *            bundle, y el bundle se publica en GitHub Pages. Pasarle
 *            VITE_AUTO_LOGIN_PASSWORD al build = publicar la contrasena de la
 *            cuenta de Supabase en texto plano. Verificado bajando
 *            assets/index-C8NUY4aA.js: estaba ahi.
 *            Enforcement de: .claude/rules/dev-login.md (excepcion de produccion).
 *
 *   CHECK-2  archivos de memoria/documentos internos versionados. `.claude/memory/`
 *            tenia 21 archivos pusheados con la ruta del servidor y nombres de
 *            documentos del cliente. Enforcement de: la regla de repo publico.
 *
 * Corre SIN secretos y SIN red, por eso puede ser bloqueante en CI desde el dia uno
 * y no se puede saltear con `git push --no-verify`.
 *
 * Uso:
 *   node scripts/_gateRepoPublico.mjs             # exit 0 = limpio, 1 = fuga
 *   node scripts/_gateRepoPublico.mjs --selftest  # se prueba a si mismo roto
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const WORKFLOWS_DIR = '.github/workflows';

/** Variables VITE_* que NUNCA deben viajar al build publicado. */
const PROHIBIDAS_EN_CI = ['VITE_AUTO_LOGIN_EMAIL', 'VITE_AUTO_LOGIN_PASSWORD'];

/** Prefijos de path que no pueden estar versionados en un repo publico. */
const PATHS_PROHIBIDOS = [
  '.claude/memory/',
  '.claude/agent-memory/',
  'docs/empresa-extracted/',
  'docs-local/',
  '.sgc-cache/',
  '.arb-cache/',
];

/**
 * CHECK-1. Busca las variables prohibidas en los workflows.
 *
 * Solo mira lineas que las EXPONEN al build (`VAR: ${{ secrets.VAR }}` o un valor
 * literal). Un comentario que las nombra para explicar por que NO van es legitimo:
 * si no, este mismo gate volveria imposible documentar la razon.
 */
export function buscarCredencialesEnCI(leerArchivo, listarArchivos) {
  const hallazgos = [];
  const archivos = listarArchivos().filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

  for (const archivo of archivos) {
    const lineas = leerArchivo(archivo).split(/\r?\n/);
    lineas.forEach((linea, i) => {
      const sinComentario = linea.split('#')[0];
      for (const varProhibida of PROHIBIDAS_EN_CI) {
        // `NOMBRE:` a la izquierda de un valor = se la esta pasando al proceso.
        const re = new RegExp('(^|\\s)' + varProhibida + '\\s*:');
        if (re.test(sinComentario)) {
          hallazgos.push({
            check: 'CHECK-1',
            archivo,
            linea: i + 1,
            detalle: varProhibida + ' se le esta pasando al build. Vite la inlinea en el bundle publico.',
          });
        }
      }
    });
  }
  return hallazgos;
}

/** CHECK-2. Busca paths internos versionados. */
export function buscarPathsProhibidos(listarVersionados) {
  const hallazgos = [];
  for (const path of listarVersionados()) {
    const normalizado = path.replace(/\\/g, '/');
    const prefijo = PATHS_PROHIBIDOS.find((p) => normalizado.startsWith(p));
    if (prefijo) {
      hallazgos.push({
        check: 'CHECK-2',
        archivo: normalizado,
        linea: 0,
        detalle: 'versionado en un repo publico (prefijo prohibido: ' + prefijo + ')',
      });
    }
  }
  return hallazgos;
}

// ---------------------------------------------------------------- entrada real

function listarWorkflowsReales() {
  if (!existsSync(WORKFLOWS_DIR)) return [];
  return readdirSync(WORKFLOWS_DIR).map((f) => join(WORKFLOWS_DIR, f).replace(/\\/g, '/'));
}

function listarVersionadosReales() {
  const salida = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return salida.split(/\r?\n/).filter(Boolean);
}

// ------------------------------------------------------------------- selftest

/**
 * El gate se prueba roto a si mismo. Si un fixture conocido-malo pasa, el gate
 * esta ciego y se declara ROJO — mismo principio que el custodio de la ola 1.
 */
function selftest() {
  const casos = [];

  const yamlMalo = [
    '      - run: npm run build',
    '        env:',
    '          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}',
    '          VITE_AUTO_LOGIN_PASSWORD: ${{ secrets.VITE_AUTO_LOGIN_PASSWORD }}',
  ].join('\n');

  const yamlBueno = [
    '      # NO volver a agregar VITE_AUTO_LOGIN_PASSWORD aca: Vite la inlinea en el bundle.',
    '      - run: npm run build',
    '        env:',
    '          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}',
  ].join('\n');

  casos.push({
    nombre: 'CHECK-1 detecta la credencial expuesta en el env del build',
    ok: buscarCredencialesEnCI(() => yamlMalo, () => ['fixture.yml']).length === 1,
  });
  casos.push({
    nombre: 'CHECK-1 NO se dispara por un comentario que la nombra para explicarla',
    ok: buscarCredencialesEnCI(() => yamlBueno, () => ['fixture.yml']).length === 0,
  });
  casos.push({
    nombre: 'CHECK-1 ignora archivos que no son yaml',
    ok: buscarCredencialesEnCI(() => yamlMalo, () => ['README.md']).length === 0,
  });
  casos.push({
    nombre: 'CHECK-2 detecta memoria versionada',
    ok: buscarPathsProhibidos(() => ['.claude/memory/reference_server_paths.md']).length === 1,
  });
  casos.push({
    nombre: 'CHECK-2 detecta separadores de Windows',
    ok: buscarPathsProhibidos(() => ['.claude\\memory\\MEMORY.md']).length === 1,
  });
  casos.push({
    nombre: 'CHECK-2 no marca un archivo legitimo',
    ok: buscarPathsProhibidos(() => ['.claude/rules/dev-login.md']).length === 0,
  });

  let fallados = 0;
  for (const c of casos) {
    console.log((c.ok ? '  OK   ' : '  FALLA') + ' ' + c.nombre);
    if (!c.ok) fallados++;
  }
  if (fallados > 0) {
    console.error('\n✗ SELFTEST ROJO: ' + fallados + ' de ' + casos.length + ' casos. El gate esta ciego, no confies en su verde.');
    process.exit(1);
  }
  console.log('\n✓ SELFTEST VERDE: ' + casos.length + ' casos.');
  process.exit(0);
}

// ----------------------------------------------------------------------- main

if (process.argv.includes('--selftest')) selftest();

const hallazgos = [
  ...buscarCredencialesEnCI((f) => readFileSync(f, 'utf8'), listarWorkflowsReales),
  ...buscarPathsProhibidos(listarVersionadosReales),
];

if (hallazgos.length === 0) {
  console.log('✓ GATE REPO PUBLICO: limpio (0 credenciales en CI, 0 paths internos versionados)');
  process.exit(0);
}

console.error('✗ GATE REPO PUBLICO: ' + hallazgos.length + ' fuga(s) en un repo PUBLICO\n');
const porCheck = {};
for (const h of hallazgos) (porCheck[h.check] ||= []).push(h);
for (const [check, lista] of Object.entries(porCheck)) {
  console.error(check + ' — ' + lista.length + ' hallazgo(s):');
  for (const h of lista.slice(0, 25)) {
    console.error('  ' + h.archivo + (h.linea ? ':' + h.linea : '') + ' — ' + h.detalle);
  }
  if (lista.length > 25) console.error('  ... y ' + (lista.length - 25) + ' mas');
  console.error('');
}
console.error('Reglas: .claude/rules/dev-login.md (excepcion de produccion) y la regla de repo publico.');
process.exit(1);
