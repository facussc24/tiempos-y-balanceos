// Construye AMFE en esquema Barack (Op->WE->Funcion->Falla->Causa) desde el parseado fiel.
// Determinístico, SIN inventar: nombres reales del origen + roles canónicos + cross-ref recepción.
// FASE 3 plan proud-squishing-tide. Salida: tmp/amfeNNN.barack.json + digest + validación.
// uso: node scripts/_buildAmfeBarack.mjs [128|129] [full]
import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { syncFieldAliases, syncLegacyFmFields, countAmfeStats, calculateAP } from './_lib/amfeIo.mjs';
import { validateAmfeDoc, printIssues } from './_lib/amfeValidator.mjs';

const uid = () => randomUUID();
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const nk = (s) => norm(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---- clasificador 6M por texto de FM+causa ----
const SIG = {
  Measurement: /(calibr|medicion|dimensional|micrometr|metro|probeta|mylar|patron|vernier|cinta metrica|balanza)/,
  Environment: /(ambiente|iluminacion|polvo|ventilacion|humedad|temperatura ambiente|limpieza del sector|suciedad ambiental|ergonom)/,
  Machine: /(maquina|maquinaria|soldadora|mesa de|equipo|herramienta|molde|inyector|prensa|horno|aguja|bma\d|mantenimiento|desgast|calibracion de la maq|set ?up de maq)/,
  Material: /(material|vinilo|tela|hilo|adhesivo|primer|sustrato|insumo|proveedor|estiba|embalaje del prov|lote|contaminacion|espesor|gramaje|materia prima|goma)/,
  Method: /(instruccion|procedimiento|documentacion|trazabilidad|set ?up|parametr|hoja de|sistema arb|orden de compra|ficha tecnica|metodo|registro|i-ac-|p-09|p-14|secuencia|criterio)/,
  Man: /(operario|operador|manipulacion|error humano|inspeccion visual|no respeta|omision|ejecucion|capacit|distrac|aplica|coloca|posiciona|carga|selecciona|lider|supervisor|leader)/,
};
const ORDER6M = ['Measurement', 'Environment', 'Machine', 'Material', 'Method', 'Man'];
function classify6M(text) {
  const k = nk(text);
  for (const m of ORDER6M) if (SIG[m].test(k)) return m;
  return 'Man'; // por defecto: error de proceso atribuido al operador (criterio Barack)
}

// ---- bucket de proceso por nombre de operación ----
function bucket(opName) {
  const k = nk(opName);
  if (/recep/.test(k)) return 'recepcion';
  if (/(cortar|corte)/.test(k)) return 'corte';
  if (/soldad/.test(k)) return 'soldadura';
  if (/costura|costurar|puntada/.test(k)) return 'costura';
  if (/refilad/.test(k)) return 'refilado';
  if (/adhesiv/.test(k)) return 'adhesivado';
  if (/(pegado|tapizad|montaje|virolad)/.test(k)) return 'tapizado';
  if (/inspec|control final/.test(k)) return 'inspeccion';
  if (/embalaj/.test(k)) return 'embalaje';
  return 'generico';
}

// ---- nombres de WE reales por (bucket, 6M). Solo nombres confirmados/origen/estándar. ----
const NA = null; // no aplica -> el FM se reasigna a Man
const RES = {
  recepcion:  { Machine:'Autoelevador', Man:'Operador de Producción', Material:'Materia prima recibida', Method:'Procedimiento de Recepción P-14', Measurement:'Instrumentos de medición de recepción', Environment:'Condiciones ambientales de planta' },
  corte:      { Machine:'Mesa de corte automática BMA090', Man:'Operador de Producción', Material:'Vinilo / Tela', Method:'Hoja de operación de corte', Measurement:'Calibre / Mylar', Environment:'Condiciones ambientales de planta' },
  costura:    { Machine:'Máquina de coser', Man:'Operador de Producción', Material:'Hilo de costura', Method:'Hoja de operación de costura', Measurement:'Muestra patrón / Calibre', Environment:'Condiciones ambientales de planta' },
  refilado:   { Machine:NA, Man:'Operador de Producción', Material:'Funda terminada', Method:'Hoja de operación de refilado', Measurement:'Muestra patrón', Environment:'Condiciones ambientales de planta' },
  adhesivado: { Machine:NA, Man:'Operador de Producción', Material:'Adhesivo', Method:'Hoja de operación de adhesivado', Measurement:'Balanza / Muestra patrón', Environment:'Condiciones ambientales de planta' },
  tapizado:   { Machine:'Mesa de Tapizado Semiautomática', Man:'Operador de Producción', Material:'Vinilo / Sustrato', Method:'Hoja de operación de tapizado', Measurement:'Muestra patrón', Environment:'Horno (condiciones de planta)' },
  soldadura:  { Machine:'Soldadora por ultrasonido', Man:'Operador de Producción', Material:'Material base', Method:'Hoja de operación de soldadura', Measurement:'Muestra patrón', Environment:'Condiciones ambientales de planta' },
  inspeccion: { Machine:NA, Man:'Inspector de Calidad', Material:'Pieza terminada', Method:'Hoja de operación de control final', Measurement:'Calibre MC257', Environment:'Condiciones ambientales de planta' },
  embalaje:   { Machine:'Etiquetadora impresora', Man:'Operador de Producción', Material:'Medio de embalaje', Method:'Instructivo de embalaje', Measurement:NA, Environment:'Condiciones ambientales de planta' },
  generico:   { Machine:NA, Man:'Operador de Producción', Material:'Material de proceso', Method:'Hoja de operación', Measurement:'Muestra patrón', Environment:'Condiciones ambientales de planta' },
};
function resolveWeName(buck, m) {
  const name = (RES[buck] || RES.generico)[m];
  return name ? name.replace(/ \/ /g, ' y ') : name; // sin "/" (regla 1M por linea)
}
const APH_PLACEHOLDER = 'Pendiente definición equipo APQP';
// descripción de función del WE (no es etiqueta 6M pura -> pasa validador FN_GENERIC)
function weFunction(buck, m, name) {
  switch (m) {
    case 'Machine': return `Operar ${name} según parámetros de proceso`;
    case 'Man': return `Ejecutar la operación y realizar autocontrol`;
    case 'Material': return `Aportar ${name} conforme a especificación`;
    case 'Method': return `Aplicar ${name}`;
    case 'Measurement': return `Verificar con ${name}`;
    case 'Environment': return `Mantener condiciones ambientales estables`;
    default: return `Contribuir a la operación`;
  }
}

// limpiar operationFunction: sacar prompts template, "Requerimientos", parámetros numéricos
function cleanOpFunction(s) {
  return norm(String(s).split('/').map(p => norm(p))
    .filter(p => p && !/^¿.*\?$/.test(p) && !/^requerimiento/i.test(p) && !/^\d/.test(p) && !/segundos|mm\b|°c|bar\b/i.test(p))
    .join(' / '));
}
function normSpecial(s) {
  const k = nk(s);
  if (k === 'cc') return 'CC';
  if (k === 'sc') return 'SC';
  return '';
}

function build(parsed, header) {
  const operations = parsed.operations.map(op => {
    const buck = bucket(op.operationName);
    // agrupar FMs por 6M
    const groups = {}; // m -> [failures]
    for (const f of op.failures) {
      const m0 = classify6M(`${f.fm} ${f.causes[0]?.cause || ''}`);
      let m = m0;
      if (resolveWeName(buck, m) == null) m = 'Man'; // si esa M no aplica al proceso, va a Operador
      (groups[m] ||= []).push(f);
    }
    // construir WEs (orden 6M canónico, solo los que tienen FMs)
    const order = ['Machine', 'Man', 'Material', 'Method', 'Measurement', 'Environment'];
    const workElements = order.filter(m => groups[m]?.length).map(m => {
      const name = resolveWeName(buck, m) || 'Operador de Producción';
      // corte = SCRAP, no retrabajo (regla amfe.md / decisión Fak: si se corta mal no hay vuelta atrás)
      const fixCorte = (s) => (buck !== 'corte' || !s) ? s : s
        .replace(/^Retrabajo$/i, 'Scrap (material mal cortado, no recuperable)')
        .replace(/Retrabajo de una porción de la producción\.?/i, 'Scrap de una porción de la producción (material no recuperable).')
        .replace(/retrabajo/gi, 'scrap');
      const failures = groups[m].map(f => ({
        id: uid(),
        description: f.fm,
        effectLocal: fixCorte(f.effectLocal || ''),
        effectNextLevel: fixCorte(f.effectNextLevel || ''),
        effectEndUser: fixCorte(f.effectEndUser || ''),
        severity: f.severity || null,
        causes: f.causes.map(c => {
          const ap = (f.severity && c.occurrence && c.detection) ? calculateAP(f.severity, c.occurrence, c.detection) : '';
          // AP=H sin accion ni placeholder -> placeholder autorizado (regla amfe-aph-pending)
          let prevAct = c.preventionAction || '';
          const detAct = c.detectionAction || '';
          if (ap === 'H' && !prevAct && !detAct) prevAct = APH_PLACEHOLDER;
          return {
            id: uid(),
            cause: c.cause, description: c.cause,
            severity: f.severity || null,
            occurrence: c.occurrence ?? null,
            detection: c.detection ?? null,
            ap, actionPriority: ap,
            preventionControl: c.preventionControl || '',
            detectionControl: c.detectionControl || '',
            specialChar: normSpecial(c.specialChar),
            preventionAction: prevAct,
            detectionAction: detAct,
            responsible: c.responsible || '',
            targetDate: c.targetDate || '',
            status: c.status || '',
            actionTaken: c.actionTaken || '',
            completionDate: c.completionDate || '',
            severityNew: c.severityNew ?? null,
            occurrenceNew: c.occurrenceNew ?? null,
            detectionNew: c.detectionNew ?? null,
            observations: c.observations || '',
          };
        }),
      }));
      const desc = weFunction(buck, m, name);
      return { id: uid(), name, type: m, functions: [{ id: uid(), description: desc, functionDescription: desc, requirements: '', failures }] };
    });
    return {
      id: uid(),
      opNumber: op.operationNumber, operationNumber: op.operationNumber,
      name: op.operationName, operationName: op.operationName,
      focusElementFunction: op.focusElementFunction || '',
      operationFunction: cleanOpFunction(op.operationFunction || ''),
      workElements,
    };
  });
  return { header, operations };
}

// ---- run ----
const argKey = process.argv[2];
const full = process.argv[3] === 'full';
const keys = argKey ? [argKey] : ['128', '129'];

const TEAM = 'Paulo Centurión (Ingeniería), Manuel Meszaros (Calidad), Cristina Rabago (Seguridad e Higiene), Mariana Vera (Producción)';
const HEADERS = {
  '128': { ip: '115', subject: 'IP DECORATIVE PA2 AMAROK - IP CORTO', partNumber: '2HT.857.115 HOA / 2HT.857.115 YZM / 2HT.857.115 DEC' },
  '129': { ip: '116', subject: 'IP DECORATIVE PA2 AMAROK', partNumber: '2HT.857.116 HOA / 2HT.857.116 YZM / 2HT.857.116 DEC' },
};

for (const k of keys) {
  const parsed = JSON.parse(readFileSync(`tmp/amfe${k}.parsed.json`, 'utf8'));
  const h = HEADERS[k];
  const header = {
    companyName: 'BARACK MERCOSUL', organization: 'BARACK MERCOSUL',
    scope: h.subject, subject: h.subject,
    partNumber: h.partNumber, applicableParts: h.partNumber,
    client: 'VWA', customerName: 'VWA',
    responsibleEngineer: 'Paulo Centurión', responsible: 'Paulo Centurión',
    coreTeam: TEAM, preparedBy: 'Facundo Santoro', approvedBy: 'Paulo Centurión',
    plant: 'Planta Hurlingham', model: 'AMAROK PA2',
    amfeNumber: k, revisionLevel: 'G',
    startDate: '', amfeDate: '', revisionDate: '',
  };
  const doc = build(parsed, header);
  syncLegacyFmFields(doc);
  syncFieldAliases(doc);
  const stats = countAmfeStats(doc);
  const val = validateAmfeDoc(doc, h.subject, k);
  writeFileSync(`tmp/amfe${k}.barack.json`, JSON.stringify(doc, null, 1));

  console.log(`\n############ AMFE ${k} (IP ${h.ip}) — esquema Barack ############`);
  console.log('stats:', JSON.stringify(stats));
  console.log(`Validación: CRITICAL=${val.critical.length}  WARNING=${val.warning.length}`);
  const crit = {}; val.critical.forEach(i => crit[i.type] = (crit[i.type] || 0) + 1);
  const warn = {}; val.warning.forEach(i => warn[i.type] = (warn[i.type] || 0) + 1);
  if (val.critical.length) console.log('  CRITICAL por tipo:', JSON.stringify(crit));
  if (val.warning.length) console.log('  WARNING por tipo:', JSON.stringify(warn));
  // listar causas sin O/D (gaps del origen, NO inventar)
  const noSOD = [];
  for (const op of doc.operations) for (const w of op.workElements) for (const fn of w.functions) for (const f of fn.failures) for (const c of f.causes) {
    if (c.occurrence == null || c.detection == null) noSOD.push(`OP${op.opNumber} / FM "${f.description.slice(0,30)}" / causa "${c.cause.slice(0,40)}" (S=${c.severity} O=${c.occurrence} D=${c.detection})`);
  }
  if (noSOD.length) { console.log(`  >> Causas sin O/D (origen incompleto, ${noSOD.length}):`); noSOD.forEach(x => console.log('     ' + x)); }
  // digest por operación
  for (const op of doc.operations) {
    const nFM = op.workElements.reduce((a, w) => a + w.functions.reduce((b, fn) => b + fn.failures.length, 0), 0);
    const nC = op.workElements.reduce((a, w) => a + w.functions.reduce((b, fn) => b + fn.failures.reduce((c, f) => c + f.causes.length, 0), 0), 0);
    console.log(`  OP ${String(op.opNumber).padEnd(6)} ${op.operationName.slice(0,38).padEnd(38)} WE:[${op.workElements.map(w=>`${w.name}/${w.type}`).join(', ').slice(0,90)}] FM:${nFM} C:${nC}`);
  }
  if (full && k === keys[0]) {
    const op10 = doc.operations[0];
    console.log(`\n--- OP10 detalle Barack ---`);
    for (const w of op10.workElements) {
      console.log(`  WE ${w.name} [${w.type}] fn="${w.functions[0].description}"`);
      for (const f of w.functions[0].failures) {
        console.log(`     FM "${f.description.slice(0,44)}" S=${f.severity}`);
        for (const c of f.causes) console.log(`        causa "${c.cause.slice(0,40)}" SOD=${c.severity}/${c.occurrence}/${c.detection} AP=${c.ap} ${c.specialChar}`);
      }
    }
  }
}
console.log('\nDONE');
