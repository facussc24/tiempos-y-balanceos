/**
 * _buscarDocSgc.mjs — buscar un documento del SGC en el servidor, SIN colgarse y SIN mentir.
 *
 * POR QUE EXISTE (incidente 2026-09-08)
 *   Fak pidio un formulario de aceptacion de devoluciones. Afirme que el "Anexo I" del
 *   I-AC-012 nunca se habia emitido y codifique el nuevo como I-AC-012.1. Estaba
 *   VIGENTE desde 2011 en ...\Instructivos\CALIDAD\Anexos\I-AC-012.1 Devolucion de
 *   clientes B.xls. El mail a Gonzalo ya habia salido.
 *
 *   Las dos causas, las dos evitables:
 *     1. Busque en `.sgc-cache`, que cachea los INSTRUCTIVOS pero no la subcarpeta
 *        `Anexos\`. Un cache incompleto devuelve "no hay" con la misma cara que un "no existe".
 *     2. El `find` recursivo sobre Y: se corto por timeout a los 120 s y segui sin el
 *        resultado. Un chequeo que no termino no es un chequeo.
 *
 * QUE HACE DISTINTO
 *   - Mira el SERVIDOR, no el cache.
 *   - Incluye las subcarpetas `Anexos\`, que es donde viven los registros.
 *   - Acota la profundidad para no colgarse, y si una carpeta NO se pudo leer lo dice
 *     fuerte y sale con exit 2: nunca devuelve silencio que se pueda leer como "no existe".
 *   - Separa VIGENTE de OBSOLETO y de las copias de BRASIL / SISTEMA 2017.
 *
 * USO
 *   node scripts/_buscarDocSgc.mjs I-AC-012
 *   node scripts/_buscarDocSgc.mjs "Devolucion de clientes"
 *   node scripts/_buscarDocSgc.mjs I-AC-012 --todo   # incluye BRASIL y sistemas viejos
 */
import fs from 'node:fs';
import path from 'node:path';

const RAIZ_SGC = 'Y:/BARACK/CALIDAD/DOCUMENTACION SGC';
const VIGENTE = `${RAIZ_SGC}/SISTEMA/SISTEMA SGC`;
const PROFUNDIDAD_MAX = 5;
const RAMAS_NO_VIGENTES = /^(BRASIL|CAMBIOS DEL SISTEMA BARACK|SISTEMA 2017)$/i;

const args = process.argv.slice(2);
const todo = args.includes('--todo');
const patron = args.filter((a) => !a.startsWith('--')).join(' ').trim();

if (!patron) {
  console.error('Falta el codigo o el texto a buscar. Ej: node scripts/_buscarDocSgc.mjs I-AC-012');
  process.exit(1);
}

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const objetivo = norm(patron);

const hallazgos = [];
const inaccesibles = [];

function recorrer(dir, nivel) {
  if (nivel > PROFUNDIDAD_MAX) return;
  let entradas;
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    inaccesibles.push({ dir, motivo: e.code || e.message });
    return;
  }
  for (const e of entradas) {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!todo && RAMAS_NO_VIGENTES.test(e.name)) continue;
      recorrer(completo, nivel + 1);
    } else if (norm(e.name).includes(objetivo)) {
      // ~$ son archivos de bloqueo de Office, no documentos
      if (e.name.startsWith('~$')) continue;
      let mtime = null;
      try { mtime = fs.statSync(completo).mtime.toISOString().slice(0, 10); } catch { /* no critico */ }
      hallazgos.push({ ruta: completo.replace(/\\/g, '/'), mtime });
    }
  }
}

const raiz = todo ? RAIZ_SGC : VIGENTE;
if (!fs.existsSync(raiz)) {
  console.error(`\n  NO SE PUDO ABRIR el SGC: ${raiz}`);
  console.error('  El disco Y: no esta montado o no responde. ESTO NO ES UN "NO EXISTE".\n');
  process.exit(2);
}

recorrer(raiz, 0);

const esObsoleto = (r) => /\/obsoletos?\//i.test(r);
const vigentes = hallazgos.filter((h) => !esObsoleto(h.ruta));
const obsoletos = hallazgos.filter((h) => esObsoleto(h.ruta));

console.log(`\nBuscando "${patron}" en ${raiz}\n`);

if (vigentes.length) {
  console.log(`VIGENTES (${vigentes.length}):`);
  for (const h of vigentes) console.log(`  ${h.mtime ?? '          '}  ${h.ruta}`);
} else {
  console.log('VIGENTES: ninguno.');
}

if (obsoletos.length) {
  console.log(`\nOBSOLETOS (${obsoletos.length}):`);
  for (const h of obsoletos) console.log(`  ${h.mtime ?? '          '}  ${h.ruta}`);
}

if (inaccesibles.length) {
  console.log(`\n  ${inaccesibles.length} CARPETA(S) NO SE PUDIERON LEER — la busqueda esta INCOMPLETA:`);
  for (const i of inaccesibles.slice(0, 10)) console.log(`   ${i.motivo}  ${i.dir}`);
  console.log('\n  NO afirmar que el documento no existe. Reintentar o mirar a mano.\n');
  process.exit(2);
}

if (!hallazgos.length) {
  console.log('\n  Sin resultados, y todas las carpetas se leyeron bien.');
  console.log(`  Ojo: se miro hasta ${PROFUNDIDAD_MAX} niveles${todo ? '' : ' y solo el sistema VIGENTE (--todo agrega BRASIL y los sistemas viejos)'}.\n`);
}
console.log('');
