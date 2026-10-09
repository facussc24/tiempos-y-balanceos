/**
 * _claude.mjs — el tablero de control de la API de Anthropic (los creditos mensuales del plan Max).
 *
 * Los creditos NO cubren Claude Code: solo se gastan con una clave de API de la organizacion
 * vinculada al plan, y vencen al final de cada CICLO de facturacion (BARACK_API_CICLO_DIA = el dia en
 * que se renueva; por defecto 1). Este script dice si esa clave esta, si anda, cuanto se gasto en el
 * ciclo y si la noche de Claude esta agendada; y deja pegar la clave sin que pase por el chat.
 *
 * Uso:
 *   node scripts/_claude.mjs --check                que hay y que falta (la clave nunca se muestra)
 *   node scripts/_claude.mjs --pegar-clave          abre un cuadro de Windows para pegar la clave; la
 *                                                   escribe en .env.local (con copia antes), la prueba
 *                                                   y, si anda, agenda la noche
 *   node scripts/_claude.mjs --probar               una llamada minima a Haiku ("OK") y su costo
 *   node scripts/_claude.mjs --ledger [--mes 2026-10]  gasto del ciclo (el actual, o el que arranca en ese mes) por modelo y por tarea
 *   node scripts/_claude.mjs --preguntar "texto" [--modelo opus|sonnet|haiku|fable]
 *
 * Sale con 0 ok · 1 algo anda mal · 2 argumento · 3 falta la clave · 4 se cancelo el cuadro.
 * Reglas: .claude/rules/api-claude.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  crearCliente, leerClave, llamar, verificarAcceso, presupuestoDelMes, leerLedgerCiclo, resumenLedger, cicloDia, topeCorridaUsd,
  selloLocal, usd, resolverModelo, MENSAJE_SIN_CLAVE, ErrorApi,
} from './_lib/claudeApi.mjs';
import { psRun } from './_lib/powershell.mjs';
import {
  NOMBRE_TAREA, HORA_TAREA, HORAS_VIEJO, comandoAgendar, comandoEstadoTarea, leerEstadoTarea, edadHoras,
} from './_lib/nocturno.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const RUTA_ENV = path.join(RAIZ, '.env.local');
const RUTA_NOCHE = path.join(RAIZ, '.claude', 'state', 'nocturno.json');

const leerJson = (ruta) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return null; } };
const comillaPs = (s) => `'${String(s).replace(/'/g, "''")}'`;

// ─────────────────────────────────────────────────────────────────────────────
// --pegar-clave: el cuadro y la escritura los hace PowerShell; la clave no pasa por Node ni por el chat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El script de PowerShell que pide la clave en un cuadro (con el texto tapado) y la escribe en
 * `rutaEnv` como linea ANTHROPIC_API_KEY=... (reemplaza la que hubiera; las demas lineas y el fin de
 * linea del archivo quedan como estaban; antes deja una copia .bak-<fecha>.local). La copia y el
 * temporal TERMINAN en `.local` a proposito: el .gitignore ignora `*.local`, y un `.env.local.bak-x`
 * suelto se publicaria con un `git add -A` (el repo es publico). Lo unico que imprime es
 * OK|<copia>, CANCELADO o FORMATO: nunca la clave. `clavePrueba` reemplaza el cuadro y es SOLO para
 * probar la escritura con una clave inventada sobre un archivo temporal.
 */
export function scriptPegarClave({ rutaEnv = RUTA_ENV, clavePrueba = null } = {}) {
  const cuadro = clavePrueba != null ? [`$clave = ${comillaPs(clavePrueba)}`] : [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '$form = New-Object System.Windows.Forms.Form',
    "$form.Text = 'Clave de la API de Claude'",
    '$form.ClientSize = New-Object System.Drawing.Size(500, 150)',
    "$form.StartPosition = 'CenterScreen'",
    '$form.TopMost = $true',
    "$form.FormBorderStyle = 'FixedDialog'",
    '$form.MaximizeBox = $false',
    '$form.MinimizeBox = $false',
    '$lbl = New-Object System.Windows.Forms.Label',
    "$lbl.Text = 'Pega la clave que creaste en platform.claude.com (empieza con sk-ant-). No se ve y no pasa por el chat: va directo al archivo .env.local del repo.'",
    '$lbl.Location = New-Object System.Drawing.Point(12, 12)',
    '$lbl.Size = New-Object System.Drawing.Size(476, 40)',
    '$txt = New-Object System.Windows.Forms.TextBox',
    '$txt.UseSystemPasswordChar = $true',
    '$txt.Location = New-Object System.Drawing.Point(12, 62)',
    '$txt.Size = New-Object System.Drawing.Size(476, 24)',
    '$ok = New-Object System.Windows.Forms.Button',
    "$ok.Text = 'Guardar'",
    '$ok.DialogResult = [System.Windows.Forms.DialogResult]::OK',
    '$ok.Location = New-Object System.Drawing.Point(312, 106)',
    '$ok.Size = New-Object System.Drawing.Size(85, 28)',
    '$no = New-Object System.Windows.Forms.Button',
    "$no.Text = 'Cancelar'",
    '$no.DialogResult = [System.Windows.Forms.DialogResult]::Cancel',
    '$no.Location = New-Object System.Drawing.Point(403, 106)',
    '$no.Size = New-Object System.Drawing.Size(85, 28)',
    '$form.AcceptButton = $ok',
    '$form.CancelButton = $no',
    '$form.Controls.AddRange(@($lbl, $txt, $ok, $no))',
    '$form.Add_Shown({ $form.Activate(); $txt.Focus() })',
    '$resultado = $form.ShowDialog()',
    '$clave = $txt.Text',
    '$form.Dispose()',
    "if ($resultado -ne [System.Windows.Forms.DialogResult]::OK) { Write-Output 'CANCELADO'; exit 4 }",
  ];
  return [
    "$ErrorActionPreference = 'Stop'",
    `$rutaEnv = ${comillaPs(rutaEnv)}`,
    ...cuadro,
    "$clave = ($clave -replace '\\s', '')",
    "if (-not $clave) { Write-Output 'CANCELADO'; exit 4 }",
    "if ($clave -notmatch '^sk-ant-[A-Za-z0-9_-]{20,}$') { Write-Output 'FORMATO'; exit 5 }",
    "$bak = ''",
    '$lineas = @()',
    '$nl = "`r`n"',
    'if (Test-Path -LiteralPath $rutaEnv) {',
    "  $bak = $rutaEnv + '.bak-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.local'",
    '  Copy-Item -LiteralPath $rutaEnv -Destination $bak',
    '  $crudo = [System.IO.File]::ReadAllText($rutaEnv)',
    '  if ($crudo -notmatch "`r`n") { $nl = "`n" }',
    '  $lineas = @($crudo -split "`r?`n")',
    '  $fin = $lineas.Count - 1',
    "  while ($fin -ge 0 -and $lineas[$fin] -eq '') { $fin-- }",
    '  if ($fin -ge 0) { $lineas = @($lineas[0..$fin]) } else { $lineas = @() }',
    '}',
    "$nuevas = @($lineas | Where-Object { $_ -notmatch '^\\s*ANTHROPIC_API_KEY\\s*=' })",
    "$nuevas += ('ANTHROPIC_API_KEY=' + $clave)",
    "$tmp = $rutaEnv + '.tmp.local'",
    '[System.IO.File]::WriteAllText($tmp, (($nuevas -join $nl) + $nl), (New-Object System.Text.UTF8Encoding($false)))',
    'Move-Item -LiteralPath $tmp -Destination $rutaEnv -Force',
    "Write-Output ('OK|' + $bak)",
    'exit 0',
  ].join('\n');
}

/** Corre el script y devuelve { estado: 'OK'|'CANCELADO'|'FORMATO'|'ERROR', copia, detalle }. */
export function correrPegarClave(opciones = {}) {
  let salida;
  try {
    salida = psRun(scriptPegarClave(opciones), { timeout: 10 * 60 * 1000 });
  } catch (e) {
    salida = String(e?.stdout ?? '');
    if (!/^(CANCELADO|FORMATO)/m.test(salida)) return { estado: 'ERROR', detalle: String(e?.stderr || e?.message || e).trim().split(/\r?\n/)[0].slice(0, 200) };
  }
  const ultima = String(salida).trim().split(/\r?\n/).pop() || '';
  if (ultima.startsWith('OK|')) return { estado: 'OK', copia: ultima.slice(3) || null };
  if (ultima === 'CANCELADO' || ultima === 'FORMATO') return { estado: ultima };
  return { estado: 'ERROR', detalle: `salida inesperada del cuadro (${ultima.slice(0, 40)})` };
}

function agendarNoche() {
  psRun(comandoAgendar({ raiz: RAIZ }), { timeout: 60000 });
  return leerEstadoTarea(psRun(comandoEstadoTarea(), { timeout: 30000 }));
}

async function pegarClave() {
  console.log('Se abre un cuadro de Windows: pega la clave ahi (Ctrl+V) y apreta Guardar.');
  const r = correrPegarClave();
  if (r.estado === 'CANCELADO') { console.log('Cancelado: no se toco .env.local.'); return 4; }
  if (r.estado === 'FORMATO') { console.error('Eso no parece una clave de la API (empieza con sk-ant-). No se toco .env.local. Proba de nuevo.'); return 1; }
  if (r.estado !== 'OK') { console.error(`No se pudo guardar la clave: ${r.detalle}`); return 1; }
  console.log(`Clave guardada en .env.local${r.copia ? ` (copia del archivo anterior: ${path.basename(r.copia)})` : ''}.`);
  if (!leerClave({ env: {} })) { console.error('Raro: el archivo se escribio pero no leo la clave. Correr --check.'); return 1; }
  const acceso = await verificarAcceso(crearCliente({ env: {} }));
  if (!acceso.ok) {
    console.error(`La clave quedo guardada pero la API no la acepta: ${acceso.detalle}.`);
    console.error('Revisar en claude.ai que la organizacion este vinculada a los creditos (Configuracion > Facturacion > API credits). La noche NO se agenda hasta que ande.');
    return 1;
  }
  console.log(`La API responde: ${acceso.detalle}.`);
  try {
    const t = agendarNoche();
    console.log(t.agendada ? `Noche agendada: "${NOMBRE_TAREA}" todos los dias a las ${HORA_TAREA} (proxima ${t.proxima}).` : 'No pude confirmar la tarea nocturna: correr node scripts/_nocturno.mjs --agendar.');
  } catch (e) {
    console.error(`No pude agendar la noche (${String(e?.message ?? e).split(/\r?\n/)[0]}): correr node scripts/_nocturno.mjs --agendar.`);
  }
  console.log('Para probar con una llamada minima (fraccion de centavo): node scripts/_claude.mjs --probar');
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// --check
// ─────────────────────────────────────────────────────────────────────────────

/** La version instalada del SDK. Se lee por ruta: el paquete no exporta su package.json a resolve(). */
function versionSdk() {
  try {
    const req = createRequire(import.meta.url);
    const principal = req.resolve('@anthropic-ai/sdk');
    let dir = path.dirname(principal);
    while (dir !== path.dirname(dir)) {
      const pj = path.join(dir, 'package.json');
      if (fs.existsSync(pj)) {
        const j = JSON.parse(fs.readFileSync(pj, 'utf8'));
        if (j.name === '@anthropic-ai/sdk') return j.version;
      }
      dir = path.dirname(dir);
    }
    return null;
  } catch { return null; }
}

async function check() {
  const falta = [];
  let codigo = 0;
  const ok = (t) => console.log(`  ✔ ${t}`);
  const mal = (t) => console.log(`  ✘ ${t}`);
  console.log(`API de Claude — ${selloLocal().slice(0, 16)}`);

  const sdk = versionSdk();
  if (sdk) ok(`SDK @anthropic-ai/sdk ${sdk} instalado`);
  else { mal('falta el SDK @anthropic-ai/sdk'); falta.push('npm install (el SDK esta en package.json)'); codigo = 1; }

  const clave = leerClave();
  if (!clave) {
    mal('clave ANTHROPIC_API_KEY: NO esta (ni en el entorno ni en .env.local)');
    falta.push('vincular la organizacion en claude.ai (Configuracion > Facturacion > API credits)');
    falta.push('crear la clave en platform.claude.com (API Keys)');
    falta.push('pegarla:  node scripts/_claude.mjs --pegar-clave');
    codigo = 3;
  } else {
    ok('clave ANTHROPIC_API_KEY: esta (no se muestra)');
    const acceso = await verificarAcceso(crearCliente());
    if (acceso.ok) ok(`acceso: ${acceso.detalle}`);
    else { mal(`acceso: ${acceso.detalle}`); falta.push('que la API acepte la clave (ver el error de arriba)'); codigo = 1; }
  }

  // los creditos vencen por CICLO de facturacion, no por mes calendario (BARACK_API_CICLO_DIA, por defecto 1)
  const p = presupuestoDelMes();
  (p.semaforo === 'rojo' ? mal : ok)(`presupuesto, ${p.ciclo.texto}: ${usd(p.gastadoUsd)} de ${usd(p.presupuestoUsd)} (${p.porcentaje} %, ${p.semaforo})`);
  if (p.semaforo === 'rojo') falta.push(`el ciclo esta en rojo: la noche no arranca hasta que se renueve (el ${p.ciclo.proximo}) o con --sin-tope`);
  console.log(`  · el ciclo arranca el dia ${cicloDia()}${process.env.BARACK_API_CICLO_DIA ? '' : ' (por defecto; si el plan se renueva otro dia, fijar BARACK_API_CICLO_DIA)'} · la noche frena sola si UNA corrida pasa de ${usd(topeCorridaUsd())} (BARACK_API_TOPE_CORRIDA_USD)`);

  let tarea = { agendada: false };
  try { tarea = leerEstadoTarea(psRun(comandoEstadoTarea(), { timeout: 30000 })); } catch (e) { tarea = { agendada: false, error: String(e?.message ?? e).split(/\r?\n/)[0] }; }
  if (tarea.agendada) ok(`noche agendada: "${NOMBRE_TAREA}" (${tarea.estado}, proxima ${tarea.proxima}, ultima ${tarea.ultima}, resultado ${tarea.resultado})`);
  else {
    mal(`noche: NO agendada${tarea.error ? ` (no pude preguntar: ${tarea.error})` : ''}`);
    if (clave) { falta.push('agendar la noche:  node scripts/_nocturno.mjs --agendar'); if (!codigo) codigo = 1; }
    else falta.push('(la noche se agenda sola al pegar la clave; antes fallaria cada manana)');
  }

  const noche = leerJson(RUTA_NOCHE);
  if (!noche) console.log('  · ultima noche: ninguna todavia');
  else {
    const h = edadHoras(noche);
    const vieja = h != null && h > HORAS_VIEJO;
    (vieja ? mal : ok)(`ultima noche (hace ${h ?? '?'} h${vieja ? ', VIEJA' : ''}): ${noche.lineaTablero}`);
    if (vieja && tarea.agendada) { falta.push('la ultima noche tiene mas de 26 h: mirar .sgc-cache/api/nocturno-diario.log'); if (!codigo) codigo = 1; }
  }

  if (falta.length) {
    console.log('\nFalta:');
    falta.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  } else console.log('\nTodo en orden.');
  return codigo;
}

// ─────────────────────────────────────────────────────────────────────────────
// --probar, --ledger, --preguntar
// ─────────────────────────────────────────────────────────────────────────────

async function probar() {
  const r = await llamar(crearCliente(), { modelo: 'haiku', effort: 'low', usuario: 'Respondé solo OK', maxTokens: 1000, tarea: 'probar' });
  console.log(`Respuesta de ${r.modelo}: ${r.texto || '(vacia)'}`);
  console.log(`Costo: $${r.costoUsd.toFixed(6)} (${r.usage.input_tokens ?? 0} tokens de entrada, ${r.usage.output_tokens ?? 0} de salida, ${r.duracionMs} ms)`);
  if (!r.texto) { console.error('Respuesta vacia: no cuenta como prueba.'); return 1; }
  return 0;
}

const col = (s, n) => String(s).padEnd(n);
const num = (x) => String(Math.round(Number(x) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** El gasto de un CICLO de facturacion: el actual, o (con `mes`) el que arranca en ese mes. */
function ledger(mes) {
  const p = presupuestoDelMes({ mes });
  const r = resumenLedger(leerLedgerCiclo(p.ciclo));
  console.log(`Gasto de la API en el ${p.ciclo.texto}: ${usd(r.totalUsd)} de ${usd(p.presupuestoUsd)} (${p.porcentaje} %, ${p.semaforo}) · ${r.llamadas} llamada(s)${r.desde ? ` · ${r.desde} a ${r.hasta}` : ''}`);
  if (!r.llamadas) return 0;
  console.log(`\n  ${col('modelo', 20)}${col('llamadas', 10)}${col('entrada', 12)}${col('salida', 12)}${col('cache leido', 13)}USD`);
  for (const [m, x] of Object.entries(r.porModelo).sort((a, b) => b[1].usd - a[1].usd)) {
    console.log(`  ${col(m, 20)}${col(x.llamadas, 10)}${col(num(x.entrada), 12)}${col(num(x.salida), 12)}${col(num(x.cacheLectura), 13)}${usd(x.usd)}`);
  }
  console.log(`\n  ${col('tarea', 32)}${col('llamadas', 10)}USD`);
  for (const [t, x] of Object.entries(r.porTarea).sort((a, b) => b[1].usd - a[1].usd)) {
    console.log(`  ${col(t, 32)}${col(x.llamadas, 10)}${usd(x.usd)}`);
  }
  return 0;
}

async function preguntar(texto, modelo = 'opus') {
  const r = await llamar(crearCliente(), { modelo, effort: 'medium', usuario: texto, maxTokens: 16000, tarea: 'preguntar' });
  console.log(r.texto);
  console.error(`\n(${r.modelo} · $${r.costoUsd.toFixed(4)} · ${r.usage.input_tokens ?? 0} entrada / ${r.usage.output_tokens ?? 0} salida)`);
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const USO = 'uso: node scripts/_claude.mjs --check | --pegar-clave | --probar | --ledger [--mes AAAA-MM] | --preguntar "texto" [--modelo opus|sonnet|haiku|fable]';

async function main(argv) {
  const CON_VALOR = ['--mes', '--preguntar', '--modelo'];
  const SIN_VALOR = ['--check', '--probar', '--ledger', '--pegar-clave'];
  const op = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (SIN_VALOR.includes(a)) { op[a] = true; continue; }
    if (CON_VALOR.includes(a) && i + 1 < argv.length) { op[a] = argv[++i]; continue; }
    console.error(`no conozco el argumento ${a}. No hago nada.\n${USO}`);
    return 2;
  }
  const acciones = ['--check', '--probar', '--ledger', '--pegar-clave', '--preguntar'].filter((a) => op[a]);
  if (acciones.length !== 1) { console.error(USO); return 2; }
  if (op['--mes'] && !/^\d{4}-\d{2}$/.test(op['--mes'])) { console.error('--mes va como AAAA-MM. No hago nada.'); return 2; }
  if (op['--modelo']) { try { resolverModelo(op['--modelo']); } catch (e) { console.error(e.message); return 2; } }
  try {
    if (op['--check']) return await check();
    if (op['--pegar-clave']) return await pegarClave();
    if (op['--ledger']) return ledger(op['--mes'] || null);
    if (op['--probar']) return await probar();
    return await preguntar(op['--preguntar'], op['--modelo'] || 'opus');
  } catch (e) {
    if (e instanceof ErrorApi && e.tipo === 'sin_clave') { console.error(MENSAJE_SIN_CLAVE); return 3; }
    console.error(`Fallo: ${e?.message ?? e}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; setTimeout(() => process.exit(code), 1500).unref(); });
}
