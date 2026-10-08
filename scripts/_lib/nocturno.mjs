/**
 * nocturno.mjs — lo puro de scripts/_nocturno.mjs: la noche de Claude que gasta los creditos de la
 * API del plan Max en trabajo util mientras la notebook no se usa.
 *
 * LO QUE APRENDIMOS ANTES (y por que esto tiene esta forma). La auto-mejora nocturna anterior se
 * APAGO el 04/08/2026: 0 auditorias exitosas en 280.370 lineas de log, 47.522 timeouts y un fork
 * bomb de `claude -p`. Por eso la noche nueva es un `node` suelto que habla con la API por el SDK:
 *   - nunca lanza `claude -p` ni procesos en cadena; los pasos corren uno detras del otro;
 *   - cada paso es independiente: el que falla queda como 'error' con su detalle y los demas siguen;
 *   - ningun paso deja un archivo a medias (se escribe a .tmp y se renombra);
 *   - "resultado vacio" es error, no exito: el envoltorio .ps1 lo verifica mirando el estado;
 *   - no toca el repo, ni Supabase (solo lectura), ni el arb, ni Outlook: lo prueba
 *     __tests__/scripts/candadosNocturno.test.mjs leyendo el texto de estos archivos.
 *
 * El entregable de la noche es un archivo de TRABAJO para la sesion de la manana
 * (.claude/state/nocturno.json + reports/staging/), nunca un informe para Fak.
 */

export const NOMBRE_TAREA = 'Barack - Noche de Claude (API)';
export const HORA_TAREA = '06:30';
/** El orden en que corren. `--solo <paso>` acepta uno de estos. */
export const PASOS = Object.freeze(['preauditoria', 'mails', 'novedades']);
export const HORAS_VIEJO = 26;

// ─────────────────────────────────────────────────────────────────────────────
// Arranque y pasos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿Arranca la noche? Con el presupuesto del mes en rojo NO (salvo `sinTope`): es el unico freno
 * del gasto, y es pasivo (no corta una llamada a mitad, decide antes de empezar).
 */
export function debeArrancar(presupuesto, { sinTope = false } = {}) {
  if (!presupuesto) return { ok: true, motivo: '' };
  if (presupuesto.semaforo === 'rojo' && !sinTope) {
    return { ok: false, motivo: `presupuesto del mes en rojo: $${Number(presupuesto.gastadoUsd).toFixed(2)} de $${presupuesto.presupuestoUsd}. No arranco (--sin-tope para forzar).` };
  }
  return { ok: true, motivo: '' };
}

/**
 * Corre los pasos en orden. Cada paso: { nombre, correr: async () => ({ detalle, costoUsd?, saltado?, datos? }) }.
 * Un paso que tira queda 'error' con el mensaje; uno que devuelve `saltado` queda 'saltado'; con
 * `solo` los demas quedan 'saltado'. Nunca tira: devuelve [{ nombre, estado, detalle, costoUsd, datos }].
 */
export async function correrPasos(pasos, { solo = null, alTerminar = () => {} } = {}) {
  const out = [];
  for (const p of pasos) {
    let fila;
    if (solo && p.nombre !== solo) {
      fila = { nombre: p.nombre, estado: 'saltado', detalle: `--solo ${solo}`, costoUsd: 0, datos: null };
    } else {
      try {
        const r = (await p.correr()) || {};
        fila = {
          nombre: p.nombre,
          estado: r.saltado ? 'saltado' : 'ok',
          detalle: String(r.detalle ?? ''),
          costoUsd: Number(r.costoUsd) || 0,
          datos: r.datos ?? null,
        };
      } catch (e) {
        fila = {
          nombre: p.nombre, estado: 'error', detalle: String(e?.message ?? e).slice(0, 400),
          costoUsd: Number(e?.costoUsd ?? e?.respuesta?.costoUsd) || 0, datos: null,
        };
      }
    }
    out.push(fila);
    alTerminar(fila);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mails sin respuesta: elegir, recortar, pedir, filtrar
// ─────────────────────────────────────────────────────────────────────────────

export const TOPE_MAILS = 12;
export const TOPE_CUERPO = 1500;
export const AREAS = Object.freeze(['ingenieria', 'calidad', 'logistica', 'otra']);

/** Hasta `tope` pedidos, los mas viejos primero (como los devuelve _mails.py --sin-respuesta). */
export function elegirPedidos(pedidos, tope = TOPE_MAILS) {
  return (Array.isArray(pedidos) ? pedidos : []).filter((p) => p && p.asunto).slice(0, tope);
}

/**
 * Para cada pedido, el mail que corresponde: el de su `id` (el ultimo recibido del hilo), o si no
 * esta, el mas nuevo de la Bandeja con la misma clave de hilo. `mails`: [{ id, asunto, de, fecha,
 * carpeta, cuerpo }]. `claveHilo` se inyecta (vive en mailCache.mjs). Devuelve [{ pedido, mail|null }].
 */
export function emparejarMails(pedidos, mails, claveHilo) {
  const porId = new Map();
  const porClave = new Map();
  for (const m of mails) {
    if (m.id) porId.set(String(m.id), m);
    if (!/bandeja de entrada/i.test(String(m.carpeta ?? ''))) continue;
    const k = claveHilo(m.asunto);
    const previo = porClave.get(k);
    if (!previo || String(m.fecha) > String(previo.fecha)) porClave.set(k, m);
  }
  return pedidos.map((p) => ({ pedido: p, mail: (p.id && porId.get(String(p.id))) || porClave.get(p.hilo || claveHilo(p.asunto)) || null }));
}

/** El cuerpo propio del mail (sin lo citado ni la firma; `cuerpoPropio` se inyecta), recortado. */
export function recortarCuerpo(texto, cuerpoPropio, tope = TOPE_CUERPO) {
  let t = '';
  try { t = cuerpoPropio(texto); } catch { t = String(texto ?? ''); }
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return t.length > tope ? `${t.slice(0, tope)}…` : t;
}

export const SYSTEM_MAILS = `Resumís mails que le mandaron a Facundo (ingeniero de procesos de Barack Mercosul, autopartista argentina) y que él todavía no contestó. Para cada mail, UNA línea de hasta 120 caracteres que diga qué le piden, en castellano rioplatense simple, sin saludo ni adornos. Si el mail no pide nada concreto, decí "no pide nada concreto: <de qué habla>".

El área es de quién es el tema, no de quién escribe: "ingenieria" (procesos, AMFE, planos, BOM, hojas de proceso, tiempos, dispositivos), "calidad" (reclamos, auditorías, PPAP, controles, 8D), "logistica" (embalaje, envíos, stock, proveedores, compras), "otra" (lo demás). Se etiqueta, no se filtra: todos los mails van en la respuesta, en el mismo orden, con el asunto tal cual.

No inventes plazos, nombres ni números que no estén en el mail. No propongas respuestas. Devolvés SOLO el JSON del esquema.`;

export const SCHEMA_MAILS = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['lineas'],
  properties: {
    lineas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['asunto', 'linea', 'area'],
        properties: {
          asunto: { type: 'string' },
          linea: { type: 'string', description: 'que piden, hasta 120 caracteres' },
          area: { type: 'string', enum: [...AREAS] },
        },
      },
    },
  },
});

/** El mensaje para Haiku: un bloque por mail, numerado, con lo minimo. */
export function armarPedidoMails(pares) {
  const bloques = pares.map(({ pedido, cuerpo }, i) => [
    `### ${i + 1}. asunto: ${pedido.asunto}`,
    `de: ${pedido.de} · fecha: ${pedido.fecha} · ${pedido.dias} días sin respuesta${pedido.estado && pedido.estado !== 'sin respuesta' ? ` · ${pedido.estado}` : ''}`,
    cuerpo ? `cuerpo:\n${cuerpo}` : 'cuerpo: (no está en el cache: resumí por el asunto)',
  ].join('\n'));
  return { usuario: `${bloques.join('\n\n')}\n\nDevolvé el JSON con una línea por mail, en el mismo orden.`, schema: SCHEMA_MAILS };
}

const corto = (t, n) => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/**
 * Lo que vuelve de Haiku contra lo que se le mando: una linea por pedido, en el orden de los
 * pedidos. Si el modelo salteo uno o cambio el asunto, ese pedido queda con la linea "(sin resumen)"
 * en vez de desaparecer: un mail que se cae del resumen es un pedido que nadie ve.
 */
export function lineasDeMails(pedidos, respuesta) {
  const lineas = Array.isArray(respuesta?.lineas) ? respuesta.lineas : [];
  return pedidos.map((p, i) => {
    const l = lineas[i] && corto(lineas[i].asunto, 200) === corto(p.asunto, 200)
      ? lineas[i]
      : lineas.find((x) => corto(x?.asunto, 200) === corto(p.asunto, 200));
    return {
      asunto: corto(p.asunto, 120),
      de: corto(p.de, 40),
      dias: Number(p.dias) || 0,
      estado: p.estado || 'sin respuesta',
      linea: l ? corto(l.linea, 120) : '(sin resumen: abrir el mail)',
      area: l && AREAS.includes(l.area) ? l.area : 'otra',
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Novedades de Claude
// ─────────────────────────────────────────────────────────────────────────────

/** ¿Toca leer novedades esta noche? Los lunes, o si `avisoHook` dice que paso una semana. */
export function tocaNovedades(ahora, aviso) {
  return ahora.getDay() === 1 || !!String(aviso ?? '').trim();
}

/** Un listado de _novedadesClaude.mjs sin posteos ni versiones nuevas no vale una llamada. */
export function novedadesSinCambios(texto) {
  const t = String(texto ?? '');
  return !/^- \*\*/m.test(t) && !/^### \d+\.\d+\.\d+/m.test(t);
}

export const SYSTEM_NOVEDADES = `Leés el listado de novedades de Claude Code (posteos públicos del equipo de Anthropic y el registro de cambios oficial) para un repo de ingeniería de procesos que usa Claude Code todos los días con hooks, skills, subagentes, scripts en Node y la API de Anthropic. Devolvés como mucho 8 renglones, en castellano rioplatense simple, cada uno con la forma:

- nos sirve: <qué y para qué, en una frase> — <URL>
- nos puede romper: <qué y por qué, en una frase> — <URL>

Solo lo que está en el listado; cada renglón con la URL del posteo o "registro de cambios <versión>". Sin introducción ni cierre. Si no hay nada que sirva ni que pueda romper, un solo renglón: "- sin novedades que nos toquen".`;

// ─────────────────────────────────────────────────────────────────────────────
// Estado de la noche y linea del tablero
// ─────────────────────────────────────────────────────────────────────────────

const p2 = (x) => String(x).padStart(2, '0');
const ddmm = (f) => `${p2(f.getDate())}/${p2(f.getMonth() + 1)}`;
const hhmm = (f) => `${p2(f.getHours())}:${p2(f.getMinutes())}`;
const plata = (x) => `$${(Math.round((Number(x) || 0) * 100) / 100).toFixed(2).replace('.', ',')}`;

/**
 * La linea que lee el tablero:
 * "Noche 08/10 06:31 · pre-auditoría AMFE: 3 revisados · 2 hallazgos para verificar (1 nuevo) ·
 *  4 mails resumidos · novedades: sin cambios · $0,41 (mes $12,30 de $100, verde)"
 */
export function lineaTablero({ fin, pasos = [], costoUsd = 0, presupuesto = null, noArranco = '' } = {}) {
  const f = fin instanceof Date ? fin : new Date(fin ?? Date.now());
  const partes = [`Noche ${ddmm(f)} ${hhmm(f)}`];
  if (noArranco) {
    partes.push(`no arrancó: ${noArranco}`);
  } else {
    const paso = (n) => pasos.find((p) => p.nombre === n);
    const pre = paso('preauditoria');
    if (pre) {
      if (pre.estado === 'error') partes.push(`pre-auditoría AMFE: ERROR (${corto(pre.detalle, 80)})`);
      else if (pre.estado === 'ok') partes.push(pre.detalle || 'pre-auditoría AMFE: ok');
    }
    const mails = paso('mails');
    if (mails) {
      if (mails.estado === 'error') partes.push(`mails: ERROR (${corto(mails.detalle, 80)})`);
      else if (mails.estado === 'ok') partes.push(mails.detalle || 'mails: ok');
    }
    const nov = paso('novedades');
    if (nov) {
      if (nov.estado === 'error') partes.push(`novedades: ERROR (${corto(nov.detalle, 60)})`);
      else if (nov.estado === 'ok') partes.push(`novedades: ${nov.detalle || 'ok'}`);
      else if (nov.estado === 'saltado' && !/^--solo/.test(nov.detalle)) partes.push('novedades: no tocaba');
    }
  }
  const mes = presupuesto ? ` (mes ${plata(presupuesto.gastadoUsd)} de $${presupuesto.presupuestoUsd}, ${presupuesto.semaforo})` : '';
  partes.push(`${plata(costoUsd)}${mes}`);
  return partes.join(' · ');
}

/** El JSON de .claude/state/nocturno.json (lo lee el tablero y la sesion de la manana). */
export function armarEstado({ inicio, fin, pasos = [], presupuesto = null, noArranco = '', mails = [], hallazgos = null, reporte = null, resumenNovedades = null }) {
  const costoUsd = Math.round(pasos.reduce((s, p) => s + (Number(p.costoUsd) || 0), 0) * 1e6) / 1e6;
  const fi = fin instanceof Date ? fin : new Date(fin);
  const ini = inicio instanceof Date ? inicio : new Date(inicio);
  const local = (f) => `${f.getFullYear()}-${p2(f.getMonth() + 1)}-${p2(f.getDate())} ${hhmm(f)}:${p2(f.getSeconds())}`;
  return {
    fecha: local(fi).slice(0, 10),
    inicio: local(ini),
    fin: local(fi),
    finMs: fi.getTime(),
    pasos: pasos.map(({ nombre, estado, detalle, costoUsd: c }) => ({ nombre, estado, detalle, costoUsd: Number(c) || 0 })),
    costoUsd,
    presupuesto,
    noArranco: noArranco || null,
    lineaTablero: lineaTablero({ fin: fi, pasos, costoUsd, presupuesto, noArranco }),
    mails,
    hallazgos,
    reporte,
    resumenNovedades,
  };
}

/** ¿El estado es viejo? (mas de HORAS_VIEJO horas: la noche no corrio o fallo antes de escribir) */
export function edadHoras(estado, ahora = Date.now()) {
  const ms = Number(estado?.finMs);
  if (!Number.isFinite(ms)) return null;
  return Math.round(((ahora - ms) / 3600000) * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// La tarea de Windows (texto de PowerShell; lo corre _nocturno.mjs con psRun)
// ─────────────────────────────────────────────────────────────────────────────

const comillaPs = (s) => `'${String(s).replace(/'/g, "''")}'`;

/**
 * El script que registra la tarea diaria. Mismo patron que scripts/_arbVigilante.ps1 (probado en esta
 * PC): conhost --headless para que no aparezca ventana, usuario interactivo sin elevar. Es una
 * notebook: StartWhenAvailable la corre al prenderla si a la hora estaba apagada (por eso 06:30 y no
 * 03:00). El tope de 1 hora corta una corrida colgada.
 */
export function comandoAgendar({ raiz, hora = HORA_TAREA, tarea = NOMBRE_TAREA } = {}) {
  if (!raiz) throw new Error('comandoAgendar: falta la raiz del repo');
  if (!/^\d{2}:\d{2}$/.test(hora)) throw new Error(`hora invalida: ${hora}`);
  const ps1 = `${String(raiz).replace(/[\\/]+$/, '')}\\scripts\\_nocturno.ps1`;
  return [
    "$ErrorActionPreference = 'Stop'",
    `$raiz = ${comillaPs(raiz)}`,
    `$accion = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\\conhost.exe') -Argument ${comillaPs(`--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`)} -WorkingDirectory $raiz`,
    `$cuando = New-ScheduledTaskTrigger -Daily -At ${comillaPs(hora)}`,
    '$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) -Priority 6',
    '$quien = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited',
    `Register-ScheduledTask -TaskName ${comillaPs(tarea)} -Action $accion -Trigger $cuando -Settings $ajustes -Principal $quien -Force | Out-Null`,
    `$t = Get-ScheduledTask -TaskName ${comillaPs(tarea)}`,
    `$i = Get-ScheduledTaskInfo -TaskName ${comillaPs(tarea)}`,
    "Write-Output ('{0}|{1}' -f $t.State, $i.NextRunTime.ToString('dd/MM HH:mm'))",
  ].join('\n');
}

export function comandoDesagendar({ tarea = NOMBRE_TAREA } = {}) {
  return [
    `$t = Get-ScheduledTask -TaskName ${comillaPs(tarea)} -ErrorAction SilentlyContinue`,
    "if (-not $t) { Write-Output 'NO-ESTABA'; exit 0 }",
    `Unregister-ScheduledTask -TaskName ${comillaPs(tarea)} -Confirm:$false`,
    "Write-Output 'BORRADA'",
  ].join('\n');
}

/** Una linea "estado|proxima|ultima|resultado" o "NO-AGENDADA". */
export function comandoEstadoTarea({ tarea = NOMBRE_TAREA } = {}) {
  return [
    `$t = Get-ScheduledTask -TaskName ${comillaPs(tarea)} -ErrorAction SilentlyContinue`,
    "if (-not $t) { Write-Output 'NO-AGENDADA'; exit 0 }",
    `$i = Get-ScheduledTaskInfo -TaskName ${comillaPs(tarea)}`,
    "$f = { param($d) if ($d -and $d.Year -gt 2000) { $d.ToString('dd/MM HH:mm') } else { '-' } }",
    "Write-Output ('{0}|{1}|{2}|{3}' -f $t.State, (& $f $i.NextRunTime), (& $f $i.LastRunTime), $i.LastTaskResult)",
  ].join('\n');
}

/** Interpreta la salida de comandoEstadoTarea. */
export function leerEstadoTarea(salida) {
  const s = String(salida ?? '').trim().split(/\r?\n/).pop() || '';
  if (!s || s === 'NO-AGENDADA') return { agendada: false };
  const [estado, proxima, ultima, resultado] = s.split('|');
  return { agendada: true, estado, proxima, ultima, resultado: resultado ?? null };
}
