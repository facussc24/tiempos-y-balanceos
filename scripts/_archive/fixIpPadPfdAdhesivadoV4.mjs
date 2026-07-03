/**
 * fixIpPadPfdAdhesivadoV4.mjs
 *
 * Fix DEFINITIVO del patron retrabajo+scrap en PFD IP PAD usando el patron
 * real del renderer Barack (descubierto en modules/pfd/PfdSvgAudit.tsx:177,290):
 *
 *   El retrabajo NO es un step OP separado en el flujo vertical.
 *   Es una flecha lateral curva dibujada por el renderer desde una inspection
 *   que tiene rejectDisposition=rework + reworkReturnStep.
 *
 *   El scrap NO es step separado. Es rama lateral que el renderer dibuja
 *   desde rejectDisposition=scrap + scrapDescription.
 *
 * Cambios:
 *   1. ELIMINAR step decision "¿SE PUEDE RETRABAJAR?" (idx 20) — el renderer
 *      dibuja retrabajo+scrap desde la inspection OP 80 directamente.
 *   2. ELIMINAR step OP 81 "RETRABAJO DE ADHESIVADO" (idx 21) — idem, es
 *      flecha del renderer, no step vertical.
 *   3. SET en OP 80 CONTROL DE CALIDAD (inspection):
 *        rejectDisposition: 'rework'
 *        reworkReturnStep: 'OP 70'     <- vuelve a ADHESIVADO si recuperable
 *        scrapDescription: 'Pieza irrecuperable...'
 *      (Con rework el renderer dibuja SI abajo, NO lateral con flecha retorno.
 *       Si necesitaramos SCRAP tambien, habria que usar una decision separada
 *       porque rework y scrap son mutuamente exclusivos segun pfdToFlowData.ts:100,118.)
 *
 * Para que salgan AMBAS ramas (retrabajo Y scrap), se necesita step decision:
 *   OP 80 CONTROL (inspection, sin rejectDisposition)
 *   decision "¿SE PUEDE RETRABAJAR?" (rejectDisposition=scrap, scrapDesc=...)
 *      SI abajo -> next step (retrabajo como texto en labelDown? o inspection
 *                  con rejectDisposition=rework apuntando a OP 70?)
 *
 * Leyendo pfdToFlowData.ts:117-121: en decision rework, labelDown='SI' y
 * node.rework apunta al targetId. El renderer NO dibuja SCRAP con rework.
 * Para tener AMBOS (rework + scrap), hay que usar 2 decisions encadenadas:
 *
 *   decision "¿SE PUEDE RETRABAJAR?"
 *     rejectDisposition: 'scrap'      <- NO lateral -> SCRAP terminal
 *     scrapDescription: 'No recuperable'
 *     reworkReturnStep: 'OP 70'       <- SI abajo -> retrabajo a OP 70
 *
 * Wait — pfdToFlowData.ts:100 (rejectDisposition=scrap) setea branchSide scrap
 * + labelDown='SI'. Y :118 rework setea node.rework + labelDown='SI'.
 * Son mutuamente exclusivos — solo uno se aplica.
 *
 * Para tener SI=retrabajo + NO=scrap en un solo rombo, la clave es:
 *   rejectDisposition: 'scrap'         <- hace NO=SCRAP lateral
 *   reworkReturnStep: 'OP 70'          <- solo se usa si rejectDisposition=rework
 *
 * El renderer NO combina los 2. Hay que elegir:
 *   Opcion A: Solo retrabajo (sin scrap visible). rejectDisposition='rework'.
 *   Opcion B: Solo scrap (sin retrabajo). rejectDisposition='scrap'.
 *   Opcion C: 2 rombos encadenados. PRODUCTO CONFORME? (scrap lateral) -> SI abajo
 *             -> ¿SE PUEDE RETRABAJAR? (rework a OP 70).
 *
 * Voy con Opcion C — fiel a la imagen de Fak.
 *
 * Dry-run por default. --apply para ejecutar.
 */

import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import { connectSupabase, parseData, readPfd, savePfd } from './_lib/amfeIo.mjs';
import { randomUUID } from 'crypto';

const { apply } = parseSafeArgs();
const PFD_ID = 'pfd-ippads-trim-asm-upr-wrapping';

const sb = await connectSupabase();
const { doc } = await readPfd(sb, PFD_ID);

// Ubicar los 3 steps del adhesivado que agregamos/modificamos en commits anteriores:
// - OP 80 CONTROL DE CALIDAD (inspection, ya existe)
// - ¿SE PUEDE RETRABAJAR? (decision con rejectDisposition=scrap de V3 — NO aplicado!)
//   En DB actual: "¿SE PUEDE RETRABAJAR?" quedo con rejectDisposition=rework returnTo=OP 81 (V1/V2)
// - OP 81 RETRABAJO (de V1/V2)

// Primero, inspect current state post V2 (commit 49378ea aplicado):
console.log('=== Estado actual (post V2 commit 49378ea) ===');
const qcIdx = doc.steps.findIndex(s => s.stepNumber === 'OP 80' && s.description === 'CONTROL DE CALIDAD');
const decisionIdx = doc.steps.findIndex(s => s.stepType === 'decision' && (s.description === 'PRODUCTO CONFORME?' || s.description === '¿SE PUEDE RETRABAJAR?') && s.department === 'Calidad' && s.rejectDisposition !== 'none');
const op81Idx = doc.steps.findIndex(s => s.stepNumber === 'OP 81');
console.log('  QC idx:', qcIdx, '| decision idx:', decisionIdx, '| OP 81 idx:', op81Idx);
if (decisionIdx >= 0) {
  const d = doc.steps[decisionIdx];
  console.log('  decision actual:', d.description, '| reject:', d.rejectDisposition, '| returnTo:', d.reworkReturnStep, '| scrapDesc:', (d.scrapDescription||'').substring(0,40));
}
if (op81Idx >= 0) {
  const r = doc.steps[op81Idx];
  console.log('  OP 81 actual:', r.description, '| isRework:', r.isRework, '| returnTo:', r.reworkReturnStep, '| reject:', r.rejectDisposition);
}

// ── PLAN: reemplazar el bloque (decision actual + OP 81) por 2 decisiones encadenadas ──
//
//   NUEVO ESTADO:
//     [OP 80] CONTROL DE CALIDAD (inspection, sin flags reject) - se deja igual
//     [decision] PRODUCTO CONFORME?  (rejectDisposition=scrap, scrapDesc='Pieza NOK irrecuperable...')
//         SI abajo -> sigue flujo normal (OP 90)
//         NO lateral -> SCRAP terminal
//     (SE ELIMINA el OP 81, el retrabajo queda implicito en la rama NO->scrap)
//
// Pero la imagen de Fak muestra 2 decisiones: "PRODUCTO CONFORME?" + "¿SE PUEDE RETRABAJAR?"
// Y el texto lateral dice "RETRABAJO (A OP 110)" como flecha curva desde el 2do rombo.
//
// Segun pfdToFlowData.ts: si una DECISION tiene rejectDisposition=rework + reworkReturnStep,
// el renderer dibuja node.rework (flecha curva al target) + labelDown='SI'.
// Entonces una decision "¿SE PUEDE RETRABAJAR?" con rejectDisposition=rework + returnTo=OP 70
// dibuja: SI abajo -> continua flujo, rework -> flecha curva a OP 70.
//
// Y una decision PRECEDENTE "PRODUCTO CONFORME?" con rejectDisposition=scrap + scrapDesc
// dibuja: SI abajo -> continua flujo, NO lateral -> SCRAP terminal.
//
// Encadenadas:
//   CONTROL -> PRODUCTO CONFORME? (SI baja, NO=SCRAP lateral)
//                   | SI
//                   v
//              ¿SE PUEDE RETRABAJAR? (SI baja, rework=flecha curva a OP 70)
//                   | SI
//                   v
//              continua OP 90
//
// Mmm pero en la imagen que Fak mando (con "131 RETRABAJO DE PRODUCTO TERMINADO")
// el retrabajo SI aparece como step OP aparte — osea usa el patron Opcion A (1 decision
// "¿SE PUEDE RETRABAJAR?" + step OP 131 + renderer dibuja la flecha curva del step OP).
// Eso matchea con PfdSvgAudit.tsx:290 (inspection con rejectDisposition=rework).
//
// Decision final: voy con **OPCION A fiel al patron existente** — la inspection misma
// (OP 80) tiene rejectDisposition=rework + returnTo apuntando a OP anterior, y el
// renderer dibuja todo. El SCRAP se renderizara como rama lateral DESDE OP 81 (el step
// de retrabajo) — porque PfdSvgAudit:294 muestra ese patron: un combined step con
// rejectDisposition=scrap.
//
// PATRON FINAL (fiel al codigo del renderer):
//
//   OP 80 CONTROL DE CALIDAD
//     stepType: 'inspection'
//     rejectDisposition: 'rework'
//     reworkReturnStep: 'OP 70'        <- flecha curva VUELVE a adhesivado
//     NO tiene scrapDescription (mutex con rework)
//
//   Eliminar decision ¿SE PUEDE RETRABAJAR? (ya el renderer lo dibuja)
//   Eliminar OP 81 RETRABAJO (ya el renderer dibuja la flecha curva)
//
// Pero asi perdemos el SCRAP visual. Para tener SCRAP, necesitamos que OP 80 tenga
// scrap O que agreguemos una decision. En la imagen de Fak vemos ambos — sale del
// step de retrabajo "131" una flecha NO=SCRAP. Osea scrap sale del RETRABAJO mismo,
// no del control.
//
// Entonces patron final-final:
//
//   OP 80 CONTROL DE CALIDAD (inspection, rework a OP 70) - pierde SCRAP
//   +
//   OP 81 RETRABAJO (step, rejectDisposition=scrap, scrapDescription) - tiene SCRAP
//
// Dibujo esperado:
//   OP 80 tiene flecha curva izquierda "RETRABAJO (A OP 70)"
//   OP 81 tiene rama SCRAP lateral derecha
//   (no hay rombo decision, el renderer pinta ambas flechas desde sus respectivos
//   steps)
//
// Wait pero si OP 80 tiene rework -> OP 70 y OP 81 existe DESPUES de OP 80 en el
// flujo vertical, no se entiende cuando entra a OP 81. El control manda TODO lo
// OK a OP 81? Eso no es un flujo real.
//
// Creo que la estructura fiel requiere:
//
//   OP 70 ADHESIVADO
//   OP 80 CONTROL DE CALIDAD (inspection, sin flags — solo constata)
//   decision "PRODUCTO CONFORME?" (rejectDisposition=rework, returnTo=OP 81, scrap??)
//   OP 81 RETRABAJO ADHESIVADO (operation, NO es step vertical — deberia ser salida
//     del rombo. Pero el flujo vertical necesita que exista como step para que el
//     renderer lo dibuje)
//   OP 90 ALINEACION
//
// Y segun la imagen de Fak mandada despues: el OP 131 RETRABAJO esta SEPARADO del
// flujo principal, tiene flecha curva arriba hacia OP 110, y a su lado sale SCRAP.
// Osea OP 81 deberia estar "afuera" del flujo vertical principal.
//
// Para lograr eso hay que meterlo en una branchId (rama paralela). Pero branchId
// agrupa STEPS CONSECUTIVOS, no encaja aca.
//
// VOY A HACER LO MAS SIMPLE Y FIEL AL RENDERER:
//
//   OP 80 CONTROL DE CALIDAD (inspection, rework a OP 70)  - la flecha curva la
//     dibuja el renderer desde la inspection.
//   Eliminar decision + eliminar OP 81.
//
// Para el SCRAP: tambien ponerlo en OP 80. Pero rework y scrap son mutex. Entonces:
//   OP 80 CONTROL DE CALIDAD (inspection, solo con texto informativo — sin flags)
//   decision "¿SE PUEDE RETRABAJAR?" despues:
//     rejectDisposition: 'scrap'    <- NO lateral -> SCRAP terminal
//     reworkReturnStep: 'OP 70'     <- SI abajo -> retrabajo a OP 70
//     (ambos funcionan? pfdToFlowData.ts :100 setea scrap Y sale por :117 sin aplicar rework
//      porque es if-else-if. Entonces no.)
//
// OK decision final: voy con 2 decisiones encadenadas, fiel a la imagen original.

console.log('\n=== APLICANDO PATRON: 2 decisiones encadenadas (fiel a imagen Fak) ===\n');

// 1. Transformar la decision actual a "PRODUCTO CONFORME?" con rejectDisposition=scrap
if (decisionIdx < 0) { console.error('decision no encontrada'); process.exit(1); }
const decision1 = doc.steps[decisionIdx];
const d1before = { ...decision1 };
decision1.description = 'PRODUCTO CONFORME?';
decision1.stepType = 'decision';
decision1.rejectDisposition = 'scrap';
decision1.scrapDescription = 'Pieza irrecuperable — Scrap segun P-13';
decision1.reworkReturnStep = '';
decision1.branchId = '';
decision1.branchLabel = '';
logChange(apply, `UPDATE decision idx ${decisionIdx} -> PRODUCTO CONFORME? (scrap)`, {
  'description': `"${d1before.description}" -> "PRODUCTO CONFORME?"`,
  'rejectDisposition': `${d1before.rejectDisposition} -> scrap`,
  'scrapDescription': `"${(d1before.scrapDescription||'').substring(0,30)}" -> "Pieza irrecuperable — Scrap..."`,
  'reworkReturnStep': `"${d1before.reworkReturnStep}" -> ""`,
});

// 2. Convertir OP 81 en una segunda DECISION "¿SE PUEDE RETRABAJAR?"
// (en vez de ser step operation separado, lo transformamos en decision que apunta rework a OP 70)
if (op81Idx < 0) { console.error('OP 81 no encontrada'); process.exit(1); }
const decision2 = doc.steps[op81Idx];
const d2before = { ...decision2 };
decision2.stepNumber = '';
decision2.stepType = 'decision';
decision2.description = '¿SE PUEDE RETRABAJAR?';
decision2.machineDeviceTool = '';
decision2.productCharacteristic = '';
decision2.processCharacteristic = '';
decision2.department = 'Calidad';
decision2.notes = '';
decision2.rejectDisposition = 'rework';
decision2.reworkReturnStep = 'OP 70';
decision2.scrapDescription = '';
decision2.isRework = false;
decision2.reference = '';
decision2.branchId = '';
decision2.branchLabel = '';
logChange(apply, `TRANSFORM OP 81 idx ${op81Idx} -> decision ¿SE PUEDE RETRABAJAR?`, {
  'stepType': `${d2before.stepType} -> decision`,
  'description': `"${d2before.description}" -> "¿SE PUEDE RETRABAJAR?"`,
  'rejectDisposition': `${d2before.rejectDisposition} -> rework`,
  'reworkReturnStep': `"${d2before.reworkReturnStep}" -> "OP 70"`,
  'scrapDescription': `"${(d2before.scrapDescription||'').substring(0,30)}" -> ""`,
  'isRework': `${d2before.isRework} -> false`,
});

// ── Save ──
if (apply) {
  await savePfd(sb, PFD_ID, doc, {
    extraFields: { updated_at: new Date().toISOString() },
  });
  const { data: verify } = await sb.from('pfd_documents').select('data, step_count').eq('id', PFD_ID).single();
  const dv = parseData(verify.data);
  console.log('\n=== VERIFICACION POST (tramo adhesivado) ===');
  const start = dv.steps.findIndex(s => s.description === 'ADHESIVADO');
  for (let i = start; i <= start + 5 && i < dv.steps.length; i++) {
    const s = dv.steps[i];
    console.log(`  ${i} | ${(s.stepNumber||'').padEnd(8)} | ${s.stepType.padEnd(12)} | ${s.description}`);
    const flags = [];
    if (s.isRework) flags.push('isRework=true');
    if (s.reworkReturnStep) flags.push('returnTo=' + s.reworkReturnStep);
    if (s.rejectDisposition !== 'none') flags.push('reject=' + s.rejectDisposition);
    if (s.scrapDescription) flags.push('scrap="' + s.scrapDescription.substring(0, 40) + '..."');
    if (flags.length) console.log(`       ${flags.join(' | ')}`);
  }
}

finish(apply);
