/**
 * AMFE 162 Top Roll (AMFE-TR-PAT), OP 10 inyeccion: la rebaba estaba cargada dos veces sobre la
 * Maquina inyectora de plastico, con las mismas tres causas y distinta deteccion.
 * Decision de Fak, 12/10/2026 (tarea del Escritorio "AMFE 162 Top Roll - la caratula y la rebaba se
 * contradicen"): queda "Rebaba Excesiva / Exceso de Material" (sus efectos dicen lo que pasa: se corta
 * la rebaba o la pieza queda fea) con D=8 en la causa que decia 4 (inspeccion visual = 8, regla amfe.md
 * §13), y se borra "Rebarbas en pieza inyectada". Si un plan de control apunta a una causa borrada, se
 * lo redirige a la causa equivalente de la fila que queda.
 *
 *   node scripts/_fixAmfe162RebabaDuplicada.mjs           # dry-run
 *   node scripts/_fixAmfe162RebabaDuplicada.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, readCp, saveAmfe, saveCp, calculateAP, normalizeText } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const QUEDA = 'Rebaba Excesiva / Exceso de Material';
const SALE = 'Rebarbas en pieza inyectada';
// causa de la fila que sale -> causa equivalente de la que queda (por el comienzo del texto, normalizado)
const EQUIVALE = [
    ['parametros de proceso desajustados', 'parametros de proceso desajustados'],
    ['linea de junta del molde', 'linea de junta danada'],
    ['fuerza de cierre insuficiente', 'fuerza de cierre insuficiente'],
];

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const fila = (await listAmfes(sb)).filter(a => a.amfe_number === 'AMFE-TR-PAT');
if (fila.length !== 1) throw new Error(`AMFE-TR-PAT: se esperaba 1 documento y hay ${fila.length}`);
const { id, amfe_number, doc: before } = await readAmfe(sb, fila[0].id);
const after = structuredClone(before);

const op = after.operations.filter(o => String(o.opNumber ?? o.operationNumber) === '10');
if (op.length !== 1) throw new Error(`OP 10: se esperaba 1 y hay ${op.length}`);
const ubicar = desc => {
    const r = [];
    for (const we of op[0].workElements || []) for (const fn of we.functions || [])
        (fn.failures || []).forEach((fm, i) => { if ((fm.description || '').trim() === desc) r.push({ we, fn, fm, i }); });
    return r;
};
const queda = ubicar(QUEDA), sale = ubicar(SALE);
if (queda.length !== 1 || sale.length !== 1) throw new Error(`se esperaba una fila de cada una: queda=${queda.length} sale=${sale.length}`);
const texto = c => normalizeText(c.cause || c.description || '');

// 1. La causa con D=4 de la fila que queda pasa a 8
for (const c of queda[0].fm.causes) {
    if (Number(c.detection) === 4 && texto(c).startsWith('parametros de proceso desajustados')) {
        const ap = calculateAP(Number(c.severity), Number(c.occurrence), 8);
        logChange(apply, `D 4 -> 8 en "${c.cause || c.description}"`, { SOD: `${c.severity}/${c.occurrence}/8`, AP: `${c.ap || c.actionPriority} -> ${ap}` });
        c.detection = 8;
        c.ap = ap;
        c.actionPriority = ap;
    }
}

// 2. Mapa de ids de causa: la que sale -> la equivalente que queda
const mapa = {};
for (const c of sale[0].fm.causes) {
    const par = EQUIVALE.find(([a]) => texto(c).startsWith(a));
    const destino = par && queda[0].fm.causes.find(q => texto(q).startsWith(par[1]));
    if (!destino) throw new Error(`sin equivalente para la causa "${c.cause || c.description}"`);
    mapa[c.id] = destino.id;
}

// 3. Se borra la fila repetida
sale[0].fn.failures.splice(sale[0].i, 1);
logChange(apply, `borrar "${SALE}" (${sale[0].fm.causes.length} causas) de ${sale[0].we.name}`);

// 4. Planes de control que apuntan a las causas borradas
const { data: cps, error } = await sb.from('cp_documents').select('id, cp_number');
if (error) throw new Error(error.message);
const cpCambios = [];
for (const r of cps) {
    const { doc } = await readCp(sb, r.id);
    let n = 0;
    for (const it of doc.items || []) {
        if (!Array.isArray(it.amfeCauseIds)) continue;
        const nuevos = [...new Set(it.amfeCauseIds.map(x => mapa[x] || x))];
        if (nuevos.join() !== it.amfeCauseIds.join()) { it.amfeCauseIds = nuevos; n++; }
    }
    if (n) { cpCambios.push({ id: r.id, doc }); logChange(apply, `plan de control ${r.cp_number}: ${n} item(s) redirigidos a la causa que queda`); }
}
if (!cpCambios.length) console.log('  ningun plan de control apunta a las causas borradas');

await runWithValidation([{ id, amfeNumber: amfe_number, productName: 'Top Roll Patagonia', before, after }], apply, async () => {
    await saveAmfe(sb, id, after);
    for (const c of cpCambios) await saveCp(sb, c.id, c.doc);
});
finish(apply);
