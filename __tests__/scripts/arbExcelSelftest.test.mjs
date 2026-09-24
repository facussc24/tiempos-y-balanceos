/**
 * Corre el selftest de `scripts/_lib/arbExcel.py` desde la suite, para que CI lo ejecute.
 *
 * `arbExcel.py` decide que ventanas de Excel cierra `_arbVer.cerrar_excel()` antes y despues de
 * cada export del arb. Hasta el 24/09/2026 cerraba TODAS y clickeaba a ciegas en todo cartel
 * `NUIDialog` — incluido el de "guardar cambios" — y se llevo lo que Fak tenia abierto. El
 * selftest no necesita Windows ni Excel: prueba la decision pura en las dos direcciones (lo del
 * export se reconoce; lo de Fak y el cartel de guardar NO), con los carteles leidos del Excel
 * real ese dia.
 *
 * Mismo criterio que mailsSelftest.test.mjs: NUNCA skip si falta python — un test salteado
 * es un verde vacio, y el runner de CI ya instala Python 3.12.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', '_lib', 'arbExcel.py');

describe('arbExcel.py --selftest (que ventanas de Excel cierra el export del arb)', () => {
    it('reconoce solo la ventana del export y nunca el cartel de guardar', () => {
        const out = execFileSync('python', [SCRIPT, '--selftest'], {
            encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });
        expect(out).toContain('selftest arbExcel: todo verde');
        expect(out).not.toMatch(/^ {2}MAL/m);
        // los casos que importan, por nombre: si alguien los borra, este test se entera
        expect(out).toMatch(/ok {4}RELACIONES\.xlsx - Excel +esperado=False/);
        expect(out).toMatch(/ok {4}guardar cambios, castellano \(real\) +esperado=\('guardar', None\)/);
        expect(out).toMatch(/ok {4}mezcla: conversiones \+ boton Guardar +esperado=\('guardar', None\)/);
        expect(out).toMatch(/ok {4}conversiones, castellano \(real\) +esperado=\('conversiones', 'No convertir'\)/);
        expect((out.match(/^ {2}ok {2}/gm) || []).length).toBeGreaterThanOrEqual(33);   // 19 titulos + 14 carteles
    });
});
