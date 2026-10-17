/**
 * programita.mjs — la lógica PURA de la página local del programita (scripts/_programita.mjs). Recibe textos y
 * números ya leídos y devuelve qué mostrar; no toca el disco, así se prueba con datos de ejemplo
 * (__tests__/scripts/programita.test.mjs).
 *
 * Fak, audio del 15/10/2026 17:58: «un programita propio nuestro, con el logo de Barack arriba a la izquierda… que nos
 * vaya diciendo qué tareas corren en segundo plano: los mails, las sincronizaciones, qué estamos haciendo en este
 * momento, si la nube está bien sincronizada… porque una vez se piensa que está todo funcionando bien y no es así».
 *
 * La regla de fondo: el verde o el rojo de una tarea sale de SU registro, no del Programador de tareas de Windows. El
 * 17/10 a las 10:37 la de mails terminó con 0 para Windows y su registro decía «Outlook clásico no está abierto».
 * El nombre de la tarea de Windows no se muestra: va la frase para Fak (`para_fak`), porque el nombre puede decir «Claude»
 * y ningún documento de Barack lo dice (core-prohibiciones.md §9).
 * Colores: verde = anda · ambar = ojo, no es una rotura · rojo = roto o atrasado · gris = sin dato o no aplica.
 */
import { leerNoche } from '../../mods/tablero/hooks/estado.mjs';

const dos = (n) => String(n).padStart(2, '0');
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** 'vie 17/10 10:37' en hora de esta PC; '—' si no hay hora. */
export function fechaHora(ms) {
  if (!Number.isFinite(ms)) return '—';
  const d = new Date(ms);
  return `${DIAS[d.getDay()]} ${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** 'hace 3 min', 'hace 2 h 10 min', 'hace 4 días'. */
export function hace(ms, ahora) {
  if (!Number.isFinite(ms)) return '';
  const min = Math.max(0, Math.round((ahora - ms) / 60000));
  if (min < 60) return `hace ${min} min`;
  if (min < 48 * 60) return `hace ${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
  return `hace ${Math.round(min / 1440)} días`;
}

// 'AAAA-MM-DD HH:MM[:SS]' en hora local → ms
export function msLocal(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(texto ?? '');
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)).getTime();
}

const sinDato = (detalle) => ({ color: 'gris', palabra: 'sin dato', detalle, cuandoMs: null });

/**
 * Los registros de la casa que terminan cada corrida con «AAAA-MM-DD HH:MM  RESULTADO[:] OK | ERROR… | PARCIAL…»
 * (_nubeSync.ps1, _syncMailsDiario.ps1, _backupSemanal.ps1). Una corrida nueva es un renglón escrito más de 2 min
 * después del último RESULTADO (los que una corrida agrega pegados a su resultado, como «backups/ ocupa N MB», no
 * cuentan): con menos de 20 min está en curso; con más, se murió sin anotar resultado (auditor 17/10: el 25/09 una
 * corrida de sync-diario.log arrancó a las 12:56 y nunca terminó, y la página decía «terminó bien» con la anterior).
 */
export function leerResultado(texto, ahora) {
  if (texto == null) return sinDato('no encuentro su registro');
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  let ultimo = null; let idx = -1;
  lineas.forEach((l, i) => {
    const m = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+RESULTADO:?\s*(.*)$/.exec(l.trim());
    if (m) { ultimo = { cuandoMs: msLocal(m[1]), texto: m[2].trim() }; idx = i; }
  });
  const despues = lineas.slice(idx + 1).map((l) => msLocal(l.trim())).filter(Number.isFinite)
    .filter((ms) => !ultimo || ms - ultimo.cuandoMs > 2 * 60000);
  if (despues.length) {
    const desde = Math.min(...despues);
    if (ahora - Math.max(...despues) < 20 * 60000) return { color: 'verde', palabra: 'corriendo', detalle: 'está corriendo ahora', cuandoMs: desde };
    return { color: 'rojo', palabra: 'roto', detalle: `empezó ${fechaHora(desde)} y no anotó ningún resultado`, cuandoMs: desde };
  }
  if (!ultimo) return { color: 'rojo', palabra: 'roto', detalle: 'el registro no tiene ningún resultado', cuandoMs: null };
  if (/^OK\b/i.test(ultimo.texto)) return { color: 'verde', palabra: 'terminó bien', detalle: '', cuandoMs: ultimo.cuandoMs };
  if (/^PARCIAL/i.test(ultimo.texto)) return { color: 'ambar', palabra: 'a medias', detalle: ultimo.texto.replace(/^PARCIAL\W*/i, ''), cuandoMs: ultimo.cuandoMs };
  return { color: 'rojo', palabra: 'roto', detalle: ultimo.texto, cuandoMs: ultimo.cuandoMs };
}

/**
 * mails.log de la tarea «mis mails a la nube»: 'AAAA-MM-DD HH:MM:SS codigo N {json}', o un aviso suelto
 * ('… sin nube: …'). Vale el último renglón.
 */
export function leerMails(texto) {
  if (texto == null) return sinDato('no encuentro su registro');
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return { color: 'rojo', palabra: 'roto', detalle: 'el registro está vacío', cuandoMs: null };
  const l = lineas[lineas.length - 1].trim();
  const cuandoMs = msLocal(l);
  const m = /^\S+ \S+ codigo (\d+) (\{.*\})\s*$/.exec(l);
  if (!m) return { color: 'rojo', palabra: 'roto', detalle: l.replace(/^\S+ \S+ /, '').slice(0, 140) || 'renglón que no entiendo', cuandoMs };
  let j = null;
  try { j = JSON.parse(m[2]); } catch { return { color: 'rojo', palabra: 'roto', detalle: 'renglón roto en el registro', cuandoMs }; }
  if (m[1] === '0' && j?.resultado === 'ok') {
    const nuevos = (j.casillas ?? []).reduce((s, c) => s + (Number(c?.nuevos) || 0), 0);
    return { color: 'verde', palabra: 'terminó bien', detalle: `${nuevos} mail${nuevos === 1 ? '' : 's'} nuevo${nuevos === 1 ? '' : 's'}`, cuandoMs };
  }
  return { color: 'rojo', palabra: 'roto', detalle: j?.detalle || j?.resultado || `código ${m[1]}`, cuandoMs };
}

/** nocturno.json, con la misma lectura que la banda del tablero. */
export function leerNocheTarea(texto, mtimeMs) {
  const n = leerNoche(texto, mtimeMs == null ? null : { mtimeMs });
  if (!n) return texto == null ? sinDato('no encuentro su registro') : { color: 'rojo', palabra: 'roto', detalle: 'el registro de la noche no se puede leer', cuandoMs: mtimeMs ?? null };
  if (!n.corrio) {
    const gastado = /tope de gasto/.test(n.motivo ?? '');
    return { color: gastado ? 'ambar' : 'rojo', palabra: gastado ? 'no corrió: API gastada' : 'no corrió', detalle: n.motivo ?? '', cuandoMs: n.cuandoMs };
  }
  if (n.conError || n.cortada || n.enPausa) return { color: 'rojo', palabra: 'terminó con errores', detalle: `${n.conError} paso(s) con error${n.cortada ? ', cortada' : ''}${n.enPausa ? `, ${n.enPausa} en pausa` : ''}`, cuandoMs: n.cuandoMs };
  return { color: 'verde', palabra: 'terminó bien', detalle: `${n.pasos} paso(s)`, cuandoMs: n.cuandoMs };
}

/**
 * El arb: el latido que el vigilante reescribe en cada vuelta (~/arb_fotos/vigilante_latido.txt: 'DD/MM HH:MM:SS  pid N
 * <paso>') y la cola de su registro (lanzador.log). Auditor 17/10: el registro tenía 300 vueltas seguidas de «sin red
 * al servidor» mientras Windows decía 0. Ronda 2: el ÚLTIMO renglón no alcanza, porque un «Fak usando la PC; espero» o
 * un «abriendo» quedan escritos encima de la falla (el registro no repite renglones iguales): manda la última falla que
 * no tenga un «login OK» después.
 */
const FALLA_ARB = /servidor no responde|sin red|No pude escribir|no pude traerla|sin confirmacion|sigue abierta|no tomo Aceptar/i;
export function leerArb(latido, colaLog, ahora) {
  const m = /^(\d\d)\/(\d\d) (\d\d):(\d\d):(\d\d)\s+pid \d+\s+(.*)$/.exec((latido ?? '').trim());
  if (!m) return latido == null ? sinDato('no encuentro el latido del vigilante del arb') : { color: 'rojo', palabra: 'roto', detalle: 'el latido del vigilante no se entiende', cuandoMs: null };
  const anio = new Date(ahora).getFullYear();
  let cuandoMs = new Date(anio, +m[2] - 1, +m[1], +m[3], +m[4], +m[5]).getTime();
  if (cuandoMs > ahora + 86400000) cuandoMs = new Date(anio - 1, +m[2] - 1, +m[1], +m[3], +m[4], +m[5]).getTime();
  const paso = m[6].trim();
  if (ahora - cuandoMs > 15 * 60000) return { color: 'rojo', palabra: 'roto', detalle: `el vigilante no late desde ${fechaHora(cuandoMs)}`, cuandoMs };
  if (/^arb abierto/.test(paso)) return { color: 'verde', palabra: 'disponible', detalle: 'el arb está abierto', cuandoMs };
  if (/^pausado/.test(paso)) return { color: 'ambar', palabra: 'en pausa', detalle: 'el vigilante está pausado a mano', cuandoMs };
  const renglones = (Array.isArray(colaLog) ? colaLog : String(colaLog ?? '').split(/\r?\n/)).map((l) => l.trim()).filter(Boolean);
  let falla = null;
  for (const l of renglones) {
    if (/login OK/i.test(l)) falla = null;
    else if (FALLA_ARB.test(l)) falla = l.replace(/^\d\d\/\d\d \d\d:\d\d:\d\d\s+/, '');
  }
  if (falla) return { color: 'rojo', palabra: 'roto', detalle: `el arb está cerrado y no lo puede abrir: ${falla}`, cuandoMs };
  if (/bloqueado|usando la PC/i.test(paso)) return { color: 'ambar', palabra: 'esperando', detalle: paso, cuandoMs };
  return { color: 'verde', palabra: 'corriendo', detalle: paso, cuandoMs };
}

/** Solo lo que dice Windows (para una tarea sin registro propio). */
export function leerWindows(win) {
  if (!win) return sinDato('Windows no la tiene registrada');
  const r = win.ultimoResultado;
  if (r === 0) return { color: 'verde', palabra: 'terminó bien', detalle: 'según Windows', cuandoMs: win.ultimaMs };
  if (r === 267009) return { color: 'verde', palabra: 'corriendo', detalle: 'según Windows', cuandoMs: win.ultimaMs };
  return { color: 'rojo', palabra: 'roto', detalle: `Windows dice código ${r}`, cuandoMs: win.ultimaMs };
}

/**
 * Una tarea de la casa: la lectura de su registro + lo que dice Windows (próxima corrida, apagada) + el atraso: su
 * último resultado tiene más de `atrasada_si_pasan_minutos` (cada tarea con su número y su porqué en el canon; el
 * «doble del intervalo» de la primera versión no tenía fuente y daba rojo falso todas las noches, auditor 17/10).
 */
export function armarTarea(def, lectura, win, ahora) {
  const t = { nombre: def.nombre, paraFak: def.para_fak, ...lectura, proximaMs: win?.proximaMs ?? null, avisos: [] };
  if (!win) t.avisos.push('Windows no la tiene registrada en esta PC');
  else if (win.estado === 'Disabled') { t.color = 'rojo'; t.palabra = 'apagada'; t.avisos.push('la tarea está apagada en Windows'); }
  const tope = def.atrasada_si_pasan_minutos;
  if (tope && t.palabra !== 'corriendo' && Number.isFinite(t.cuandoMs) && ahora - t.cuandoMs > tope * 60000) {
    t.color = 'rojo';
    t.avisos.push(`atrasada: su último resultado es de ${hace(t.cuandoMs, ahora)}${def.cuando_corre ? ` y corre ${def.cuando_corre}` : ''}`);
  }
  return t;
}

/**
 * Una sesión abierta de la app. `app`: el registro de la app (title, lastActivityAt, postTurnSummary, model,
 * permissionMode, scheduledTaskId). `est`: estadoDe() de colgados.mjs sobre su conversación, o null.
 */
export function estadoSesion(app, est, ahora) {
  const cat = app?.postTurnSummary?.status_category ?? null;
  // la app anota lastActivityAt por turno; la conversación se escribe a cada herramienta: vale la más nueva
  const horas = [app?.lastActivityAt, est?.ultimoMs].filter(Number.isFinite);
  // la página lleva el logo de Barack: el nombre del asistente no aparece (core-prohibiciones.md §9). Los títulos de
  // sesión de Fak y los ids de tarea lo traen a veces (auditor 17/10: 4 sesiones de 7 días): se muestra «asistente»;
  // el dato de origen no se toca. Solo acá, no en todo el texto: una ruta real (`Claude Fak\…`) no se deforma.
  const sinNombre = (s) => (s == null ? s : String(s).replace(/claude/gi, 'asistente'));
  const base = { titulo: sinNombre(app?.title) || '(sin título)', ultimaMs: horas.length ? Math.max(...horas) : null, modelo: app?.model ?? '', tarea: sinNombre(app?.scheduledTaskId ?? null) };
  if (est?.estado === 'trabajando') return { ...base, color: 'verde', palabra: 'corriendo', detalle: '' };
  if (est?.estado === 'espera_herramienta') return { ...base, color: 'rojo', palabra: `quieta hace ${est.quietaMin} min`, detalle: 'espera una herramienta: casi siempre un cartel de permiso' };
  if (est?.estado === 'espera_modelo') return { ...base, color: 'rojo', palabra: `quieta hace ${est.quietaMin} min`, detalle: 'quedó a mitad de un turno' };
  if (cat === 'blocked') return { ...base, color: 'ambar', palabra: 'espera algo tuyo', detalle: '' };
  if (cat === 'review_ready') return { ...base, color: 'verde', palabra: 'terminó: para revisar', detalle: '' };
  if (cat === 'completed') return { ...base, color: 'gris', palabra: 'terminó', detalle: '' };
  return { ...base, color: 'gris', palabra: 'terminó su turno', detalle: '' };
}

/**
 * seguimiento.log de `bambu_red.py --seguir`: '<hora> ESTADO etapa N capa a/b P % faltan M min … [| detector exito X
 * falla Y] [| ALARMA DEL DETECTOR]', y renglones '<hora> SALIDA n: texto' o '<hora> SIN CONEXION desde …'. La hora va
 * como 'HH:MM:SS' (hasta el 16/10) o con fecha y zona, '2026-10-17T11:44:49-03:00' (desde b47e890d, 16/10: el auditor
 * del 17/10 midió que con solo la hora 595 de 595 renglones nuevos salían «sin datos de capa»). Sin fecha en el renglón,
 * la fecha sale de la del archivo.
 */
export function leerSeguimiento(texto, mtimeMs, ahora, { umbral = 0.45, recienteMin = 7 } = {}) {
  if (texto == null) return { color: 'gris', palabra: 'sin impresiones', detalle: 'no encuentro ningún seguimiento', cuandoMs: null };
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  const HORA = String.raw`^(?:\d{4}-\d{2}-\d{2}T)?(\d\d:\d\d):\d\d(?:\.\d+)?(?:Z|[+-]\d\d:?\d\d)?\s+`;
  let estado = null; let salida = null;
  for (const l of lineas) {
    const m = new RegExp(`${HORA}([A-Z_]+) etapa -?\\d+ capa (\\d+)\\/(\\d+) (\\d+) % faltan (\\d+) min`).exec(l);
    if (m) {
      const d = /detector exito ([\d.]+) falla ([\d.]+)/.exec(l);
      estado = { hora: m[1], gcode: m[2], capa: +m[3], capas: +m[4], pct: +m[5], faltan: +m[6], exito: d ? +d[1] : null, falla: d ? +d[2] : null, alarma: /ALARMA DEL DETECTOR/.test(l) };
      salida = null;
    }
    const s = /SALIDA (\d+): (.*)$/.exec(l);
    if (s) salida = { codigo: +s[1], texto: s[2] };
    if (/ SIN CONEXION /.test(l)) salida = { codigo: 12, texto: l.replace(new RegExp(HORA), '') };
  }
  // la alarma del detector: la vigilancia sale con 11 SIN escribir un renglón SALIDA (bambu_red.py hace `return 11`
  // fuera de terminar()), así que el último renglón de capa con ALARMA queda como el último dato y vale aunque el registro
  // ya no se mueva (auditor ronda 2: a los 8 min la página decía «no imprime» con la impresora imprimiendo). La salida
  // 16 tampoco deja renglón: esa no se puede ver desde el registro.
  if (estado?.alarma && !salida && Number.isFinite(mtimeMs) && ahora - mtimeMs < 12 * 3600000) {
    return { color: 'rojo', palabra: 'el detector avisó', detalle: `capa ${estado.capa} de ${estado.capas}: mirar la última foto; la vigilancia se cortó con la alarma`, cuandoMs: mtimeMs };
  }
  // lo último que pasó después del último renglón de capa manda: sin conexión, quieta, detector, fallada
  if (salida && Number.isFinite(mtimeMs) && ahora - mtimeMs < 12 * 3600000) {
    if (salida.codigo === 12) return { color: 'ambar', palabra: 'sin conexión', detalle: `${salida.texto}: no se sabe si sigue imprimiendo; que alguien mire la pantalla`, cuandoMs: mtimeMs };
    // salidas de la tabla «Cómo se corre» de la skill impresion-3d-bambu: 2 pausa o alarma; 1, 3, 11, 13 y 16 algo anda mal
    if (salida.codigo === 2) return { color: 'ambar', palabra: 'en pausa o con alarma', detalle: salida.texto, cuandoMs: mtimeMs };
    if ([1, 3, 11, 13, 16].includes(salida.codigo)) return { color: 'rojo', palabra: salida.codigo === 11 ? 'el detector avisó' : 'roto', detalle: salida.texto, cuandoMs: mtimeMs };
  }
  const coma = (n) => n.toFixed(2).replace('.', ',');
  const detector = estado?.exito != null ? `detector: distancia a «sana» ${coma(estado.exito)}, a «fallada» ${coma(estado.falla)} (avisa si pasa ${coma(umbral)} tres veces seguidas)` : '';
  const reciente = Number.isFinite(mtimeMs) && ahora - mtimeMs < recienteMin * 60000;
  if (!estado) return { color: 'gris', palabra: 'sin datos de capa', detalle: salida?.texto ?? '', cuandoMs: mtimeMs ?? null };
  const avance = `capa ${estado.capa} de ${estado.capas}, ${estado.pct} %`;
  if (reciente && estado.alarma) return { color: 'rojo', palabra: 'imprimiendo: el detector avisa', detalle: `${avance}. ${detector}`, cuandoMs: mtimeMs, imprimiendo: true };
  if (reciente && ['RUNNING', 'PREPARE', 'SLICING'].includes(estado.gcode)) return { color: 'verde', palabra: 'imprimiendo', detalle: `${avance}, faltan ${estado.faltan} min${detector ? `. ${detector}` : ''}`, cuandoMs: mtimeMs, imprimiendo: true };
  if (reciente && estado.gcode === 'PAUSE') return { color: 'ambar', palabra: 'en pausa', detalle: avance, cuandoMs: mtimeMs, imprimiendo: true };
  if (estado.gcode === 'FINISH') return { color: 'gris', palabra: 'no imprime', detalle: `la última terminó (${estado.capas} capas) a las ${estado.hora}`, cuandoMs: mtimeMs };
  if (estado.gcode === 'FAILED') return { color: reciente ? 'rojo' : 'gris', palabra: reciente ? 'falló' : 'no imprime', detalle: `la última falló en la capa ${estado.capa} de ${estado.capas}`, cuandoMs: mtimeMs };
  return { color: 'gris', palabra: 'no imprime', detalle: `el último seguimiento quedó en ${avance} a las ${estado.hora}${salida ? ` (${salida.texto})` : ''}`, cuandoMs: mtimeMs };
}

/** La nube: la salida de _nubeSubio.ps1 (código y texto) medida a una hora. */
export function leerNube(medicion) {
  if (!medicion) return sinDato('todavía no se midió');
  const { codigo, texto, cuandoMs } = medicion;
  const m = /pendientes de subir: (\d+) \(([\d.,]+) MB\)/.exec(texto ?? '');
  if (codigo === 0) return { color: 'verde', palabra: 'subió todo', detalle: 'no queda nada pendiente', cuandoMs };
  if (codigo === 1 && m) {
    const ejemplos = (texto.match(/^\s+\d\d\/\d\d \d\d:\d\d .*$/gm) ?? []).slice(0, 3).map((s) => s.trim());
    return { color: 'rojo', palabra: 'falta subir', detalle: `${m[1]} archivo(s) sin subir (${m[2]} MB)`, ejemplos, sinOneDrive: /OneDrive NO esta corriendo/.test(texto), cuandoMs };
  }
  return { color: 'rojo', palabra: 'roto', detalle: (texto ?? '').trim().split(/\r?\n/)[0] || `el chequeo salió con ${codigo}`, cuandoMs };
}

/** _ESTADO.json de la nube: el último sync de cada PC. */
export function leerEstadoNube(texto) {
  if (texto == null) return [];
  let d; try { d = JSON.parse(texto); } catch { return []; }
  return Object.entries(d?.por_pc ?? {}).map(([pc, e]) => ({ pc, cuandoMs: Date.parse(e?.ultimoSync ?? '') || null, archivos: e?.archivos ?? null, conflictos: e?.conflictos ?? null }));
}

/** El último selftest de una skill, guardado con su hora. */
export function leerSelftest(def, guardado) {
  if (!def.comandos?.length) return { skill: def.skill, paraFak: def.para_fak, color: 'gris', palabra: 'sin selftest', detalle: def.sin_selftest ?? '', cuandoMs: null };
  if (!guardado) return { skill: def.skill, paraFak: def.para_fak, color: 'gris', palabra: 'sin correr todavía', detalle: '', cuandoMs: null };
  return { skill: def.skill, paraFak: def.para_fak, color: guardado.ok ? 'verde' : 'rojo', palabra: guardado.ok ? 'disponible' : 'roto', detalle: guardado.ok ? (guardado.resumen ?? '') : (guardado.resumen || 'el selftest falló'), cuandoMs: guardado.cuandoMs };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** La página entera. `e`: { ahora, sesiones, tareas, nube, nubePcs, impresora, selftests, refresco, logo, foto, pc }. */
export function html(e) {
  const punto = (c, p) => `<span class="est ${c}"><i></i>${esc(p)}</span>`;
  const cuando = (ms) => (Number.isFinite(ms) ? `<span class="cu">${esc(fechaHora(ms))} · ${esc(hace(ms, e.ahora))}</span>` : '<span class="cu">—</span>');
  const filaTarea = (t) => `<tr><td><b>${esc(t.paraFak)}</b></td><td>${punto(t.color, t.palabra)}${t.detalle ? `<div class="det">${esc(t.detalle)}</div>` : ''}${t.avisos.map((a) => `<div class="det rojo-t">${esc(a)}</div>`).join('')}</td><td>${cuando(t.cuandoMs)}</td><td>${Number.isFinite(t.proximaMs) ? `<span class="cu">${esc(fechaHora(t.proximaMs))}</span>` : '<span class="cu">—</span>'}</td></tr>`;
  const filaSesion = (s) => `<tr><td><b>${esc(s.titulo)}</b>${s.tarea ? `<div class="cu">la lanzó la tarea ${esc(s.tarea)}</div>` : ''}</td><td>${punto(s.color, s.palabra)}${s.detalle ? `<div class="det">${esc(s.detalle)}</div>` : ''}</td><td>${cuando(s.ultimaMs)}</td></tr>`;
  const filaSelftest = (s) => `<tr><td><b>${esc(s.paraFak)}</b><div class="cu">${esc(s.skill)}</div></td><td>${punto(s.color, s.palabra)}${s.detalle ? `<div class="det">${esc(s.detalle)}</div>` : ''}</td><td>${cuando(s.cuandoMs)}</td></tr>`;
  const n = e.nube;
  const imp = e.impresora;
  const rojos = [...e.tareas, ...e.sesiones, ...e.selftests, n, imp].filter((x) => x && x.color === 'rojo').length;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="${e.refresco}"><title>Barack · tareas en segundo plano</title><style>
:root{--fondo:#eceff1;--hoja:#fff;--texto:#111827;--suave:#4b5563;--borde:#d0d5da;--verde:#1a7f37;--ambar:#9a6700;--rojo:#cf222e;--gris:#6b7280}
body{margin:0;background:var(--fondo);color:var(--texto);font-family:"Segoe UI",system-ui,sans-serif;font-size:15px;line-height:1.45}
header{display:flex;align-items:center;gap:16px;background:var(--hoja);border-bottom:1px solid var(--borde);padding:10px 16px}
header img{height:42px}header h1{font-size:19px;margin:0}header .cu{margin-left:auto;text-align:right}
main{max-width:1180px;margin:0 auto;padding:14px 16px 30px}
section{background:var(--hoja);border:1px solid var(--borde);border-radius:8px;padding:12px 14px;margin-bottom:14px}
h2{font-size:16px;margin:0 0 8px}table{width:100%;border-collapse:collapse}td,th{text-align:left;vertical-align:top;padding:6px 8px;border-top:1px solid var(--borde)}
th{font-size:12px;color:var(--suave);font-weight:600;border-top:0}
.cu{color:var(--suave);font-size:12.5px}.det{color:var(--suave);font-size:13px}.rojo-t{color:var(--rojo)}
.est{font-weight:600;white-space:nowrap}.est i{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:6px;vertical-align:-1px}
.verde{color:var(--verde)}.verde i{background:var(--verde)}.ambar{color:var(--ambar)}.ambar i{background:var(--ambar)}
.rojo{color:var(--rojo)}.rojo i{background:var(--rojo)}.gris{color:var(--gris)}.gris i{background:var(--gris)}
.imp{display:flex;gap:14px;flex-wrap:wrap}.imp img{max-width:360px;width:100%;border-radius:6px;border:1px solid var(--borde)}
.resumen{font-size:15px;margin:0 0 12px}
@media (max-width:640px){td,th{padding:5px 4px}header h1{font-size:16px}}
</style></head><body>
<header><img src="${esc(e.logo)}" alt="Barack"><h1>Tareas en segundo plano</h1><div class="cu">actualizado ${esc(fechaHora(e.ahora))}<br>se recarga cada ${e.refresco} s · PC ${esc(e.pc ?? '')}</div></header>
<main>
<p class="resumen">${rojos ? `<b class="rojo">${rojos} cosa${rojos === 1 ? '' : 's'} en rojo</b>: mirá abajo.` : '<b class="verde">Nada en rojo.</b>'}</p>
<section><h2>Qué se está haciendo ahora (sesiones de las últimas ${e.sesionesHoras} h)</h2>
${e.sesiones.length ? `<table><tr><th>Sesión</th><th>Estado</th><th>Última actividad</th></tr>${e.sesiones.map(filaSesion).join('')}</table>` : '<p class="det">No hay sesiones con actividad.</p>'}</section>
<section><h2>Tareas programadas</h2><table><tr><th>Tarea</th><th>Última corrida</th><th>Cuándo</th><th>Próxima</th></tr>${e.tareas.map(filaTarea).join('')}</table>
<p class="cu">El color sale del registro de cada tarea, no de Windows: Windows puede decir «terminó» aunque la tarea no haya hecho su trabajo.</p></section>
<section><h2>La nube de Ingeniería</h2><table><tr><th>Qué</th><th>Estado</th><th>Medido</th></tr>
<tr><td><b>¿Subió todo?</b></td><td>${punto(n.color, n.palabra)}${n.detalle ? `<div class="det">${esc(n.detalle)}</div>` : ''}${n.sinOneDrive ? '<div class="det rojo-t">OneDrive no está corriendo</div>' : ''}${(n.ejemplos ?? []).map((x) => `<div class="cu">${esc(x)}</div>`).join('')}</td><td>${cuando(n.cuandoMs)}</td></tr>
${e.nubePcs.map((p) => `<tr><td>Memoria y configuración desde ${esc(p.pc)}</td><td class="det">${p.archivos ?? '?'} archivo(s) en el último sync${p.conflictos ? `, ${p.conflictos} conflicto(s)` : ''}</td><td>${cuando(p.cuandoMs)}</td></tr>`).join('')}</table></section>
<section><h2>La impresora 3D</h2><div class="imp"><div>${punto(imp.color, imp.palabra)}${imp.detalle ? `<div class="det">${esc(imp.detalle)}</div>` : ''}<div>${cuando(imp.cuandoMs)}</div>${imp.carpeta ? `<div class="cu">${esc(imp.carpeta)}</div>` : ''}<div class="cu">Se lee el registro que deja el seguimiento; acá no se le habla a la impresora.</div></div>
${e.foto ? `<div><img src="${esc(e.foto)}" alt="Última foto de la cámara"><div class="cu">última foto de la cámara${Number.isFinite(e.fotoMs) ? ` · ${esc(fechaHora(e.fotoMs))}` : ''}</div></div>` : ''}</div></section>
<section><h2>Salud de cada skill (su último selftest)</h2><table><tr><th>Skill</th><th>Resultado</th><th>Corrido</th></tr>${e.selftests.map(filaSelftest).join('')}</table>
<p class="cu">Además de las tres que se pidieron (impresora, hojas de proceso y diseño 3D) entran las otras skills que ya tienen selftest. Se vuelven a correr solos cada ${e.selftestsHoras} h mientras la página está abierta.</p></section>
</main></body></html>`;
}
