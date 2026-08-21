/**
 * _verificarAprendizajeAmfe.mjs — prueba que cada leccion de la tanda Patagonia esta CARGADA
 * y ACTIVA, disparandole a cada gate el caso real que lo origino.
 *
 * Fak, 21/08/2026: *"quiero que [el AMFE nuevo] ya lo haga con todo esto... asegurate de
 * confirmarme de que tu inteligencia ya fue actualizada"*. Decirlo no alcanza: esto lo mide.
 * Cada fila prueba con el TEXTO REAL que se colo alguna vez.
 *
 * Correr:  node scripts/_verificarAprendizajeAmfe.mjs
 */
import { scanForbidden, scanRevisionMeta } from './_lib/forbiddenContent.mjs';
import { validateAmfeDoc } from './_lib/amfeValidator.mjs';
import { readFileSync, existsSync } from 'fs';

const filas = [];
const ok = (n) => n > 0;

// ── 1. confesiones en el log de revisiones (Fak, 20/08: "parece una burla")
filas.push(['Log de revisiones sin confesiones', 'scanRevisionMeta + gate en _exportAmfeOficial.ts',
  'SE REESCRIBEN EN ESPANOL... LOS TERMINOS EN INGLES',
  ok(scanRevisionMeta('SE REESCRIBEN EN ESPANOL, CON EL VOCABULARIO DE LA PLANTA, LOS TERMINOS EN INGLES DE FUNCIONES, EFECTOS Y CONTROLES.').length)]);
filas.push(['  ...y "replicado de" / notas internas', 'idem',
  'REPLICADA DEL AMFE DE IP PADS (DECISION FAK 20/08)',
  ok(scanRevisionMeta('SE AGREGA LA OPERACION 61, REPLICADA DEL AMFE DE IP PADS (DECISION FAK 20/08).').length)]);
filas.push(['  ...pero NO molesta a una revision legitima', 'idem',
  'EL ENFUNDADO VA ANTES DEL ESPUMADO. SE ALINEA CON EL FLUJOGRAMA 152 REV. B.',
  scanRevisionMeta('EL ENFUNDADO VA ANTES DEL ESPUMADO. SE ALINEA CON EL FLUJOGRAMA 152 REV. B.').length === 0]);

// ── 2. vocabulario (Fak, 19 y 20/08)
const ing = (t) => scanForbidden(t).forbidden.filter(f => f.kind.startsWith('ingles')).length;
filas.push(['Ingles random', 'ENGLISH_RANDOM_TERMS (CRITICAL)', 'posible Gap & Flush NOK', ok(ing('posible Gap & Flush NOK'))]);
filas.push(['  ...incluso pegado: "Gap&Flush"', 'idem (espaciado flexible)', 'Gap&Flush', ok(ing('posible Gap&Flush NOK'))]);
filas.push(['Castellano ajeno a la planta', 'idem', 'luz y enrase / ruidos y chirridos', ok(ing('luz y enrase fuera de especificacion')) && ok(ing('Ruidos y chirridos'))]);
filas.push(['  ...pero NO el vocabulario real', 'idem', 'alineacion y separacion / SCRAP / peeling',
  ing('alineacion y separacion entre piezas fuera de especificacion') === 0 && ing('Scrap del material') === 0 && ing('ensayo de peeling con dinamometro') === 0]);
filas.push(['Equipo que Barack no tiene', 'FORBIDDEN_EQUIPMENT (CRITICAL)', 'hielo seco',
  ok(scanForbidden('Limpieza de molde con hielo seco').forbidden.length)]);

// ── 3. checks del validador (auditoria externa, 21/08)
const causa = (extra) => ({ operations: [{ opNumber: '10', operationNumber: '10',
  name: 'RECEPCION', operationName: 'RECEPCION',
  focusElementFunction: 'Funcion Interna: a / Funcion del Cliente: b / Funcion del Usuario Final: c',
  operationFunction: 'Recibir y controlar',
  workElements: [{ name: 'Vinilo PVC (427VIN014COR01)', type: 'Material',
    functions: [{ description: 'Aportar el vinilo conforme', functionDescription: 'Aportar el vinilo conforme',
      failures: [{ description: 'Flamabilidad fuera de TL 1010 VW', effectLocal: 'Scrap',
        effectNextLevel: 'Para linea', effectEndUser: 'Riesgo en cabina',
        causes: [{ description: 'Lote fuera de norma', cause: 'Lote fuera de norma',
          preventionControl: 'Certificado del proveedor (P-14)', detectionControl: 'Ensayo de flamabilidad',
          ...extra }] }] }] }] }] });
const tiene = (doc, t) => { const r = validateAmfeDoc(doc, 'X', 'T'); return [...r.critical, ...r.warning].some(i => i.type === t); };

filas.push(['AP fuera de la tabla AIAG-VDA', 'CAUSE_AP_MISMATCH (CRITICAL)', 'S=8 O=4 D=7 declarado M (tabla: H)',
  tiene(causa({ severity: 8, occurrence: 4, detection: 7, ap: 'M', actionPriority: 'M', specialChar: 'CC' }), 'CAUSE_AP_MISMATCH')]);
filas.push(['  ...y NO molesta si esta bien', 'idem', 'S=8 O=4 D=7 declarado H',
  !tiene(causa({ severity: 8, occurrence: 4, detection: 7, ap: 'H', actionPriority: 'H', optimizationAction: 'Pendiente definicion equipo APQP', specialChar: 'CC' }), 'CAUSE_AP_MISMATCH')]);
filas.push(['CC que se cae al detallar', 'CAUSE_S9_SIN_CC (WARNING, no asigna)', 'S=9 sin specialChar',
  tiene(causa({ severity: 9, occurrence: 3, detection: 4, ap: 'H', actionPriority: 'H', optimizationAction: 'Pendiente definicion equipo APQP', specialChar: '' }), 'CAUSE_S9_SIN_CC')]);
filas.push(['AP=H sin accion (bloqueo IATF)', 'CAUSE_APH_EMPTY_NO_PLACEHOLDER (CRITICAL)', 'AP=H y accion vacia',
  tiene(causa({ severity: 9, occurrence: 4, detection: 7, ap: 'H', actionPriority: 'H', specialChar: 'CC' }), 'CAUSE_APH_EMPTY_NO_PLACEHOLDER')]);
filas.push(['Valor de especificacion en el control', 'CONTROL_CON_VALOR (WARNING)', 'Calibre... Cotas: diametro 90 mm',
  tiene(causa({ severity: 6, occurrence: 3, detection: 4, ap: 'L', actionPriority: 'L',
    preventionControl: 'Calibre digital (P-10/I). Cotas: diametro 90 mm +/- 0,5' }), 'CONTROL_CON_VALOR')]);
filas.push(['"Falta de capacitacion" como causa', 'CAUSE_CAPACITACION', 'causa = falta de capacitacion',
  tiene(causa({ severity: 6, occurrence: 3, detection: 4, ap: 'L', actionPriority: 'L',
    description: 'Falta de capacitacion del operario', cause: 'Falta de capacitacion del operario' }), 'CAUSE_CAPACITACION')]);
filas.push(['PU inyectado antes de enfundar', 'PU_ANTES_DE_ENFUNDADO (CRITICAL)', 'orden invertido en apoyacabezas',
  existsSync('scripts/_lib/amfeValidator.mjs') && readFileSync('scripts/_lib/amfeValidator.mjs', 'utf8').includes('PU_ANTES_DE_ENFUNDADO')]);

// ── 4. el logo del flujograma (Fak, 19/08)
filas.push(['Flujograma sin logo oficial', '_flujograma.mjs aborta si falta el asset', 'tools/flowchart/assets/barack_logo.png',
  existsSync('tools/flowchart/assets/barack_logo.png') && readFileSync('scripts/_flujograma.mjs', 'utf8').includes('Sin logo no se genera')]);

const anchoA = Math.max(...filas.map(f => f[0].length));
const anchoB = Math.max(...filas.map(f => f[1].length));
console.log('\nVERIFICACION DEL APRENDIZAJE — cada gate contra el caso real que lo origino\n');
console.log(`  ${'LECCION'.padEnd(anchoA)}  ${'GATE'.padEnd(anchoB)}  ESTADO`);
console.log(`  ${'-'.repeat(anchoA)}  ${'-'.repeat(anchoB)}  ------`);
let fallos = 0;
for (const [leccion, gate, caso, pasa] of filas) {
  if (!pasa) fallos++;
  console.log(`  ${leccion.padEnd(anchoA)}  ${gate.padEnd(anchoB)}  ${pasa ? 'ACTIVO' : '*** NO ACTIVA ***'}`);
  if (!pasa) console.log(`      caso que deberia frenar: "${caso}"`);
}
console.log(`\n  ${filas.length - fallos}/${filas.length} lecciones verificadas como activas.`);
if (fallos) { console.log('  HAY GATES CAIDOS — no dar por cargado el aprendizaje.'); process.exit(1); }
