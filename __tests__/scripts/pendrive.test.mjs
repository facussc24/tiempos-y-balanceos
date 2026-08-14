/**
 * Tests de `_pendrive.mjs` y de la copia verificada.
 *
 * Lo que tienen que garantizar: que NUNCA se pierda un archivo. El destino de este script es
 * el peor posible — el pendrive no tiene Papelera, lo que se borra ahi no vuelve. Asi que:
 *   - lo superado se MUEVE (copia -> verifica md5 -> recien ahi borra), nunca al reves
 *   - una copia que llego distinta se descarta y el original queda intacto
 *   - con dos pendrives conectados NO se elige uno: copiar al equivocado no avisa
 *
 * Vectores:
 *   1-5   superadosPor / yaEstan: que es "lo viejo" y que no
 *   6-10  elegirUnidad: cero, una, varias, por letra, por etiqueta
 *  11-16  copiarVerificado / moverVerificado / revisarDestino (MAX_PATH incluido)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { superadosPor, yaEstan, elegirUnidad, parsearArgs } from '../../scripts/_pendrive.mjs';
import {
    copiarVerificado, moverVerificado, revisarDestino, nombreLibre, md5, MAX_PATH_WINDOWS,
} from '../../scripts/_lib/copiaVerificada.mjs';

const n = (nombre) => ({ nombre, ruta: `X:\\${nombre}` });

describe('superadosPor — que queda viejo cuando entra lo nuevo', () => {
    it('1. el RevA queda superado cuando entra el RevB', () => {
        const out = superadosPor([n('PLOTTER RevB - 32 piezas.dxf')], [n('PLOTTER RevA - 32 piezas.dxf')]);
        expect(out).toHaveLength(1);
        expect(out[0].reemplazadoPor).toBe('PLOTTER RevB - 32 piezas.dxf');
    });

    it('2. un archivo de OTRA pieza no queda superado', () => {
        expect(superadosPor([n('PLOTTER RevB.dxf')], [n('OTRA PIEZA RevB.plt')])).toHaveLength(0);
    });

    it('3. el mismo archivo con el mismo nombre no se cuenta como superado', () => {
        expect(superadosPor([n('patron.dxf')], [n('patron.dxf')])).toHaveLength(0);
    });

    it('4. un pendrive vacio no tiene nada superado', () => {
        expect(superadosPor([n('patron.dxf')], [])).toHaveLength(0);
    });

    it('5. yaEstan detecta el repetido sin importar el case', () => {
        expect(yaEstan([n('Patron.DXF')], [n('patron.dxf')])).toHaveLength(1);
    });
});

describe('elegirUnidad — nunca adivinar cual pendrive', () => {
    const D = { letra: 'D:', etiqueta: 'ING CB', libreGB: 10, totalGB: 15 };
    const E = { letra: 'E:', etiqueta: 'BACKUP', libreGB: 20, totalGB: 30 };

    it('6. sin unidades: error claro, no excepcion', () => {
        expect(elegirUnidad([]).error).toMatch(/no hay ninguna unidad/i);
    });

    it('7. una sola: esa', () => {
        expect(elegirUnidad([D]).unidad).toBe(D);
    });

    it('8. dos o mas: NO elige — copiar al pendrive equivocado no avisa', () => {
        const r = elegirUnidad([D, E]);
        expect(r.unidad).toBeUndefined();
        expect(r.error).toMatch(/--unidad/);
    });

    it('9. con --unidad se puede pedir por letra, con o sin dos puntos', () => {
        expect(elegirUnidad([D, E], 'E:').unidad).toBe(E);
        expect(elegirUnidad([D, E], 'e').unidad).toBe(E);
    });

    it('10. y tambien por etiqueta, que es lo que uno lee en el pendrive', () => {
        expect(elegirUnidad([D, E], 'ing cb').unidad).toBe(D);
        expect(elegirUnidad([D, E], 'no existe').error).toMatch(/no encontre/i);
    });
});

describe('copiarVerificado / moverVerificado', () => {
    let dir; let origen;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pendrive-'));
        origen = path.join(dir, 'patron.dxf');
        fs.writeFileSync(origen, 'contenido del patron');
    });
    afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

    it('11. copia y devuelve el md5 y los bytes', () => {
        const destino = path.join(dir, 'copia.dxf');
        const r = copiarVerificado(origen, destino);
        expect(r.md5).toBe(md5(origen));
        expect(fs.readFileSync(destino, 'utf8')).toBe('contenido del patron');
    });

    it('12. mover deja el destino y saca el origen — en ese orden', () => {
        const destino = path.join(dir, 'movido.dxf');
        moverVerificado(origen, destino);
        expect(fs.existsSync(destino)).toBe(true);
        expect(fs.existsSync(origen)).toBe(false);
    });

    it('13. si el destino no se puede escribir, el ORIGEN no se toca', () => {
        const destino = path.join(dir, 'no', 'existe', 'copia.dxf');
        expect(() => moverVerificado(origen, destino)).toThrow(/no existe la carpeta destino/);
        expect(fs.existsSync(origen)).toBe(true);
    });

    it('14. una ruta de mas de 259 caracteres se rechaza ANTES de copiar', () => {
        const largo = path.join(dir, `${'x'.repeat(MAX_PATH_WINDOWS)}.dxf`);
        expect(revisarDestino(largo)[0]).toMatch(/no la abre con doble click/);
        expect(() => copiarVerificado(origen, largo)).toThrow(/caracteres/);
    });

    it('15. una ruta corta y con carpeta existente no tiene objeciones', () => {
        expect(revisarDestino(path.join(dir, 'ok.dxf'))).toEqual([]);
    });

    it('16. el hash distingue contenidos distintos (el control no es ciego)', () => {
        const otro = path.join(dir, 'otro.dxf');
        fs.writeFileSync(otro, 'contenido distinto');
        expect(md5(otro)).not.toBe(md5(origen));
    });

    it('17. NO pisa un archivo que ya esta: asi se pierde un respaldo sin que nadie se entere', () => {
        const destino = path.join(dir, 'copia.dxf');
        fs.writeFileSync(destino, 'un respaldo anterior');
        expect(() => copiarVerificado(origen, destino)).toThrow(/ya existe un archivo ahi/);
        expect(fs.readFileSync(destino, 'utf8')).toBe('un respaldo anterior');
    });

    it('18. con pisar:true si sobreescribe (para cuando eso es lo buscado)', () => {
        const destino = path.join(dir, 'copia.dxf');
        fs.writeFileSync(destino, 'viejo');
        copiarVerificado(origen, destino, { pisar: true });
        expect(fs.readFileSync(destino, 'utf8')).toBe('contenido del patron');
    });

    it('19. nombreLibre esquiva la colision en vez de tapar el respaldo viejo', () => {
        const destino = path.join(dir, 'patron.dxf');   // ya existe: es el origen
        expect(path.basename(nombreLibre(destino))).toBe('patron (2).dxf');
        fs.writeFileSync(path.join(dir, 'patron (2).dxf'), 'x');
        expect(path.basename(nombreLibre(destino))).toBe('patron (3).dxf');
    });

    it('20. si el nombre esta libre, nombreLibre no lo cambia', () => {
        const p = path.join(dir, 'nuevo.dxf');
        expect(nombreLibre(p)).toBe(p);
    });
});

describe('parsearArgs — las comillas que Fak se puede olvidar', () => {
    it('21. termino + flag, en cualquier orden', () => {
        expect(parsearArgs(['x', '--aplicar'])).toEqual({ termino: 'x', sueltos: [] });
        expect(parsearArgs(['--aplicar', 'x'])).toEqual({ termino: 'x', sueltos: [] });
    });

    it('22. el valor de --unidad no se confunde con el termino, vaya donde vaya', () => {
        expect(parsearArgs(['--unidad', 'D:', 'x'])).toEqual({ termino: 'x', sueltos: [] });
        expect(parsearArgs(['x', '--unidad', 'D:'])).toEqual({ termino: 'x', sueltos: [] });
    });

    it('23. un termino que se llama IGUAL que el valor de --unidad no se traga', () => {
        // Con `args.indexOf(a)` dentro del find, este caso devolvia undefined: indexOf
        // encuentra la PRIMERA aparicion del valor, no la posicion que se esta mirando.
        expect(parsearArgs(['--unidad', 'D:', 'D:']).termino).toBe('D:');
    });

    it('24. sin comillas, las palabras que sobran se cantan — no se descartan calladas', () => {
        expect(parsearArgs(['armrest', 'door', 'panel', '--aplicar']))
            .toEqual({ termino: 'armrest', sueltos: ['door', 'panel'] });
    });

    it('25. sin termino devuelve null y el CLI muestra el uso', () => {
        expect(parsearArgs(['--aplicar']).termino).toBeNull();
    });
});
