// Dibujo PURO: de un estado a un árbol de elementos. Sin `$` ni disco, para probarlo
// con vitest. El mod le pasa los elementos de $.ui.resolve(e); sin ellos usa `crudo`,
// la misma forma plana { type, props, children } que la doc muestra para un sitio.
import { tramo } from './estado.mjs'

const nodo = (type) => ({ children = [], ...props } = {}) => ({ type, props, children: [].concat(children) })
export const crudo = { Box: nodo('Box'), Text: nodo('Text') }

const COLOR = { verde: 'green', ambar: 'yellow', rojo: 'red' } // 'yellow' hace de ámbar: la doc nombra colores básicos

export const usd = (n) => 'US$ ' + n.toFixed(2).replace('.', ',')
export const usdRedondo = (n) => 'US$ ' + Math.round(n) // en la banda, sin centavos: se lee de un vistazo
export const barra = (pct) => { const c = Math.max(0, Math.min(10, Math.round(pct / 10))); return '█'.repeat(c) + '░'.repeat(10 - c) }
export const faltan = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`)
export const recortar = (t, n) => (t.length > n ? t.slice(0, Math.max(1, n - 1)).trimEnd() + '…' : t)

const dos = (n) => String(n).padStart(2, '0')
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
// Un momento dicho como lo diría una persona: «hoy 14:00», «mañana 01:00», «ayer 06:30», y si no «vie 16/10 13:00»
// (`corto`: «vie 13:00», para una banda angosta). Todo en hora local.
export function cuando(ms, ahora, { corto = false } = {}) {
  if (ms == null || ahora == null) return null
  const d = new Date(Math.round(ms / 60_000) * 60_000) // 16:59:59 se lee 17:00, como en la tarjeta de uso de la app
  const hora = `${dos(d.getHours())}:${dos(d.getMinutes())}`
  const hoy = new Date(ahora)
  const corrido = (dias) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias)
  if (mismoDia(d, hoy)) return `hoy ${hora}`
  if (mismoDia(d, corrido(1))) return `mañana ${hora}`
  if (mismoDia(d, corrido(-1))) return `ayer ${hora}`
  return corto ? `${DIAS[d.getDay()]} ${hora}` : `${DIAS[d.getDay()]} ${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${hora}`
}

// Para los tests: todo el texto del árbol, en orden
export function textoPlano(n) {
  if (typeof n === 'string') return n
  if (!n || !Array.isArray(n.children)) return ''
  return n.children.map(textoPlano).filter(Boolean).join(' ')
}

// Cuánto ocupa una fila en la banda: la etiqueta (7 columnas) y cada celda con sus 2 de separación
export const largoFila = (celdas) => 7 + celdas.reduce((a, c) => a + 2 + textoPlano(c).length, 0)

export function dibujar(estado, el = crudo, opciones = {}) {
  const { Box, Text } = el
  const s = estado ?? {}
  const ancho = opciones.ancho ?? 100
  const dim = (t) => Text({ dimColor: true, children: [t] })
  const fuerte = (t, color) => Text(color ? { bold: true, color, children: [t] } : { bold: true, children: [t] })
  // Etiqueta fija de 7 columnas: las cifras caen siempre en el mismo lugar
  const fila = (etiqueta, celdas) => Box({ flexDirection: 'row', columnGap: 2, children: [dim(etiqueta.padEnd(7)), ...celdas] })
  const nada = [dim('sin datos')]
  // Una fila más ancha que la banda se parte en dos renglones (o se corta). Cada fila se arma en varias formas, de la
  // más completa a la más corta, y va la primera que entra; si ninguna entra, la más corta (auditor, 11/10/2026: con
  // una prestada con saldo, una noche con error o «renueva mañana» la fila pasaba de las 93 y 95 columnas que pidió la app).
  const elegir = (formas) => formas.find((celdas) => largoFila(celdas) <= ancho) ?? formas.at(-1)

  const ventana = (nombre, v, renueva) => (v == null
    ? [dim(nombre), dim('—')]
    : [dim(nombre), fuerte(`${Math.round(v.pct)} %`, COLOR[v.tramo]), Text({ color: COLOR[v.tramo], children: [barra(v.pct)] }),
      ...(renueva ? [dim('renueva ' + renueva)] : [])])

  // La ventana de 5 h renueva siempre dentro de las próximas horas: alcanza la hora. La de la semana lleva el día
  // (el dueño, 11/10/2026: «renueva pusiste hora pero no día… el de semana necesita día también»). Si no entra todo,
  // primero se va la fecha («vie 13:00»), después la hora de las 5 h, y recién al final el día de la semana.
  const cupo = s.cupo ?? {}
  const conDia = cupo.semana?.renuevaMs != null && s.ahora != null
  const semanaLarga = conDia ? cuando(cupo.semana.renuevaMs, s.ahora) : cupo.semana?.renueva
  const semanaCorta = conDia ? cuando(cupo.semana.renuevaMs, s.ahora, { corto: true }) : cupo.semana?.renueva
  const armarCupo = (de5h, deSemana) => [...ventana('5 h', cupo.cincoHoras, de5h), dim('·'), ...ventana('semana', cupo.semana, deSemana)]
  const filaCupo = cupo.cincoHoras || cupo.semana
    ? elegir([
      armarCupo(cupo.cincoHoras?.renueva, semanaLarga),
      armarCupo(cupo.cincoHoras?.renueva, semanaCorta),
      armarCupo(null, semanaCorta),
      armarCupo(null, null),
    ])
    : nada

  const ag = s.agentes ?? {}
  const filaAgentes = ag.puntos == null ? nada : [
    dim('corren'), fuerte(String(ag.corriendo ?? '—')),
    dim('· últimos 10 min'), fuerte(`${ag.puntos}/${ag.tope} pts`, COLOR[tramo((ag.puntos / ag.tope) * 100)]),
  ]

  // El pedido se recorta a lo que quede de ancho después de las dos primeras celdas; si no queda lugar, no va
  const h = s.hora
  let filaHora = [dim('sin hora fijada')]
  if (h != null) {
    const cabeza = [fuerte('laburando hasta ' + h.hasta), dim('· faltan ' + faltan(h.faltanMin) + (h.propia ? '' : ' (otra sesión)'))]
    const lugar = ancho - largoFila(cabeza) - 2
    filaHora = lugar >= 8 ? [...cabeza, dim(recortar('«' + h.pedido + '»', lugar))] : cabeza
  }

  // La plata de la API: por clave, lo gastado y lo que queda. «≈» en los dos números cuando parte de la cuenta es
  // estimada (pedidos viejos sin la clave anotada). Lo que queda es crédito del plan menos lo anotado, no el saldo
  // que muestra Anthropic.
  const api = s.api
  let filaApi = nada
  if (api?.plan && api.viejo) {
    filaApi = elegir([
      [dim('plan:'), fuerte('renovó' + (api.renueva ? ' el ' + api.renueva : '')), dim('· todavía sin gasto anotado')],
      [dim('plan:'), fuerte('renovó' + (api.renueva ? ' el ' + api.renueva : ''))],
    ])
  } else if (api?.plan) {
    const p = api.plan
    const usado = p.credito ? tramo((p.gastado / p.credito) * 100) : 'sin'
    const aprox = api.estimado ? ' ≈' : ''
    const plan = (conFecha) => [
      dim('plan: gastado' + aprox), fuerte(usdRedondo(p.gastado)),
      ...(p.quedan == null ? [] : [dim('· quedan' + aprox), fuerte(usdRedondo(p.quedan), COLOR[usado])]),
      ...(conFecha && api.renueva ? [dim('hasta el ' + api.renueva)] : []),
    ]
    const prestadas = api.prestadas ?? []
    const detalle = prestadas.flatMap((x) => (x.agotada
      ? [dim('· prestada:'), fuerte('agotada')]
      : [dim('· prestada: gastado'), fuerte(usdRedondo(x.gastado)), dim('vence el ' + x.hasta)]))
    const corto = prestadas.flatMap((x) => [dim('· prestada:'), fuerte(x.agotada ? 'agotada' : usdRedondo(x.gastado))])
    const cuenta = prestadas.length ? [dim(`· ${prestadas.length} ${prestadas.length === 1 ? 'prestada' : 'prestadas'}`)] : []
    filaApi = elegir([
      [...plan(true), ...detalle], [...plan(true), ...corto], [...plan(false), ...corto],
      [...plan(true), ...cuenta], [...plan(false), ...cuenta], plan(false),
    ])
  }

  // La tarea automática de la madrugada: si corrió o no, y por qué no. Lo que la noche deja para revisar (sus
  // «prioridades») NO va acá: son sugerencias sin verificar para la sesión de la mañana, no para el dueño.
  const n = s.noche
  let filaNoche = nada
  if (n) {
    const dia = cuando(n.cuandoMs, s.ahora) ?? 'sin fecha'
    const larga = [dim('tarea automática de'), fuerte(dia)]
    const corta = [dim('tarea de'), fuerte(dia)]
    let estadoLargo
    let estadoCorto
    if (!n.corrio) {
      estadoCorto = [fuerte('no corrió', COLOR.ambar)]
      estadoLargo = n.motivo ? [...estadoCorto, dim('· ' + n.motivo)] : estadoCorto
    } else if (n.conError) {
      estadoLargo = [fuerte(`corrió con ${n.conError} de ${n.pasos} pasos con error`, COLOR.rojo)]
      estadoCorto = [fuerte(`con errores (${n.conError} de ${n.pasos})`, COLOR.rojo)]
    } else if (n.cortada) {
      estadoLargo = [fuerte('se cortó antes de terminar', COLOR.ambar)]
      estadoCorto = [fuerte('se cortó', COLOR.ambar)]
    } else {
      estadoLargo = [fuerte('corrió bien', COLOR.verde)]
      estadoCorto = estadoLargo
    }
    const costo = n.corrio && n.costoUsd ? [dim('· ' + usd(n.costoUsd))] : []
    filaNoche = elegir([
      [...larga, ...estadoLargo, ...costo], [...larga, ...estadoLargo], [...corta, ...estadoLargo], [...corta, ...estadoCorto],
    ])
  }

  const id = s.identidad ?? {}
  const filas = [
    dim([id.casa, id.proyecto].filter(Boolean).join(' · ') || 'tablero'),
    fila('cupo', filaCupo), fila('agentes', filaAgentes), fila('corte', filaHora), fila('api', filaApi), fila('noche', filaNoche),
  ]
  // `debajo`: lo que otros mods dibujan en la banda; va después, no se tapa
  return Box({ flexDirection: 'column', children: opciones.debajo ? [...filas, opciones.debajo] : filas })
}
