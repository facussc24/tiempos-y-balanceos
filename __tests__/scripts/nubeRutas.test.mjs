/**
 * Tests de `scripts/_lib/nubeRutas.mjs` — como `_nube.mjs` encuentra la carpeta del cerebro
 * (`Barack-cerebro`) dentro del OneDrive corporativo.
 *
 * POR QUE EXISTE ESTE ARCHIVO
 *
 * 06/09/2026: en la notebook de Fak la carpeta `OneDrive - BARACK ARGENTINA SRL` es un
 * REPARSE POINT (PowerShell la lista con el atributo ReparsePoint). Para Node, el Dirent que
 * devuelve `readdirSync(HOME, { withFileTypes: true })` dice `isDirectory() = false` e
 * `isSymbolicLink() = true`, asi que el filtro `d.isDirectory() && /^OneDrive.*BARACK/` la
 * SALTEABA y `buscarNube()` caia al fallback CANONICA — que hoy coincide con el nombre real
 * por casualidad. En otra PC, con otro nombre de tenant, el script no encontraria la nube
 * aunque exista. El mismo bug ya se arreglo en `barack-claude` (`rutas.mjs`, commit 0ec72ef):
 * no se mira el Dirent, se hace `statSync(...)`, que sigue el enlace y mira el destino.
 *
 * Se reproduce sin admin con una junction (`symlinkSync(real, link, 'junction')`). En Linux
 * —el runner de CI— eso crea un symlink comun, que para el Dirent es lo mismo: `isDirectory()`
 * tambien da false. Cada test arma su HOME de mentira con `mkdtempSync` y lo desarma pieza
 * por pieza (todo vacio y conocido), sin borrado recursivo.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmdirSync, unlinkSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buscarNube, CANONICA, CARPETA_CEREBRO } from '../../scripts/_lib/nubeRutas.mjs';

const ONEDRIVE_LINK = 'OneDrive - BARACK PRUEBA';

/** Piezas creadas en este test, en orden de creacion. Se desarman al reves. */
let piezas = [];

function home() {
    const h = mkdtempSync(join(tmpdir(), 'nube-junction-'));
    piezas.push(h);
    return h;
}
function carpeta(...partes) {
    const p = join(...partes);
    mkdirSync(p);
    piezas.push(p);
    return p;
}
function archivo(...partes) {
    const p = join(...partes);
    writeFileSync(p, '');
    piezas.push(p);
    return p;
}
/** Enlace tipo carpeta: junction en Windows, symlink comun en Linux. */
function enlace(real, link) {
    symlinkSync(real, link, 'junction');
    piezas.push(link);
    return link;
}

afterEach(() => {
    // Al reves de como se creo: primero lo de adentro. rmdir saca carpetas vacias y, en
    // Windows, tambien la junction (sin tocar su destino); lo que rmdir rechaza es un archivo
    // o un symlink de Linux, y eso sale con unlink.
    for (const p of [...piezas].reverse()) {
        try { rmdirSync(p); continue; } catch { /* no es carpeta vacia ni junction */ }
        try { unlinkSync(p); } catch { /* ya no esta */ }
    }
    piezas = [];
});

describe('buscarNube — la OneDrive como reparse point (EL BUG DEL 06/09)', () => {
    it('encuentra Barack-cerebro aunque la carpeta de OneDrive sea un enlace', () => {
        const h = home();
        const real = carpeta(h, 'real');
        carpeta(real, CARPETA_CEREBRO);
        const link = enlace(real, join(h, ONEDRIVE_LINK));

        // Precondicion: el fixture reproduce lo que pasa en la notebook. Si el Dirent dijera
        // "directorio", el test pasaria por el motivo equivocado.
        const dirent = readdirSync(h, { withFileTypes: true }).find((d) => d.name === ONEDRIVE_LINK);
        expect(dirent, 'la junction tiene que aparecer en el listado del HOME').toBeDefined();
        expect(dirent.isDirectory(), 'el fixture no reproduce el bug: el Dirent dice directorio').toBe(false);

        expect(buscarNube(h)).toBe(join(link, CARPETA_CEREBRO));
    });

    it('si el cerebro todavia no existe, apunta ADENTRO de la OneDrive enlazada (para que --subir --aplicar lo cree ahi)', () => {
        const h = home();
        const real = carpeta(h, 'real');
        const link = enlace(real, join(h, ONEDRIVE_LINK));
        expect(buscarNube(h)).toBe(join(link, CARPETA_CEREBRO));
    });
});

describe('buscarNube — lo que ya andaba y tiene que seguir andando', () => {
    it('con la carpeta de OneDrive real (sin enlace) la encuentra', () => {
        const h = home();
        const od = carpeta(h, 'OneDrive - BARACK OTRO TENANT');
        const cerebro = carpeta(od, CARPETA_CEREBRO);
        expect(buscarNube(h)).toBe(cerebro);
    });

    it('con dos OneDrive BARACK elige la que TIENE el cerebro, no la primera', () => {
        const h = home();
        carpeta(h, 'OneDrive - BARACK A');
        const b = carpeta(h, 'OneDrive - BARACK B');
        const cerebro = carpeta(b, CARPETA_CEREBRO);
        expect(buscarNube(h)).toBe(cerebro);
    });

    it('sin ninguna OneDrive BARACK cae a la canonica, debajo de ESE home', () => {
        const h = home();
        expect(buscarNube(h)).toBe(join(h, CANONICA, CARPETA_CEREBRO));
    });

    it('un home que no se puede leer tambien cae a la canonica, sin explotar', () => {
        const h = join(home(), 'no-existe');
        expect(buscarNube(h)).toBe(join(h, CANONICA, CARPETA_CEREBRO));
    });

    it('un ARCHIVO que se llama como la OneDrive no cuenta (al sacar isDirectory no se cuela)', () => {
        const h = home();
        archivo(h, 'OneDrive - BARACK ARGENTINA SRL.lnk');
        expect(buscarNube(h)).toBe(join(h, CANONICA, CARPETA_CEREBRO));
    });

    it('la OneDrive de otra empresa no cuenta aunque tenga un Barack-cerebro adentro', () => {
        const h = home();
        const od = carpeta(h, 'OneDrive - OTRA EMPRESA SA');
        carpeta(od, CARPETA_CEREBRO);
        expect(buscarNube(h)).toBe(join(h, CANONICA, CARPETA_CEREBRO));
    });
});

describe('_nube.mjs usa esta lib, no una copia propia del filtro', () => {
    const src = readFileSync(resolve(fileURLToPath(import.meta.url), '../../../scripts/_nube.mjs'), 'utf8');

    it('importa buscarNube de _lib/nubeRutas.mjs', () => {
        expect(src).toMatch(/import\s*\{[^}]*\bbuscarNube\b[^}]*\}\s*from\s*'\.\/_lib\/nubeRutas\.mjs'/);
    });

    it('no redefine buscarNube ni vuelve a filtrar el listado del HOME por isDirectory()', () => {
        expect(src).not.toMatch(/function\s+buscarNube/);
        expect(src).not.toMatch(/\.isDirectory\(\)\s*&&/);
    });
});
