/**
 * apqp-cliente-guard — los dos sentidos.
 *
 * Un gate que no puede dar VERDE esta tan roto como el que no puede dar ROJO, asi que cada
 * caso en rojo tiene su gemelo en verde. Los ROJOS son los que ocurrieron de verdad el
 * 21/09/2026 (emiti un flujograma Rev.A en el paquete que va al cliente y escribi en un
 * listado maestro, las dos sin OK de Fak); los VERDES son lo que Fak dejo explicitamente
 * autorizado ese mismo dia.
 *
 * Regla: .claude/rules/autonomy-contract.md §F
 *
 * Vivio un rato en `scripts/_lib/` y eso rompio el CI: vitest levanta cualquier `*.test.mjs`
 * del repo y un archivo sin `describe`/`it` cuenta como archivo en rojo ("No test suite found
 * in file"). Los tests van en `__tests__/`.
 */
import { describe, it, expect } from 'vitest';
import { GUARDIANES } from '../../scripts/_lib/guardianes.mjs';

const LEGAJO = 'Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\PPAP CLIENTES\\REYDEL-SMRC\\APB P21\\P21 SSRT-MY2026 HILO NARANJA\\APQP';
// El paquete del cliente vive adentro de `1. Imput`, junto al resto de lo que mando el
// cliente (Fak, 21/09/2026: "podes dejar todo eso dentro de input, en la carpeta original
// del cliente"). Estuvo un rato en el casillero 31 por decision mia, asi que el gate tiene
// que frenar en las DOS: la carpeta se reconoce por su nombre `PPAP_<part number>_<n>`, no
// por donde este colgada.
const PAQUETE = `${LEGAJO}\\1. Imput\\PPAP_00257327-01-NHZD_328\\05 - Process Flow & Standar Work`;
const PAQUETE_VIEJO = `${LEGAJO}\\31-Aprobacion de piezas de Produccion(PPAP)\\PPAP_00257327-01-NHZD_328\\05 - Process Flow & Standar Work`;
const LISTADO = 'Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\13. Analisis del modo de falla y sus efectos ( I-AC-005.3)\\1. LISTADO DE AMFES\\Listado_Maestro_AMFE.xlsx';

/** ctx minimo, con la forma que arma parsear() cuando el JSON del hook se leyo bien. */
const ctx = (tool, { cmd = '', file = '' } = {}) => ({
    ok: true,
    toolL: tool.toLowerCase(),
    cmd6: cmd,
    fileL: file,
    body6: '',
    raw: '',
    rescate: { tool: tool.toLowerCase(), cmd, file, content: '' },
});

const correr = (c) => GUARDIANES['apqp-cliente-guard'](c, { env: {} });
const bloquea = (c) => {
    const r = correr(c);
    return Boolean(r && r.tipo === 'bloqueo');
};

const ROJOS = [
    ['Write directo adentro del paquete del cliente', ctx('Write', { file: `${PAQUETE}\\FLUJOGRAMA 159.pdf` })],
    ['cp hacia el paquete del cliente', ctx('Bash', { cmd: `cp /c/tmp/f.pdf "${PAQUETE}\\FLUJOGRAMA 159.pdf"` })],
    ['Copy-Item hacia el paquete del cliente', ctx('PowerShell', { cmd: `Copy-Item f.pdf "${PAQUETE}\\f.pdf"` })],
    ['el paquete en su ubicacion vieja tambien se frena', ctx('Bash', { cmd: `cp f.pdf "${PAQUETE_VIEJO}\\f.pdf"` })],
    ['Write directo sobre un listado maestro', ctx('Write', { file: LISTADO })],
    ['script de alta en un listado maestro con --apply', ctx('Bash', { cmd: 'py -3 scripts/_registrarAmfe173.py --apply' })],
    ['el otro script de alta, con --apply', ctx('Bash', { cmd: 'py -3 scripts/_registrarFlujograma159.py --apply' })],
];

const VERDES = [
    ['el plano del cliente en su casillero del legajo (autorizado por Fak)',
        ctx('Bash', { cmd: `cp plano.pdf "${LEGAJO}\\6-Planos de la pieza\\RP-00238891.pdf"` })],
    ['MOVER el paquete entero del cliente a 1. Imput (es lo que pidio Fak)',
        ctx('Bash', { cmd: `mv "${LEGAJO}\\31-Aprobacion de piezas de Produccion(PPAP)\\PPAP_00257327-01-NHZD_328" "${LEGAJO}\\1. Imput\\"` })],
    ['el flujograma en el casillero 20 del legajo',
        ctx('Bash', { cmd: `cp f.pdf "${LEGAJO}\\20- Flujograma de proceso\\FLUJOGRAMA 159.pdf"` })],
    ['SACAR un archivo del paquete del cliente',
        ctx('Bash', { cmd: `rm -f "${PAQUETE}\\FLUJOGRAMA 159.pdf"` })],
    ['el mismo script de alta, en DRY-RUN',
        ctx('Bash', { cmd: 'py -3 scripts/_registrarAmfe173.py' })],
    ['LEER el listado maestro',
        ctx('Bash', { cmd: `py -3 -c "from openpyxl import load_workbook; load_workbook(r'${LISTADO}')"` })],
    ['listar la carpeta del paquete del cliente',
        ctx('Bash', { cmd: `ls -la "${PAQUETE}"` })],
    ['un Write cualquiera del repo',
        ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\scripts\\_algo.mjs' })],
    ['la propia regla que nombra las carpetas',
        ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\.claude\\rules\\autonomy-contract.md' })],
];

describe('apqp-cliente-guard', () => {
    describe('ROJO — bloquea (exit 2)', () => {
        for (const [titulo, c] of ROJOS) {
            it(titulo, () => expect(bloquea(c)).toBe(true));
        }
    });

    describe('VERDE — deja pasar (exit 0)', () => {
        for (const [titulo, c] of VERDES) {
            it(titulo, () => expect(bloquea(c)).toBe(false));
        }
    });

    it('el mensaje de bloqueo dice CUAL es la ruta y a donde va en su lugar', () => {
        const r = correr(ctx('Write', { file: `${PAQUETE}\\x.pdf` }));
        expect(r.texto).toContain('PAQUETE QUE VA AL CLIENTE');
        expect(r.texto).toContain('PPAP_00257327-01-NHZD_328');
        expect(r.texto).toMatch(/CALIDAD/);
        expect(r.texto).toContain('autonomy-contract.md');
    });

    it('el gate puede dar rojo Y puede dar verde (ninguna de las dos listas quedo vacia)', () => {
        expect(ROJOS.length).toBeGreaterThan(3);
        expect(VERDES.length).toBeGreaterThan(3);
    });
});
