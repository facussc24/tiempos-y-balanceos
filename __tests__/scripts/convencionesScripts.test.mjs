/**
 * Convenciones de `scripts/` que, si se rompen, no fallan donde uno mira.
 *
 * Incidente 2026-08-03: `scripts/_escritorio.mjs` arrancaba con `#!/usr/bin/env node`.
 * Vitest inlinea los modulos y se los pasa a `new vm.Script()`, que NO acepta `#!`, asi
 * que `escritorio.test.mjs` (32 tests) moria antes de cargar con un
 * `SyntaxError: Invalid or unexpected token` apuntando a la linea 1 y sin decir por que.
 * Lo tapaba el cache de Vite: con cache tibio pasaba, con cache limpio —o sea, en CI— no.
 * Y el reporte no decia "1 test en rojo" sino "Failed Suites 1 / Tests: no tests", que es
 * facil de leer como si no hubiera pasado nada.
 *
 * Todos los scripts del repo se invocan `node scripts/x.mjs` (nunca `./scripts/x.mjs`),
 * asi que el shebang no aportaba nada. Este test lo mantiene asi para el proximo script
 * que se escriba, sin depender de que alguien se acuerde.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_SCRIPTS = path.resolve(fileURLToPath(import.meta.url), '../../../scripts');

/** Todos los .mjs de scripts/, incluidos los de _lib/ y archive/. */
function scriptsMjs(dir = RAIZ_SCRIPTS, acumulado = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) scriptsMjs(p, acumulado);
        else if (e.name.endsWith('.mjs')) acumulado.push(p);
    }
    return acumulado;
}

describe('convenciones de scripts/', () => {
    it('1. ninguno arranca con shebang: rompe a Vitest antes de cargar la suite', () => {
        const conShebang = scriptsMjs()
            .filter((p) => fs.readFileSync(p, 'utf8').startsWith('#!'))
            .map((p) => path.relative(RAIZ_SCRIPTS, p));
        expect(conShebang, 'sacar el "#!" — estos scripts se corren con `node scripts/...`').toEqual([]);
    });

    it('2. hay scripts para revisar (el test no pasa por barrer cero archivos)', () => {
        expect(scriptsMjs().length).toBeGreaterThan(10);
    });
});
