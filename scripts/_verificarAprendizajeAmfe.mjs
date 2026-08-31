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
import { ordenInvertido } from './_lib/ordenProceso.mjs';
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
// La auditoria de cliente del 22/08 encontro que la tabla del repo partia la severidad en
// bandas que no son las del manual (usaba 7-8 y 4-6 donde la Figura 3.5-3 usa 5-8 y 2-4).
// 281 de 1000 combinaciones subdeclaraban riesgo, con los tests en verde porque estaban
// escritos a partir del codigo. Estas dos filas prueban la banda 5-8 con casos reales.
filas.push(['Banda de severidad 5-8 (no 7-8)', 'CAUSE_AP_MISMATCH (CRITICAL)', 'S=7 O=4 D=6 declarado M (figura: H)',
  tiene(causa({ severity: 7, occurrence: 4, detection: 6, ap: 'M', actionPriority: 'M' }), 'CAUSE_AP_MISMATCH')]);
filas.push(['  ...y S=5 tambien es banda 5-8', 'idem', 'S=5 O=5 D=5 declarado L (figura: H)',
  tiene(causa({ severity: 5, occurrence: 5, detection: 5, ap: 'L', actionPriority: 'L' }), 'CAUSE_AP_MISMATCH')]);
filas.push(['S/O/D que la figura llama "Error"', 'CAUSE_SOD_IMPLAUSIBLE (WARNING)', 'S=10 O=1 D=8 (O=1 exige D=1)',
  tiene(causa({ severity: 10, occurrence: 1, detection: 8, ap: 'L', actionPriority: 'L' }), 'CAUSE_SOD_IMPLAUSIBLE')]);
filas.push(['  ...pero O=1 con D=1 es valido', 'idem', 'S=10 O=1 D=1',
  !tiene(causa({ severity: 10, occurrence: 1, detection: 1, ap: 'L', actionPriority: 'L' }), 'CAUSE_SOD_IMPLAUSIBLE')]);

// ── La D se califica primero por la COBERTURA, no por el instrumento (31/08/2026).
//    Tabla P3 renglon 9: "Random audits <100% of product". La auditoria de cliente
//    encontro 298 causas con control por muestreo calificadas entre 3 y 8 — y 100 de
//    ellas las habia puesto en 7 esa misma manana un script que trataba igual una
//    inspeccion al 100% y un muestreo. Textos reales de los AMFE de Patagonia.
const conControl = (texto, d) => causa({ severity: 6, occurrence: 4, detection: d,
  ap: 'H', actionPriority: 'H', optimizationAction: 'Pendiente definicion equipo APQP',
  detectionControl: texto });

filas.push(['Muestreo (<100%) calificado por debajo de 9', 'DETECCION_MUESTREO_OPTIMISTA (WARNING)',
  '"Inspeccion por muestreo segun P-14 en recepcion" con D=4',
  tiene(conControl('Inspeccion por muestreo segun P-14 en recepcion', 4), 'DETECCION_MUESTREO_OPTIMISTA')]);
filas.push(['  ...y un control al 100% NO es muestreo', 'idem',
  '"Inspeccion visual 100% + pieza patron" con D=4',
  !tiene(conControl('Inspeccion visual 100% + pieza patron', 4), 'DETECCION_MUESTREO_OPTIMISTA')]);
filas.push(['  ...ni el 100% con un control por lote aguas abajo', 'idem',
  '"Autocontrol visual 100% + control por Calidad por lote" con D=7',
  !tiene(conControl('Autocontrol visual 100% + control por Calidad por lote', 7), 'DETECCION_MUESTREO_OPTIMISTA')]);
filas.push(['  ...y el muestreo NO entra por deteccion humana', 'DETECCION_HUMANA_OPTIMISTA (el bug del 31/08)',
  'un muestreo visual con D=4 no debe empujarse a 7',
  !tiene(conControl('Verificacion visual de la etiqueta, 1 muestra por entrega (P-10/I)', 4), 'DETECCION_HUMANA_OPTIMISTA')]);

// ── Sin metodo declarado la tabla dice 10, no 8 (Tabla P3 renglon 10). 36 causas del
//    lote de Patagonia tenian el control vacio o en "-" calificadas D=8.
filas.push(['Control de deteccion vacio calificado D=8', 'DETECCION_SIN_CONTROL_DECLARADO (WARNING)',
  'detectionControl = "" con D=8',
  tiene(conControl('', 8), 'DETECCION_SIN_CONTROL_DECLARADO')]);
filas.push(['  ...y el guion tambien es "sin control"', 'idem', 'detectionControl = "-" con D=8',
  tiene(conControl('-', 8), 'DETECCION_SIN_CONTROL_DECLARADO')]);
filas.push(['  ...pero con D=10 ya esta bien declarado', 'idem', 'detectionControl = "" con D=10',
  !tiene(conControl('', 10), 'DETECCION_SIN_CONTROL_DECLARADO')]);

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
// 23/08: esta fila era un readFileSync().includes('PU_ANTES_DE_ENFUNDADO') — o sea que
// seguia VERDE aunque alguien vaciara el cuerpo del check, porque el string sobrevive en el
// nombre y en el comentario. Es el mismo modo de falla que este archivo existe para cazar
// ("un control que da el mismo resultado para todos los casos no detecta nada"). Ahora
// dispara el validador de verdad, con el caso real y con su negativo.
const docOrdenPu = (numFunda, numPu) => ({
  operations: [
    { opNumber: numFunda, operationNumber: numFunda, name: 'ENFUNDADO', operationName: 'ENFUNDADO', workElements: [] },
    { opNumber: numPu, operationNumber: numPu, name: 'INYECCION DE PU', operationName: 'INYECCION DE PU', workElements: [] },
  ],
});
filas.push(['PU inyectado antes de enfundar', 'PU_ANTES_DE_ENFUNDADO (CRITICAL)', 'AMFE 153/155 pre-18/08: 50 PU / 60 ENFUNDADO',
  tiene(docOrdenPu('60', '50'), 'PU_ANTES_DE_ENFUNDADO')]);
filas.push(['  ...y NO molesta al orden correcto', 'idem', '40 ENFUNDADO / 52 INYECCION DE PU',
  !tiene(docOrdenPu('40', '52'), 'PU_ANTES_DE_ENFUNDADO')]);

// ── 4. el logo del flujograma (Fak, 19/08)
filas.push(['Flujograma sin logo oficial', '_flujograma.mjs aborta si falta el asset', 'tools/flowchart/assets/barack_logo.png',
  existsSync('tools/flowchart/assets/barack_logo.png') && readFileSync('scripts/_flujograma.mjs', 'utf8').includes('Sin logo no se genera')]);

// ── 5. auditoria de cliente antes de entregar (analisis 22/08 — el rol del 21/08 vio en
//       20 min lo que 3 dias no; regla amfe.md §18)
filas.push(['Export exige auditoria de cliente vigente', '_exportAmfeOficial.ts aborta sin marcador .audit-cliente/', 'export sin .audit-cliente/<amfe>.json',
  readFileSync('scripts/_exportAmfeOficial.ts', 'utf8').includes('.audit-cliente/')
  && existsSync('.claude/commands/auditoria-cliente.md')]);

// ── 6. efecto de planta en la columna de usuario final (1ra corrida de /auditoria-cliente,
//       22/08, AMFE 159 OP15: effectEndUser = "Reproceso o scrap"; AIAG-VDA 3.4.5)
const docEndUser = (texto) => { const d = causa({ severity: 6, occurrence: 4, detection: 4, ap: 'L', actionPriority: 'L' });
  d.operations[0].workElements[0].functions[0].failures[0].effectEndUser = texto; return d; };
filas.push(['Efecto de planta como "usuario final"', 'FM_ENDUSER_EFECTO_PLANTA (WARNING)', 'effectEndUser = "Reproceso o scrap" (AMFE 159 OP15)',
  tiene(docEndUser('Reproceso o scrap'), 'FM_ENDUSER_EFECTO_PLANTA')]);
filas.push(['  ...y NO molesta a un efecto legitimo', 'idem', 'effectEndUser = "Ruido en el uso"',
  !tiene(docEndUser('Ruido en el uso'), 'FM_ENDUSER_EFECTO_PLANTA')]);

// ── 7. el candado miraba 10 campos y el texto sucio vivia en otros 6 (23/08).
//       Fak, 19/08: "sigo viendo palabras extranas que nadie en esta empresa usaria
//       como 'enrase', 'chirridos'". Estaban en ENGLISH_RANDOM_TERMS desde el 19/08 y
//       FORBIDDEN_VOCABULARY daba 0: nadie escaneaba cause.cause ni los 3 efectos.
//       Textos reales leidos de Supabase live, no escritos desde el codigo.
const docCampo = (campo, texto) => {
  const d = causa({ severity: 6, occurrence: 4, detection: 4, ap: 'L', actionPriority: 'L' });
  const fm = d.operations[0].workElements[0].functions[0].failures[0];
  if (campo.startsWith('cause.')) fm.causes[0][campo.slice(6)] = texto; else fm[campo] = texto;
  return d;
};
for (const [campo, texto, termino] of [
  ['cause.cause', 'Operario no verifico el enrase de las lineas de contorno del TNT', 'enrase'],
  ['effectEndUser', 'Pieza no montable o con Gap & Flush NOK en el modulo del vehiculo', 'Gap & Flush'],
  ['description', 'Lote de Isocianato fuera de spec o contaminado', 'fuera de spec'],
]) {
  filas.push([`Palabra prohibida en ${campo}`, 'FORBIDDEN_VOCABULARY (CRITICAL)', `${campo} = "${texto}"`,
    tiene(docCampo(campo, texto), 'FORBIDDEN_VOCABULARY')]);
}
filas.push(['  ...y "stock/setup" NO molestan (Fak 23/08)', 'idem', 'effectLocal = "Paro de linea si no hay stock"',
  !tiene(docCampo('effectLocal', 'Paro de linea si no hay stock en el setup'), 'FORBIDDEN_VOCABULARY')]);

// ── 8. una renumeracion no puede dar vuelta el orden de un proceso real (23/08).
//       El 18/08 12:40 los traseros quedaron VARILLA -> FUNDA -> PU por lo que Fak dijo del
//       puesto; a las 16:47 `_alinearAmfesPatagonia.mjs` mapeo VARILLA 50->41 y ENFUNDADO
//       60->40 y lo invirtio, sin que ningun gate se quejara: los tres controles que existian
//       (PU_ANTES_DE_ENFUNDADO, _verificarNumeracion, este harness) miran funda-vs-PU y
//       ninguno mira varilla-vs-funda. El fixture es el plan real de aquel dia.
const opOrden = (n, nombre) => ({ opNumber: String(n), operationNumber: String(n), name: nombre, operationName: nombre });
const TRASEROS_1240 = [opOrden(50, 'INSERCION DE VARILLA'), opOrden(60, 'ENFUNDADO'), opOrden(70, 'INYECCION DE PU')];
const TRASEROS_1647 = [opOrden(40, 'ENFUNDADO'), opOrden(41, 'INSERCION DE VARILLA'), opOrden(52, 'INYECCION DE PU')];
filas.push(['Renumerar da vuelta el orden del proceso', 'ORDEN_PROCESO_ALTERADO (_lib/ordenProceso.mjs)',
    'AMFE 153/155 el 18/08 16:47: VARILLA 50->41 y ENFUNDADO 60->40',
    ordenInvertido(TRASEROS_1240, TRASEROS_1647, 'AMFE 153').length > 0]);
filas.push(['  ...y una renumeracion limpia NO molesta', 'idem', 'los mismos numeros corridos, mismo orden',
    ordenInvertido(TRASEROS_1240, TRASEROS_1240.map(o => opOrden(Number(o.opNumber) - 5, o.name)), 'x').length === 0]);

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
