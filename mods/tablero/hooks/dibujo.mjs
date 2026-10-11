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

export function dibujar(estado, el = crudo, opciones = {}) {
  const { Box, Text } = el
  const s = estado ?? {}
  const ancho = opciones.ancho ?? 100
  const dim = (t) => Text({ dimColor: true, children: [t] })
  const fuerte = (t, color) => Text(color ? { bold: true, color, children: [t] } : { bold: true, children: [t] })
  // Etiqueta fija de 7 columnas: las cifras caen siempre en el mismo lugar
  const fila = (etiqueta, celdas) => Box({ flexDirection: 'row', columnGap: 2, children: [dim(etiqueta.padEnd(7)), ...celdas] })
  const nada = [dim('sin datos')]

  const ventana = (nombre, v, renueva) => (v == null
    ? [dim(nombre), dim('—')]
    : [dim(nombre), fuerte(`${Math.round(v.pct)} %`, COLOR[v.tramo]), Text({ color: COLOR[v.tramo], children: [barra(v.pct)] }),
      ...(renueva ? [dim('renueva ' + renueva)] : [])])

  // La ventana de 5 h renueva siempre dentro de las próximas horas: alcanza la hora. La de la semana lleva el día
  // (el dueño, 11/10/2026: «renueva pusiste hora pero no día… el de semana necesita día también»); con la banda
  // angosta va sin la fecha («vie 13:00») para que la fila no se parta.
  const cupo = s.cupo ?? {}
  const deSemana = cupo.semana?.renuevaMs != null && s.ahora != null
    ? cuando(cupo.semana.renuevaMs, s.ahora, { corto: ancho < 104 })
    : cupo.semana?.renueva
  const filaCupo = cupo.cincoHoras || cupo.semana
    ? [...ventana('5 h', cupo.cincoHoras, cupo.cincoHoras?.renueva), dim('·'), ...ventana('semana', cupo.semana, deSemana)]
    : nada

  const ag = s.agentes ?? {}
  const filaAgentes = ag.puntos == null ? nada : [
    dim('corren'), fuerte(String(ag.corriendo ?? '—')),
    dim('· últimos 10 min'), fuerte(`${ag.puntos}/${ag.tope} pts`, COLOR[tramo((ag.puntos / ag.tope) * 100)]),
  ]

  const h = s.hora
  const filaHora = h == null ? [dim('sin hora fijada')] : [
    fuerte('laburando hasta ' + h.hasta),
    dim('· faltan ' + faltan(h.faltanMin) + (h.propia ? '' : ' (otra sesión)')),
    dim(recortar('«' + h.pedido + '»', Math.max(20, ancho - 52))), // lo que quede de ancho; corto, no se corta la banda
  ]

  // La plata de la API: por clave, lo gastado y lo que queda. «≈» cuando parte de la cuenta es estimada (pedidos
  // viejos sin la clave anotada). Lo que queda es crédito del plan menos lo anotado, no el saldo de Anthropic.
  const api = s.api
  let filaApi = nada
  if (api?.plan) {
    const p = api.plan
    const usado = p.credito ? tramo((p.gastado / p.credito) * 100) : 'sin'
    filaApi = api.viejo
      ? [dim('plan:'), fuerte('renovó' + (api.renueva ? ' el ' + api.renueva : '')), dim('· todavía sin gasto anotado')]
      : [
        dim('plan: gastado'), fuerte(usdRedondo(p.gastado)),
        ...(p.quedan == null ? [] : [dim('· quedan' + (api.estimado ? ' ≈' : '')), fuerte(usdRedondo(p.quedan), COLOR[usado])]),
        ...(api.renueva ? [dim('hasta el ' + api.renueva)] : []),
      ]
    for (const x of api.prestadas ?? []) {
      filaApi.push(...(x.agotada ? [dim('· prestada:'), fuerte('agotada')] : [dim('· prestada: gastado'), fuerte(usdRedondo(x.gastado)), dim('vence el ' + x.hasta)]))
    }
  }

  // La tarea automática de la madrugada: si corrió o no, por qué, y si dejó algo para mirar
  const n = s.noche
  let filaNoche = nada
  if (n) {
    const dia = cuando(n.cuandoMs, s.ahora) ?? 'sin fecha'
    const cola = []
    if (!n.corrio) cola.push(fuerte('no corrió', COLOR.ambar), ...(n.motivo ? [dim('· ' + n.motivo)] : []))
    else {
      cola.push(n.conError ? fuerte(`corrió con ${n.conError} de ${n.pasos} pasos con error`, COLOR.rojo) : fuerte(n.cortada ? 'se cortó antes de terminar' : 'corrió bien', n.cortada ? COLOR.ambar : COLOR.verde))
      if (n.paraMirar != null) cola.push(dim(n.paraMirar ? `· dejó ${n.paraMirar} ${n.paraMirar === 1 ? 'cosa' : 'cosas'} para mirar` : '· no dejó nada para mirar'))
      if (n.costoUsd) cola.push(dim('· ' + usd(n.costoUsd)))
    }
    filaNoche = [dim('tarea automática de'), fuerte(dia), ...cola]
  }

  const id = s.identidad ?? {}
  const filas = [
    dim([id.casa, id.proyecto].filter(Boolean).join(' · ') || 'tablero'),
    fila('cupo', filaCupo), fila('agentes', filaAgentes), fila('corte', filaHora), fila('api', filaApi), fila('noche', filaNoche),
  ]
  // `debajo`: lo que otros mods dibujan en la banda; va después, no se tapa
  return Box({ flexDirection: 'column', children: opciones.debajo ? [...filas, opciones.debajo] : filas })
}
