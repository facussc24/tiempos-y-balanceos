/**
 * cortes.mjs <clave>... — lista los nodos de nivel superior de un flujograma (como esta commiteado) con lo que importa para elegir
 * DONDE partirlo en dos hojas: el indice, el tipo, el numero de paso, la descripcion, si abre ramas paralelas, si tiene reproceso colgado,
 * si lleva un REVERIFICAR (y a donde vuelve) y si es un conector circulo-letra. Marca los cortes posibles (despues de un nodo que no abre
 * ramas, no tiene un reproceso colgado, no es el control del que cuelga un rombo, y ningun REVERIFICAR ni conector cruza el corte).
 * No dibuja nada ni usa el navegador.
 */
import { execFileSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const emitido = (k) => JSON.parse(execFileSync('git', ['show', `HEAD:tools/flowchart/data/${k}.json`], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 26 }));
const seqOf = (b) => (Array.isArray(b) ? b : b.sequence);
const rows = (seq) => { let c = 0; for (const n of seq) { c++; if (n.branches) c += Math.max(...n.branches.map((b) => rows(seqOf(b)))); if (n.branchSide && n.branchSide.sequence) c = Math.max(c, rows(n.branchSide.sequence)); } return c; };
const decena = (n) => { const id = parseInt(n && n.stepId, 10); return Number.isFinite(id) ? Math.floor(id / 10) : null; };

for (const clave of process.argv.slice(2)) {
  const d = emitido(clave);
  const flow = d.flow;
  // pasos y conectores que aparecen en cada nodo de nivel superior (todo lo que cuelga adentro)
  const info = flow.map((n) => {
    const ids = new Set(), rw = [], co = [], ci = [];
    const walk = (nd) => {
      if (nd.stepId) ids.add(String(nd.stepId));
      if (nd.rework) rw.push(String(nd.rework.targetId));
      if (nd.incomingConnector) ci.push(nd.incomingConnector);
      if (nd.branchSide) { if (nd.branchSide.type === 'connector') co.push(nd.branchSide.text); if (nd.branchSide.stepId) ids.add(String(nd.branchSide.stepId)); if (nd.branchSide.sequence) nd.branchSide.sequence.forEach(walk); }
      if (nd.branches) nd.branches.forEach((b) => seqOf(b).forEach(walk));
    };
    walk(n);
    return { ids, rw, co, ci };
  });
  console.log(`\n=== ${clave}  rev ${d.header.revision}  (${flow.length} nodos de nivel superior, ${rows(flow)} filas en el camino mas largo)`);
  let acum = 0;
  flow.forEach((n, i) => {
    const filas = 1 + (n.branches ? Math.max(...n.branches.map((b) => rows(seqOf(b)))) : 0) + 0;
    acum += filas;
    // cruces si se corta DESPUES de i
    const antes = new Set(), despues = new Set();
    info.forEach((x, j) => (j <= i ? x.ids : x.ids).forEach((s) => (j <= i ? antes : despues).add(s)));
    let cruza = [];
    info.forEach((x, j) => { if (j > i) x.rw.forEach((t) => { if (antes.has(t)) cruza.push(`REVERIFICAR ${t} (en ${j}) vuelve a la hoja 1`); }); });
    info.forEach((x, j) => { if (j <= i) x.rw.forEach((t) => { if (despues.has(t)) cruza.push(`REVERIFICAR ${t} (en ${j}) vuelve a la hoja 2`); }); });
    const outs = new Set(), ins = new Set();
    info.forEach((x, j) => { x.co.forEach((c) => (j <= i ? outs : null)?.add(c)); x.ci.forEach((c) => (j > i ? ins : null)?.add(c)); });
    const outs2 = new Set(), ins2 = new Set();
    info.forEach((x, j) => { x.co.forEach((c) => { if (j > i) outs2.add(c); }); x.ci.forEach((c) => { if (j <= i) ins2.add(c); }); });
    for (const c of outs) if (ins.has(c)) cruza.push(`conector (${c}) sale en la hoja 1 y entra en la 2`);
    for (const c of outs2) if (ins2.has(c)) cruza.push(`conector (${c}) sale en la hoja 2 y entra en la 1`);
    const sig = flow[i + 1];
    const malo = n.branches ? 'abre ramas' : (n.branchSide && n.branchSide.sequence ? 'reproceso colgado' : (sig && sig.type === 'condition' ? 'el rombo cuelga de este control' : (cruza.length ? 'cruza: ' + cruza[0] : '')));
    const cambia = (decena(n) !== null && sig && decena(sig) !== null && decena(sig) !== decena(n)) ? 'cambia de sector' : '';
    const tag = malo ? `  x ${malo}` : `  CORTE POSIBLE${cambia ? ' (' + cambia + ')' : ''}`;
    const bs = n.branchSide ? ` [lado: ${n.branchSide.type || ''}${n.branchSide.text ? ' ' + n.branchSide.text : ''}${n.branchSide.sequence ? ' seq' + n.branchSide.sequence.length : ''}]` : '';
    const rr = n.branches ? ` {ramas ${n.branches.map((b) => rows(seqOf(b))).join('/')}}` : '';
    console.log(`${String(i).padStart(2)} filas~${String(acum).padStart(2)} ${(n.type || '').padEnd(10)} ${String(n.stepId || '').padEnd(5)} ${String(n.description || n.text || n.labelCondition || '').slice(0, 52).padEnd(52)}${rr}${bs}${tag}`);
  });
}
