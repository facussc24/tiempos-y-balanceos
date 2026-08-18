/**
 * Tests de los datos de flujograma que consume `scripts/_flujograma.mjs`.
 *
 * Contexto: desde el 18/08/2026 los flujogramas se generan aca (regla `no-pfd-no-ho.md`).
 * El motor (`tools/flowchart/Flowchart.jsx`) viene del generador de Claude Design y tiene
 * un comportamiento documentado que NO es un bug a arreglar sino una trampa a evitar: si un
 * rombo (`type:"condition"`) va suelto adentro de `branchSide`, el motor **superpone los
 * textos y no dibuja el rombo**. Hay que envolverlo en `branchSide.sequence`.
 *
 * Ese fallo es silencioso: el render sale, el PNG pesa lo normal, y el documento que llega
 * al cliente tiene una decision del proceso ilegible. Por eso se chequea en test y no a ojo.
 *
 * Lo demas que se protege: que los tipos de figura sean los que el motor sabe dibujar (un
 * type invalido no rompe, simplemente no dibuja NADA en ese paso), que no haya numeros de
 * operacion repetidos, y que todo flujograma traiga su historial de revisiones —lo exige
 * APQP 3ra ed. §1.15 para todo output de APQP.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const DATA = join(process.cwd(), 'tools', 'flowchart', 'data');
const archivos = existsSync(DATA) ? readdirSync(DATA).filter(f => f.endsWith('.json')) : [];
const casos = archivos.map(f => [f, JSON.parse(readFileSync(join(DATA, f), 'utf8'))]);

/** Los unicos que `FlowNode` sabe dibujar. Cualquier otro no pinta nada. */
const TIPOS = new Set(['operation', 'op-ins', 'transfer', 'storage', 'inspection', 'condition', 'terminal', 'connector']);

/** Recorre el arbol completo: flujo principal, ramas laterales y ramas paralelas. */
function recorrer(nodos, visitar, ruta = 'flow') {
    (nodos || []).forEach((n, i) => {
        visitar(n, `${ruta}[${i}]`);
        if (n.branchSide?.sequence) recorrer(n.branchSide.sequence, visitar, `${ruta}[${i}].branchSide.sequence`);
        if (n.branches) n.branches.forEach((b, j) => recorrer(Array.isArray(b) ? b : b.sequence, visitar, `${ruta}[${i}].branches[${j}]`));
    });
}

describe('datos de flujograma', () => {
    it('hay al menos un flujograma cargado', () => {
        expect(archivos.length).toBeGreaterThan(0);
    });

    it.each(casos)('%s: tiene header, flow y revisions', (_f, d) => {
        expect(d.header?.title, 'sin titulo').toBeTruthy();
        expect(d.header?.documentCode, 'sin codigo de formulario').toBeTruthy();
        expect(d.header?.revision, 'sin letra de revision').toBeTruthy();
        expect(Array.isArray(d.flow) && d.flow.length, 'flow vacio').toBeTruthy();
        // APQP §1.15: todo output de APQP lleva change log.
        expect(Array.isArray(d.revisions) && d.revisions.length, 'sin historial de revisiones').toBeTruthy();
    });

    it.each(casos)('%s: todos los tipos de figura son dibujables', (_f, d) => {
        const malos = [];
        recorrer(d.flow, (n, ruta) => { if (!TIPOS.has(n.type)) malos.push(`${ruta}: type="${n.type}"`); });
        expect(malos, `tipos que el motor no dibuja:\n${malos.join('\n')}`).toHaveLength(0);
    });

    it.each(casos)('%s: ningun rombo suelto dentro de branchSide (trampa del motor)', (_f, d) => {
        // Si `branchSide` es el rombo mismo en vez de envolverlo en `sequence`, el motor
        // pisa los textos y no lo dibuja. Falla en silencio: el PNG sale igual.
        const malos = [];
        recorrer(d.flow, (n, ruta) => {
            if (n.branchSide && !n.branchSide.sequence && n.branchSide.type === 'condition') {
                malos.push(`${ruta}: envolvelo en branchSide.sequence`);
            }
        });
        expect(malos, `rombos colapsados:\n${malos.join('\n')}`).toHaveLength(0);
    });

    it.each(casos)('%s: los numeros de operacion no se repiten DENTRO de un mismo camino', (_f, d) => {
        // Ojo: repetir un numero entre RAMAS PARALELAS es correcto y esperado. En el
        // flujograma 152 los tres apoyacabezas comparten documento y cada variante hace su
        // propia "30 COSTURA UNION" con paneles distintos — es una sola operacion del
        // proceso aplicada a tres variantes, que es como lo pide `amfe.md` §12 (OPs
        // condicionales por variante, NUNCA documentos separados).
        // Lo que si es un defecto es repetir un numero dentro del MISMO camino: ahi son dos
        // operaciones distintas peleando por el mismo identificador.
        const porCamino = new Map();
        recorrer(d.flow, (n, ruta) => {
            if (!n.stepId) return;
            // El camino es la rama a la que pertenece el nodo; los hermanos de `branches`
            // son caminos distintos y no compiten entre si.
            const camino = ruta.replace(/\[\d+\]$/, '');
            if (!porCamino.has(camino)) porCamino.set(camino, []);
            porCamino.get(camino).push(String(n.stepId));
        });

        const malos = [];
        for (const [camino, nums] of porCamino) {
            const dup = [...new Set(nums.filter((v, i) => nums.indexOf(v) !== i))];
            if (dup.length) malos.push(`${camino}: ${dup.join(', ')}`);
        }
        expect(malos, `numeros repetidos en el mismo camino:\n${malos.join('\n')}`).toHaveLength(0);
    });

    it.each(casos)('%s: toda condicion tiene su pregunta y su rama', (_f, d) => {
        const malos = [];
        recorrer(d.flow, (n, ruta) => {
            if (n.type !== 'condition') return;
            if (!n.labelCondition) malos.push(`${ruta}: rombo sin labelCondition`);
            if (!n.branchSide && !n.branches) malos.push(`${ruta}: rombo sin salida alternativa`);
        });
        expect(malos, malos.join('\n')).toHaveLength(0);
    });

    it.each(casos)('%s: un rework apunta a una operacion que existe', (_f, d) => {
        const existentes = new Set();
        recorrer(d.flow, (n) => { if (n.stepId) existentes.add(String(n.stepId)); });
        const malos = [];
        recorrer(d.flow, (n, ruta) => {
            if (n.rework?.targetId && !existentes.has(String(n.rework.targetId))) {
                malos.push(`${ruta}: vuelve a la OP ${n.rework.targetId}, que no existe en el flujograma`);
            }
        });
        expect(malos, malos.join('\n')).toHaveLength(0);
    });

    it.each(casos)('%s: la ultima fila de revisiones coincide con la letra del cajetin', (_f, d) => {
        // Si no coinciden, el documento dice una revision arriba y otra en el historial.
        const ultima = d.revisions[d.revisions.length - 1];
        expect(String(ultima.rev)).toBe(String(d.header.revision));
    });

    it.each(casos)('%s: cada fila de revision esta completa', (_f, d) => {
        for (const [i, r] of d.revisions.entries()) {
            expect(r.rev, `fila ${i} sin letra`).toBeTruthy();
            expect(r.date, `fila ${i} sin fecha`).toBeTruthy();
            expect(r.details, `fila ${i} sin detalle del cambio`).toBeTruthy();
            expect(r.modifiedBy, `fila ${i} sin quien lo modifico`).toBeTruthy();
            expect(r.date, `fila ${i}: la fecha va dd/mm/aaaa`).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        }
    });
});
