/**
 * fixIpPadPfdAdhesivadoV5.mjs
 *
 * Patron FINAL usando la feature rework_or_scrap recien agregada al renderer
 * (modules/pfd/flow/FlowNode.tsx renderBranchSide + pfdToFlowData.ts).
 *
 * Un solo rombo "PRODUCTO CONFORME?" con rejectDisposition='rework_or_scrap'.
 * El renderer dibuja:
 *   - SI abajo -> continua flujo (OP 90)
 *   - NO lateral -> mini-flow anidado a la derecha:
 *       Segundo rombo "¿SE PUEDE RETRABAJAR?"
 *         SI abajo + flecha retorno -> OP 70 (reworkReturnStep)
 *         NO lateral -> SCRAP terminal
 *
 * Cambios sobre el PFD actual:
 *   1. Decision idx 20 (PRODUCTO CONFORME?): rejectDisposition scrap -> rework_or_scrap
 *      + reworkReturnStep: 'OP 70' (vuelve a ADHESIVADO si retrabajable)
 *      + scrapDescription: conservar "Pieza irrecuperable..."
 *   2. ELIMINAR decision idx 21 (¿SE PUEDE RETRABAJAR?): ya no hace falta,
 *      el renderer la genera anidada en el branchSide.
 *
 * Dry-run por default. --apply para ejecutar.
 */

import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import { connectSupabase, parseData, readPfd, savePfd } from './_lib/amfeIo.mjs';

const { apply } = parseSafeArgs();
const PFD_ID = 'pfd-ippads-trim-asm-upr-wrapping';

const sb = await connectSupabase();
const { doc } = await readPfd(sb, PFD_ID);

// Ubicar los 2 decision steps del adhesivado
const prodConformeIdx = doc.steps.findIndex(s =>
  s.stepType === 'decision' &&
  s.description === 'PRODUCTO CONFORME?' &&
  s.department === 'Calidad' &&
  s.rejectDisposition === 'scrap'
);
const puedeRetrabajarIdx = doc.steps.findIndex(s =>
  s.stepType === 'decision' && s.description === '¿SE PUEDE RETRABAJAR?'
);

if (prodConformeIdx < 0 || puedeRetrabajarIdx < 0) {
  console.error('Decisions no encontradas:', { prodConformeIdx, puedeRetrabajarIdx });
  process.exit(1);
}

console.log(`PRODUCTO CONFORME? idx=${prodConformeIdx} | ¿SE PUEDE RETRABAJAR? idx=${puedeRetrabajarIdx}`);

// 1. Modificar PRODUCTO CONFORME? a rework_or_scrap
const d1 = doc.steps[prodConformeIdx];
const d1before = {
  rejectDisposition: d1.rejectDisposition,
  reworkReturnStep: d1.reworkReturnStep,
  scrapDescription: d1.scrapDescription,
};
d1.rejectDisposition = 'rework_or_scrap';
d1.reworkReturnStep = 'OP 70';
// scrapDescription ya tiene "Pieza irrecuperable..." del V4, se conserva
logChange(apply, `UPDATE PRODUCTO CONFORME? (idx ${prodConformeIdx})`, {
  'rejectDisposition': `${d1before.rejectDisposition} -> rework_or_scrap`,
  'reworkReturnStep': `"${d1before.reworkReturnStep}" -> "OP 70"`,
  'scrapDescription': d1.scrapDescription?.substring(0, 50),
});

// 2. Eliminar ¿SE PUEDE RETRABAJAR? — el renderer la genera anidada
const d2 = doc.steps[puedeRetrabajarIdx];
logChange(apply, `DELETE ¿SE PUEDE RETRABAJAR? (idx ${puedeRetrabajarIdx})`, {
  reason: 'Ahora la genera el renderer automaticamente dentro del branchSide anidado de PRODUCTO CONFORME? (via rework_or_scrap feature)',
  removed: d2.description,
});
doc.steps.splice(puedeRetrabajarIdx, 1);

if (apply) {
  await savePfd(sb, PFD_ID, doc, {
    extraFields: { step_count: doc.steps.length, updated_at: new Date().toISOString() },
  });
  const { data: verify } = await sb.from('pfd_documents').select('data, step_count').eq('id', PFD_ID).single();
  const dv = parseData(verify.data);
  console.log(`\n=== VERIFICACION POST (step_count=${verify.step_count}, esperado=${doc.steps.length}) ===`);
  const start = dv.steps.findIndex(s => s.description === 'ADHESIVADO');
  for (let i = start; i <= start + 4 && i < dv.steps.length; i++) {
    const s = dv.steps[i];
    console.log(`  ${i} | ${(s.stepNumber||'').padEnd(8)} | ${s.stepType.padEnd(12)} | ${s.description}`);
    const flags = [];
    if (s.reworkReturnStep) flags.push('returnTo=' + s.reworkReturnStep);
    if (s.rejectDisposition !== 'none') flags.push('reject=' + s.rejectDisposition);
    if (s.scrapDescription) flags.push('scrap="' + s.scrapDescription.substring(0, 40) + '..."');
    if (flags.length) console.log(`       ${flags.join(' | ')}`);
  }
}

finish(apply);
