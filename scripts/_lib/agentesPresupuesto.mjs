/**
 * agentesPresupuesto.mjs — lo puro de `scripts/_agentes.mjs`: leer y mostrar el presupuesto de subagentes
 * que hace cumplir `~/.claude/hooks/agentes-guard.sh` (08/10/2026).
 *
 * El guardian cuenta PUNTOS por ventana de 10 minutos (haiku 1 · sonnet 4 · opus 8 · fable 20; 40 puntos
 * = "10 Sonnet") y deja cada lanzamiento en `~/.claude/.agent-spawns.log` como "<epoch> <tool> <peso>".
 * El presupuesto se sube por 12 h con `~/.claude/.agent-limit` (N Sonnet = N x 4 puntos). Fak, 08/10:
 * "en algunas tareas quiero destinar mas presupuesto... necesito entenderlo": este modulo lo hace visible
 * (que se gasto, que presupuesto rige, por que se subio) y deja escrito el motivo de cada suba en
 * `~/.claude/.agent-presupuestos.log`.
 */

export const PESOS = Object.freeze({ haiku: 1, sonnet: 4, opus: 8, fable: 20 });
export const LIMITE_DEFAULT = 10;
export const VENTANA_SEG = 600;
export const VENCE_SEG = 43200;

/** "<epoch> <tool> <peso>" -> { ts, tool, peso }. Lineas viejas (sin peso, "pesado"/"liviano") pesan como Sonnet. */
export function leerLinea(linea) {
    const partes = String(linea ?? '').trim().split(/\s+/);
    const ts = Number(partes[0]);
    if (!Number.isFinite(ts) || ts <= 0) return null;
    const peso = /^\d+$/.test(partes[2] ?? '') ? Number(partes[2]) : PESOS.sonnet;
    return { ts, tool: partes[1] || 'Agent', peso };
}

/** Los lanzamientos de la ventana y sus puntos. `ahora` en segundos. */
export function resumenVentana(lineas, { ahora = Math.floor(Date.now() / 1000), ventanaSeg = VENTANA_SEG } = {}) {
    const corte = ahora - ventanaSeg;
    const vigentes = (lineas || []).map(leerLinea).filter((x) => x && x.ts >= corte);
    const puntos = vigentes.reduce((s, x) => s + x.peso, 0);
    const porPeso = {};
    for (const x of vigentes) porPeso[x.peso] = (porPeso[x.peso] || 0) + 1;
    const masViejo = vigentes.length ? Math.min(...vigentes.map((x) => x.ts)) : null;
    return { lanzamientos: vigentes.length, puntos, porPeso, liberaEnSeg: masViejo == null ? null : Math.max(0, masViejo + ventanaSeg - ahora) };
}

/**
 * El limite vigente a partir del archivo `.agent-limit` (contenido y fecha de modificacion, en segundos).
 * Igual que el guardian: vale 12 h desde la ultima modificacion; pasado eso vuelve el default.
 */
export function limiteVigente({ contenido = null, modificadoSeg = null, ahora = Math.floor(Date.now() / 1000) } = {}) {
    if (contenido == null) return { limite: LIMITE_DEFAULT, origen: 'default', venceEnSeg: null };
    if (modificadoSeg != null && ahora - modificadoSeg > VENCE_SEG) return { limite: LIMITE_DEFAULT, origen: 'vencido', venceEnSeg: 0 };
    const n = Number(String(contenido).replace(/[^0-9]/g, '').slice(0, 4));
    if (!Number.isFinite(n)) return { limite: LIMITE_DEFAULT, origen: 'default', venceEnSeg: null };
    return { limite: n, origen: 'override', venceEnSeg: modificadoSeg == null ? null : Math.max(0, modificadoSeg + VENCE_SEG - ahora) };
}

export const presupuestoPuntos = (limite) => (limite === 0 ? Infinity : limite * PESOS.sonnet);

/** Una linea de registro para `.agent-presupuestos.log`: cuando, cuanto, por que. */
export function lineaRegistro({ ahora = new Date(), limite, porque, pc = process.env.COMPUTERNAME || '' }) {
    const iso = ahora.toISOString().slice(0, 16).replace('T', ' ');
    return `${iso}\t${limite}\t${limite === 0 ? 'sin conteo' : `${presupuestoPuntos(limite)} puntos/10 min`}\t${pc}\t${String(porque ?? '').replace(/\s+/g, ' ').trim()}`;
}

const min = (seg) => (seg == null ? '-' : `${Math.ceil(seg / 60)} min`);
const horas = (seg) => (seg == null ? '-' : `${(seg / 3600).toFixed(1)} h`);

/** El estado en texto, para la consola y para Fak. */
export function textoEstado({ ventana, limite, pase = false, hoy = null }) {
    const presup = presupuestoPuntos(limite.limite);
    const l = [];
    l.push(`Presupuesto de subagentes: ${presup === Infinity ? 'SIN CONTEO (apagado por Fak)' : `${presup} puntos cada 10 min`} (${limite.origen === 'override' ? `subido a ${limite.limite} Sonnet, vence en ${horas(limite.venceEnSeg)}` : limite.origen === 'vencido' ? 'la suba vencio; vuelve el default' : 'default: 10 Sonnet'})`);
    l.push(`Pesos: haiku ${PESOS.haiku} · sonnet ${PESOS.sonnet} · opus ${PESOS.opus} · fable ${PESOS.fable} · auditoria final 0`);
    l.push(`Ultimos 10 min: ${ventana.lanzamientos} lanzamiento(s), ${ventana.puntos} punto(s)${presup === Infinity ? '' : ` de ${presup}`}${ventana.liberaEnSeg != null && ventana.lanzamientos ? ` · el mas viejo sale de la ventana en ${min(ventana.liberaEnSeg)}` : ''}`);
    const detalle = Object.entries(ventana.porPeso).sort((a, b) => Number(b[0]) - Number(a[0])).map(([p, n]) => `${n} de peso ${p}`).join(', ');
    if (detalle) l.push(`  ${detalle}`);
    if (pase) l.push('Pase .agent-opus-ok vigente: Opus y Fable descuentan como Sonnet (4).');
    if (hoy) l.push(`Hoy: ${hoy.lanzamientos} lanzamiento(s), ${hoy.puntos} punto(s) en total.`);
    return l.join('\n');
}
