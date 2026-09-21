/**
 * `_videoBiblioteca.mjs --auditar` — probado EN ROJO y EN VERDE sobre un arbol de mentira.
 *
 * Por que existe (21/09/2026). Fak pidio ordenar el material de la HOTMELT y la MOLDEADORA IMG:
 * "que esten los archivos originales videos o fotos originales y todo lo demas dentro de una
 * carpeta que diga .claude para que no estorbe". Al medirlo aparecieron 228 hallazgos, y el mas
 * caro no se veia mirando UNA carpeta: el mismo video de 1,19 GB estaba archivado en dos maquinas
 * con dos nombres que se contradecian ("MOLDEADORA - capacitacion en el HMI" y "Prensa KingPower
 * - Parte 1"). Por eso el cruce ENTRE carpetas tiene su propio chequeo.
 *
 * Un control que no puede dar verde esta tan roto como el que no puede dar rojo: cada caso de
 * aca prueba los dos lados, y el rojo comprueba tambien el CODIGO del hallazgo.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditarCarpeta, claveDe, NOMBRE_DE_LA_CASA, MISMO_TAMANO_MIN } from '../../scripts/_videoBiblioteca.mjs';

let raiz;
const ORDENADA = 'MAQUINA ORDENADA';
const DESORDENADA = 'MAQUINA DESORDENADA';

/** Escribe un archivo con su carpeta, para armar el arbol de prueba. Sin `bytes` cada uno pesa
 *  distinto, para no disparar el chequeo de tamano por accidente. */
let unico = 0;
const tocar = (p, bytes = 0) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, 'x'.repeat(bytes || (unico += 7)));
};
const GRANDE = MISMO_TAMANO_MIN + 10;
const codigos = (dir) => auditarCarpeta(dir).hallazgos.map((h) => h.codigo);

beforeAll(() => {
    raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'vba-'));

    // --- la que esta como la pidio Fak: originales arriba, todo lo demas en .claude
    const a = path.join(raiz, ORDENADA);
    tocar(path.join(a, '2026-09-09 - MOLDEADORA - HMI - tabla de tiempos (IMG_0814).MOV'));
    tocar(path.join(a, '2026-09-09 - PIZARRA - tiradas T1 a T10 (IMG_0802).HEIC'));
    tocar(path.join(a, '.claude', 'LEEME - que hay aca.txt'));
    tocar(path.join(a, '.claude', 'transcripciones', 'IMG_0814.txt'));
    tocar(path.join(a, '.claude', 'fotogramas de cada video', '0814', '0814_001.jpg'));

    // --- la que estaba antes de ordenar, con un defecto de cada tipo
    const b = path.join(raiz, DESORDENADA);
    tocar(path.join(b, '2026-09-02 - MOLDEADORA - recorrida de pantallas (IMG_0578).MOV'), GRANDE);
    tocar(path.join(b, 'Prensa KingPower - Parte 1 (02-09, 18 min).MOV'));          // nombre fuera de formato
    tocar(path.join(b, '2026-09-31 - MOLDEADORA - fecha que no existe (IMG_0900).MOV'));
    tocar(path.join(b, '2026-09-04 - MOLDEADORA - sin clave.MOV'));                 // sin parentesis
    tocar(path.join(b, '2026-09-04 - MOLDEADORA - origen vacio (x).MOV'));          // parentesis sin origen
    tocar(path.join(b, 'CASO - burbuja en la punta.pdf'));                          // no es un original
    tocar(path.join(b, '_INFO SACADA DE LOS VIDEOS', 'transcripciones', '0578.txt'));  // carpeta en la raiz
    tocar(path.join(b, '.claude', 'transcripciones', 'IMG_0823.txt'));              // de otra maquina
    tocar(path.join(b, '.claude', 'fotogramas de cada video', '0823', 'x.jpg'));    // de otra maquina
});

afterAll(() => { fs.rmSync(raiz, { recursive: true, force: true }); });

describe('auditarCarpeta — la carpeta ordenada da VERDE', () => {
    it('no tiene un solo hallazgo', () => {
        const r = auditarCarpeta(path.join(raiz, ORDENADA));
        expect(r.hallazgos).toEqual([]);
        expect(r.originales).toHaveLength(2);
    });

    it('si le sacan el LEEME, lo dice', () => {
        const a = path.join(raiz, ORDENADA, '.claude', 'LEEME - que hay aca.txt');
        const txt = fs.readFileSync(a);
        fs.rmSync(a);
        expect(codigos(path.join(raiz, ORDENADA))).toContain('SIN_LEEME');
        fs.writeFileSync(a, txt);
    });

    it('una foto NO necesita fotogramas ni transcripcion; un video SI', () => {
        const c = codigos(path.join(raiz, ORDENADA));
        expect(c).not.toContain('VIDEO_SIN_FOTOGRAMAS');
        const suelto = path.join(raiz, ORDENADA, '2026-09-10 - MOLDEADORA - ciclo completo (IMG_0844).MOV');
        tocar(suelto);
        const d = codigos(path.join(raiz, ORDENADA));
        expect(d).toContain('VIDEO_SIN_FOTOGRAMAS');
        expect(d).toContain('VIDEO_SIN_TRANSCRIPCION');
        fs.rmSync(suelto);
    });
});

describe('auditarCarpeta — la desordenada da ROJO, y dice de que', () => {
    it('encuentra cada uno de los defectos reales del 21/09', () => {
        const c = codigos(path.join(raiz, DESORDENADA));
        for (const esperado of ['CARPETA_EN_LA_RAIZ', 'RAIZ_NO_ORIGINAL', 'NOMBRE_FUERA_DE_FORMATO',
            'FECHA_QUE_NO_EXISTE', 'ORIGEN_SIN_DECLARAR', 'TRABAJO_DE_OTRA_MAQUINA', 'SIN_LEEME']) {
            expect(c, esperado).toContain(esperado);
        }
    });

    it('un origen que no es del telefono (WhatsApp, otra persona) NO es un hallazgo', () => {
        const b = path.join(raiz, DESORDENADA);
        const f = path.join(b, '2026-09-11 - MOLDEADORA - HMI (WhatsApp 11-09 9.11).mp4');
        tocar(f);
        expect(codigos(b).filter((x) => x === 'ORIGEN_SIN_DECLARAR')).toHaveLength(1); // solo el `(x)`
        fs.rmSync(f);
    });

    it('un original DECLARADO como faltante deja de ser "de otra maquina"', () => {
        const b = path.join(raiz, DESORDENADA);
        const dec = path.join(b, '.claude', 'ORIGINALES QUE FALTAN.txt');
        expect(codigos(b).filter((x) => x === 'TRABAJO_DE_OTRA_MAQUINA')).toHaveLength(2);
        tocar(dec, 0); fs.writeFileSync(dec, 'IMG_0823\n');
        const c = codigos(b);
        expect(c).not.toContain('TRABAJO_DE_OTRA_MAQUINA');
        expect(c).toContain('ORIGINAL_QUE_FALTA');
        fs.rmSync(dec);
    });

    it('dos archivos GRANDES del mismo tamano son el mismo archivo dos veces', () => {
        const b = path.join(raiz, DESORDENADA);
        const copia = path.join(b, '2026-09-02 - PRENSA - recorrida de pantallas (IMG_0578b).MOV');
        tocar(copia, GRANDE);
        const h = auditarCarpeta(b).hallazgos.filter((x) => x.codigo === 'MISMO_TAMANO');
        expect(h).toHaveLength(1);
        expect(h[0].detalle).toMatch(/es el mismo archivo dos veces/);
        fs.rmSync(copia);
    });

    it('pero dos archivos CHICOS del mismo tamano no son un hallazgo: seria un rojo falso', () => {
        const b = path.join(raiz, DESORDENADA);
        const a1 = path.join(b, '2026-09-02 - MOLDEADORA - captura uno (IMG_0701).PNG');
        const a2 = path.join(b, '2026-09-02 - MOLDEADORA - captura dos (IMG_0702).PNG');
        tocar(a1, 2048); tocar(a2, 2048);
        expect(auditarCarpeta(b).hallazgos.filter((x) => x.codigo === 'MISMO_TAMANO')).toHaveLength(0);
        fs.rmSync(a1); fs.rmSync(a2);
    });

    it('el que nombra el trabajo de otra maquina dice QUE archivo es', () => {
        const h = auditarCarpeta(path.join(raiz, DESORDENADA)).hallazgos
            .filter((x) => x.codigo === 'TRABAJO_DE_OTRA_MAQUINA');
        expect(h).toHaveLength(2);
        expect(h.map((x) => x.archivo).join(' ')).toMatch(/IMG_0823/);
    });
});

describe('las piezas sueltas', () => {
    it('claveDe se queda con la ULTIMA clave del nombre, que es la del telefono', () => {
        expect(claveDe('2026-08-26 - PARAMETROS - rodillos 130 (IMG_0383).MOV')).toBe('IMG_0383');
        expect(claveDe('2026-09-09 - PIZARRA - T1 y T2 (SIQJ5541).JPG')).toBe('SIQJ5541');
        expect(claveDe('2026-09-09 - PIZARRA - enderezada (IMG_E0815).JPG')).toBe('IMG_E0815');
    });

    it('el nombre de la casa exige fecha adelante y clave entre parentesis', () => {
        expect(NOMBRE_DE_LA_CASA.test('2026-09-09 - PIZARRA - tiradas T1 a T10 (IMG_0802).HEIC')).toBe(true);
        expect(NOMBRE_DE_LA_CASA.test('Prensa KingPower - Parte 1 (02-09, 18 min).MOV')).toBe(false);
        expect(NOMBRE_DE_LA_CASA.test('2026-09-09 - sin clave.MOV')).toBe(false);
    });
});
