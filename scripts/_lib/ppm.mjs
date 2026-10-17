/**
 * ppm.mjs — las dos columnas nuevas de la hoja de los 4 numeros (scripts/_cuatroNumeros.mjs), tanda 9, pieza 10:
 * el «PPM del asistente» v0. Funciones puras: las ejerce __tests__/scripts/ppm.test.mjs.
 */

/**
 * PPM v0, columna A (tanda 9, pieza 10): reentregas con el MISMO metodo que dio «15 de 54» el 01/10 (commit 58139029):
 * entregas por SendUserFile agrupadas por carpeta (claveDe), una por carpeta y por turno de Fak; una sesion «reentrega»
 * si alguna carpeta se entrego en 3 turnos distintos o mas. Puro: `porSesion` = Map(ses -> Map(clave -> Set(turnos))).
 */
export function reentregasPorCarpeta(porSesion) {
  const conEntregas = [...porSesion.values()].filter((m) => m.size > 0).length;
  const conTres = [...porSesion.values()].filter((m) => [...m.values()].some((t) => t.size >= 3)).length;
  return { conEntregas, conTres };
}

/**
 * PPM v0, columna B: hallazgos del auditor aceptados sobre emitidos, de los informes de docs/auditorias/ que traen las
 * etiquetas de la pieza 3 (Importante / Nit / Preexistente) y la respuesta (arreglado / rechazado / a propósito / no
 * importa). Puro: recibe los textos. «Aceptado» = arreglado.
 */
export function hallazgosRespondidos(textos) {
  let informes = 0, emitidos = 0, respondidos = 0, arreglados = 0;
  // «respuesta: arreglado» o la celda en negrita «**arreglado**»; la leyenda «**arreglado / rechazado / …**» no cuenta.
  const resp = /respuesta:\s*(arreglado|rechazado|a prop[oó]sito|no importa)\b|\*\*(arreglado|rechazado|a prop[oó]sito|no importa)\*\*/gi;
  for (const t of textos) {
    const e = (t.match(/\[(Importante|Nit|Preexistente)\]/g) || []).length;
    if (!e) continue;
    informes += 1; emitidos += e;
    const rs = [...t.matchAll(resp)].map((m) => (m[1] || m[2]).toLowerCase());
    respondidos += rs.length; arreglados += rs.filter((r) => r === 'arreglado').length;
  }
  return { informes, emitidos, respondidos, arreglados };
}
