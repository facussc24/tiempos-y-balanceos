// Instala (o actualiza) en esta PC los mods de la casa para TODAS las sesiones de Claude Code.
//
//   node scripts/_modsInstalar.mjs                     que haria (no toca nada)
//   node scripts/_modsInstalar.mjs --aplicar           valida, prueba, copia, registra e instala
//   node scripts/_modsInstalar.mjs --estado            que hay instalado, si la copia esta al dia y el registro
//   node scripts/_modsInstalar.mjs --quitar --aplicar  vuelta atras: desinstala los mods y saca el marketplace
//
// Por que una copia y no la carpeta `mods/` del repo: un marketplace agregado desde una ruta local carga sus plugins
// EN EL LUGAR, en cada arranque de sesion (doc oficial, «Edit plugins in place on a shared directory»; medido el
// 11/10/2026: el registro del mod dice `mod=~/.claude/mods-casa/<mod>`). Si el marketplace fuera `mods/`, una edicion a
// medias de cualquier sesion quedaria viva en todas las sesiones nuevas, y uno de los mods decide si sale un subagente.
// La copia de `~/.claude/mods-casa/` solo cambia cuando este script la reemplaza, despues de `claude plugin validate`
// y `claude plugin test`. `claude plugin install` deja ademas otra copia en `~/.claude/plugins/cache/`, que es la que
// cargo la app de escritorio (el marketplace lo cargo el `claude` de la terminal): se mantienen las dos iguales al
// repo y `--estado` dice si alguna quedo atras.
//
// No borra nada: la version anterior de cada mod queda en `~/.claude/mods-casa/_anteriores/<mod>-<fecha>` (volver atras
// es copiarla de vuelta). El marketplace NO se llama `barack`: el instalador de las otras PC saca ese nombre.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MARKETPLACE = 'mods-casa'
// carpeta del repo -> el mod. `recordatorio-ccsc` queda afuera a proposito (Fak, 11/10/2026 04:05).
export const MODS = ['tablero', 'presupuesto-agentes']
// Lo que no viaja a la copia instalada ni cuenta para comparar dos copias: las pruebas, lo que Claude Code escribe al
// cargar con --plugin-dir y la marca `.in_use` que deja adentro de un plugin instalado mientras una sesion lo usa (con
// ella en la cuenta, `--estado` decia «DISTINTO» de un mod que estaba al dia: lo midio la sesion de prueba, 11/10/2026).
const NO_VIAJA = [/^tests(\/|$)/, /^\.claude-plugin\/types(\/|$)/, /^tsconfig\.json$/, /^\.gitignore$/, /^\.in_use$/]

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const barras = (ruta) => String(ruta).replaceAll('\\', '/')

export function rutas(casa = join(homedir(), '.claude')) {
  return { casa, destino: join(casa, 'mods-casa'), registro: join(casa, 'mods-log') }
}

export function viaja(rel) {
  const r = barras(rel)
  return !NO_VIAJA.some((re) => re.test(r))
}

// Todos los archivos de una carpeta que viajan, relativos y con barras normales, ordenados.
export function archivosDe(carpeta) {
  const salida = []
  const andar = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, ent.name)
      const rel = barras(relative(carpeta, abs))
      if (!viaja(rel)) continue
      if (ent.isDirectory()) andar(abs)
      else if (ent.isFile()) salida.push(rel)
    }
  }
  if (existsSync(carpeta)) andar(carpeta)
  return salida.sort()
}

// Una huella del contenido que viaja: sirve para decir si la copia instalada es la del repo.
export function huella(carpeta) {
  const h = createHash('sha256')
  for (const rel of archivosDe(carpeta)) {
    h.update(rel + '\n')
    h.update(readFileSync(join(carpeta, rel)))
  }
  return h.digest('hex').slice(0, 12)
}

/** ¿La carpeta `copia` existe y trae exactamente lo que viaja de `origen`? */
export const alDia = (copia, origen) => Boolean(copia) && existsSync(copia) && huella(copia) === huella(origen)

export function leerManifiesto(carpetaMod) {
  return JSON.parse(readFileSync(join(carpetaMod, '.claude-plugin', 'plugin.json'), 'utf8'))
}

// El catalogo del marketplace: un plugin por mod, con la ruta relativa a la copia.
export function armarMarketplace(mods) {
  return {
    name: MARKETPLACE,
    owner: { name: 'Barack Mercosul - Ingenieria' },
    plugins: mods.map((m) => ({ name: m.nombre, source: './' + m.carpeta, description: m.descripcion })),
  }
}

function claude(args, { correr = spawnSync } = {}) {
  const r = correr('claude', args, { encoding: 'utf8', cwd: REPO })
  const stdout = String(r.stdout ?? '')
  return { ok: r.status === 0, stdout, salida: (stdout + String(r.stderr ?? '')).trim(), error: r.error }
}

/**
 * El JSON de una salida de `claude ... --json`: SOLO de la salida normal (un aviso por stderr no se mezcla) y, si trae
 * renglones de texto antes o despues, el tramo que va del primer `[` o `{` de principio de linea a su cierre. null si
 * no hay JSON: quien llama tiene que tratar null como «no pude leer», nunca como «lista vacia».
 */
export function jsonDeSalida(stdout) {
  const texto = String(stdout ?? '').trim()
  try { return JSON.parse(texto) } catch { /* trae algo mas que el JSON */ }
  const lineas = texto.split(/\r?\n/)
  const desde = lineas.findIndex((l) => /^[[{]/.test(l))
  if (desde < 0) return null
  for (let hasta = lineas.length; hasta > desde; hasta--) {
    try { return JSON.parse(lineas.slice(desde, hasta).join('\n')) } catch { /* se prueba con un renglon menos */ }
  }
  return null
}

function listaJson(args, opciones) {
  const r = claude([...args, '--json'], opciones)
  return r.ok ? jsonDeSalida(r.stdout) : null
}

/**
 * Deja en `final` una copia de `origen` (lo que viaja). Se arma al lado y se cambia de nombre, para que una sesion que
 * arranca en ese instante no cargue un mod a medio copiar; la anterior se guarda en `anteriores`, no se borra. Si la
 * carpeta vieja esta en uso y Windows no la deja renombrar (EBUSY / EPERM / EACCES), se pisa archivo por archivo desde
 * la copia nueva, que queda guardada tambien. Devuelve { enUso } con el codigo del error si hubo que pisar.
 */
export function reemplazarCopia(origen, final, { anteriores, nombre, marca, renombrar = renameSync } = {}) {
  const nuevo = `${final}.nuevo-${marca}`
  cpSync(origen, nuevo, { recursive: true, filter: (src) => src === origen || viaja(relative(origen, src)) })
  if (!existsSync(final)) { renombrar(nuevo, final); return { enUso: null } }
  mkdirSync(anteriores, { recursive: true })
  try {
    renombrar(final, join(anteriores, `${nombre}-${marca}`))
  } catch (e) {
    if (!['EBUSY', 'EPERM', 'EACCES'].includes(e?.code)) throw e
    cpSync(nuevo, final, { recursive: true, force: true })
    renombrar(nuevo, join(anteriores, `${nombre}-${marca}.nueva`))
    return { enUso: e.code }
  }
  renombrar(nuevo, final)
  return { enUso: null }
}

function sello() {
  const d = new Date()
  const dos = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}${dos(d.getSeconds())}`
}

function relevar() {
  return MODS.map((carpeta) => {
    const origen = join(REPO, 'mods', carpeta)
    const man = leerManifiesto(origen)
    return { carpeta, origen, nombre: man.name, version: man.version, descripcion: man.description, id: `${man.name}@${MARKETPLACE}` }
  })
}

function estado() {
  const { destino, registro } = rutas()
  const mods = relevar()
  const instalados = listaJson(['plugin', 'list'])
  const mercados = listaJson(['plugin', 'marketplace', 'list'])
  if (instalados === null || mercados === null) { console.error('No pude leer lo instalado (claude plugin list --json): no se el estado.'); return 1 }
  const mercado = mercados.find((m) => m.name === MARKETPLACE)
  console.log(`Con ${claude(['--version']).salida.split('\n')[0]} (el claude del PATH; la app de escritorio trae el suyo).`)
  console.log(`Marketplace ${MARKETPLACE}: ${mercado ? 'registrado' : 'NO registrado'}`)
  for (const m of mods) {
    const inst = instalados.find((p) => p.id === m.id)
    const copia = join(destino, m.carpeta)
    console.log(`- ${m.id}: ${inst ? (inst.enabled ? 'instalado y activo' : 'instalado, APAGADO') : 'NO instalado'}`
      + ` · copia del marketplace ${existsSync(copia) ? (alDia(copia, m.origen) ? 'al dia con el repo' : 'DISTINTA del repo (correr --aplicar)') : 'no existe'}`
      + (inst ? ` · lo instalado ${alDia(inst.installPath, m.origen) ? 'al dia con el repo' : 'DISTINTO del repo (correr --aplicar)'} (${inst.installPath})` : ''))
  }
  const log = join(registro, 'presupuesto-agentes.log')
  if (existsSync(log)) {
    const lineas = readFileSync(log, 'utf8').split('\n').filter(Boolean)
    console.log(`\nRegistro del presupuesto (${lineas.length} lineas, ultima escritura ${statSync(log).mtime.toLocaleString('es-AR')}):`)
    for (const l of lineas.slice(-8)) console.log('  ' + l)
  } else {
    console.log('\nRegistro del presupuesto: todavia no existe (ninguna sesion cargo el mod).')
  }
  // El tablero: nadie puede mirar la pantalla desde aca. Su registro dice cuando cargo y la primera vez que la app le
  // pidio dibujar la banda en cada sesion; sin ese renglon, la banda todavia no se vio (una sesion que nadie tiene
  // abierta en pantalla carga el mod y no dibuja: medido el 11/10/2026).
  const logTablero = join(registro, 'tablero.log')
  if (existsSync(logTablero)) {
    const lineas = readFileSync(logTablero, 'utf8').split('\n').filter(Boolean)
    const dibujos = lineas.filter((l) => / ui\.render AbovePrompt /.test(l))
    console.log(`\nRegistro del tablero (${lineas.length} lineas): cargo ${lineas.filter((l) => / session\.start /.test(l)).length} veces · `
      + (dibujos.length ? `la app le pidio dibujar la banda ${dibujos.length} veces, la ultima ${dibujos.at(-1).slice(0, 19)}Z` : 'la app TODAVIA NO le pidio dibujar la banda (falta abrir una sesion nueva en pantalla)'))
  } else {
    console.log('\nRegistro del tablero: todavia no existe (ninguna sesion cargo el mod).')
  }
  return 0
}

function instalar(aplicar) {
  const { destino, registro } = rutas()
  const mods = relevar()
  const paso = (texto) => console.log((aplicar ? '' : '[haria] ') + texto)

  // 1. Nada se copia sin validar ni probar: es codigo que corre adentro de todas las sesiones.
  for (const m of mods) {
    for (const [que, args] of [['validate', ['plugin', 'validate', m.origen]], ['test', ['plugin', 'test', m.origen]]]) {
      const r = claude(args)
      if (!r.ok) {
        console.error(`FALLA claude plugin ${que} ${m.carpeta}: no se instala nada.\n${r.salida || r.error}`)
        return 1
      }
      console.log(`ok  claude plugin ${que} mods/${m.carpeta}`)
    }
  }

  // 2. La copia: se arma al lado y se cambia de nombre; la anterior se guarda, no se borra.
  const marca = sello()
  for (const m of mods) {
    const final = join(destino, m.carpeta)
    if (existsSync(final) && huella(final) === huella(m.origen)) { console.log(`=   ${m.carpeta}: la copia ya es la del repo`); continue }
    paso(`copiar mods/${m.carpeta} -> ${final}` + (existsSync(final) ? ` (la anterior queda en _anteriores/${m.carpeta}-${marca})` : ''))
    if (!aplicar) continue
    const r = reemplazarCopia(m.origen, final, { anteriores: join(destino, '_anteriores'), nombre: m.carpeta, marca })
    if (r.enUso) console.log(`    la copia de ${m.carpeta} estaba en uso (${r.enUso}): se piso archivo por archivo; la copia nueva entera quedo en _anteriores/${m.carpeta}-${marca}.nueva`)
    if (huella(final) !== huella(m.origen)) { console.error(`FALLA: la copia de ${m.carpeta} no quedo igual a la del repo. No sigo.`); return 1 }
  }
  const catalogo = JSON.stringify(armarMarketplace(mods), null, 2) + '\n'
  const rutaCatalogo = join(destino, '.claude-plugin', 'marketplace.json')
  if (!existsSync(rutaCatalogo) || readFileSync(rutaCatalogo, 'utf8') !== catalogo) {
    paso(`escribir ${rutaCatalogo}`)
    if (aplicar) { mkdirSync(dirname(rutaCatalogo), { recursive: true }); writeFileSync(rutaCatalogo, catalogo, 'utf8') }
  }
  if (!existsSync(registro)) { paso(`crear ${registro}`); if (aplicar) mkdirSync(registro, { recursive: true }) }

  // 3. Registrar el marketplace (una vez) e instalar cada mod (una vez). La ruta va con barras normales.
  const mercados = listaJson(['plugin', 'marketplace', 'list'])
  if (mercados === null) { console.error('No pude leer la lista de marketplaces (claude plugin marketplace list --json): no sigo.'); return 1 }
  if (!mercados.some((x) => x.name === MARKETPLACE)) {
    paso(`claude plugin marketplace add ${barras(destino)}`)
    if (aplicar) {
      const r = claude(['plugin', 'marketplace', 'add', barras(destino)])
      if (!r.ok) { console.error('FALLA al registrar el marketplace:\n' + r.salida); return 1 }
    }
  } else console.log(`=   marketplace ${MARKETPLACE} ya registrado`)
  const instalados = listaJson(['plugin', 'list'])
  if (instalados === null) { console.error('No pude leer lo instalado (claude plugin list --json): no sigo.'); return 1 }
  for (const m of mods) {
    const inst = instalados.find((p) => p.id === m.id)
    if (!inst) {
      paso(`claude plugin install ${m.id}`)
      if (aplicar) {
        const r = claude(['plugin', 'install', m.id])
        if (!r.ok) { console.error(`FALLA al instalar ${m.id}:\n${r.salida}`); return 1 }
      }
      continue
    }
    // 4. Hay OTRA copia: `claude plugin install` deja el mod tambien en ~/.claude/plugins/cache/<marketplace>/<mod>/
    //    <version>/ y `claude plugin list` nombra esa. Medido el 11/10/2026 (el `mod=` del registro): una sesion de la
    //    app de escritorio cargo la de la CACHE; el `claude` de la terminal (2.1.293), la del marketplace. Por eso las
    //    dos se dejan iguales al repo. Si la de la cache quedo atras, se la trae reinstalando (misma version).
    if (alDia(inst.installPath, m.origen)) { console.log(`=   ${m.id} instalado y al dia`); continue }
    paso(`reinstalar ${m.id}: lo instalado (${inst.installPath}) no es lo del repo`)
    if (!aplicar) continue
    for (const args of [['plugin', 'uninstall', m.id], ['plugin', 'install', m.id]]) {
      const r = claude(args)
      if (!r.ok) { console.error(`FALLA claude ${args.join(' ')}:\n${r.salida}\nMirar con: claude plugin list`); return 1 }
    }
  }
  if (aplicar) {
    // Se vuelve a leer: «instalado» se dice despues de verlo en la lista y de comparar la copia que carga.
    const despues = listaJson(['plugin', 'list'])
    if (despues === null) { console.error('No pude volver a leer lo instalado: NO SE como quedo. Mirar con: claude plugin list'); return 1 }
    const mal = mods.filter((m) => { const i = despues.find((p) => p.id === m.id); return !i || !alDia(i.installPath, m.origen) })
    if (mal.length) { console.error(`FALLA: no quedaron instalados y al dia: ${mal.map((m) => m.id).join(', ')}. Mirar con: claude plugin list`); return 1 }
  }
  if (!aplicar) { console.log('\nNo se toco nada. Con --aplicar se hace.'); return 0 }
  console.log('\nListo. Lo toman las sesiones NUEVAS; una sesion ya abierta lo toma con /reload-plugins.\n')
  return estado()
}

/**
 * La vuelta atras. Dice «quitados» SOLO despues de volver a leer la lista y ver que no estan: una desinstalacion que
 * falla, o una lista que no se puede leer, sale con 1 y dice que quedo (auditor Opus, 11/10/2026: decia «Quitados» y
 * salia con 0 con los dos mods todavia instalados). `opciones.correr` reemplaza a `claude` en los tests.
 */
export function quitar(aplicar, opciones = {}) {
  const consola = opciones.consola ?? console
  const mods = opciones.mods ?? relevar()
  const instalados = listaJson(['plugin', 'list'], opciones)
  const mercados = listaJson(['plugin', 'marketplace', 'list'], opciones)
  if (instalados === null || mercados === null) {
    consola.error('No pude leer lo instalado (claude plugin list --json): no toco nada. A mano: claude plugin disable <mod>@' + MARKETPLACE)
    return 1
  }
  const paso = (texto) => consola.log((aplicar ? '' : '[haria] ') + texto)
  for (const m of mods.filter((x) => instalados.some((p) => p.id === x.id))) {
    paso(`claude plugin uninstall ${m.id}`)
    if (aplicar) { const r = claude(['plugin', 'uninstall', m.id], opciones); if (!r.ok) consola.error(`  fallo: ${r.salida}`) }
  }
  if (mercados.some((x) => x.name === MARKETPLACE)) {
    paso(`claude plugin marketplace remove ${MARKETPLACE}`)
    if (aplicar) { const r = claude(['plugin', 'marketplace', 'remove', MARKETPLACE], opciones); if (!r.ok) consola.error(`  fallo: ${r.salida}`) }
  }
  if (!aplicar) { consola.log('\nNo se toco nada. Con --aplicar se hace.'); return 0 }
  const despues = listaJson(['plugin', 'list'], opciones)
  const quedan = despues === null ? null : mods.filter((m) => despues.some((p) => p.id === m.id)).map((m) => m.id)
  if (quedan === null) { consola.error('\nNo pude volver a leer lo instalado: NO SE si quedaron quitados. Mirar con: claude plugin list'); return 1 }
  if (quedan.length) { consola.error(`\nSIGUEN INSTALADOS: ${quedan.join(', ')}. A mano: claude plugin disable <mod>@${MARKETPLACE} y volver a mirar con claude plugin list`); return 1 }
  consola.log('\nQuitados (verificado en la lista). La copia de ~/.claude/mods-casa queda en el disco; ninguna sesion nueva la carga.')
  return 0
}

const CONOCIDOS = ['--aplicar', '--estado', '--quitar']
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const raro = args.find((a) => !CONOCIDOS.includes(a))
  if (raro) {
    console.error(`No conozco el argumento ${raro}. Uso: node scripts/_modsInstalar.mjs [--aplicar | --estado | --quitar --aplicar]`)
    process.exit(2)
  }
  const aplicar = args.includes('--aplicar')
  process.exit(args.includes('--estado') ? estado() : args.includes('--quitar') ? quitar(aplicar) : instalar(aplicar))
}
