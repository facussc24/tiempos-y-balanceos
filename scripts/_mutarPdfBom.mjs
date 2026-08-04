/**
 * _mutarPdfBom.mjs — mutation testing de `_pdfBomArb.py`.
 *
 * Rompe el script a proposito, una defensa por vez, y corre la suite contra la copia rota.
 * Si la suite sigue VERDE con el bug puesto, ese test no protege nada: es un verde vacio.
 *
 * Nace de dos experimentos mal montados el 04/08/2026 que dieron el resultado que yo
 * esperaba por el motivo equivocado (un `grep` con `\t` que no matcheaba nunca, y una
 * mutacion que la suite jamas ejecuto porque apuntaba al script original). De ahi que este
 * script se AUTOVERIFIQUE: antes de mutar nada exige que la suite este verde, y despues de
 * cada mutacion exige haber ejecutado realmente la copia mutada.
 *
 *   node scripts/_mutarPdfBom.mjs
 *
 * Sale con codigo 1 si alguna mutacion SOBREVIVE.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(fileURLToPath(import.meta.url), '../..');
const SCRIPT = path.join(RAIZ, 'scripts', '_pdfBomArb.py');
const SUITE = '__tests__/scripts/pdfBomArb.test.mjs';

/** Cada entrada rompe UNA defensa. El texto tiene que existir tal cual en el .py: si algun
 *  dia deja de existir, esto falla ruidosamente en vez de reportar "cazada" sin haber mutado. */
const MUTACIONES = [
    {
        nombre: 'es_consumo acepta enteros pelados',
        de: "RE_CONSUMO = re.compile(r'\\d{1,3}(?:\\.\\d{3})*,\\d+')",
        a: "RE_CONSUMO = re.compile(r'\\d{1,3}(?:\\.\\d{3})*,\\d+|\\d+')",
    },
    {
        nombre: 'la continuacion no exige linea previa vacia',
        de: '    if not previa_vacia:\n        return False\n',
        a: '',
    },
    {
        nombre: 'la continuacion no exige forma de unidad',
        de: 'return es_unidad(campos[off + 1]) and es_consumo(campos[off + 2])',
        a: 'return es_consumo(campos[off + 2])',
    },
    {
        nombre: 'gate 2 sigue de largo si falta ARTICULO.TXT (fail-open)',
        de: "    if vigentes is None:\n        sys.exit('ABORTA: no encuentro ARTICULO.TXT al lado de RELACIONES.TXT. Sin el maestro '\n                 'no puedo descartar que alguna pieza este anulada.')",
        a: '    if vigentes is None:\n        vigentes = set(piezas)',
    },
    {
        nombre: 'gate 4 avisa en vez de abortar ante una fila rota',
        de: "    if rotas:\n        sys.exit(",
        a: "    if rotas:\n        print(",
    },
    {
        nombre: 'gate 3 ignora las lineas que no supo clasificar',
        de: '    if sin_clasificar:\n        sys.exit(',
        a: '    if False:\n        sys.exit(',
    },
    {
        nombre: 'el PDF se guarda con nombre final aunque falle el gate 5',
        de: '    parcial = salida + \'.parcial\'',
        a: '    parcial = salida',
        sinTest: 'El gate 5 (releer el PDF) es defensa en profundidad: con los gates 1-4 puestos '
            + 'no encontre ninguna entrada que lo haga fallar a el y no a uno anterior. Por eso '
            + 'no hay fixture que distinga guardar en .parcial de guardar directo. Se deja el '
            + 'rename atomico igual: si algun dia un gate anterior se afloja, es lo unico que '
            + 'evita dejar un PDF con pinta de terminado en la carpeta desde la que se adjunta.',
    },
];

const correrSuite = (env) => {
    try {
        execFileSync('npx', ['vitest', 'run', '--pool=threads', SUITE],
            { cwd: RAIZ, encoding: 'utf8', env, stdio: 'pipe', shell: true });
        return true;                      // verde
    } catch {
        return false;                     // rojo
    }
};

const original = fs.readFileSync(SCRIPT, 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mutpdfbom-'));

console.log('Chequeando que la suite arranque en verde...');
if (!correrSuite(process.env)) {
    console.error('ABORTA: la suite ya esta ROJA sin mutar nada. Arreglar eso primero — si no,'
        + '\n        toda mutacion se reporta "cazada" sin haber probado nada.');
    process.exit(1);
}
console.log('  verde. Mutando.\n');

let sobrevivientes = 0;
const documentadas = [];
for (const { nombre, de, a, sinTest } of MUTACIONES) {
    if (!original.includes(de)) {
        console.error(`  ERROR      ${nombre}\n             el fragmento a mutar ya no existe en el .py — actualizar esta mutacion.`);
        sobrevivientes++;
        continue;
    }
    const copia = path.join(tmp, 'mutante.py');
    fs.writeFileSync(copia, original.replace(de, a));

    // La copia tiene que ser distinta del original: si no, "cazada" no significaria nada.
    if (fs.readFileSync(copia, 'utf8') === original) {
        console.error(`  ERROR      ${nombre}: la mutacion no cambio nada.`);
        sobrevivientes++;
        continue;
    }

    const verde = correrSuite({ ...process.env, PDFBOM_SCRIPT: copia });
    if (!verde) {
        console.log(`  cazada     ${nombre}`);
    } else if (sinTest) {
        documentadas.push({ nombre, sinTest });
        console.log(`  sin test   ${nombre}  (documentado, ver abajo)`);
    } else {
        sobrevivientes++;
        console.log(`  SOBREVIVE  ${nombre}`);
    }
    // Una mutacion marcada `sinTest` que de pronto se caza es buena noticia, pero deja el
    // motivo desactualizado: se canta para que alguien borre la excepcion.
    if (!verde && sinTest) {
        console.log('             ^ ya tiene test: sacarle el campo `sinTest` a esta mutacion.');
    }
}

fs.rmSync(tmp, { recursive: true, force: true });

console.log();
for (const { nombre, sinTest } of documentadas) {
    console.log(`SIN TEST (a proposito): ${nombre}\n  ${sinTest}\n`);
}
if (sobrevivientes) {
    console.error(`${sobrevivientes} de ${MUTACIONES.length} mutaciones SOBREVIVIERON sin justificacion:`
        + '\nesas defensas no tienen un test que las proteja. Agregar el caso que las mate,'
        + '\no documentar por que no se puede con el campo `sinTest`.');
    process.exit(1);
}
console.log(`${MUTACIONES.length - documentadas.length} de ${MUTACIONES.length} mutaciones cazadas`
    + `${documentadas.length ? `, ${documentadas.length} documentada(s) sin test` : ''}.`);
