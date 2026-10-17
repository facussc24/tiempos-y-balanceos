/**
 * Una hoja de proceso sin `epp=` frena, en TODOS los generadores (tanda 1.5 del plan del sistema, 16/10/2026).
 *
 * POR QUE: el `EPP_STD` de cinco iconos (con anteojos) se ponia solo en toda hoja que no declaraba su EPP,
 * y asi salieron gafas donde nadie las usa (Fak, 21/09/2026: "¿para que necesito gafas? nadie usa gafas en
 * esta maquina"; 14/10/2026, HO-990 Rev.A del Insert: "¿por que hay gafas? en ese sector no hace falta
 * gafas"). Hot melt tenia sus propios valores por defecto (`EPP_HOTMELT`, el `setdefault` de armar_deck) y
 * el A3 pasaba `None` sin avisar.
 *
 * EN LAS DOS DIRECCIONES: sin `epp` cada `hoja()` sale con SystemExit que habla de `epp=` y ANTES de
 * agregar la lamina (si el freno fuera otro control, el test lo diria); con `epp` declarado el freno no
 * salta. Se importa la copia de ESTE checkout (el test lo verifica con `__file__`).
 *
 * Correr:  npx vitest run __tests__/scripts/hojasEppDeclarado.test.mjs
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(fileURLToPath(import.meta.url), '../../..');

/** Python que importa el modulo, llama a la funcion con un dict y devuelve que paso, en JSON. */
const PY = String.raw`
import sys, os, json, io, contextlib, importlib
raiz, carpeta, modulo, funcion, con_epp = sys.argv[1:6]
for sub in ('scripts/img', 'scripts/hotmelt', 'scripts/novax', 'scripts/p21'):
    sys.path.insert(0, os.path.join(raiz, sub))
sys.path.insert(0, os.path.join(raiz, carpeta))
from pptx import Presentation
with contextlib.redirect_stdout(io.StringIO()):
    m = importlib.import_module(modulo)
prs = Presentation()
d = dict(op='99', denominacion='PRUEBA DEL FRENO DE EPP')
if con_epp == '1':
    d['epp'] = ['un_icono.png']
salida = {'archivo': os.path.abspath(m.__file__), 'freno': None, 'otro_error': None}
try:
    if funcion == '_gate_epp_declarado':
        getattr(m, funcion)(d)
    else:
        getattr(m, funcion)(prs, d)
except SystemExit as e:
    salida['freno'] = str(e)
except Exception as e:
    salida['otro_error'] = type(e).__name__ + ': ' + str(e)[:200]
salida['laminas'] = len(prs.slides)
print(json.dumps(salida))
`;

function correr(carpeta, modulo, funcion, conEpp) {
    const r = spawnSync('python', ['-c', PY, RAIZ, carpeta, modulo, funcion, conEpp ? '1' : '0'], {
        encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, maxBuffer: 16 * 1024 * 1024,
    });
    expect(r.status, r.stderr).toBe(0);
    return JSON.parse(r.stdout.trim().split('\n').pop());
}

// [carpeta, modulo, funcion que dibuja la hoja]
const GENERADORES = [
    ['scripts/img', 'generar_hojas_img', 'hoja'],                 // IMG A4, embossing y cambio de molde
    ['scripts/novax', 'generar_hojas_insert', 'hoja'],            // Insert (HO-990 Rev.A)
    ['scripts/p21', 'generar_hojas_p21', 'hoja'],                 // P21 (usaba g.EPP_STD)
    ['scripts/hotmelt', 'generar_hojas_hotmelt', 'hoja'],         // hot melt A4 v1 (EPP_HOTMELT)
    ['scripts/hotmelt', 'generar_hojas_hotmelt_a3', 'hoja_a3'],   // hot melt A3 (valor fijo con barbijo)
    ['scripts/hotmelt', 'hoja_a3_fotos', 'hoja'],                 // el A3 de una foto por paso (pasaba None)
    ['scripts/hotmelt', 'hoja_pptx', 'hoja'],                     // hot melt v2 / armar_deck (setdefault EPP_BASE)
];

describe('una hoja sin epp= frena en todos los generadores', () => {
    for (const [carpeta, modulo, funcion] of GENERADORES) {
        it(`${modulo}.${funcion}: sin epp frena antes de dibujar, y el freno habla de epp=`, () => {
            const r = correr(carpeta, modulo, funcion, false);
            expect(r.archivo.toLowerCase()).toContain(path.join(RAIZ, carpeta).toLowerCase());
            expect(r.otro_error, 'tenia que frenar por el EPP, no romper por otra cosa').toBeNull();
            expect(r.freno, 'no freno').not.toBeNull();
            expect(r.freno).toContain('no declara su epp=');
            expect(r.laminas, 'el freno tiene que correr antes de agregar la lamina').toBe(0);
        }, 60000);
    }

    // verde: el freno no salta cuando la hoja declara su EPP (lo de despues puede fallar por las fotos de
    // prueba, que no existen: se mira solo que no sea el freno del EPP)
    for (const [carpeta, modulo] of [['scripts/img', 'generar_hojas_img'], ['scripts/novax', 'generar_hojas_insert'],
        ['scripts/hotmelt', 'generar_hojas_hotmelt'], ['scripts/hotmelt', 'generar_hojas_hotmelt_a3'],
        ['scripts/hotmelt', 'hoja_pptx']]) {
        it(`${modulo}: con epp declarado el freno no salta`, () => {
            const r = correr(carpeta, modulo, '_gate_epp_declarado', true);
            expect(r.freno).toBeNull();
            expect(r.otro_error).toBeNull();
        }, 60000);
    }

    it('ya no existe ningun set de EPP por defecto en los generadores', () => {
        const PY2 = String.raw`
import sys, os, re
raiz = sys.argv[1]
malos = []
for rel in ('scripts/img/generar_hojas_img.py', 'scripts/novax/generar_hojas_insert.py', 'scripts/p21/generar_hojas_p21.py',
            'scripts/hotmelt/generar_hojas_hotmelt.py', 'scripts/hotmelt/generar_hojas_hotmelt_a3.py',
            'scripts/hotmelt/hoja_a3_fotos.py', 'scripts/hotmelt/hoja_pptx.py', 'scripts/hotmelt/armar_deck.py'):
    s = open(os.path.join(raiz, rel), encoding='utf-8').read()
    for pat in (r'get\(\s*"epp"\s*,', r'setdefault\(\s*"epp"', r'^EPP_STD\s*='):
        for m in re.finditer(pat, s, re.M):
            malos.append(rel + ': ' + m.group(0))
print('\n'.join(malos))
`;
        const r = spawnSync('python', ['-c', PY2, RAIZ], { encoding: 'utf8' });
        expect(r.stdout.trim(), r.stdout).toBe('');
    });
});
