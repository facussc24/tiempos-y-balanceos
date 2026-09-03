/**
 * Tests de `scripts/_lib/nubeFlags.mjs` — los flags de robocopy que usa `_nube.mjs`
 * para sincronizar el cerebro (memorias + config + secretos) contra OneDrive.
 *
 * POR QUE EXISTE ESTE ARCHIVO
 *
 * El 03/09/2026 una auditoria encontro que `/XO` se colaba en la SUBIDA de los archivos
 * sueltos. El call-site pasaba `espejo: false` para evitar `/MIR` (correcto: /MIR sobre
 * un archivo suelto borraria el resto de la carpeta destino), pero esa misma bandera
 * decidia el `/XO`. Reproducido con robocopy real:
 *
 *     loc/.env.local = "LOCAL_NUEVO"  ·  nub/.env.local = "NUBE_VIEJA" (mtime posterior)
 *     robocopy loc nub .env.local /XO   -> Copiado: 0, Omitido: 1   (la nube NO se actualiza)
 *     robocopy loc nub .env.local       -> Copiado: 1              (la nube SI se actualiza)
 *
 * O sea: con la copia de la nube fechada igual o despues (reloj corrido entre PCs, o un
 * `--bajar` previo que preserva el timestamp), un `.env.local` editado NO subia, sin dar
 * error, y el resumen del script lo mostraba igual que "no habia nada que subir".
 *
 * El bug vivio porque las tres decisiones (recorrer / espejar / proteger lo nuevo) estaban
 * mezcladas en un solo booleano Y no habia con que ejercitarlas. Cada `it` de aca clava
 * una de esas decisiones por separado.
 */
import { describe, it, expect } from 'vitest';
import { construirFlags } from '../../scripts/_lib/nubeFlags.mjs';

const base = { origen: 'O', destino: 'D' };

describe('/XO — protege lo mas nuevo del destino', () => {
    it('NO va al subir una carpeta: la PC es la fuente de verdad', () => {
        expect(construirFlags({ ...base, direccion: 'subir' })).not.toContain('/XO');
    });

    it('NO va al subir un archivo suelto — EL BUG DEL 03/09', () => {
        // Con /XO aca, un .env.local editado no sube si la nube quedo con fecha igual
        // o posterior. Falla en silencio: el resumen dice "0 archivos", igual que si
        // no hubiera nada que hacer.
        const f = construirFlags({ ...base, direccion: 'subir', soloArchivo: '.env.local' });
        expect(f).not.toContain('/XO');
    });

    it('SI va al bajar una carpeta: no pisar una memoria local mas nueva', () => {
        expect(construirFlags({ ...base, direccion: 'bajar' })).toContain('/XO');
    });

    it('SI va al bajar un archivo suelto', () => {
        const f = construirFlags({ ...base, direccion: 'bajar', soloArchivo: '.qr-secret' });
        expect(f).toContain('/XO');
    });
});

describe('/MIR — espejo, y donde NUNCA puede aparecer', () => {
    it('va al subir una carpeta: borra en la nube lo que ya no existe local', () => {
        expect(construirFlags({ ...base, direccion: 'subir' })).toContain('/MIR');
    });

    it('NUNCA sobre un archivo suelto: borraria el resto de la carpeta destino', () => {
        for (const direccion of ['subir', 'bajar']) {
            const f = construirFlags({ ...base, direccion, soloArchivo: '.env.local' });
            expect(f, `direccion=${direccion}`).not.toContain('/MIR');
        }
    });

    it('NUNCA al bajar: bajar no borra nada local, ni con carpetas', () => {
        expect(construirFlags({ ...base, direccion: 'bajar' })).not.toContain('/MIR');
    });
});

describe('/E — recursion', () => {
    it('va en carpetas al bajar', () => {
        expect(construirFlags({ ...base, direccion: 'bajar' })).toContain('/E');
    });

    it('NO va en un archivo suelto: con recursion robocopy agarra el mismo nombre de los worktrees', () => {
        // .claude/worktrees/*/ tiene su propio .env.example: con /E se copiaban 4 en vez de 1.
        for (const direccion of ['subir', 'bajar']) {
            const f = construirFlags({ ...base, direccion, soloArchivo: '.env.example' });
            expect(f, `direccion=${direccion}`).not.toContain('/E');
        }
    });
});

describe('forma general', () => {
    it('origen y destino van primero, y el nombre del archivo suelto tercero', () => {
        const f = construirFlags({ ...base, direccion: 'subir', soloArchivo: '.qr-secret' });
        expect(f.slice(0, 3)).toEqual(['O', 'D', '.qr-secret']);
    });

    it('/L solo cuando se pide listar — sin el, robocopy copia de verdad', () => {
        expect(construirFlags({ ...base, direccion: 'subir', listar: true })).toContain('/L');
        expect(construirFlags({ ...base, direccion: 'subir' })).not.toContain('/L');
    });

    it('excluye node_modules y __pycache__', () => {
        const f = construirFlags({ ...base, direccion: 'subir' });
        expect(f).toContain('/XD');
        expect(f).toContain('node_modules');
        expect(f).toContain('__pycache__');
    });

    it('una direccion invalida explota en vez de elegir un default silencioso', () => {
        // Un default aca vuelve a esconder exactamente el bug que este archivo previene.
        expect(() => construirFlags({ ...base, direccion: 'espejo' })).toThrow(/direccion invalida/);
        expect(() => construirFlags({ ...base })).toThrow(/direccion invalida/);
        expect(() => construirFlags({ ...base, direccion: false })).toThrow(/direccion invalida/);
    });
});
