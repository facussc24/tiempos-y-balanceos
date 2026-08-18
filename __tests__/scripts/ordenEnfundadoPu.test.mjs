/**
 * Tests del check PU_ANTES_DE_ENFUNDADO (rules/amfe.md §12, decidido el 2026-08-18).
 *
 * La regla: en los apoyacabezas el poliuretano se inyecta ADENTRO de la funda ya montada.
 * Se pone la varilla, se enfunda, se carga al molde y recien ahi se espuma. Fak: "es
 * imposible que se inyecte sin la funda, se saldria todo el material".
 *
 * Por que existe este check y no alcanzaba con tenerlo escrito: los AMFE 153 y 155
 * declaraban `50 INYECCION DE PU / 60 ENFUNDADO` — el proceso al reves — y la regla del
 * proyecto AFIRMABA que era correcto ("HRC/HRO: 14 OPs directo a PU") y ademas prohibia
 * tocarlo. La regla se habia redactado describiendo esos mismos documentos, asi que heredo
 * su error y lo protegio durante meses. Un check ejecutable no puede heredar nada: mide.
 *
 * Lo que protege, que es donde el check se vuelve inutil o danino:
 *  - si no mira los numeros de OP sino el orden del array, un doc bien numerado pero mal
 *    ordenado en JSON daria falso positivo (y al reves);
 *  - si se dispara en AMFEs que no espuman, mete ruido en 15 documentos que no tienen nada
 *    que ver y se termina ignorando;
 *  - si matchea "ENFUNDADO" por substring, "REPROCESO: RE-ENFUNDADO" lo confunde.
 */
import { describe, it, expect } from 'vitest';
import { validateOrdenEnfundadoPu, validateNombresDeOperacion } from '../../scripts/_lib/amfeValidator.mjs';

/** Doc minimo con las operaciones que importan. */
function doc(ops) {
    return { operations: ops.map(([opNumber, name]) => ({ opNumber, operationNumber: opNumber, name })) };
}

describe('PU_ANTES_DE_ENFUNDADO', () => {
    it('marca el orden invertido — el caso real de los AMFE 153 y 155', () => {
        const r = validateOrdenEnfundadoPu(doc([
            ['40', 'COSTURA VISTA'],
            ['50', 'INYECCION DE PU'],
            ['60', 'ENFUNDADO'],
            ['70', 'INSERCION DE VARILLA'],
        ]), 'AMFE-HRC-PAT');
        expect(r).toHaveLength(1);
        expect(r[0].type).toBe('PU_ANTES_DE_ENFUNDADO');
        expect(r[0].detail).toMatch(/OP 50.*antes.*OP 60/);
    });

    it('no marca el orden correcto de los traseros, ya corregido', () => {
        expect(validateOrdenEnfundadoPu(doc([
            ['50', 'INSERCION DE VARILLA'],
            ['60', 'ENFUNDADO'],
            ['70', 'INYECCION DE PU'],
        ]), 'AMFE-HRC-PAT')).toHaveLength(0);
    });

    it('no marca el delantero, que enfunda en 50 y espuma en 63', () => {
        expect(validateOrdenEnfundadoPu(doc([
            ['50', 'ENFUNDADO'],
            ['51', 'INSERCION DE VARILLA'],
            ['61', 'COLOCACION DE BOLSA Y CARGA DEL APOYACABEZAS EN EL MOLDE'],
            ['63', 'INYECCION DE PU'],
        ]), 'AMFE-HF-PAT')).toHaveLength(0);
    });

    it('ignora los AMFE que no espuman: no mete ruido donde no aplica', () => {
        expect(validateOrdenEnfundadoPu(doc([
            ['10', 'RECEPCION DE MATERIA PRIMA'],
            ['20', 'CORTE DE COMPONENTES'],
            ['60', 'ENFUNDADO'],
        ]), 'AMFE-INS-PAT')).toHaveLength(0);

        expect(validateOrdenEnfundadoPu(doc([
            ['30', 'ADHESIVADO HOT MELT'],
            ['50', 'INYECCION DE PU'],
        ]), 'AMFE-TR-PAT')).toHaveLength(0);
    });

    it('usa el NUMERO de operacion, no la posicion en el array', () => {
        // Mismo contenido, array desordenado: el veredicto no puede cambiar.
        const desordenado = doc([
            ['70', 'INYECCION DE PU'],
            ['50', 'INSERCION DE VARILLA'],
            ['60', 'ENFUNDADO'],
        ]);
        expect(validateOrdenEnfundadoPu(desordenado, 'X')).toHaveLength(0);

        const malPeroOrdenadoEnElArray = doc([
            ['50', 'INYECCION DE PU'],
            ['60', 'ENFUNDADO'],
        ]);
        expect(validateOrdenEnfundadoPu(malPeroOrdenadoEnElArray, 'X')).toHaveLength(1);
    });

    it('no confunde un reproceso de enfundado con la operacion de enfundado', () => {
        // "REPROCESO: RE-ENFUNDADO" va DESPUES del espumado a proposito: es un retrabajo.
        // Si el check lo tomara como el enfundado de linea, marcaria todos los AMFE buenos.
        expect(validateOrdenEnfundadoPu(doc([
            ['50', 'INSERCION DE VARILLA'],
            ['60', 'ENFUNDADO'],
            ['70', 'INYECCION DE PU'],
            ['91', 'REPROCESO: RE-ENFUNDADO DE FUNDA'],
        ]), 'X')).toHaveLength(0);
    });

    it('no explota con numeros vacios o no numericos', () => {
        expect(validateOrdenEnfundadoPu(doc([
            ['', 'INYECCION DE PU'],
            ['60', 'ENFUNDADO'],
        ]), 'X')).toHaveLength(0);
        expect(validateOrdenEnfundadoPu({ operations: [] }, 'X')).toHaveLength(0);
    });
});

/**
 * Tests de OP_NOMBRE_DUPLICADO.
 *
 * Nace junto con el cambio de `issueKey()` a identificar por NOMBRE (18/08/2026). Ese
 * cambio es seguro mientras no haya dos operaciones homonimas en un AMFE — medido ese dia
 * sobre los 17 AMFE: cero. Este check es lo que nos avisa el dia que deje de ser cierto,
 * en vez de que lo descubramos porque un gate dejo pasar algo.
 */
describe('OP_NOMBRE_DUPLICADO', () => {
    it('marca dos operaciones con el mismo nombre', () => {
        const r = validateNombresDeOperacion({
            operations: [
                { opNumber: '20', name: 'CORTE DE COMPONENTES' },
                { opNumber: '50', name: 'COSTURA UNION' },
                { opNumber: '70', name: 'corte de componentes' },   // homonima, distinta caja
            ],
        }, 'X');
        expect(r).toHaveLength(1);
        expect(r[0].type).toBe('OP_NOMBRE_DUPLICADO');
        expect(r[0].detail).toMatch(/OP 70 y la OP 20/);
    });

    it('no marca nada cuando todos los nombres son distintos', () => {
        expect(validateNombresDeOperacion({
            operations: [
                { opNumber: '10', name: 'RECEPCION DE MATERIA PRIMA' },
                { opNumber: '20', name: 'CORTE DE COMPONENTES' },
                { opNumber: '30', name: 'COSTURA UNION' },
            ],
        }, 'X')).toHaveLength(0);
    });

    it('ignora las operaciones sin nombre en vez de agruparlas como homonimas', () => {
        // Dos operaciones sin nombre no son "la misma": son otro defecto, que ya cazan
        // otros checks. Agruparlas aca seria ruido.
        expect(validateNombresDeOperacion({
            operations: [{ opNumber: '10', name: '' }, { opNumber: '20', name: '   ' }],
        }, 'X')).toHaveLength(0);
    });
});
