/**
 * Tests de `_entregas.mjs` — el indice de entregas derivado.
 *
 * Lo que tienen que garantizar: que el aviso "hecho pero sin salir" SIRVA. Un aviso que
 * lista 86 documentos no lo lee nadie, y uno que se pierde el unico que importa es peor
 * que no tenerlo. Los dos casos reales que motivaron el script son vectores fijos:
 *
 *   - un DXF RevB listo desde el 10/08/2026 y nunca enviado a mesa de corte
 *   - un PDF de difusion del 07/08, que NO era el archivo mas nuevo de su carpeta
 *     (habia otros dos PDF posteriores) y por eso "el ultimo de la tarea" lo tapaba
 *
 * Y el falso positivo que hay que NO cometer: plano_del_cliente.pdf, un plano que mando el cliente. Esta
 * en la carpeta de la tarea pero llego de afuera — no tiene por que salir de Barack.
 *
 * Vectores:
 *   1-6    familiaEntregable: version vs documento distinto (y no comerse el Nº de HO)
 *   7-9    porFamilia / ultimoEntregable
 *  10-14   estadoEntregable: las 5 combinaciones
 *  15-17   pendientesDe: umbral de dias
 *  18-21   entregablesDe: solo primer nivel, solo extensiones de entregable
 *  22-24   indexarAdjuntos: enviado vs recibido vs borrador
 *  25-27   integracion sobre un Escritorio de mentira
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
    familiaEntregable, porFamilia, ultimoEntregable, estadoEntregable, pendientesDe,
    diasQuieto, entregablesDe, indexarAdjuntos, claveArchivo, relevar, EXT_ENTREGABLE,
} from '../../scripts/_entregas.mjs';

const DIA = 86400000;

describe('familiaEntregable — version vs documento distinto', () => {
    it('1. agrupa vN aunque el separador sea guion bajo (base_v2A / base_v3B)', () => {
        expect(familiaEntregable('base_v2A.step')).toBe(familiaEntregable('base_v3B.step'));
    });

    it('2. agrupa RevA/RevB del mismo patron', () => {
        expect(familiaEntregable('PLOTTER RevB - 32 piezas.dxf'))
            .toBe(familiaEntregable('PLOTTER RevA - 32 piezas.dxf'));
    });

    it('3. agrupa por decimal (holgura 0,45 vs 0,55)', () => {
        expect(familiaEntregable('TORNILLO suave 0,45.step'))
            .toBe(familiaEntregable('TORNILLO suave 0,55.step'));
    });

    it('4. NO agrupa dos difusiones distintas del mismo dia — el caso de la difusion del 07/08', () => {
        expect(familiaEntregable('Modificaciones BOM ARB_20260807_Linea A.pdf'))
            .not.toBe(familiaEntregable('Modificaciones BOM ARB_20260806_Linea B.pdf'));
    });

    it('5. NO se come el numero de documento: es identidad, no version', () => {
        expect(familiaEntregable('DOC-401 PIEZA A REV.A.xlsx'))
            .not.toBe(familiaEntregable('DOC-402 PIEZA B REV.A.xlsx'));
    });

    it('6. la extension separa: un STEP y un STL son entregables distintos', () => {
        expect(familiaEntregable('DISPOSITIVO v10.step')).not.toBe(familiaEntregable('DISPOSITIVO v10.stl'));
    });
});

describe('porFamilia / ultimoEntregable', () => {
    const f = (nombre, dia) => ({ nombre, mtime: dia * DIA, ruta: `x/${nombre}`, sub: '' });

    it('7. de cada familia deja el mas nuevo', () => {
        const out = porFamilia([f('base_v1.step', 1), f('base_v3.step', 3), f('base_v2.step', 2)]);
        expect(out).toHaveLength(1);
        expect(out[0].nombre).toBe('base_v3.step');
    });

    it('8. deja UNA fila por documento distinto, no una por tarea', () => {
        const out = porFamilia([
            f('Modificaciones BOM ARB_20260806_Linea B.pdf', 6),
            f('Modificaciones BOM ARB_20260807_Linea A.pdf', 7),
            f('Consumos_20260807_Linea A.pdf', 8),
        ]);
        expect(out).toHaveLength(3);
    });

    it('9. empata por mtime -> gana el nombre mayor (determinista)', () => {
        expect(ultimoEntregable([f('a.dxf', 5), f('b.dxf', 5)]).nombre).toBe('b.dxf');
    });
});

describe('estadoEntregable', () => {
    it('10. sin mail ni copia = SIN SALIR (es el unico pendiente)', () => {
        expect(estadoEntregable({ enviado: false, recibido: false, enBiblioteca: false }))
            .toEqual({ estado: 'SIN SALIR', pendiente: true });
    });

    it('11. llego como adjunto de un recibido = insumo, no pendiente (plano_del_cliente.pdf)', () => {
        expect(estadoEntregable({ enviado: false, recibido: true, enBiblioteca: false }).pendiente).toBe(false);
    });

    it('12. salio por mail = no pendiente', () => {
        expect(estadoEntregable({ enviado: true, recibido: false, enBiblioteca: false }).estado).toBe('enviado');
    });

    it('13. copia en la biblioteca = no pendiente aunque no haya mail', () => {
        expect(estadoEntregable({ enviado: false, recibido: false, enBiblioteca: true }).estado).toBe('archivado');
    });

    it('14. mail + biblioteca = entregado del todo', () => {
        expect(estadoEntregable({ enviado: true, recibido: false, enBiblioteca: true }).estado).toBe('entregado');
    });
});

describe('pendientesDe — el umbral que hace util el aviso', () => {
    const ahora = Date.UTC(2026, 7, 14);
    const fila = (nombre, diasAtras, pendiente = true) => ({
        tarea: 'T', donde: 'Escritorio',
        familias: [{ entregable: nombre, mtime: ahora - diasAtras * DIA, pendiente, sub: '', ruta: '' }],
    });

    it('15. lo de hoy no entra: es trabajo en curso, no un pendiente', () => {
        expect(pendientesDe([fila('recien.stl', 0)], { dias: 2, ahora })).toHaveLength(0);
    });

    it('16. lo de hace 4 dias si — es el caso del DXF RevB', () => {
        const out = pendientesDe([fila('PLOTTER RevB - 32 piezas.dxf', 4)], { dias: 2, ahora });
        expect(out).toHaveLength(1);
        expect(out[0].dias).toBe(4);
    });

    it('17. ordena por antiguedad: lo mas viejo primero', () => {
        const out = pendientesDe([fila('nuevo.pdf', 3), fila('viejo.pdf', 100)], { dias: 2, ahora });
        expect(out.map((o) => o.entregable)).toEqual(['viejo.pdf', 'nuevo.pdf']);
    });

    it('17b. diasQuieto cuenta dias enteros', () => {
        expect(diasQuieto(ahora - 3 * DIA - 1000, ahora)).toBe(3);
    });
});

describe('entregablesDe — solo el primer nivel', () => {
    let dir;
    beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'entregas-')); });
    afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

    it('18. toma los entregables de la raiz', () => {
        fs.writeFileSync(path.join(dir, 'patron.dxf'), 'x');
        fs.writeFileSync(path.join(dir, 'tabla.xlsx'), 'x');
        expect(entregablesDe(dir).map((e) => e.nombre).sort()).toEqual(['patron.dxf', 'tabla.xlsx']);
    });

    it('19. NO baja a subcarpetas: ahi viven las pruebas y el material recibido', () => {
        fs.mkdirSync(path.join(dir, 'ENVIADO CLIENTE'));
        fs.writeFileSync(path.join(dir, 'ENVIADO CLIENTE', 'plano_del_cliente.pdf'), 'x');
        expect(entregablesDe(dir)).toHaveLength(0);
    });

    it('20. ignora lo que no es entregable (fotos, notas)', () => {
        fs.writeFileSync(path.join(dir, 'foto.png'), 'x');
        fs.writeFileSync(path.join(dir, 'notas.md'), 'x');
        fs.writeFileSync(path.join(dir, 'bom.pdf'), 'x');
        expect(entregablesDe(dir).map((e) => e.nombre)).toEqual(['bom.pdf']);
    });

    it('21. una carpeta que no existe devuelve vacio, no explota', () => {
        expect(entregablesDe(path.join(dir, 'no-existe'))).toEqual([]);
    });

    it('21b. el set de extensiones cubre los formatos que se entregan', () => {
        for (const e of ['.dxf', '.plt', '.xlsx', '.pdf', '.step', '.stl']) {
            expect(EXT_ENTREGABLE.has(e)).toBe(true);
        }
        expect(EXT_ENTREGABLE.has('.png')).toBe(false);
    });
});

describe('indexarAdjuntos — enviado vs recibido', () => {
    let jsonl;
    beforeEach(() => {
        jsonl = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mails-')), 'mails.jsonl');
    });
    afterEach(() => { fs.rmSync(path.dirname(jsonl), { recursive: true, force: true }); });

    const escribir = (mails) => fs.writeFileSync(jsonl, mails.map((m) => JSON.stringify(m)).join('\n'));

    it('22. un adjunto de Elementos enviados queda como enviado', async () => {
        escribir([{ carpeta: 'f/ Elementos enviados', fecha: '2026-08-07', asunto: 'x', adjuntos: ['BOM.pdf'] }]);
        expect((await indexarAdjuntos(jsonl)).get(claveArchivo('BOM.pdf')).enviado).toBe(true);
    });

    it('23. uno de Bandeja de entrada queda como recibido, NO enviado', async () => {
        escribir([{ carpeta: 'f/ Bandeja de entrada', fecha: '2026-08-10', asunto: 'plano', adjuntos: ['plano_del_cliente.pdf'] }]);
        const v = (await indexarAdjuntos(jsonl)).get(claveArchivo('plano_del_cliente.pdf'));
        expect(v).toEqual(expect.objectContaining({ enviado: false, recibido: true }));
    });

    it('24. BORRADORES no cuenta como enviado — un mail escrito y no mandado es el caso que buscamos', async () => {
        escribir([{ carpeta: 'f/ Borradores', fecha: '2026-08-07', asunto: 'x', adjuntos: ['sin_mandar.pdf'] }]);
        expect((await indexarAdjuntos(jsonl)).has(claveArchivo('sin_mandar.pdf'))).toBe(false);
    });

    it('24b. el match no depende del case', async () => {
        escribir([{ carpeta: 'f/ Elementos enviados', fecha: '2026-08-07', asunto: 'x', adjuntos: ['Tabla FINAL.xlsx'] }]);
        expect((await indexarAdjuntos(jsonl)).has(claveArchivo('tabla final.XLSX'))).toBe(true);
    });
});

describe('integracion — los dos hallazgos del relevamiento manual del 14/08/2026', () => {
    let raiz; let escritorio; let jsonl; let biblioteca;

    beforeEach(() => {
        raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'entregas-int-'));
        escritorio = path.join(raiz, 'Desktop');
        biblioteca = path.join(raiz, 'biblio');
        fs.mkdirSync(escritorio); fs.mkdirSync(biblioteca);
        jsonl = path.join(raiz, 'mails.jsonl');

        const tarea = (n) => { const p = path.join(escritorio, n); fs.mkdirSync(p); return p; };
        const viejo = Date.now() - 6 * DIA;
        const poner = (dir, nombre) => {
            const p = path.join(dir, nombre);
            fs.writeFileSync(p, 'x');
            fs.utimesSync(p, viejo / 1000, viejo / 1000);
        };

        // La carpeta con CUATRO PDF distintos: el APC no es el mas nuevo.
        const boms = tarea('5.8.2026 BOMs y pesajes');
        poner(boms, 'Modificaciones BOM ARB_20260806_Linea B.pdf');
        poner(boms, 'Modificaciones BOM ARB_20260807_Linea A.pdf');
        poner(boms, 'Consumos_20260807_Linea A.pdf');

        // El plano que mando el cliente: esta en la carpeta pero no sale de Barack.
        poner(tarea('Remache del cliente'), 'plano_del_cliente.pdf');

        fs.writeFileSync(jsonl, [
            { carpeta: 'f/ Elementos enviados', fecha: '2026-08-06', asunto: 'insertos', adjuntos: ['Modificaciones BOM ARB_20260806_Linea B.pdf'] },
            { carpeta: 'f/ Elementos enviados', fecha: '2026-08-07', asunto: 'consumos', adjuntos: ['Consumos_20260807_Linea A.pdf'] },
            { carpeta: 'f/ Bandeja de entrada', fecha: '2026-08-10', asunto: 'remache', adjuntos: ['plano_del_cliente.pdf'] },
        ].map((m) => JSON.stringify(m)).join('\n'));
    });

    afterEach(() => { fs.rmSync(raiz, { recursive: true, force: true }); });

    it('25. encuentra la difusion del 07/08 aunque NO sea el archivo mas nuevo de su carpeta', async () => {
        const { filas } = await relevar({ escritorio, archivo: path.join(raiz, 'no-hay'), biblioteca, jsonl });
        const nombres = pendientesDe(filas, { dias: 2 }).map((p) => p.entregable);
        expect(nombres).toContain('Modificaciones BOM ARB_20260807_Linea A.pdf');
    });

    it('26. NO marca como pendiente lo que ya salio por mail', async () => {
        const { filas } = await relevar({ escritorio, archivo: path.join(raiz, 'no-hay'), biblioteca, jsonl });
        const nombres = pendientesDe(filas, { dias: 2 }).map((p) => p.entregable);
        expect(nombres).not.toContain('Modificaciones BOM ARB_20260806_Linea B.pdf');
        expect(nombres).not.toContain('Consumos_20260807_Linea A.pdf');
    });

    it('27. NO marca como pendiente un plano que mando el cliente', async () => {
        const { filas } = await relevar({ escritorio, archivo: path.join(raiz, 'no-hay'), biblioteca, jsonl });
        expect(pendientesDe(filas, { dias: 2 }).map((p) => p.entregable)).not.toContain('plano_del_cliente.pdf');
    });

    it('28. una copia en la biblioteca alcanza para no ser pendiente, sin mail', async () => {
        fs.writeFileSync(path.join(biblioteca, 'Modificaciones BOM ARB_20260807_Linea A.pdf'), 'x');
        const { filas } = await relevar({ escritorio, archivo: path.join(raiz, 'no-hay'), biblioteca, jsonl });
        expect(pendientesDe(filas, { dias: 2 }).map((p) => p.entregable)).toHaveLength(0);
    });
});
