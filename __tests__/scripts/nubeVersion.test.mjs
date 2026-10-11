import { describe, it, expect } from 'vitest';
import {
    parsearVersion, compararVersiones, avisoVersion, leerVersionClaude, VERSION_MINIMA_CLAUDE,
} from '../../scripts/_lib/nubeVersion.mjs';

describe('parsearVersion / compararVersiones', () => {
    it('verde: saca los tres numeros de lo que imprime claude --version', () => {
        expect(parsearVersion('2.1.293 (Claude Code)')).toEqual([2, 1, 293]);
        expect(parsearVersion('  2.1.293\n')).toEqual([2, 1, 293]);
    });
    it('rojo: sin version no inventa una', () => {
        expect(parsearVersion('')).toBeNull();
        expect(parsearVersion(null)).toBeNull();
        expect(parsearVersion("'claude' is not recognized as an internal or external command")).toBeNull();
    });
    it('compara por numero, no por texto', () => {
        expect(compararVersiones([2, 1, 1000], [2, 1, 293])).toBeGreaterThan(0);
        expect(compararVersiones([10, 0, 0], [2, 1, 293])).toBeGreaterThan(0);
        expect(compararVersiones([2, 1, 293], [2, 1, 293])).toBe(0);
        expect(compararVersiones([2, 0, 999], [2, 1, 293])).toBeLessThan(0);
    });
});

describe('avisoVersion', () => {
    it('verde: la minima o una mas nueva no avisan', () => {
        expect(VERSION_MINIMA_CLAUDE).toBe('2.1.293');
        expect(avisoVersion('2.1.293 (Claude Code)')).toBeNull();
        expect(avisoVersion('2.2.0 (Claude Code)')).toBeNull();
        expect(avisoVersion('2.1.1000 (Claude Code)')).toBeNull();
    });
    it('rojo: una mas vieja avisa con las dos versiones; sin salida avisa que no pudo leer', () => {
        expect(avisoVersion('2.1.292 (Claude Code)')).toMatch(/2\.1\.292.*minima es 2\.1\.293/);
        expect(avisoVersion('1.0.128 (Claude Code)')).toMatch(/minima es 2\.1\.293/);
        expect(avisoVersion(null)).toMatch(/no pude leer/);
        expect(avisoVersion('')).toMatch(/no pude leer/);
    });
});

describe('leerVersionClaude', () => {
    it('verde: corre claude --version con timeout y devuelve el texto limpio', () => {
        const llamadas = [];
        const exec = (cmd, opts) => { llamadas.push({ cmd, opts }); return '2.1.293 (Claude Code)\n'; };
        expect(leerVersionClaude(exec)).toBe('2.1.293 (Claude Code)');
        expect(llamadas).toHaveLength(1);
        expect(llamadas[0].cmd).toBe('claude --version');
        expect(llamadas[0].opts.timeout).toBeGreaterThan(0);
    });
    it('rojo: si claude no esta o se cuelga, null y el aviso lo dice; nunca una excepcion', () => {
        expect(leerVersionClaude(() => { throw new Error('ENOENT'); })).toBeNull();
        expect(avisoVersion(leerVersionClaude(() => { throw new Error('ETIMEDOUT'); }))).toMatch(/no pude leer/);
    });
});
