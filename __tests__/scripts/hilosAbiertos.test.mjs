/**
 * Tests de `scripts/_lib/hilosAbiertos.mjs` (08/10/2026): los mails de un hilo que una tarea abierta
 * del Escritorio no tiene. Caso que lo origino: el segundo mail de Carlos con el consumo correcto.
 */
import { describe, it, expect } from 'vitest';
import {
    fechaMs, clavesDeTarea, ultimaFechaMsg, mailsNuevosDelHilo, cruzarTareas, textoHook, textoDetalle,
} from '../../scripts/_lib/hilosAbiertos.mjs';

const msg = (asunto, fecha, de = 'Carlos Baptista') => ({ asunto, de, fecha });
const mail = (asunto, fecha, de = 'Carlos Baptista', carpeta = 'f.santoro@barackmercosul.com / Bandeja de entrada') => ({ asunto, fecha, de, de_mail: '', carpeta });

describe('fechas y claves', () => {
    it('fechaMs lee la fecha del cache (AAAA-MM-DD HH:MM) y la ISO de un .msg', () => {
        expect(fechaMs('2026-10-06 14:08')).toBe(new Date(2026, 9, 6, 14, 8).getTime());
        expect(fechaMs('2026-10-06')).toBe(new Date(2026, 9, 6).getTime());
        expect(Number.isFinite(fechaMs('2026-10-06T17:08:00.000Z'))).toBe(true);
        expect(fechaMs('')).toBeNaN();
        expect(fechaMs(null)).toBeNaN();
    });

    it('clavesDeTarea saca RE/RV y junta los asuntos; un asunto vacio no define hilo', () => {
        const c = clavesDeTarea([msg('RV: RE: Consumo Sika Top Roll', '2026-10-05 10:00'), msg('', '2026-10-05 10:00'), msg('Consumo Sika Top Roll', '2026-10-05 09:00')]);
        expect([...c]).toEqual(['consumo sika top roll']);
    });

    it('ultimaFechaMsg es la del .msg mas nuevo; 0 si ninguno tiene fecha', () => {
        expect(ultimaFechaMsg([msg('a', '2026-10-05 10:00'), msg('b', '2026-10-06 08:00')])).toBe(new Date(2026, 9, 6, 8, 0).getTime());
        expect(ultimaFechaMsg([msg('a', '')])).toBe(0);
    });
});

describe('mailsNuevosDelHilo — el caso de Carlos y el consumo', () => {
    const claves = clavesDeTarea([msg('Consumo Sika Top Roll', '2026-10-05 10:00')]);
    const desde = ultimaFechaMsg([msg('Consumo Sika Top Roll', '2026-10-05 10:00')]);
    const mails = [
        mail('Consumo Sika Top Roll', '2026-10-05 10:00'),                 // el mismo que esta en la carpeta
        mail('RE: Consumo Sika Top Roll', '2026-10-06 14:08'),             // el segundo mail: la correccion
        mail('RE: Consumo Sika Top Roll', '2026-10-06 15:00', 'Facundo Santoro'),
        mail('Otro tema', '2026-10-07 09:00'),
        mail('RE: Consumo Sika Top Roll', '2026-10-07 09:00', 'noreply@sistema'), // ruido
    ];

    it('devuelve los del mismo hilo posteriores al ultimo .msg, ordenados, sin el que ya esta ni el ruido', () => {
        const r = mailsNuevosDelHilo({ claves, desde, mails });
        expect(r.map((m) => m.fecha)).toEqual(['2026-10-06 14:08', '2026-10-06 15:00']);
    });

    it('sin claves no devuelve nada (una tarea sin .msg con asunto no se cruza)', () => {
        expect(mailsNuevosDelHilo({ claves: new Set(), desde, mails })).toEqual([]);
    });

    it('un mail del hilo con la misma fecha (segundos de diferencia) no cuenta como nuevo', () => {
        const r = mailsNuevosDelHilo({ claves, desde, mails: [mail('RE: Consumo Sika Top Roll', '2026-10-05 10:00')] });
        expect(r).toEqual([]);
    });
});

describe('cruzarTareas y textos', () => {
    const tareas = [
        { nombre: 'Sika Top Roll - consumo - Carlos 05-10', msgs: [msg('Consumo Sika Top Roll', '2026-10-05 10:00')] },
        { nombre: 'Tarea sin novedades', msgs: [msg('Plan de control APB', '2026-10-01 08:00')] },
        { nombre: 'Vieja en espera', enEspera: true, msgs: [msg('Hilo naranja P21', '2026-09-07 08:00')] },
        { nombre: 'Sin msg', msgs: [] },
    ];
    const mails = [
        mail('RE: Consumo Sika Top Roll', '2026-10-06 14:08'),
        mail('RE: Hilo naranja P21', '2026-09-20 11:00', 'Pablo Gamboa'),
        mail('Plan de control APB', '2026-10-01 08:00', 'Nicolas Perez'),
    ];

    it('solo las tareas con mails nuevos, la mas reciente primero', () => {
        const c = cruzarTareas(tareas, mails);
        expect(c.map((t) => t.nombre)).toEqual(['Sika Top Roll - consumo - Carlos 05-10', 'Vieja en espera']);
        expect(c[0].nuevos).toHaveLength(1);
        expect(c[1].enEspera).toBe(true);
    });

    it('textoHook: vacio si no hay nada; si hay, encabezado + una linea por tarea con el ultimo mail', () => {
        expect(textoHook([])).toBe('');
        const t = textoHook(cruzarTareas(tareas, mails));
        expect(t).toMatch(/^\[HILOS ABIERTOS — 2 tarea/);
        expect(t).toMatch(/Sika Top Roll - consumo - Carlos 05-10: 1 mail nuevo desde el 05\/10 · ultimo 06\/10 de Carlos Baptista/);
        expect(t).toMatch(/\(en _EN ESPERA\)/);
        expect(t.split('\n')).toHaveLength(3);
    });

    it('textoHook recorta a `tope` tareas y dice cuantas quedan afuera', () => {
        const muchas = Array.from({ length: 10 }, (_, i) => ({ nombre: `T${i}`, msgs: [msg(`Asunto ${i}`, '2026-10-01 08:00')] }));
        const ms = muchas.map((t, i) => mail(`RE: Asunto ${i}`, '2026-10-02 08:00'));
        const t = textoHook(cruzarTareas(muchas, ms), { tope: 3 });
        expect(t.split('\n')).toHaveLength(5);
        expect(t).toMatch(/y 7 mas/);
    });

    it('textoDetalle lista cada mail con fecha, remitente y asunto', () => {
        const t = textoDetalle(cruzarTareas(tareas, mails));
        expect(t).toMatch(/2026-10-06 14:08\s+Carlos Baptista\s+RE: Consumo Sika Top Roll/);
        expect(textoDetalle([])).toMatch(/ninguna tarea/);
    });
});
