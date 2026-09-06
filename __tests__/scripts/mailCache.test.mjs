/**
 * Tests de `_lib/mailCache.mjs` — el barrido Bandeja↔Escritorio del relevador.
 *
 * Lo que tienen que garantizar: que el aviso "mail sin carpeta" SIRVA en las dos
 * direcciones. Si el matching es muy laxo, un pedido real queda tapado por una carpeta que
 * matcheo de casualidad (el costo caro: eso es exactamente el pedido invisible que el
 * barrido existe para destapar). Si es muy estricto, la lista se llena de hilos que si
 * tienen carpeta y nadie la lee. Los vectores salen de los casos reales de los
 * relevamientos del 14/08 y 19/08/2026 y de la primera corrida real (30/08/2026).
 *
 * Vectores:
 *   1-4    normalizarTexto / raiz / tokensSignificativos
 *   5-9    matcheaTarea: 2 comunes, 1 distintivo (numero o largo), 1 comun NO alcanza
 *  10-11   claveHilo: RV/RE/FW apilados
 *  12-13   esRuido: no-reply y cumpleaños; un pedido real NO es ruido
 *  14-15   tipoCarpeta
 *  16-19   cruzarMailsConTareas: pedido invisible detectado, tarea existente suprimida,
 *          hilo deduplicado, borradores/salida separados
 *  20      el control en ROJO: sacar la carpeta hace aparecer el mail (el mismo cruce
 *          que en verde lo suprime — un control que no da rojo contra un caso rojo
 *          no detecta nada)
 */
import { describe, it, expect } from 'vitest';

import {
    normalizarTexto, raiz, tokensSignificativos, matcheaTarea, claveHilo,
    esRuido, tipoCarpeta, cruzarMailsConTareas, fechaCorte,
} from '../../scripts/_lib/mailCache.mjs';

const mail = (extra) => ({
    fecha: '2026-08-28 10:00',
    carpeta: 'f.santoro@barackmercosul.com / Bandeja de entrada',
    de: 'Carlos Baptista',
    de_mail: 'c.baptista@barackmercosul.com',
    para: 'Facundo Santoro',
    asunto: '',
    adjuntos: 0,
    ...extra,
});

describe('normalizacion y tokens', () => {
    it('1. saca tildes, puntuacion y mayusculas', () => {
        expect(normalizarTexto('RV: Alta código Caimarí — ¡urgente!')).toBe('rv alta codigo caimari urgente');
    });

    it('2. raiz: plural simple y en -es, sin tocar tokens con numero', () => {
        expect(raiz('topes')).toBe('tope');
        expect(raiz('operaciones')).toBe('operacion');
        expect(raiz('6as')).toBe('6as');
        expect(raiz('mes')).toBe('mes');  // corto: no llega al minimo de 4 para el recorte
    });

    it('3. tokensSignificativos tira stopwords y restos de 1-2 letras', () => {
        expect(tokensSignificativos('RE: la solicitud de Leo')).toEqual(['solicitud', 'leo']);
    });

    it('4. conserva tokens cortos con numero (3d, 6a: son señal, no resto)', () => {
        expect(tokensSignificativos('impresion 3d del tope 6a')).toContain('3d');
        expect(tokensSignificativos('impresion 3d del tope 6a')).toContain('6a');
    });
});

describe('matcheaTarea', () => {
    const t = tokensSignificativos;

    it('5. dos tokens en comun alcanzan (caso Caimari, 14/08)', () => {
        expect(matcheaTarea(t('Alta código Caimari'), t('Nuevo código caimari o ya tiene'))).toBe(true);
    });

    it('6. un solo token largo (apellido/producto) alcanza', () => {
        expect(matcheaTarea(t('consulta caimari'), t('Nuevo codigo caimari'))).toBe(true);
    });

    it('7. un solo token con numero (part number) alcanza', () => {
        expect(matcheaTarea(t('cambio descripcion ASG1050-2'), t('ASG1050-2 nueva descripcion NC IATF'))).toBe(true);
    });

    it('8. una sola palabra comun NO alcanza: mejor listar de mas que tapar un pedido', () => {
        expect(matcheaTarea(t('plano nuevo del cliente'), t('Nuevo codigo caimari'))).toBe(false);
    });

    it('9. plural no rompe el match (TOPE TOP ROLL vs Topes... 19/08)', () => {
        expect(matcheaTarea(t('TOPE TOP ROLL 6A Y 6B para imprimir'), t('TOPE TOP ROLL 6A Y 6B'))).toBe(true);
    });
});

describe('hilos y ruido', () => {
    it('10. claveHilo pela RV/RE/FW apilados', () => {
        expect(claveHilo('RV: RE: Rv: Tope top roll')).toBe('tope top roll');
    });

    it('11. dos mails del mismo hilo comparten clave aunque uno tenga prefijo', () => {
        expect(claveHilo('RE: AMFE DUCTOS')).toBe(claveHilo('AMFE DUCTOS'));
    });

    it('12. no-reply y cumpleaños son ruido (3 de 11 hilos en la corrida real del 30/08)', () => {
        expect(esRuido(mail({ de_mail: 'no-reply@sap.vwgroupsupply.com' }))).toBe(true);
        expect(esRuido(mail({ asunto: 'Felíz Cumpleaños Marianna' }))).toBe(true);
    });

    it('13. un pedido real de una persona NO es ruido', () => {
        expect(esRuido(mail({ asunto: 'RV: Factibilidades' }))).toBe(false);
    });

    it('14. tipoCarpeta distingue entrada, borradores y salida', () => {
        expect(tipoCarpeta('x / Bandeja de entrada')).toBe('entrada');
        expect(tipoCarpeta('x / Borradores')).toBe('borradores');
        expect(tipoCarpeta('x / Bandeja de salida')).toBe('salida');
    });

    it('15. Enviados y Eliminados quedan afuera del barrido', () => {
        expect(tipoCarpeta('x / Elementos enviados')).toBe('otro');
        expect(tipoCarpeta('x / Elementos eliminados')).toBe('otro');
    });
});

describe('cruzarMailsConTareas', () => {
    const tareas = [
        'Nuevo código caimari o ya tiene',
        'Ductos - alinear HO con flujograma 158',
        'Topes de Pablo - pasarle las observaciones del 3D',
    ];

    it('16. un pedido sin carpeta aparece; uno con carpeta no', () => {
        const { sinCarpeta } = cruzarMailsConTareas([
            mail({ asunto: 'ESTANTERIA DE CAJAS', de: 'Pablo Gamboa' }),
            mail({ asunto: 'RE: Alta codigo caimari' }),
        ], tareas);
        expect(sinCarpeta.map((h) => h.asunto)).toEqual(['ESTANTERIA DE CAJAS']);
    });

    it('17. un hilo entero es UNA linea, con el mail mas nuevo adelante', () => {
        const { sinCarpeta } = cruzarMailsConTareas([
            mail({ asunto: 'TEMPLATE', fecha: '2026-08-25 09:00' }),
            mail({ asunto: 'RE: TEMPLATE', fecha: '2026-08-26 14:00' }),
            mail({ asunto: 'RV: RE: TEMPLATE', fecha: '2026-08-24 08:00' }),
        ], tareas);
        expect(sinCarpeta).toHaveLength(1);
        expect(sinCarpeta[0].mails).toBe(3);
        expect(sinCarpeta[0].fecha).toBe('2026-08-26 14:00');
    });

    it('18. borradores y bandeja de salida van a noAvisados, no a sinCarpeta', () => {
        const { sinCarpeta, noAvisados } = cruzarMailsConTareas([
            mail({ asunto: 'Difusion BOM', carpeta: 'x / Borradores' }),
            mail({ asunto: 'Difusion BOM 2', carpeta: 'x / Bandeja de salida' }),
        ], tareas);
        expect(sinCarpeta).toHaveLength(0);
        expect(noAvisados.map((m) => m.tipo).sort()).toEqual(['borradores', 'salida']);
    });

    it('19. el ruido no ensucia la lista', () => {
        const { sinCarpeta } = cruzarMailsConTareas([
            mail({ asunto: 'Feliz Cumpleaños Pedro' }),
            mail({ asunto: 'aviso', de_mail: 'noreply@algo.com' }),
        ], tareas);
        expect(sinCarpeta).toHaveLength(0);
    });

    it('20. EN ROJO: sacar la carpeta hace aparecer el mismo mail que en verde se suprime', () => {
        const pedido = [mail({ asunto: 'RE: Alta codigo caimari' })];
        expect(cruzarMailsConTareas(pedido, tareas).sinCarpeta).toHaveLength(0);
        const sinLaTarea = tareas.filter((t) => !t.includes('caimari'));
        expect(cruzarMailsConTareas(pedido, sinLaTarea).sinCarpeta).toHaveLength(1);
    });
});

describe('fechaCorte', () => {
    it('resta dias en ISO', () => {
        expect(fechaCorte(10, Date.UTC(2026, 7, 30, 12))).toBe('2026-08-20');
    });
    it('cuenta en dia LOCAL: a las 23:30 de Argentina el dia UTC ya es el siguiente y el corte no se corre', () => {
        // new Date(a, m, d, h) es hora local en cualquier zona: acá y en el runner de CI (UTC) da lo mismo.
        expect(fechaCorte(10, new Date(2026, 7, 30, 23, 30).getTime())).toBe('2026-08-20');
        expect(fechaCorte(0, new Date(2026, 8, 5, 21, 33).getTime())).toBe('2026-09-05');
    });
});
