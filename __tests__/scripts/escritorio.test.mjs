/**
 * Tests del archivado de tareas cerradas (regla `escritorio-tareas.md`).
 *
 * Lo que tienen que garantizar: que NO se pueda archivar sin dejar registro, que el
 * registro no se llene con relleno, que el movimiento se VERIFIQUE (OneDrive con Files
 * On-Demand puede morder), y que si alguien mueve una carpeta a mano el --check lo cante.
 *
 * Vectores:
 *   1-7   validarCierre: falta quien/que/donde, corto, relleno, fecha mala, fecha futura
 *   8-9   nombres canonicos idempotentes
 *  10-13  clasificarEntrada
 *  14-18  verificarInvariantes: sin fila / huerfana / nombre no canonico / duplicada / reabierta
 *  19-26  integracion real: el gate mueve o no mueve, y el listado Excel queda bien
 *  27-30  elegirFechaTarea: la antiguedad sale del mail, porque copiar la carpeta pisa el mtime
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

import {
    validarCierre, nombreCanonico, despojarFecha, clasificarEntrada, verificarInvariantes,
    anioDe, nombreIndice, esFechaValida, medir, elegirFechaTarea, COLUMNAS,
} from '../../scripts/_escritorio.mjs';

const SCRIPT = path.resolve(fileURLToPath(import.meta.url), '../../../scripts/_escritorio.mjs');
const CIERRE = {
    cerrada: '2026-07-27',
    quien: 'Marcelo',
    que: 'Mandados los dos PDF corregidos',
    donde: 'ULM GATE 2 de la biblioteca de Ingenieria',
};

describe('validarCierre — el gate que impide archivar una caja sin etiqueta', () => {
    it('1. rechaza si falta --que', () => {
        expect(validarCierre({ ...CIERRE, que: undefined })).toContain('falta --que');
    });
    it('2. rechaza si falta --quien o --donde', () => {
        expect(validarCierre({ ...CIERRE, quien: undefined })).toContain('falta --quien');
        expect(validarCierre({ ...CIERRE, donde: undefined })).toContain('falta --donde');
    });
    it('3. rechaza un --donde demasiado corto', () => {
        expect(validarCierre({ ...CIERRE, donde: 'server' }).join(' ')).toMatch(/demasiado corto/);
    });
    it('4. rechaza relleno tipo TBD / listo / -', () => {
        for (const relleno of ['TBD', 'listo', '-----', 'pendiente']) {
            expect(validarCierre({ ...CIERRE, que: relleno }).join(' ')).toMatch(/relleno|corto/);
        }
    });
    it('5. rechaza saltos de linea, que romperian la celda', () => {
        expect(validarCierre({ ...CIERRE, que: 'BOM cargada\ny verificada' }).join(' ')).toMatch(/saltos de linea/);
    });
    it('6. rechaza fechas que no existen', () => {
        expect(esFechaValida('2026-02-31')).toBe(false);
        expect(esFechaValida('27/07/2026')).toBe(false);
        expect(esFechaValida('2026-07-27')).toBe(true);
    });
    it('7. rechaza cerrar en el futuro y acepta un cierre real', () => {
        const futuro = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        expect(validarCierre({ ...CIERRE, cerrada: futuro }).length).toBeGreaterThan(0);
        expect(validarCierre(CIERRE)).toEqual([]);
    });
});

describe('nombres', () => {
    it('8. nombreCanonico no vuelve a prefijar una carpeta ya archivada', () => {
        const uno = nombreCanonico('2026-07-27', 'Enviar a Marcelo');
        expect(uno).toBe('2026-07-27 - Enviar a Marcelo');
        expect(nombreCanonico('2026-07-27', uno)).toBe(uno);
    });
    it('9. despojarFecha, anioDe y el nombre del listado', () => {
        expect(despojarFecha('2026-07-27 - Mariana arb')).toBe('Mariana arb');
        expect(despojarFecha('Mariana arb')).toBe('Mariana arb');
        expect(anioDe('2026-07-27')).toBe('2026');
        expect(nombreIndice('2026')).toBe('LISTADO DE TAREAS CERRADAS 2026.xlsx');
    });
});

describe('clasificarEntrada', () => {
    it('10. un acceso directo nunca es una tarea', () => {
        expect(clasificarEntrada('GitHub.lnk', false)).toBe('fijo');
        expect(clasificarEntrada('Dead by Daylight.url', false)).toBe('fijo');
        expect(clasificarEntrada('desktop.ini', false)).toBe('fijo');
    });
    it('11. la vieja carpeta _TERMINADAS se reconoce y no se archiva a si misma', () => {
        expect(clasificarEntrada('_TERMINADAS 2026', true)).toBe('archivo');
        expect(clasificarEntrada('_TERMINADAS', true)).toBe('archivo');
    });
    it('12. una carpeta de trabajo es una tarea', () => {
        expect(clasificarEntrada('Bolsa apc apb tra cen', true)).toBe('tarea');
    });
    it('13. un archivo suelto tambien, pero "juegos" no', () => {
        expect(clasificarEntrada('PLAN 28-07-2026.txt', false)).toBe('tarea');
        expect(clasificarEntrada('juegos', true)).toBe('fijo');
    });
});

describe('verificarInvariantes — que el archivo y el listado no se separen', () => {
    const buena = {
        cerrada: '2026-07-21', tarea: '2026-07-21 - Mariana arb', quien: 'Mariana',
        que: 'Tres cambios cargados y verificados', donde: 'Cargado en el ERP arb', estado: 'cerrada',
    };

    it('14. sano cuando la fila y la carpeta coinciden', () => {
        expect(verificarInvariantes([buena], { archivadas: ['2026-07-21 - Mariana arb'] })).toEqual([]);
    });
    it('15. carpeta archivada a mano, sin fila', () => {
        expect(verificarInvariantes([], { archivadas: ['2026-07-21 - Mariana arb'] }).join(' ')).toMatch(/no tiene fila/);
    });
    it('16. fila que apunta a una carpeta que no esta', () => {
        expect(verificarInvariantes([buena], { archivadas: [] }).join(' ')).toMatch(/no esta en el archivo/);
    });
    it('17. carpeta sin la fecha adelante', () => {
        const f = { ...buena, tarea: 'Mariana arb' };
        expect(verificarInvariantes([f], { archivadas: ['Mariana arb'] }).join(' ')).toMatch(/no arranca con la fecha/);
    });
    it('18. duplicada canta; reabierta no se chequea porque ya no esta', () => {
        expect(verificarInvariantes([buena, buena], { archivadas: ['2026-07-21 - Mariana arb'] }).join(' ')).toMatch(/dos veces/);
        expect(verificarInvariantes([{ ...buena, estado: 'reabierta 2026-07-28' }], { archivadas: [] })).toEqual([]);
    });
});

describe('elegirFechaTarea — desde cuando esta abierta de verdad', () => {
    const MAIL = Date.parse('2026-07-20T10:00:00Z');
    const COPIA = Date.parse('2026-08-02T00:00:00Z');   // el dia que se copio el Escritorio

    it('27. la fecha del mail le gana a la del archivo, aunque el archivo sea mas nuevo', () => {
        // El vector del incidente: copiar el Escritorio a la notebook le puso 02/08 a todo y
        // el relevador paso a decir "0d" en 30 tareas, incluidas varias de hace dos semanas.
        expect(elegirFechaTarea({ fechasMail: [MAIL], mtimes: [COPIA, COPIA] }))
            .toEqual({ ms: MAIL, fuente: 'mail' });
    });
    it('28. sin mail cae al archivo, y lo dice para que esa fecha no se lea como firme', () => {
        expect(elegirFechaTarea({ fechasMail: [], mtimes: [COPIA] })).toEqual({ ms: COPIA, fuente: 'archivo' });
    });
    it('29. con varios mails manda el mas nuevo: es el ultimo movimiento del tema', () => {
        const nuevo = Date.parse('2026-07-31T21:38:00Z');
        expect(elegirFechaTarea({ fechasMail: [MAIL, nuevo], mtimes: [] }).ms).toBe(nuevo);
    });
    it('30. carpeta vacia o sin stat no inventa una fecha', () => {
        expect(elegirFechaTarea({ fechasMail: [], mtimes: [] })).toEqual({ ms: 0, fuente: 'sin fecha' });
        expect(elegirFechaTarea({ fechasMail: [NaN], mtimes: [0] })).toEqual({ ms: 0, fuente: 'sin fecha' });
    });
});

describe('integracion — cola y archivo de mentira', () => {
    let cola; let arch;
    const correr = (args) => {
        try {
            return { code: 0, out: execFileSync(process.execPath, [SCRIPT, '--escritorio', cola, '--archivo', arch, ...args], { encoding: 'utf8' }) };
        } catch (e) {
            return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
        }
    };
    const archivarOk = (nombre = 'Tarea vieja') => correr(['--archivar', nombre,
        '--cerrada', CIERRE.cerrada, '--quien', CIERRE.quien, '--que', CIERRE.que, '--donde', CIERRE.donde]);
    const listado = async () => {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(path.join(arch, '2026', nombreIndice('2026')));
        return wb.worksheets[0];
    };

    beforeEach(() => {
        const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-'));
        cola = path.join(raiz, 'cola'); arch = path.join(raiz, 'TAREAS CERRADAS');
        fs.mkdirSync(path.join(cola, 'Tarea vieja'), { recursive: true });
        fs.writeFileSync(path.join(cola, 'Tarea vieja', 'mail.msg'), 'contenido del mail');
        fs.writeFileSync(path.join(cola, 'nota.txt'), 'una nota suelta');
        fs.writeFileSync(path.join(cola, 'GitHub.lnk'), 'x');
    });
    afterEach(() => { fs.rmSync(path.dirname(cola), { recursive: true, force: true }); });

    it('19. sin --que no archiva NADA (el gate frena, no avisa)', () => {
        const r = correr(['--archivar', 'Tarea vieja', '--cerrada', '2026-07-27', '--quien', 'Marcelo', '--donde', CIERRE.donde]);
        expect(r.code).toBe(1);
        expect(fs.existsSync(path.join(cola, 'Tarea vieja'))).toBe(true);
        expect(fs.existsSync(arch)).toBe(false);
    });

    it('20. con el cierre completo mueve, registra y el check pasa', () => {
        expect(archivarOk().code).toBe(0);
        expect(fs.existsSync(path.join(cola, 'Tarea vieja'))).toBe(false);
        expect(fs.existsSync(path.join(arch, '2026', '2026-07-27 - Tarea vieja', 'mail.msg'))).toBe(true);
        expect(correr(['--check']).code).toBe(0);
    });

    it('21. el listado Excel queda con la cabecera y los datos en su columna', async () => {
        archivarOk();
        const hoja = await listado();
        expect(hoja.getRow(1).values.slice(1)).toEqual(COLUMNAS.map((col) => col.header));
        expect(hoja.getRow(2).getCell(1).text).toBe('2026-07-27');
        expect(hoja.getRow(2).getCell(2).text).toBe('2026-07-27 - Tarea vieja');
        expect(hoja.getRow(2).getCell(5).text).toBe(CIERRE.donde);
        expect(hoja.rowCount).toBe(2);
    });

    it('22. no se puede archivar dos veces la misma', () => {
        archivarOk();
        expect(archivarOk().code).toBe(1);
    });

    it('23. un archivo suelto viaja adentro de su carpeta fechada', () => {
        expect(correr(['--archivar', 'nota.txt', '--cerrada', '2026-07-27', '--quien', 'Fak',
            '--que', 'Ya quedo implementado en el repo', '--donde', 'Script _refreshArb del repositorio']).code).toBe(0);
        expect(fs.existsSync(path.join(arch, '2026', '2026-07-27 - nota', 'nota.txt'))).toBe(true);
    });

    it('24. si alguien mete una carpeta a mano, --check lo canta', () => {
        archivarOk();
        fs.mkdirSync(path.join(arch, '2026', 'movida a mano'));
        const r = correr(['--check']);
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/no tiene fila en el INDICE/);
    });

    it('25. --reabrir la devuelve a la cola y la fila queda como historia', async () => {
        archivarOk();
        expect(correr(['--reabrir', '2026-07-27 - Tarea vieja']).code).toBe(0);
        expect(fs.existsSync(path.join(cola, 'Tarea vieja', 'mail.msg'))).toBe(true);
        const hoja = await listado();
        expect(hoja.rowCount).toBe(2);
        expect(hoja.getRow(2).getCell(6).text).toMatch(/^reabierta \d{4}-\d{2}-\d{2}$/);
        expect(correr(['--check']).code).toBe(0);
    });

    it('26b. --limpiar-vacia saca SOLO la que se le nombra, y respeta el dry-run', () => {
        fs.mkdirSync(path.join(cola, 'quedo vacia'));
        fs.mkdirSync(path.join(cola, 'otra vacia que Fak acaba de crear'));
        expect(correr(['--limpiar-vacia', 'quedo vacia', '--dry-run']).code).toBe(0);
        expect(fs.existsSync(path.join(cola, 'quedo vacia'))).toBe(true);   // dry-run no toca
        expect(correr(['--limpiar-vacia', 'quedo vacia']).code).toBe(0);
        expect(fs.existsSync(path.join(cola, 'quedo vacia'))).toBe(false);
        // La otra vacia NO se toca: el comando no decide solo el alcance (incidente 31/07)
        expect(fs.existsSync(path.join(cola, 'otra vacia que Fak acaba de crear'))).toBe(true);
    });
    it('26c. --limpiar-vacia se planta si la carpeta tiene algo adentro', () => {
        const r = correr(['--limpiar-vacia', 'Tarea vieja']);
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/NO esta vacia/);
        expect(fs.existsSync(path.join(cola, 'Tarea vieja', 'mail.msg'))).toBe(true);
    });

    it('26. un acceso directo no se puede archivar, y medir() cuenta lo que hay', () => {
        const r = correr(['--archivar', 'GitHub.lnk', '--cerrada', '2026-07-27', '--quien', 'Fak',
            '--que', 'Algo concreto hecho aca', '--donde', 'En el legajo del proyecto']);
        expect(r.code).toBe(1);
        expect(fs.existsSync(path.join(cola, 'GitHub.lnk'))).toBe(true);
        expect(medir(path.join(cola, 'Tarea vieja'))).toEqual({ archivos: 1, bytes: 'contenido del mail'.length });
    });
});
