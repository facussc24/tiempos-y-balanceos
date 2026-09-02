/**
 * _encargo.mjs — el UNICO canal por el que el coordinador manda trabajo a otra sesion.
 *
 * POR QUE EXISTE. Hasta el 02/09/2026, del coordinador salia prosa libre: un parrafo escrito
 * a mano que iba a otra sesion y que nadie revisaba. En dos dias eso produjo 7 fallos reales
 * (un "creo" de Fak convertido en dato, un mail inexistente mandado a buscar, dos tareas en un
 * mismo encargo, una orden de cerrar el arb que dejo todo trabado, un hallazgo lateral que
 * desvio a una sesion, un tablero armado de oido, y un OK de Fak reenviado). Las lecciones se
 * escribieron las siete veces. Ninguna frenaba nada.
 *
 * Este script arma un FORMULARIO VALIDADO y lo registra. El hook coordinador-guard.sh bloquea
 * cualquier mensaje a otra sesion que no haya salido de aca. Es el mismo patron que la casa ya
 * probo dos veces: _mailEnviar.py + mail-guard.sh, y _escritorio.mjs + escritorio-guard.sh.
 *
 * NADA SE BORRA Y NADA SE MUEVE: no hay una sola llamada de borrado ni de rename en este
 * archivo. Cerrar un encargo le agrega el campo `cerrado` al mismo JSON; el historial completo
 * queda en .claude/state/encargos/.
 *
 * USO
 *   node scripts/_encargo.mjs --a "<sesion>" --entregable "<UNO solo>" --origen fak \
 *        --cuerpo "<el texto>" [--fuente <ruta>]... [--fuente-condicional "<desc>"]... \
 *        [--supuesto "<...>" | --sin-supuestos] [--etapa proyecto|serie] \
 *        [--ok-fak "<cita textual>" --hora HH:MM]
 *
 *   node scripts/_encargo.mjs --origen hallazgo --hallazgo "<linea>" --carpeta "<carpeta>"
 *        (no arma encargo: lo anota en el HALLAZGOS.md de esa carpeta y devuelve la ruta)
 *
 *   node scripts/_encargo.mjs --cerrar <id>      # el encargo volvio; libera a esa sesion
 *   node scripts/_encargo.mjs --listar           # encargos abiertos
 *
 * SALIDA: el texto final con el marcador [ENCARGO <id>] al principio. Se pega TAL CUAL en el
 * SendMessage. Si se edita una coma despues, el hash no coincide y el guardian lo bloquea.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const DIR_ESTADO = path.join(RAIZ, '.claude', 'state', 'encargos');
const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, '_lib', 'coordinadorCanon.data.json'), 'utf8'));

// ─────────────────────────────────────────────────────────────────────── utilidades

export const normalizar = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // saca tildes: "cerrá" y "cerra" son la misma orden
    .replace(/\s+/g, ' ');

export const hashCuerpo = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);

/** Busca patrones de una lista canonica dentro de un texto. Devuelve los que aparecen. */
export function buscarPatrones(texto, patrones) {
  const t = normalizar(texto);
  return patrones.filter((p) => t.includes(normalizar(p)));
}

// ───────────────────────────────────────────────────────────── los 7 gates, uno por funcion

/** G2 · toda fuente nombrada se verifica, o se escribe condicional. */
export function verificarFuentes(fuentes, { existe = fs.existsSync } = {}) {
  const malas = [];
  for (const f of fuentes) {
    if (/^mail:/i.test(f)) {
      // Un mail no se resuelve desde node: se exige que quien lo nombra ya lo haya buscado
      // y pase el asunto mas la FECHA. Sin fecha, no esta verificado.
      if (!/\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/.test(f)) {
        malas.push({ fuente: f, motivo: 'un mail se cita con su FECHA (buscalo con scripts/_mails.py). Sin fecha no esta verificado: usá --fuente-condicional' });
      }
      continue;
    }
    if (!existe(f)) malas.push({ fuente: f, motivo: 'la ruta no existe en el disco' });
  }
  return malas;
}

/** G3 · un encargo, un entregable. */
export function detectarSegundaTarea(cuerpo) {
  return buscarPatrones(cuerpo, CANON.conectoresSegundaTarea.patrones);
}

/** G4 · nada irreversible viaja en un encargo. */
export function detectarIrreversibles(texto) {
  const hits = [];
  for (const e of CANON.accionesIrreversibles.entradas) {
    const encontrados = buscarPatrones(texto, e.patrones);
    if (encontrados.length) hits.push({ ...e, encontrados });
  }
  return hits;
}

/** G5 · origen valido, y etapa declarada cuando toca consumos. */
export function validarOrigenYEtapa({ origen, etapa, entregable, cuerpo }) {
  const errores = [];
  if (!origen) errores.push('falta --origen (fak | lista-oficial | continuidad)');
  else if (!CANON.origenesValidos.valores.includes(origen)) {
    errores.push(`--origen "${origen}" no es valido. Solo: ${CANON.origenesValidos.valores.join(' | ')}. Un HALLAZGO no es un encargo: se anota con --origen hallazgo --hallazgo "..." --carpeta "..."`);
  }
  const texto = `${entregable} ${cuerpo}`;
  const tocaConsumos = buscarPatrones(texto, CANON.etapaPieza.disparanEtapaObligatoria).length > 0;
  if (tocaConsumos && !etapa) {
    errores.push('el encargo toca consumos/BOM: falta --etapa proyecto|serie. En PROYECTO los consumos van aproximados y con medida estandar, y eso es lo esperable, no un defecto.');
  }
  if (etapa === 'proyecto') {
    const verbos = buscarPatrones(texto, CANON.etapaPieza.verbosDeAuditoriaProhibidosEnProyecto);
    if (verbos.length) {
      errores.push(`--etapa proyecto + verbo de auditoria ("${verbos.join('", "')}"): en proyecto un consumo aproximado NO es un error. ${CANON.etapaPieza.fuente}`);
    }
  }
  return errores;
}

/** G7 · el destino no es un apodo, y una autorizacion de Fak no se reenvia. */
export function validarDestinoYAutorizacion({ a, cuerpo, okFak }) {
  const errores = [];
  if (!a) errores.push('falta --a (a que sesion va el encargo)');
  else if (a.trim().length < 6) {
    errores.push(`--a "${a}" parece un apodo. Va el nombre completo de la sesion (barackmercosul-xx) o su sessionId, como sale de ListAgents. Un apodo corto es como se le habla a la sesion equivocada.`);
  }
  const frases = buscarPatrones(cuerpo, CANON.frasesAutorizacionReenviada.patrones);
  if (frases.length && !okFak) {
    errores.push(`el cuerpo reenvia una autorizacion de Fak ("${frases[0]}"). Una autorizacion NO viaja adentro de un encargo: la plataforma no la reconoce como consentimiento. Si Fak dijo algo, va con --ok-fak "<cita textual>" --hora HH:MM y sale rotulado como OK REENVIADO, que no habilita a enviar nada.`);
  }
  return errores;
}

// ───────────────────────────────────────────────────────────────────── armado del encargo

export function armarTexto({ id, a, entregable, origen, etapa, cuerpo, fuentes, condicionales, supuestos, okFak, hora }) {
  const L = [];
  L.push(`[ENCARGO ${id}]`);
  L.push(`PARA: ${a}`);
  L.push(`ENTREGABLE (uno solo): ${entregable}`);
  L.push(`ORIGEN: ${origen}${etapa ? `  ·  ETAPA DE LA PIEZA: ${etapa}` : ''}`);
  L.push('');
  L.push(cuerpo.trim());
  L.push('');
  if (fuentes.length) {
    L.push('DATO — fuentes verificadas (existen, las miré antes de mandarte esto):');
    fuentes.forEach((f) => L.push(`  · ${f}`));
  }
  if (condicionales.length) {
    L.push('A VERIFICAR — no confirmé que exista, tratalo como hipotesis:');
    condicionales.forEach((f) => L.push(`  · SI existe ${f}, usalo. Si no existe, NO lo busques mas: avisame y seguimos sin eso.`));
  }
  if (supuestos.length) {
    L.push('SUPUESTO — esto lo estoy suponiendo yo, no es un dato:');
    supuestos.forEach((s) => L.push(`  · ${s}`));
  } else {
    L.push('SUPUESTO: ninguno declarado.');
  }
  if (okFak) {
    L.push('');
    L.push(`OK REENVIADO — NO habilita a enviar nada por tu cuenta. Fak dijo${hora ? `, ${hora}` : ''}, textual: "${okFak}"`);
    L.push('Si lo que sigue es un envio de mail o algo irreversible, la autorizacion te la tiene que dar el a vos, en tu ventana.');
  }
  L.push('');
  L.push('Si algo de este encargo no cierra, PARA y avisame antes de seguir.');
  return L.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────── CLI

export function parseArgs(argv) {
  const o = { fuente: [], 'fuente-condicional': [], supuesto: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    if (Array.isArray(o[k])) o[k].push(v);
    else if (k === 'entregable' && o[k] !== undefined) { o.__dosEntregables = true; o[k] = v; }
    else o[k] = v;
  }
  return o;
}

/** Corre todas las validaciones. Devuelve la lista de errores (vacia = pasa). */
export function validarEncargo(a) {
  const errores = [];
  const cuerpo = a.cuerpo === true ? '' : (a.cuerpo || '');
  const entregable = a.entregable === true ? '' : (a.entregable || '');

  if (!entregable) errores.push('falta --entregable (UNO solo: dos entregables son dos encargos)');
  if (a.__dosEntregables) errores.push('pasaste DOS --entregable. Un encargo, un entregable. El segundo sale cuando vuelve el primero.');
  if (!cuerpo) errores.push('falta --cuerpo (el texto del encargo)');

  errores.push(...validarDestinoYAutorizacion({ a: a.a === true ? '' : a.a, cuerpo, okFak: a['ok-fak'] }));
  errores.push(...validarOrigenYEtapa({ origen: a.origen, etapa: a.etapa, entregable, cuerpo }));

  const segunda = detectarSegundaTarea(cuerpo);
  if (segunda.length) {
    errores.push(`el cuerpo tiene un conector de SEGUNDA TAREA ("${segunda.join('", "')}"). Un encargo, un entregable: armá dos encargos y mandá el segundo cuando vuelva el primero.`);
  }

  for (const h of detectarIrreversibles(`${entregable} ${cuerpo}`)) {
    errores.push(`el encargo pide una accion IRREVERSIBLE ("${h.encontrados[0]}" -> ${h.id}). ${h.motivo} Se revierte con: ${h.revierte}. Eso vuelve a Fak, no va en un encargo.`);
  }

  for (const m of verificarFuentes((a.fuente || []).filter((f) => f !== true))) {
    errores.push(`--fuente "${m.fuente}": ${m.motivo}`);
  }

  const supuestos = (a.supuesto || []).filter((s) => s !== true);
  if (!supuestos.length && !a['sin-supuestos']) {
    errores.push('declara los supuestos: --supuesto "<lo que estas suponiendo>" (repetible) o --sin-supuestos si de verdad no hay ninguno. Un "creo" no declarado viaja como si fuera un dato.');
  }
  return errores;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  fs.mkdirSync(DIR_ESTADO, { recursive: true });

  const leerTodos = () => fs.readdirSync(DIR_ESTADO)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR_ESTADO, f), 'utf8')));

  if (a.listar) {
    const abiertos = leerTodos().filter((e) => !e.cerrado);
    if (!abiertos.length) { console.log('No hay encargos abiertos.'); return 0; }
    console.log(`Encargos ABIERTOS (${abiertos.length}):`);
    for (const e of abiertos) {
      console.log(`  ${e.id}  ->  ${e.a}\n      ${e.entregable}\n      abierto desde ${e.creado}`);
    }
    return 0;
  }

  if (a.cerrar) {
    const f = path.join(DIR_ESTADO, `${a.cerrar}.json`);
    if (!fs.existsSync(f)) { console.error(`No existe el encargo ${a.cerrar}.`); return 1; }
    const e = JSON.parse(fs.readFileSync(f, 'utf8'));
    e.cerrado = new Date().toISOString();
    fs.writeFileSync(f, JSON.stringify(e, null, 2) + '\n');
    console.log(`Encargo ${a.cerrar} cerrado. ${e.a} queda libre para el proximo.`);
    return 0;
  }

  // G5 · un hallazgo NO es un encargo
  if (a.origen === 'hallazgo') {
    if (!a.hallazgo || a.hallazgo === true || !a.carpeta || a.carpeta === true) {
      console.error('Un hallazgo se anota, no se encarga:\n  --origen hallazgo --hallazgo "<linea>" --carpeta "<carpeta del Escritorio>"');
      return 1;
    }
    const destino = path.join(a.carpeta, 'HALLAZGOS.md');
    const linea = `- [${new Date().toISOString().slice(0, 10)}] ${a.hallazgo}\n`;
    const cabecera = '# Hallazgos laterales\n\nAnotados, NO encargados. Se convierten en tarea solo si Fak lo decide.\n\n';
    fs.appendFileSync(destino, fs.existsSync(destino) ? linea : cabecera + linea);
    console.log(`Anotado como hallazgo (no se encargo nada):\n  ${destino}`);
    console.log('Un hallazgo lateral se anota y se sigue. Si Fak decide que es tarea, sale un encargo con --origen fak.');
    return 0;
  }

  const errores = validarEncargo(a);
  if (errores.length) {
    console.error('\n== ENCARGO RECHAZADO ' + '='.repeat(52));
    errores.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
    console.error('='.repeat(73));
    console.error('\nNo es burocracia: cada check nace de un error real del 31/08 o 01/09/2026.');
    console.error('Detalle: Escritorio\\Mejorar el rol de coordinador\\_INVESTIGACION - rol coordinador.md\n');
    return 1;
  }

  const id = `E${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${crypto.randomBytes(2).toString('hex')}`;
  const texto = armarTexto({
    id, a: a.a, entregable: a.entregable, origen: a.origen, etapa: a.etapa, cuerpo: a.cuerpo,
    fuentes: (a.fuente || []).filter((f) => f !== true),
    condicionales: (a['fuente-condicional'] || []).filter((f) => f !== true),
    supuestos: (a.supuesto || []).filter((s) => s !== true),
    okFak: a['ok-fak'], hora: a.hora,
  });

  fs.writeFileSync(path.join(DIR_ESTADO, `${id}.json`), JSON.stringify({
    id, a: a.a, entregable: a.entregable, origen: a.origen, etapa: a.etapa || null,
    creado: new Date().toISOString(), hash: hashCuerpo(texto), cerrado: null,
    // El texto completo queda guardado para que el guardian compare LITERAL lo que se manda
    // contra lo que se valido. Sin esto, escribir el marcador a mano alcanzaria para pasar.
    texto,
  }, null, 2) + '\n');

  console.log(texto);
  console.error(`\n[registrado ${id} — pegá el texto TAL CUAL; si lo editás, el guardián lo bloquea por hash]`);
  return 0;
}

if (process.argv[1]?.endsWith('_encargo.mjs')) process.exit(main());
