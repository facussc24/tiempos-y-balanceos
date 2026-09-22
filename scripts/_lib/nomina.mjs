/**
 * nomina.mjs — quien trabaja hoy en Barack, leido de la fuente unica.
 *
 * Existe por el 21/09/2026: emiti el AMFE 173 con dos personas en el EQUIPO MULTIFUNCIONAL
 * que no trabajan mas (una desde marzo de 2024), porque copie la lista del AMFE 127 en vez
 * de verificarla. Fak lo vio apenas abrio el archivo.
 *
 * Fuente: core/amfe/nominaBarack.data.json. Aca no se hardcodea ningun nombre.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const NOMINA = JSON.parse(
  fs.readFileSync(path.join(RAIZ, 'core', 'amfe', 'nominaBarack.data.json'), 'utf8'),
);

/** "Araceli Maidana (Ingenieria)" -> "araceli maidana". Sin tildes, sin el area, sin puntos. */
export const normalizarNombre = (s) =>
  String(s ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.,;]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

let PORNOMBRE;
let DUDOSOS;

/**
 * Arma los indices de busqueda desde `NOMINA`. Se llama una vez al importar.
 *
 * Es exportada porque si no, el camino de la "baja probable sin confirmar" no se puede probar:
 * hoy la lista de dudosos esta vacia — el unico que habia, Pagliaroli, lo confirmo Fak el
 * 22/09/2026 — y un camino que no se puede ejercitar es un camino que nadie sabe si funciona.
 */
export function indexarNomina() {
  PORNOMBRE = new Map(NOMINA.personas.map((p) => [normalizarNombre(p.nombre), p]));
  DUDOSOS = new Map((NOMINA.dudosos ?? []).map((p) => [normalizarNombre(p.nombre), p]));
}
indexarNomina();

/**
 * Busca a una persona. Tolera la inicial: "C.BAPTISTA" y "C. Baptista" encuentran a
 * Carlos Baptista, que es como la escriben los listados maestros. El apellido tiene que
 * coincidir entero — dos personas con el mismo apellido devuelven `null` en vez de adivinar.
 */
export function buscarPersona(texto) {
  const n = normalizarNombre(texto);
  if (!n) return null;
  const directa = PORNOMBRE.get(n) ?? DUDOSOS.get(n);
  if (directa) return directa;

  const partes = n.split(' ');
  const apellido = partes[partes.length - 1];
  const inicial = partes.length > 1 ? partes[0][0] : null;
  const candidatos = [...PORNOMBRE.values(), ...DUDOSOS.values()].filter((p) => {
    const pn = normalizarNombre(p.nombre).split(' ');
    if (pn[pn.length - 1] !== apellido) return false;
    return inicial === null || pn[0][0] === inicial;
  });
  return candidatos.length === 1 ? candidatos[0] : null;
}

/** true solo si la persona esta y esta activa. Desconocida -> false (con `motivo` en revisar()). */
export const trabajaHoy = (texto) => buscarPersona(texto)?.activo === true;

/** La nomina se verifico hace mucho? Una baja no avisa sola. */
export function nominaVencida(hoy = new Date()) {
  const vence = new Date(`${NOMINA.vence_el}T23:59:59`);
  return hoy > vence;
}

/** Acepta "21/09/2026", "2026-09-21" y "2026-09". Devuelve null si no entiende. */
export function aFecha(txt) {
  const s = String(txt ?? '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{4})-(\d{2})$/);
  // Mes solo: se toma el ULTIMO dia. La precision de una baja es la que es, y estirarla
  // para que caiga antes seria inventar un dato para poder marcar un error.
  if (m) return new Date(Date.UTC(+m[1], +m[2], 0));
  return null;
}

/**
 * Una persona "sobra" en un documento solo si YA SE HABIA IDO cuando el documento se emitio.
 *
 * Decision de Fak, 21/09/2026: *"no vamos a modificar los viejos, los viejos pueden tener
 * nombres viejos hasta que se actualicen, no pasa nada"*. Un AMFE de 2024 con el equipo de
 * 2024 es correcto — es una foto de su fecha. Lo que no puede pasar es emitir HOY un
 * documento con alguien que se fue hace dos anos, que es lo del AMFE 173.
 *
 * Sin esto el gate bloquearia re-exportar cualquier AMFE viejo, y un gate que frena trabajo
 * legitimo se termina apagando.
 */
export function yaSeHabiaIdo(persona, fechaDocumento) {
  if (persona?.activo !== false) return false;
  const baja = aFecha(persona.baja);
  const doc = aFecha(fechaDocumento);
  if (!baja || !doc) return true;   // sin fecha no se puede excusar: se reporta
  return baja < doc;
}

/**
 * Revisa una lista de equipo y devuelve UN problema por persona, con el motivo escrito.
 * Un control que frena tiene que decir CUAL renglon lo frena.
 */
export function revisarEquipo(equipo, { fechaDocumento = null } = {}) {
  const lista = Array.isArray(equipo) ? equipo : String(equipo ?? '').split(/\s*,\s*(?![^(]*\))/);
  const problemas = [];
  for (const entrada of lista) {
    if (!String(entrada ?? '').trim()) continue;
    const p = buscarPersona(entrada);
    if (!p) {
      problemas.push({
        entrada, gravedad: 'CRITICAL', motivo: 'no esta en la nomina de Barack',
        comoArreglar: 'si es alguien que entro, agregalo a core/amfe/nominaBarack.data.json con su evidencia; si esta mal escrito, corregilo',
      });
    } else if (p.activo === false) {
      // Se fue DESPUES de que el documento se emitio: el documento es una foto de su fecha
      // y no se toca (decision de Fak, 21/09/2026). Ver `yaSeHabiaIdo`.
      if (fechaDocumento && !yaSeHabiaIdo(p, fechaDocumento)) continue;
      problemas.push({
        entrada, persona: p.nombre, gravedad: 'CRITICAL',
        motivo: `no trabaja mas en Barack (baja ${p.baja ?? 'sin fecha'}): ${p.evidencia}`,
        comoArreglar: 'sacalo del equipo. A quien lo reemplaza lo elige Fak, no el documento viejo',
      });
    } else if (p.activo !== true) {
      problemas.push({
        entrada, persona: p.nombre, gravedad: 'WARNING',
        motivo: `baja probable sin confirmar: ${p.evidencia}`,
        comoArreglar: p.que_falta ?? 'confirmalo con Fak antes de emitir',
      });
    }
  }
  if (nominaVencida()) {
    problemas.push({
      entrada: '(la nomina)', gravedad: 'WARNING',
      motivo: `la nomina se verifico el ${NOMINA.verificado_el} y vencio el ${NOMINA.vence_el}: una baja no avisa sola`,
      comoArreglar: 'reabrir las fuentes de `fuentes_de_verdad` y actualizar el .data.json',
    });
  }
  return problemas;
}

/** Los que hoy trabajan en un area — para ofrecer reemplazo, nunca para elegirlo solo. */
export const activosDe = (area) =>
  NOMINA.personas.filter((p) => p.activo === true && p.area.toLowerCase() === String(area).toLowerCase());
