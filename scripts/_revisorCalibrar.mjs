/**
 * _revisorCalibrar.mjs — calibra al agente `revisor-pedido` con casos de respuesta conocida (tanda 9, pieza 1).
 *
 * Por que: un revisor mal calibrado da verde a lo malo o rojo a lo bueno (plan de la tanda,
 * docs/PLAN_METODO_2026-10-16.md). Antes de usarlo se lo corre sobre entregables que Fak devolvio («no era lo
 * pedido») y sobre entregables que aprobo, y se mira si los separa. Los casos viven en
 * evals/revisor-pedido/casos.json; la reaccion de Fak queda en el archivo para el registro y NUNCA viaja al
 * revisor (si viajara, la calibracion le pasaria la respuesta).
 *
 *   node scripts/_revisorCalibrar.mjs --prompts <carpeta>            # un prompt por caso: <id>.txt
 *   node scripts/_revisorCalibrar.mjs --evaluar <carpeta> [--json]   # lee <id>.<corrida>.txt y compara con lo esperado
 *
 * No lanza agentes: los prompts los lanza la sesion (subagente `revisor-pedido`, o `investigador` con el cuerpo
 * del revisor pegado mientras la definicion nueva no aparece en la sesion) y guarda cada respuesta en
 * <carpeta>/<id>.<corrida>.txt. Solo lee y escribe en la carpeta que se le pasa.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
export const CASOS = path.join(RAIZ, 'evals', 'revisor-pedido', 'casos.json');
export const AGENTE = path.join(RAIZ, '.claude', 'agents', 'revisor-pedido.md');

/** El cuerpo del agente sin el frontmatter: es lo que se le pega a un `investigador` si hace falta. */
export function cuerpoDelAgente(texto) {
  const t = String(texto ?? '');
  const m = t.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return (m ? t.slice(m[0].length) : t).trim();
}

/**
 * El prompt de un caso: pedido, definicion de hecho, quiz y entregable. Nada mas: ni `reaccion_fak`, ni `esperado`,
 * ni `tipo` (cualquiera de los tres le dice al revisor la respuesta).
 */
export function armarPrompt(caso, { cuerpo = '' } = {}) {
  const L = [];
  if (cuerpo) L.push(cuerpo, '', '---', '');
  L.push('PEDIDO (textual de Fak):', String(caso.pedido ?? '').trim(), '');
  L.push('DEFINICION DE HECHO:');
  (caso.definicion_de_hecho || []).forEach((d, i) => L.push(`  ${i + 1}. ${d}`));
  L.push('', 'QUIZ:');
  (caso.quiz || []).forEach((q, i) => L.push(`  ${i + 1}. ${q}`));
  L.push('', 'ENTREGABLE:');
  const e = caso.entregable || {};
  for (const r of e.rutas || []) L.push(`  · ${r}`);
  if (e.texto) L.push('  (texto pegado, tal como se le mostro a Fak)', '<<<', e.texto, '>>>');
  if (e.nota) L.push(`  Nota: ${e.nota}`);
  L.push('', 'Solo lees: no escribas, no muevas ni borres ningun archivo. Devolve la respuesta con el formato de arriba, empezando por la linea VEREDICTO.');
  return L.join('\n');
}

/** «VEREDICTO: CUMPLE» / «VEREDICTO: NO CUMPLE» → 'CUMPLE' | 'NO CUMPLE' | null (no lo dijo). */
export function parsearVeredicto(texto) {
  const m = String(texto ?? '').match(/VEREDICTO\s*:?\s*\**\s*(NO\s+CUMPLE|CUMPLE)\b/i);
  return m ? (/^no/i.test(m[1]) ? 'NO CUMPLE' : 'CUMPLE') : null;
}

/** Compara las corridas con lo esperado. `salidas` = { [id]: [texto, texto, ...] }. */
export function evaluar(casos, salidas) {
  const filas = casos.map((c) => {
    const vs = (salidas[c.id] || []).map(parsearVeredicto);
    const aciertos = vs.filter((v) => v === c.esperado).length;
    return { id: c.id, tipo: c.tipo, esperado: c.esperado, veredictos: vs, corridas: vs.length, aciertos };
  });
  const corridas = filas.reduce((n, f) => n + f.corridas, 0);
  const aciertos = filas.reduce((n, f) => n + f.aciertos, 0);
  const casosEstables = filas.filter((f) => f.corridas > 0 && f.aciertos === f.corridas).length;
  return { filas, corridas, aciertos, casosEstables, casosTotal: casos.length };
}

function leerSalidas(dir, casos) {
  const out = {};
  for (const c of casos) {
    out[c.id] = fs.readdirSync(dir).filter((f) => f.startsWith(`${c.id}.`) && /\.\d+\.txt$/.test(f)).sort()
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
  }
  return out;
}

function main(argv) {
  const casos = JSON.parse(fs.readFileSync(CASOS, 'utf8')).casos;
  const iP = argv.indexOf('--prompts'); const iE = argv.indexOf('--evaluar');
  if (iP >= 0 && argv[iP + 1]) {
    const dir = argv[iP + 1]; fs.mkdirSync(dir, { recursive: true });
    const cuerpo = cuerpoDelAgente(fs.readFileSync(AGENTE, 'utf8'));
    for (const c of casos) fs.writeFileSync(path.join(dir, `${c.id}.txt`), armarPrompt(c, { cuerpo }));
    console.log(`${casos.length} prompts en ${dir} (las respuestas van como <id>.<corrida>.txt en la misma carpeta)`);
    return 0;
  }
  if (iE >= 0 && argv[iE + 1]) {
    const r = evaluar(casos, leerSalidas(argv[iE + 1], casos));
    if (argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); return 0; }
    console.log(`Revisor contra el pedido · ${r.aciertos} de ${r.corridas} corridas aciertan · ${r.casosEstables} de ${r.casosTotal} casos aciertan en todas sus corridas`);
    for (const f of r.filas) console.log(`  ${f.id.padEnd(32)} ${f.tipo.padEnd(9)} espera ${f.esperado.padEnd(9)} · ${f.veredictos.map((v) => v ?? 'sin veredicto').join(' / ') || 'sin corridas'}`);
    return r.corridas && r.aciertos === r.corridas ? 0 : 1;
  }
  console.log('uso: --prompts <carpeta> | --evaluar <carpeta> [--json]');
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
