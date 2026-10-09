/**
 * Tests de `scripts/_lib/agentesPresupuesto.mjs` — lo que muestra `node scripts/_agentes.mjs` sobre el
 * presupuesto de subagentes por costo (08/10/2026). Los pesos y las ventanas son los del guardian
 * `agentes-guard.sh`: si cambian ahi, cambian aca (y viceversa).
 */
import { describe, it, expect } from 'vitest';
import {
    PESOS, leerLinea, resumenVentana, limiteVigente, presupuestoPuntos, lineaRegistro, textoEstado,
} from '../../scripts/_lib/agentesPresupuesto.mjs';

const T = 1_800_000_000;

describe('leerLinea y resumenVentana', () => {
    it('lee "<epoch> <tool> <peso>"; una linea vieja sin peso o con "pesado" vale como Sonnet', () => {
        expect(leerLinea(`${T} Agent 8`)).toEqual({ ts: T, tool: 'Agent', peso: 8 });
        expect(leerLinea(`${T} Task`)).toEqual({ ts: T, tool: 'Task', peso: 4 });
        expect(leerLinea(`${T} Agent pesado`).peso).toBe(4);
        expect(leerLinea('basura')).toBeNull();
        expect(leerLinea('')).toBeNull();
    });

    it('suma los puntos de la ventana y deja afuera lo de hace mas de 10 minutos', () => {
        const lineas = [`${T - 700} Agent 20`, `${T - 500} Agent 1`, `${T - 100} Agent 8`, `${T - 10} Agent 4`, 'x'];
        const r = resumenVentana(lineas, { ahora: T });
        expect(r.lanzamientos).toBe(3);
        expect(r.puntos).toBe(13);
        expect(r.porPeso).toEqual({ 1: 1, 8: 1, 4: 1 });
        expect(r.liberaEnSeg).toBe(100);   // el de hace 500 s sale en 100 s
    });

    it('sin lanzamientos: cero y sin hora de liberacion', () => {
        expect(resumenVentana([], { ahora: T })).toEqual({ lanzamientos: 0, puntos: 0, porPeso: {}, liberaEnSeg: null });
    });
});

describe('limiteVigente — igual que el guardian: 12 h desde la ultima modificacion', () => {
    it('sin archivo: default 10 Sonnet = 40 puntos', () => {
        const l = limiteVigente({ ahora: T });
        expect(l).toEqual({ limite: 10, origen: 'default', venceEnSeg: null });
        expect(presupuestoPuntos(l.limite)).toBe(40);
    });

    it('con archivo reciente: override y cuanto le queda', () => {
        const l = limiteVigente({ contenido: '20\n', modificadoSeg: T - 3600, ahora: T });
        expect(l.limite).toBe(20);
        expect(l.origen).toBe('override');
        expect(l.venceEnSeg).toBe(43200 - 3600);
        expect(presupuestoPuntos(20)).toBe(80);
    });

    it('con archivo de hace 13 h: vencido, vuelve el default', () => {
        expect(limiteVigente({ contenido: '20', modificadoSeg: T - 13 * 3600, ahora: T })).toEqual({ limite: 10, origen: 'vencido', venceEnSeg: 0 });
    });

    it('0 = sin conteo', () => {
        expect(presupuestoPuntos(limiteVigente({ contenido: '0', modificadoSeg: T, ahora: T }).limite)).toBe(Infinity);
    });
});

describe('registro y texto', () => {
    it('la linea de registro lleva cuando, cuanto, puntos, PC y el motivo en una linea', () => {
        const l = lineaRegistro({ ahora: new Date('2026-10-08T23:00:00Z'), limite: 20, porque: 'investigacion\ngrande  de la noche', pc: 'PCX' });
        expect(l).toBe('2026-10-08 23:00\t20\t80 puntos/10 min\tPCX\tinvestigacion grande de la noche');
        expect(lineaRegistro({ ahora: new Date('2026-10-08T23:00:00Z'), limite: 0, porque: 'x', pc: 'P' })).toContain('sin conteo');
    });

    it('textoEstado dice el presupuesto, lo gastado y el pase', () => {
        const t = textoEstado({
            ventana: resumenVentana([`${T - 10} Agent 8`, `${T - 20} Agent 1`], { ahora: T }),
            limite: limiteVigente({ contenido: '20', modificadoSeg: T - 3600, ahora: T }),
            pase: true,
            hoy: { lanzamientos: 11, puntos: 44 },
        });
        expect(t).toMatch(/80 puntos cada 10 min/);
        expect(t).toMatch(/subido a 20 Sonnet, vence en 11\.0 h/);
        expect(t).toMatch(/2 lanzamiento\(s\), 9 punto\(s\) de 80/);
        expect(t).toMatch(/1 de peso 8, 1 de peso 1/);
        expect(t).toMatch(/Pase .agent-opus-ok vigente/);
        expect(t).toMatch(/Hoy: 11 lanzamiento\(s\), 44 punto\(s\)/);
        expect(PESOS).toEqual({ haiku: 1, sonnet: 4, opus: 8, fable: 20 });
    });
});
