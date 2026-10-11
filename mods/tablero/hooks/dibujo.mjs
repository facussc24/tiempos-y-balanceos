// Dibujo PURO: de un estado a un árbol de elementos. Sin `$` ni disco, para probarlo
// con vitest. El mod le pasa los elementos de $.ui.resolve(e); sin ellos usa `crudo`,
// la misma forma plana { type, props, children } que la doc muestra para un sitio.
import { tramo } from './estado.mjs'

const nodo = (type) => ({ children = [], ...props } = {}) => ({ type, props, children: [].concat(children) })
export const crudo = { Box: nodo('Box'), Text: nodo('Text') }

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const COLOR = { verde: 'green', ambar: 'yellow', rojo: 'red' } // 'yellow' hace de ámbar: la doc nombra colores básicos

export const usd = (n) => 'US$ ' + n.toFixed(2).replace('.', ',')
export const barra = (pct) => { const c = Math.max(0, Math.min(10, Math.round(pct / 10))); return '█'.repeat(c) + '░'.repeat(10 - c) }
export const faltan = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`)
export const nombreMes = (aaaaMm) => MESES[Number(aaaaMm.slice(5, 7)) - 1] ?? aaaaMm
export const recortar = (t, n) => (t.length > n ? t.slice(0, Math.max(1, n - 1)).trimEnd() + '…' : t)

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

  const ventana = (nombre, v) => (v == null
    ? [dim(nombre), dim('—')]
    : [dim(nombre), fuerte(`${Math.round(v.pct)} %`, COLOR[v.tramo]), Text({ color: COLOR[v.tramo], children: [barra(v.pct)] }),
      ...(v.renueva ? [dim('renueva ' + v.renueva)] : [])])

  const cupo = s.cupo ?? {}
  const filaCupo = cupo.cincoHoras || cupo.semana
    ? [...ventana('5 h', cupo.cincoHoras), dim('·'), ...ventana('semana', cupo.semana)]
    : nada

  const ag = s.agentes ?? {}
  const filaAgentes = ag.puntos == null ? nada : [
    dim('corren'), fuerte(String(ag.corriendo ?? '—')),
    dim('· 10 min'), fuerte(`${ag.puntos}/${ag.tope} pts`, COLOR[tramo((ag.puntos / ag.tope) * 100)]),
  ]

  const h = s.hora
  const filaHora = h == null ? [dim('sin hora fijada')] : [
    fuerte('laburando hasta ' + h.hasta),
    dim('· faltan ' + faltan(h.faltanMin) + (h.propia ? '' : ' (otra sesión)')),
    dim(recortar('«' + h.pedido + '»', Math.max(20, ancho - 52))), // lo que quede de ancho; corto, no se corta la banda
  ]

  const api = s.api ?? {}
  const filaApi = api.hoy == null ? nada : [
    dim('hoy'), fuerte(usd(api.hoy)), dim(`· ${nombreMes(api.mes)}`), fuerte(usd(api.ciclo)),
    dim(`· ${api.llamadas} llamadas · en curso ${api.enCurso ?? '—'}` + (api.rotas ? ` · ${api.rotas} líneas rotas` : '')),
  ]

  const n = s.noche
  const filaNoche = n == null ? nada : [fuerte(n.fecha ?? 'fecha ?'), dim(`· ${n.prioridades ?? '—'} prioridades`)]

  const id = s.identidad ?? {}
  const filas = [
    dim([id.casa, id.proyecto].filter(Boolean).join(' · ') || 'tablero'),
    fila('cupo', filaCupo), fila('agentes', filaAgentes), fila('corte', filaHora), fila('api', filaApi), fila('noche', filaNoche),
  ]
  // `debajo`: lo que otros mods dibujan en la banda; va después, no se tapa
  return Box({ flexDirection: 'column', children: opciones.debajo ? [...filas, opciones.debajo] : filas })
}
