/**
 * Corre el selftest de `scripts/_lib/arbRelaciones.py` y prueba `scripts/_consumo.py` de punta a
 * punta, para que CI los ejecute.
 *
 * `arbRelaciones.py` es el parser UNICO del export RELACIONES del arb (antes cada sesion escribia
 * el suyo: 258 `iconv` y 63 parsers inline en 215 transcripciones, automejora 30/09/2026) y
 * `_consumo.py` contesta "cuanto lleva X" y "donde se usa Y" en segundos, con un SELLO arriba que
 * dice de cuando es el dato y si hubo cargas al arb despues.
 *
 * El selftest trabaja sobre lineas REALES del export del 30/09/2026 y del de agosto (las filas
 * partidas), recortadas en `__tests__/scripts/fixtures/arb_*.TXT`, y se probo rojo con 16
 * mutaciones del parser (offset +9, sin fusion de partidas, hora de la copia en vez de la del
 * original, acumulado sin multiplicar, etc.). Los fixtures pueden llegar con LF (git `eol=lf`): el
 * parser lee los dos.
 *
 * Mismo criterio que respaldoCargaSelftest.test.mjs: NUNCA skip si falta python — un test
 * salteado es un verde vacio, y el runner de CI ya instala Python 3.12.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIB = path.join(RAIZ, 'scripts', '_lib', 'arbRelaciones.py');
const CONSUMO = path.join(RAIZ, 'scripts', '_consumo.py');
const FX = path.join(RAIZ, '__tests__', 'scripts', 'fixtures');
// Cada caso lanza python o node (1 a 6 s con la PC cargada): el limite por defecto de 15 s queda justo.
const LIMITE = 90000;
const ENTORNO = { ...process.env, PYTHONIOENCODING: 'utf-8' };

describe('arbRelaciones.py --selftest (parser unico del export del arb)', () => {
    it('parsea las lineas reales, arma el sello y da rojo cuando corresponde', { timeout: LIMITE }, () => {
        const out = execFileSync('python', [LIB, '--selftest'], { encoding: 'utf8', env: ENTORNO });
        expect(out).toContain('selftest arbRelaciones: todo verde');
        expect(out).not.toMatch(/^ {2}MAL/m);
        // los casos que importan, por nombre: si alguien los borra, este test se entera
        expect(out).toMatch(/ok {4}parser: nivel 1 y 2 no se pierden/);
        expect(out).toMatch(/ok {4}partidas: nivel 1 toma unidad y consumo de la linea de abajo/);
        expect(out).toMatch(/ok {4}partidas: la continuacion no crea productos fantasma/);
        expect(out).toMatch(/ok {4}explotar: acumulado con multiplicador distinto de 1/);
        expect(out).toMatch(/ok {4}donde se usa: el producto terminado lo consume por FUNDA y CORTE/);
        expect(out).toMatch(/ok {4}sello: pero la hora del export es la del original \(13:20\), no la de la copia/);
        expect(out).toMatch(/ok {4}sello: la carga de las 14:00 es POSTERIOR al export real/);
        expect(out).toMatch(/ok {4}sello: con mas de 24 h avisa viejo aunque no haya cargas/);
        expect((out.match(/^ {2}ok {2}/gm) || []).length).toBeGreaterThanOrEqual(65);
    });
});

/** Arma las dos carpetas del arb (C:\tmp y .arb-cache) de mentira, con los fixtures reales. */
function armarArb({ horasDeEdad = 1, journal = null } = {}) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'consumo-'));
    const tmp = path.join(base, 'tmp');
    const cache = path.join(base, 'cache');
    fs.mkdirSync(tmp);
    fs.mkdirSync(cache);
    const copia = (de, a) => fs.copyFileSync(path.join(FX, de), path.join(a));
    copia('arb_relaciones_muestra.TXT', path.join(tmp, 'RELACIONES.TXT'));
    copia('arb_articulo_muestra.TXT', path.join(tmp, 'ARTICULO.TXT'));
    copia('arb_insumos_listado_muestra.TXT', path.join(tmp, 'INSUMOS.TXT'));
    const hecho = new Date(Date.now() - horasDeEdad * 3600 * 1000);
    fs.utimesSync(path.join(tmp, 'RELACIONES.TXT'), hecho, hecho);
    if (journal) {
        const hoy = new Date();   // fecha LOCAL: el journal se nombra con la hora de la PC, no con la UTC
        const dia = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`;
        fs.writeFileSync(path.join(cache, `carga_${dia}.jsonl`), journal.map((r) => JSON.stringify(r)).join('\n') + '\n');
    }
    return { base, tmp, cache };
}

/** Desarma pieza por pieza (sin borrado recursivo), como nubeRutas.test.mjs. */
function desarmar({ tmp, cache, base }) {
    for (const dir of [tmp, cache]) {
        for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
        fs.rmdirSync(dir);
    }
    fs.rmdirSync(base);
}

function consumo(args, arb) {
    const r = spawnSync('python', [CONSUMO, ...args], {
        encoding: 'utf8',
        env: { ...ENTORNO, BARACK_ARB_TMP: arb.tmp, BARACK_ARB_CACHE: arb.cache },
    });
    return { out: r.stdout, err: r.stderr, code: r.status };
}

describe('_consumo.py (BOM explotada y donde se usa, solo lectura)', () => {
    it('BOM de un producto: semielaborados marcados, acumulado y totales por insumo final', { timeout: LIMITE }, () => {
        const arb = armarArb();
        try {
            const { out, code } = consumo(['0024760703-FZHE'], arb);
            expect(code).toBe(0);
            expect(out).toMatch(/^SELLO DEL DATO/m);
            expect(out).toMatch(/estado: al dia/);
            // las 6 lineas directas y los 3 semielaborados, marcados
            expect(out).toMatch(/PRODUCTO 0024760703-FZHE/);
            expect(out).toMatch(/6 lineas directas, 3 semielaborados/);
            expect(out).toMatch(/FUN-002-607-FZH\s+SEMI\s+FUNDA/);
            expect(out).toMatch(/COR-002-607-FZH\s+SEMI\s+CORTE/);
            // el vinilo cuelga de FUNDA > CORTE y trae su cantidad y el acumulado
            expect(out).toMatch(/124\.602\.0228-1\s+VINILO SANSUY SANFOAM PREMIUM III CL100\s+MTL\s+0,09800000\s+0,09800000/);
            expect(out).toMatch(/TOTAL POR INSUMO FINAL/);
            expect(out).toMatch(/Unidades \(del maestro, familias del canon\):.*MTL = metro lineal/);
            // este producto no esta en ARTICULO.TXT ni en el INSUMOS.TXT impreso: lo dice, no inventa una descripcion
            expect(out).toMatch(/sin descripcion en los exports/);
        } finally {
            desarmar(arb);
        }
    });

    it('--niveles 0 muestra solo las lineas directas y dice que no abrio los semielaborados', { timeout: LIMITE }, () => {
        const arb = armarArb();
        try {
            const { out } = consumo(['0024760703-FZHE', '--niveles', '0'], arb);
            expect(out).toMatch(/sin abrir: --niveles mas alto/);
            expect(out).not.toMatch(/124\.602\.0228-1\s+VINILO/);
        } finally {
            desarmar(arb);
        }
    });

    it('--donde-se-usa: directo y por semielaborado, con la cantidad acumulada por producto', { timeout: LIMITE }, () => {
        const arb = armarArb();
        try {
            const { out, code } = consumo(['--donde-se-usa', '124.602.0228-1'], arb);
            expect(code).toBe(0);
            expect(out).toMatch(/LO USAN DIRECTO \(1\)/);
            expect(out).toMatch(/COR-002-607-FZH\s+SEMI/);
            expect(out).toMatch(/PRODUCTOS FINALES QUE LO CONSUMEN.*\(1\)/);
            expect(out).toMatch(/0024760703-FZHE\s.*0,09800000\s+via FUN-002-607-FZH > COR-002-607-FZH/);
        } finally {
            desarmar(arb);
        }
    });

    it('un codigo de insumo sin BOM, pedido sin la opcion, muestra donde se usa', { timeout: LIMITE }, () => {
        const arb = armarArb();
        try {
            const { out } = consumo(['124.602.0228-1'], arb);
            expect(out).toMatch(/no tiene BOM propia: es un insumo/);
            expect(out).toMatch(/LO USAN DIRECTO/);
        } finally {
            desarmar(arb);
        }
    });

    it('varios candidatos: los lista en vez de elegir uno; ninguno: sale con 1', { timeout: LIMITE }, () => {
        const arb = armarArb();
        try {
            const varios = consumo(['0024760703'], arb);
            expect(varios.code).toBe(0);
            expect(varios.out).toMatch(/Hay \d+ codigos que coinciden con "0024760703"/);
            expect(varios.out).toMatch(/0024760703-FZHE\s+PRODUCTO/);
            expect(varios.out).not.toMatch(/lineas directas, \d+ semielaborados/);   // no mostro ninguna BOM
            const ninguno = consumo(['ZZZ-NO-EXISTE'], arb);
            expect(ninguno.code).toBe(1);
            expect(ninguno.out).toMatch(/SELLO DEL DATO/);   // el sello sale igual
            expect(ninguno.out).toMatch(/No encontre ningun codigo/);
        } finally {
            desarmar(arb);
        }
    });

    it('el SELLO avisa "puede estar viejo" con mas de 24 h y con una carga al arb despues del export', { timeout: LIMITE }, () => {
        const vieja = armarArb({ horasDeEdad: 60 });
        try {
            const { out } = consumo(['0024760703-FZHE'], vieja);
            expect(out).toMatch(/PUEDE ESTAR VIEJO: el export tiene 2 d/);
        } finally {
            desarmar(vieja);
        }
        // una escritura al arb DESPUES de la hora del export (hace 1 h; la carga es "ahora")
        const ahora = new Date();
        const hh = (d) => d.toTimeString().slice(0, 8);
        const despues = armarArb({
            horasDeEdad: 1,
            journal: [
                { t: hh(new Date(ahora.getTime() - 10 * 1000)), producto: 'P-EJEMPLO', estado: 'por_grabar' },
                { t: hh(new Date(ahora.getTime() - 9 * 1000)), producto: 'P-EJEMPLO', estado: 'enter_ok' },
            ],
        });
        try {
            const { out } = consumo(['0024760703-FZHE'], despues);
            // si el test corre pasada la medianoche, el journal del dia cambia de nombre: solo se exige lo que siempre vale
            if (new Date(ahora.getTime() - 10 * 1000).getDate() === ahora.getDate()) {
                expect(out).toMatch(/cargas al arb despues del export: 1 /);
                expect(out).toMatch(/PUEDE ESTAR VIEJO: 1 escritura\(s\) al arb despues del export/);
            }
        } finally {
            desarmar(despues);
        }
    });

    it('sin ningun export avisa con claridad y sale con 2', { timeout: LIMITE }, () => {
        const arb = armarArb();
        try {
            fs.unlinkSync(path.join(arb.tmp, 'RELACIONES.TXT'));
            const { out, code } = consumo(['lo-que-sea'], arb);
            expect(code).toBe(2);
            expect(out).toMatch(/SIN EXPORT/);
        } finally {
            desarmar(arb);
        }
    });
});
