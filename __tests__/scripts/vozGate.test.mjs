/**
 * Tests de `_lib/vozGate.mjs` — que el mail que sale a nombre de Fak suene a Fak.
 *
 * POR QUE ESTOS VECTORES Y NO OTROS
 *   El gate nacio porque Fak me corrigio dos veces lo mismo: *"revise porque revisamos, yo
 *   revise"* (11/09/2026) y al dia siguiente *"cuando envio un mail siempre pongo 'hice el
 *   amfe', no 'logramos'"*. La trampa de un gate asi es facil de caer y dificil de ver:
 *   **prohibir todo plural**. En el corpus real (1.549 enviados) hay 26 usos de 1a persona
 *   del plural y **22 los escribio Fak** — un gate que los marque no mide a Fak, mide mi
 *   idea de Fak. Por eso la mitad de los vectores de aca son mails SUYOS que tienen que dar
 *   VERDE, sacados textuales del cache.
 *
 * Vectores:
 *   1-3    ROJO: los tres mails mios que salieron en plural (01/09, 07/09, 11/09/2026)
 *   4-7    VERDE: los cuatro plurales legitimos de Fak (tercero nombrado, propuesta,
 *          "les informamos", "queria informarles")
 *   8-9    VERDE: sus dos formas tipicas (una linea; primera persona del singular)
 *  10      VERDE: el plural en subordinada ("los tiempos que hicimos") — mail real suyo
 *  11-14   ROJO: giro de informe, formula formal, impersonal "se procedio", tabla
 *  15-18   AMARILLO: largo sobre p90, vinetas, cierre ajeno, condicional de recomendacion
 *  19      cuerpoPropio: corta la firma y el mail citado
 *  20      primeraOracion: el saludo con nombres NO se come la primera palabra
 *          (el bug que hacia dar verde justo a los dos mails que motivaron el gate)
 *  21      el control en ROJO: si se saca la exencion, el mail de Fak se enciende — un
 *          gate que no puede dar rojo contra un caso rojo no esta midiendo nada
 *  22-23   el guardian del hook, en las dos direcciones
 *  24-25   cuerpo HTML (`cuerpo_html` / `HTMLBody`): se mide el TEXTO, no el marcado —
 *          y la tabla de verdad adentro del HTML sigue dando rojo
 */
import { describe, it, expect } from 'vitest';
import { revisarVoz, cuerpoPropio, primeraOracion, ROJO, AMARILLO } from '../../scripts/_lib/vozGate.mjs';
import { GUARDIANES, ctxDesdeEnv } from '../../scripts/_lib/guardianes.mjs';

const codigos = (texto) => revisarVoz(texto).hallazgos.map((h) => h.codigo);
const rojos = (texto) => revisarVoz(texto).hallazgos.filter((h) => h.nivel === ROJO).map((h) => h.codigo);
const amarillos = (texto) => revisarVoz(texto).hallazgos.filter((h) => h.nivel === AMARILLO).map((h) => h.codigo);

describe('vozGate — los mails mios que Fak tuvo que corregir dan ROJO', () => {
    it('1. "Actualizamos en INCA…" (enviado 01/09/2026 a Carlos y Leo)', () => {
        expect(rojos('Carlos, Leo,\n\nActualizamos en INCA la capacidad del apoyabrazos trasero central.\n\nSaludos'))
            .toContain('PLURAL_APERTURA');
    });

    it('2. "Corregimos en el arb…" (enviado 07/09/2026 a Pablo)', () => {
        expect(rojos('Pablo,\n\nCorregimos en el arb el punzonado de dos piezas de 100 grs/m2.\n\nSaludos'))
            .toContain('PLURAL_APERTURA');
    });

    it('3. "Revisamos a fondo los AMFE…" (el del 11/09/2026 que origino la regla)', () => {
        expect(rojos('Estimados,\n\nRevisamos a fondo los AMFE y los flujogramas que mande el 08/09.\n\nSaludos'))
            .toContain('PLURAL_APERTURA');
    });
});

describe('vozGate — el plural de Fak es suyo y tiene que pasar', () => {
    it('4. con un tercero nombrado: "Junto con Paulo Centurion y Nicolas Perez, hicimos…"', () => {
        expect(rojos('Buenos dias, Junto con Paulo Centurion y Nicolas Perez, hicimos modificaciones en el Top Roll de P703.'))
            .toHaveLength(0);
    });

    it('5. propuesta a futuro: "avisame y lo revisamos juntos"', () => {
        expect(rojos('Si al revisarlo detectas algun detalle que quisieras cambiar o ajustar, avisame y lo revisamos juntos.'))
            .toHaveLength(0);
    });

    it('6. el area informando: "Les informamos que actualizamos el AMFE"', () => {
        expect(rojos('Buenas tardes, Les informamos que actualizamos el AMFE de Proceso y las hojas de proceso asociadas.'))
            .toHaveLength(0);
    });

    it('7. "Queria informarles que ya cargamos la nueva tizada"', () => {
        expect(rojos('Hola, Queria informarles que ya cargamos la nueva tizada en la mesa de corte.')).toHaveLength(0);
    });

    it('8. su mail tipico de una linea', () => {
        expect(revisarVoz('Adjunto tambien el flujograma actualizado.').rojos).toBe(0);
    });

    it('9. primera persona del singular, que es lo que se busca', () => {
        const r = revisarVoz('Buen dia, Actualice el arb con los consumos del P703. Adjunto el extracto de las 10 piezas. Saludos.');
        expect(r.rojos).toBe(0);
    });

    it('10. plural en subordinada: "los archivos de tiempos que hicimos recien"', () => {
        expect(rojos('Maxi te envio los archivos de tiempos que hicimos recien.')).toHaveLength(0);
    });
});

describe('vozGate — las marcas de que el mail lo escribi yo', () => {
    it('11. el giro "Tres cosas para mirar:" (0 de 954 mails de Fak)', () => {
        expect(rojos('Manuel,\n\nTe paso el estado del PPAP.\n\nTres cosas para mirar:\n')).toContain('GIRO_N_COSAS');
    });

    it('12. formula formal que el nunca usa', () => {
        expect(rojos('Estimados, adjunto el AMFE corregido. Cordialmente,')).toContain('FORMULA_FORMAL');
    });

    it('13. impersonal de informe "se procedio a"', () => {
        expect(rojos('Se procedio a corregir el punzonado de las dos piezas.')).toContain('SE_DE_INFORME');
    });

    it('14. tabla en el cuerpo del mail', () => {
        expect(rojos('Te paso el detalle:\n\n| Pieza | Consumo |\n| 21-9689 | 0,18 |\n')).toContain('TABLA_EN_EL_CUERPO');
    });

    it('15. mas largo que el p90 suyo: avisa, no bloquea', () => {
        const largo = 'Buen dia, ' + 'te cuento el detalle de la pieza y su consumo actualizado. '.repeat(14);
        const r = revisarVoz(largo);
        expect(amarillos(largo)).toContain('LARGO_SOBRE_P90');
        expect(r.rojos).toBe(0);
    });

    it('16. vinetas: 0 de 954 mails suyos las usan', () => {
        expect(amarillos('Te paso dos temas:\n\n- El primero.\n- El segundo.\n')).toContain('VINETAS');
    });

    it('17. cierre que no es suyo ("Abrazo")', () => {
        expect(amarillos('Carlos, te paso el LSR con los puntos cargados.\n\nAbrazo')).toContain('CIERRE_AJENO');
    });

    it('18. condicional de recomendacion ("convendria")', () => {
        expect(amarillos('Convendria bajarlos del BeOn antes de mandarlos.')).toContain('CONDICIONAL_DE_RECOMENDACION');
    });
});

describe('vozGate — el texto que se mide', () => {
    it('19. cuerpoPropio corta la firma de Outlook y el mail citado', () => {
        const crudo = 'Adjunto el extracto.\n\nSaludos,\n\nFacundo Santoro\nIngenieria\n\nDe: Carlos Baptista\nAsunto: RE: BOM';
        expect(cuerpoPropio(crudo)).toBe('Adjunto el extracto.\n\nSaludos,');
    });

    it('20. el saludo con nombres no se come la primera palabra de la oracion', () => {
        // El bug de la primera version: con [,: ] como cierre del nombre, "Carlos, Leo,
        // Actualizamos en INCA" perdia "Actualizamos" y el gate daba VERDE al mail que
        // justamente lo motivo.
        expect(primeraOracion('Carlos, Leo, Actualizamos en INCA la capacidad')).toMatch(/^Actualizamos/);
        expect(primeraOracion('Buen dia Pablo, fijate que ya subi la ultima version')).toMatch(/^fijate/);
    });

    it('22. el guardian avisa al escribir un borrador _mail*.txt con plural', () => {
        const ctx = ctxDesdeEnv({
            HOOK_PARSED4: ['Write', '', 'C:/tarea/_mail LISTO PARA ENVIAR - aviso.txt',
                'Carlos,\n\nCorregimos en el arb el punzonado.\n\nSaludos'].join('\x1f'),
        });
        const res = GUARDIANES['mail-guard'](ctx, { env: {} });
        expect(res?.tipo).toBe('aviso');
        expect(res.texto).toMatch(/PLURAL_APERTURA/);
    });

    it('23. …y NO avisa cuando el borrador ya suena a Fak (el mismo camino, en verde)', () => {
        const ctx = ctxDesdeEnv({
            HOOK_PARSED4: ['Write', '', 'C:/tarea/_mail LISTO PARA ENVIAR - aviso.txt',
                'Carlos,\n\nCorregi en el arb el punzonado de dos piezas.\n\nSaludos'].join('\x1f'),
        });
        expect(GUARDIANES['mail-guard'](ctx, { env: {} })).toBeNull();
    });

    it('24. un cuerpo HTML se mide como texto, no como marcado', () => {
        // `_prepararMail.py` acepta `cuerpo_html` y Outlook devuelve `HTMLBody`. Midiendo el
        // marcado, los tags cuentan como largo: esta firma sola pasa los 2.500 caracteres de
        // LARGO_TESTAMENTO y el mail no sale por algo que el destinatario ni ve.
        const firma = '<table>' + '<tr><td style="font-family:Segoe UI;font-size:10pt;color:#444">Barack</td></tr>'.repeat(35) + '</table>';
        const html = `<html><body><p>Pablo,</p><p>Adjunto el extracto.</p>${firma}</body></html>`;
        expect(html.length).toBeGreaterThan(2500);
        expect(cuerpoPropio(html)).toMatch(/^Pablo,\s+Adjunto el extracto\./);
        expect(rojos(html)).not.toContain('LARGO_TESTAMENTO');
    });

    it('25. …y la tabla de verdad adentro del HTML sigue dando ROJO', () => {
        const html = '<p>Te paso el detalle:</p><table><tr><td>Pieza</td><td>Consumo</td></tr>'
            + '<tr><td>21-9689</td><td>0,18</td></tr></table>';
        expect(rojos(html)).toContain('TABLA_EN_EL_CUERPO');
    });

    it('21. EN ROJO: sin la frase que lo exime, el mismo mail de Fak se enciende', () => {
        const conTercero = 'Buenos dias, Junto con Paulo Centurion, hicimos modificaciones en el Top Roll.';
        const sinTercero = 'Buenos dias, Hicimos modificaciones en el Top Roll.';
        expect(rojos(conTercero)).toHaveLength(0);
        expect(rojos(sinTercero)).toContain('PLURAL_APERTURA');
    });
});
