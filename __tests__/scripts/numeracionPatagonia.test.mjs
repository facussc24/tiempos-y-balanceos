/**
 * Tests del canon de numeracion de Patagonia (`scripts/_lib/numeracionPatagonia.data.json`),
 * que consume `scripts/_verificarNumeracion.mjs`.
 *
 * De donde sale: el 02/07/2026 L. Lattanzi freno la carga de Patagonia en BeOn con el
 * mail "Condiciones que rompen trazabilidad Flujograma - AMFE - Instruccion de trabajo".
 * Las dos primeras condiciones eran de numeracion. El canon es el esperado contra el que
 * se verifica el AMFE, asi que si el canon se corrompe el chequeo miente en silencio.
 *
 * Lo que protege, que es el borde donde este archivo se vuelve peligroso:
 *  - una secuencia con numeros repetidos haria pasar un AMFE que tiene el mismo numero
 *    dos veces, que es justo el defecto que buscamos (paso el 18/08 en el flujograma del
 *    Top Roll: el embalaje y el control final los dos en 80);
 *  - una secuencia inventada "para que compile" es peor que no tenerla: por eso `null`
 *    es un valor legitimo y significa "el flujograma todavia no esta cerrado";
 *  - una secuencia sin `fuente` no se puede auditar despues, y en 3 meses nadie se
 *    acuerda de donde salio.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const CANON = JSON.parse(
    readFileSync(join(process.cwd(), 'scripts', '_lib', 'numeracionPatagonia.data.json'), 'utf8'));

const entradas = Object.entries(CANON.documentos);

describe('canon de numeracion de Patagonia', () => {
    it('tiene los 8 documentos del proyecto', () => {
        expect(entradas).toHaveLength(8);
    });

    it.each(entradas)('%s declara producto, flujograma y fuente', (clave, doc) => {
        expect(doc.producto, `${clave} sin producto`).toBeTruthy();
        expect(doc.flujograma?.id, `${clave} sin id de flujograma`).toBeTruthy();
        expect(doc.fuente, `${clave} sin fuente: no se va a poder auditar`).toBeTruthy();
    });

    it.each(entradas)('%s: la secuencia es null o una lista sin repetidos', (clave, doc) => {
        if (doc.secuencia === null) return;   // flujograma todavia abierto: legitimo
        expect(Array.isArray(doc.secuencia), `${clave}: secuencia no es lista`).toBe(true);
        expect(doc.secuencia.length).toBeGreaterThan(0);

        const nums = doc.secuencia.map(String);
        const repetidos = nums.filter((v, i) => nums.indexOf(v) !== i);
        expect(repetidos, `${clave}: numeros repetidos ${repetidos.join(',')}`).toHaveLength(0);
    });

    it.each(entradas)('%s: los numeros de la secuencia son numericos y crecientes', (clave, doc) => {
        if (doc.secuencia === null) return;
        const nums = doc.secuencia.map(Number);
        expect(nums.every(Number.isFinite), `${clave}: hay un numero no numerico`).toBe(true);
        const ordenado = [...nums].sort((a, b) => a - b);
        expect(nums, `${clave}: la secuencia no esta en orden de proceso`).toEqual(ordenado);
    });

    it('una secuencia con el flujograma PENDIENTE necesita 2 fuentes independientes', () => {
        // El caso legitimo es el Top Roll: el flujograma B todavia no salio, pero el
        // Plan de Control y el flujograma vigente coinciden, asi que el esperado ya
        // esta fijado. Con UNA sola fuente seria una secuencia supuesta disfrazada de
        // esperado — y contra eso mide todo el script.
        for (const [clave, doc] of entradas) {
            if (doc.flujograma.estado !== 'PENDIENTE' || doc.secuencia === null) continue;
            const fuentes = doc.secuenciaConfirmadaPor || [];
            expect(fuentes.length, `${clave}: flujograma pendiente y secuencia con ${fuentes.length} fuente(s)`)
                .toBeGreaterThanOrEqual(2);
        }
    });

    it('un flujograma VIGENTE tiene que traer secuencia', () => {
        for (const [clave, doc] of entradas) {
            if (doc.flujograma.estado === 'VIGENTE') {
                expect(doc.secuencia, `${clave}: vigente pero sin secuencia`).not.toBeNull();
            }
        }
    });

    it('toda secuencia declarada dice de donde salio', () => {
        for (const [clave, doc] of entradas) {
            if (doc.secuencia === null) continue;
            expect(doc.secuenciaConfirmadaPor?.length, `${clave}: secuencia sin respaldo declarado`)
                .toBeGreaterThanOrEqual(1);
        }
    });

    it('los apoyacabezas comparten el flujograma 152', () => {
        // Un solo flujograma para los tres. Si alguien los separa sin querer, el
        // chequeo cruzado de numeracion entre hermanos deja de tener sentido.
        const apc = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
        for (const k of apc) {
            expect(CANON.documentos[k].flujograma.id, `${k} deberia colgar del 152`).toBe('152');
        }
    });
});
