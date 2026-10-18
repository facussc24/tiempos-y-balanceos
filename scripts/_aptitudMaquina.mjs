/**
 * _aptitudMaquina.mjs — la cuenta del control estadistico preliminar (aptitud de maquina, I-AC-021) sobre una lista
 * de cotas, con el criterio del instructivo. No escribe nada: imprime. Logica y fuentes: `scripts/_lib/aptitudMaquina.mjs`.
 *
 * Uso:
 *   node scripts/_aptitudMaquina.mjs --valores "12,04 13,10 13,10 13,72"
 *   node scripts/_aptitudMaquina.mjs --archivo <txt|csv>  [--lie 10] [--lse 16] [--json]
 *
 * Los valores van en el ORDEN en que se tomaron (los subgrupos de 5 salen de ese orden). En el archivo: numeros
 * separados por espacio, punto y coma o renglon; la coma es decimal.
 * Es una calculadora: el estudio (planilla, sistema de medicion, normalidad con softcep o spc1) es de Calidad.
 */
import { readFileSync } from 'node:fs';
import { parsearValores, estudio, informe } from './_lib/aptitudMaquina.mjs';

const CON_VALOR = ['--valores', '--archivo', '--lie', '--lse'];
const SIN_VALOR = ['--json'];
const args = process.argv.slice(2);
const op = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (SIN_VALOR.includes(a)) { op[a] = true; continue; }
  if (CON_VALOR.includes(a)) {
    const v = args[i + 1];
    if (v === undefined || v.startsWith('--')) { console.error(`a ${a} le falta su valor. No hago nada.`); process.exit(2); }
    op[a] = v; i++; continue;
  }
  console.error(`argumento que no conozco: ${a}. Uso: --valores "12,04 13,10" | --archivo <txt> [--lie N] [--lse N] [--json]`);
  process.exit(2);
}
if (!!op['--valores'] === !!op['--archivo']) {
  console.error('va --valores o --archivo (uno de los dos). No hago nada.');
  process.exit(2);
}

const numero = (nombre) => {
  if (op[nombre] === undefined) return undefined;
  if (!String(op[nombre]).trim()) { console.error(`${nombre} esta vacio: va un numero (la tolerancia del plano)`); process.exit(2); }
  const v = Number(String(op[nombre]).replace(',', '.'));
  if (!Number.isFinite(v)) { console.error(`${nombre} no es un numero: "${op[nombre]}"`); process.exit(2); }
  return v;
};

try {
  const texto = op['--valores'] ?? readFileSync(op['--archivo'], 'utf8');
  const e = estudio(parsearValores(texto), { lie: numero('--lie'), lse: numero('--lse') });
  console.log(op['--json'] ? JSON.stringify(e, null, 2) : informe(e));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
