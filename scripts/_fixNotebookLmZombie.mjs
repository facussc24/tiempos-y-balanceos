/**
 * Diagnostica y limpia zombies de Chrome del MCP NotebookLM.
 *
 * Sintoma: `mcp__notebooklm__get_health` retorna `authenticated: false` pero las
 * cookies de state.json siguen validas. Causa real: chrome zombie del MCP
 * sostiene el lockfile del profile y Patchright no puede reabrir.
 *
 * Uso:
 *   node scripts/_fixNotebookLmZombie.mjs         # solo diagnostica
 *   node scripts/_fixNotebookLmZombie.mjs --fix   # diagnostica + mata zombies + borra lockfile
 *
 * Seguro por diseno: SOLO mata procesos chrome cuyo user-data-dir contiene
 * "notebooklm-mcp". Tu browser real nunca se toca.
 *
 * Ver regla: ~/.claude/projects/.../memory/feedback_notebooklm_auth.md
 */
import { execSync } from 'child_process'
import { existsSync, statSync, unlinkSync } from 'fs'

const PROFILE_DIR = 'C:\\Users\\FacundoS-PC\\AppData\\Local\\notebooklm-mcp\\Data\\chrome_profile'
const LOCKFILE = PROFILE_DIR + '\\lockfile'
const STATE_JSON = 'C:\\Users\\FacundoS-PC\\AppData\\Local\\notebooklm-mcp\\Data\\browser_state\\state.json'

const FIX = process.argv.includes('--fix')

function log(msg) { console.log(msg) }

// 1. Listar procesos chrome del MCP
log('=== Diagnostico zombies MCP NotebookLM ===')
let wmic
try {
  wmic = execSync('wmic process where "name=\'chrome.exe\'" get ProcessId,CommandLine /format:list', { encoding: 'utf8' })
} catch (e) {
  log('X no se pudo ejecutar wmic: ' + e.message)
  process.exit(1)
}

const entries = wmic.split('\n').reduce((acc, line) => {
  if (line.startsWith('CommandLine=')) acc.current = { cmd: line.slice('CommandLine='.length).trim() }
  else if (line.startsWith('ProcessId=')) {
    if (acc.current) { acc.current.pid = parseInt(line.slice('ProcessId='.length).trim(), 10); acc.items.push(acc.current); acc.current = null }
  }
  return acc
}, { items: [], current: null }).items

const mcpProcs = entries.filter(e => e.pid && e.cmd && e.cmd.toLowerCase().includes('notebooklm-mcp'))
log(`Procesos chrome totales: ${entries.length}`)
log(`Procesos chrome DEL MCP NotebookLM: ${mcpProcs.length}`)
for (const p of mcpProcs) log(`  PID ${p.pid}`)

// 2. Chequear lockfile
const lockExists = existsSync(LOCKFILE)
let lockInfo = null
if (lockExists) {
  const s = statSync(LOCKFILE)
  const ageMin = Math.round((Date.now() - s.mtimeMs) / 60000)
  lockInfo = { size: s.size, age_minutes: ageMin }
  log(`Lockfile: existe | size=${s.size}B | edad=${ageMin}min`)
} else {
  log('Lockfile: ausente (OK)')
}

// 3. Chequear state.json (cookies)
if (existsSync(STATE_JSON)) {
  const stat = statSync(STATE_JSON)
  const ageDays = Math.round((Date.now() - stat.mtimeMs) / 86400000)
  log(`state.json: existe | edad=${ageDays} dias`)
}

// 4. Diagnostico
const hasZombies = mcpProcs.length > 0
const hasStaleLock = lockExists && lockInfo.age_minutes > 1
const issue = hasZombies || hasStaleLock

log('')
if (!issue) {
  log('OK: sin zombies, lockfile limpio. Si get_health dice authenticated=false, correr re_auth.')
  process.exit(0)
}

log('DIAGNOSTICO: patron zombie detectado')
if (hasZombies) log(`  - ${mcpProcs.length} procesos MCP zombie corriendo`)
if (hasStaleLock) log(`  - lockfile huerfano (${lockInfo.age_minutes}min)`)

if (!FIX) {
  log('\nCorrer con --fix para aplicar limpieza:')
  log('  node scripts/_fixNotebookLmZombie.mjs --fix')
  process.exit(1)
}

// 5. Fix
log('\n=== Aplicando fix ===')
for (const p of mcpProcs) {
  try {
    execSync(`taskkill /F /PID ${p.pid}`, { stdio: 'pipe' })
    log(`  OK killed PID ${p.pid}`)
  } catch (e) {
    log(`  - PID ${p.pid} ya no existe (hijo muerto con parent)`)
  }
}

// Dar un momento para que Chrome libere archivos
await new Promise(r => setTimeout(r, 1500))

if (existsSync(LOCKFILE)) {
  try {
    unlinkSync(LOCKFILE)
    log('  OK lockfile borrado')
  } catch (e) {
    log('  X lockfile no se pudo borrar: ' + e.message + ' (puede que Chrome lo libere solo al morir parent)')
  }
} else {
  log('  OK lockfile ya no existe (Chrome lo limpio al morir el parent)')
}

log('\nFix completo. Siguiente paso: abrir NotebookLM con mcp__notebooklm__get_health. Si dice authenticated=false, correr mcp__notebooklm__re_auth una vez.')
