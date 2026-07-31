/**
 * Tests del archivado de tareas del Escritorio (regla `escritorio-tareas.md`).
 *
 * Lo que tienen que garantizar: que NO se pueda archivar sin dejar registro, que el
 * registro no se pueda llenar con relleno, y que si alguien mueve una carpeta a mano
 * el --check lo cante. Nada de esto sirve si el script "avisa" y archiva igual.
 *
 * Vectores:
 *   1-6   validarCierre: falta el que / demasiado corto / relleno / pipe / fecha mala / futura
 *   7-8   nombreCanonico idempotente + despojarFecha
 *   9-12  clasificarEntrada: acceso directo, archivo de terminadas, carpeta de tarea, fijo
 *   13-15 parsearIndice: prosa y cabecera fuera, roundtrip de la fila
 *   16-20 verificarInvariantes: sin fila / fila huerfana / nombre no canonico / duplicada / reabierta
 *   21-25 integracion real contra un Escritorio de mentira: el gate mueve o no mueve
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    validarCierre, nombreCanonico, despojarFecha, clasificarEntrada,
    parsearIndice, filaIndice, verificarInvariantes, carpetaArchivo, esFechaValida,
} from '../../scripts/_escritorio.mjs';

const SCRIPT = path.resolve(fileURLToPath(import.meta.url), '../../../scripts/_escritorio.mjs');
const CIERRE_OK = { cerrada: '2026-07-27', que: 'Mandados los 2 PDF al cliente', donde: 'Legajo del proyecto en el server' };

describe('validarCierre — el gate que impide archivar una caja sin etiqueta', () => {
    it('1. rechaza si falta --que', () => {
        expect(validarCierre({ ...CIERRE_OK, que: undefined })).toContain('falta --que');
    });
    it('2. rechaza un --donde demasiado corto', () => {
        expect(validarCierre({ ...CIERRE_OK, donde: 'server' }).join(' ')).toMatch(/demasiado corto/);
    });
    it('3. rechaza relleno tipo TBD / listo / -', () => {
        for (const relleno of ['TBD', 'listo', '-----', 'pendiente']) {
            expect(validarCierre({ ...CIERRE_OK, que: relleno }).join(' ')).toMatch(/relleno|corto/);
        }
    });
    it('4. rechaza un pipe que rompe la tabla del INDICE', () => {
        expect(validarCierre({ ...CIERRE_OK, que: 'BOM cargada | verificada' }).join(' ')).toMatch(/no puede tener/);
    });
    it('5. rechaza fechas que no existen', () => {
        expect(esFechaValida('2026-02-31')).toBe(false);
        expect(esFechaValida('27/07/2026')).toBe(false);
        expect(esFechaValida('2026-07-27')).toBe(true);
    });
    it('6. rechaza cerrar en el futuro y acepta un cierre real', () => {
        const futuro = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        expect(validarCierre({ ...CIERRE_OK, cerrada: futuro }).length).toBeGreaterThan(0);
        expect(validarCierre(CIERRE_OK)).toEqual([]);
    });
});

describe('nombres', () => {
    it('7. nombreCanonico no vuelve a prefijar una carpeta ya archivada', () => {
        const uno = nombreCanonico('2026-07-27', 'Enviar a Marcelo');
        expect(uno).toBe('2026-07-27 - Enviar a Marcelo');
        expect(nombreCanonico('2026-07-27', uno)).toBe(uno);
    });
    it('8. despojarFecha deja el nombre original y carpetaArchivo saca el ano', () => {
        expect(despojarFecha('2026-07-27 - Mariana arb')).toBe('Mariana arb');
        expect(despojarFecha('Mariana arb')).toBe('Mariana arb');
        expect(carpetaArchivo('2026-07-27')).toBe('_TERMINADAS 2026');
    });
});

describe('clasificarEntrada', () => {
    it('9. un acceso directo nunca es una tarea', () => {
        expect(clasificarEntrada('GitHub.lnk', false)).toBe('fijo');
        expect(clasificarEntrada('Dead by Daylight.url', false)).toBe('fijo');
        expect(clasificarEntrada('desktop.ini', false)).toBe('fijo');
    });
    it('10. la carpeta de terminadas se reconoce por si misma', () => {
        expect(clasificarEntrada('_TERMINADAS 2026', true)).toBe('archivo');
        expect(clasificarEntrada('_TERMINADAS 2027', true)).toBe('archivo');
    });
    it('11. una carpeta cualquiera es una tarea', () => {
        expect(clasificarEntrada('Bolsa apc apb tra cen', true)).toBe('tarea');
    });
    it('12. un archivo de trabajo suelto tambien es una tarea', () => {
        expect(clasificarEntrada('PLAN 28-07-2026.txt', false)).toBe('tarea');
        expect(clasificarEntrada('juegos', true)).toBe('fijo');
    });
});

describe('INDICE', () => {
    const INDICE = `# Terminadas

Prosa que no es una fila. | esto tampoco |

| Cerrada | Carpeta | Qué quedó hecho | Dónde quedó | Estado |
|---|---|---|---|---|
| 2026-07-21 | 2026-07-21 - Mariana arb | Tres cambios cargados y verificados | En el ERP, verificado dos veces | cerrada |
`;
    it('13. ignora la prosa, la cabecera y el separador', () => {
        const filas = parsearIndice(INDICE);
        expect(filas).toHaveLength(1);
        expect(filas[0].carpeta).toBe('2026-07-21 - Mariana arb');
    });
    it('14. roundtrip fila → parseo', () => {
        const f = { cerrada: '2026-07-27', carpeta: '2026-07-27 - X', que: 'Algo concreto hecho', donde: 'En el legajo del proyecto', estado: 'cerrada' };
        expect(parsearIndice(filaIndice(f))[0]).toEqual(f);
    });
    it('15. una linea con menos de 5 celdas no se cuela como fila', () => {
        expect(parsearIndice('| a | b | c |')).toEqual([]);
    });
});

describe('verificarInvariantes — que el archivo y el INDICE no se separen', () => {
    const fila = (o) => parsearIndice(filaIndice({ estado: 'cerrada', ...o }))[0];
    const buena = fila({ cerrada: '2026-07-21', carpeta: '2026-07-21 - Mariana arb', que: 'Tres cambios cargados', donde: 'En el ERP, verificado' });

    it('16. sano cuando la fila y la carpeta coinciden', () => {
        expect(verificarInvariantes([buena], { archivadas: ['2026-07-21 - Mariana arb'] })).toEqual([]);
    });
    it('17. carpeta archivada a mano, sin fila', () => {
        const p = verificarInvariantes([], { archivadas: ['2026-07-21 - Mariana arb'] });
        expect(p.join(' ')).toMatch(/no tiene fila en el INDICE/);
    });
    it('18. fila que apunta a una carpeta que no esta', () => {
        expect(verificarInvariantes([buena], { archivadas: [] }).join(' ')).toMatch(/no esta en el archivo/);
    });
    it('19. carpeta sin la fecha adelante', () => {
        const f = fila({ cerrada: '2026-07-21', carpeta: 'Mariana arb', que: 'Tres cambios cargados', donde: 'En el ERP, verificado' });
        expect(verificarInvariantes([f], { archivadas: ['Mariana arb'] }).join(' ')).toMatch(/no arranca con la fecha/);
    });
    it('20. duplicada, y una fila reabierta no se chequea (es historia)', () => {
        expect(verificarInvariantes([buena, buena], { archivadas: ['2026-07-21 - Mariana arb'] }).join(' ')).toMatch(/dos veces/);
        const re = fila({ cerrada: '2026-07-21', carpeta: '2026-07-21 - Tweeter', que: 'Former entregado', donde: 'Carpeta del proyecto', estado: 'reabierta 2026-07-28' });
        expect(verificarInvariantes([re], { archivadas: [] })).toEqual([]);
    });
});

describe('integracion — contra un Escritorio de mentira', () => {
    let tmp;
    const correr = (args) => {
        try {
            return { code: 0, out: execFileSync(process.execPath, [SCRIPT, '--escritorio', tmp, ...args], { encoding: 'utf8' }) };
        } catch (e) {
            return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
        }
    };

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'escritorio-'));
        fs.mkdirSync(path.join(tmp, 'Tarea vieja'));
        fs.writeFileSync(path.join(tmp, 'Tarea vieja', 'mail.msg'), 'x');
        fs.writeFileSync(path.join(tmp, 'nota.txt'), 'una nota suelta');
        fs.writeFileSync(path.join(tmp, 'GitHub.lnk'), 'x');
    });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it('21. sin --que no archiva NADA (el gate frena, no avisa)', () => {
        const r = correr(['--archivar', 'Tarea vieja', '--cerrada', '2026-07-27', '--donde', 'En el legajo del proyecto']);
        expect(r.code).toBe(1);
        expect(fs.existsSync(path.join(tmp, 'Tarea vieja'))).toBe(true);
        expect(fs.existsSync(path.join(tmp, '_TERMINADAS 2026'))).toBe(false);
    });

    it('22. con el cierre completo mueve, registra y el check pasa', () => {
        const r = correr(['--archivar', 'Tarea vieja', '--cerrada', '2026-07-27', '--que', 'Mandados los dos PDF', '--donde', 'En el legajo del proyecto']);
        expect(r.code).toBe(0);
        expect(fs.existsSync(path.join(tmp, 'Tarea vieja'))).toBe(false);
        const dest = path.join(tmp, '_TERMINADAS 2026', '2026-07-27 - Tarea vieja');
        expect(fs.existsSync(path.join(dest, 'mail.msg'))).toBe(true);
        const filas = parsearIndice(fs.readFileSync(path.join(tmp, '_TERMINADAS 2026', 'INDICE.md'), 'utf8'));
        expect(filas).toHaveLength(1);
        expect(correr(['--check']).code).toBe(0);
    });

    it('23. un archivo suelto viaja adentro de su carpeta fechada', () => {
        expect(correr(['--archivar', 'nota.txt', '--cerrada', '2026-07-27', '--que', 'Ya quedo implementado en el repo', '--donde', 'Script del repositorio']).code).toBe(0);
        expect(fs.existsSync(path.join(tmp, '_TERMINADAS 2026', '2026-07-27 - nota', 'nota.txt'))).toBe(true);
    });

    it('24. si alguien mueve una carpeta a mano, --check lo canta', () => {
        correr(['--archivar', 'Tarea vieja', '--cerrada', '2026-07-27', '--que', 'Mandados los dos PDF', '--donde', 'En el legajo del proyecto']);
        fs.mkdirSync(path.join(tmp, '_TERMINADAS 2026', 'movida a mano'));
        const r = correr(['--check']);
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/no tiene fila en el INDICE/);
    });

    it('25. --reabrir la devuelve al Escritorio y deja la fila como historia', () => {
        correr(['--archivar', 'Tarea vieja', '--cerrada', '2026-07-27', '--que', 'Mandados los dos PDF', '--donde', 'En el legajo del proyecto']);
        expect(correr(['--reabrir', '2026-07-27 - Tarea vieja']).code).toBe(0);
        expect(fs.existsSync(path.join(tmp, 'Tarea vieja', 'mail.msg'))).toBe(true);
        const filas = parsearIndice(fs.readFileSync(path.join(tmp, '_TERMINADAS 2026', 'INDICE.md'), 'utf8'));
        expect(filas).toHaveLength(1);
        expect(filas[0].estado).toMatch(/^reabierta \d{4}-\d{2}-\d{2}$/);
        expect(correr(['--check']).code).toBe(0);
    });

    it('26. un acceso directo no se puede archivar (no es una tarea)', () => {
        const r = correr(['--archivar', 'GitHub.lnk', '--cerrada', '2026-07-27', '--que', 'Algo concreto hecho aca', '--donde', 'En el legajo del proyecto']);
        expect(r.code).toBe(1);
        expect(fs.existsSync(path.join(tmp, 'GitHub.lnk'))).toBe(true);
    });
});
