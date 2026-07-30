/**
 * Tests de caracterizacion de utils/db/sqlTranslate.ts
 *
 * PRIMER test que existe sobre el traductor de SQL que corre en produccion.
 * Hasta el 2026-07-30 los 3329 tests de la suite corrian contra InMemoryAdapter,
 * que NUNCA se ejecuta en produccion: `SupabaseAdapter` (el unico adaptador real)
 * no tenia ni un test. `inlineParams` es el ultimo paso antes de mandar el SQL al
 * RPC `exec_sql_write` / `exec_sql_read`, asi que un error aca no lo atrapa nadie.
 *
 * Todos los datos de este archivo son FICTICIOS a proposito (el repo es publico).
 */

import { describe, it, expect } from 'vitest';
import { inlineParams, sqlLiteral } from '../../../utils/db/sqlTranslate';

/** Cuenta cuantas veces aparece `sub` dentro de `texto` (sin regex, sin escapes). */
function contarOcurrencias(texto: string, sub: string): number {
    return texto.split(sub).length - 1;
}

// ---------------------------------------------------------------------------
// El bug historico (arreglado 2026-07-30) — el test mas importante del archivo
// ---------------------------------------------------------------------------

describe('inlineParams — bug historico: un $N que viene DENTRO de un dato', () => {
    /**
     * QUE PASABA ANTES:
     * la version vieja vivia dentro de SupabaseAdapter y sustituia iterando los
     * parametros en ORDEN INVERSO con `replaceAll('$' + (i + 1), literal)`.
     * El orden inverso resolvia bien `$10` antes que `$1`, pero cada iteracion
     * volvia a mirar el texto YA sustituido. Entonces el `$1` que venia adentro
     * del DATO (no de la plantilla) tambien matcheaba, y en la ultima iteracion
     * se lo comia el valor de $1:
     *
     *   data = '{"desc":"tolerancia 'fak' mm"}'   <-- SQL roto / inyectable
     *
     * Con `replace(/\$(\d+)/g, fn)` el string original se recorre una sola vez,
     * de izquierda a derecha, y lo insertado nunca se re-inspecciona.
     *
     * SI ESTE TEST FALLA: volvio el bug de sustitucion en cascada. Cualquier
     * guardado de AMFE cuyo contenido mencione "$1" corrompe el SQL.
     */
    const sql = 'UPDATE amfe_documents SET updated_by = $1, data = $2, checksum = $3 WHERE id = $4';
    const params = ['fak', '{"desc":"tolerancia $1 mm"}', 'abc', 'doc-9'];

    it('deja el $1 de adentro del dato INTACTO y no lo cambia por el valor de $1', () => {
        const out = inlineParams(sql, params);

        // El marcador que viene en el DATO sobrevive tal cual
        expect(out).toContain('tolerancia $1 mm');
        // Y no quedo pisado por el valor de $1
        expect(out).not.toContain('tolerancia fak mm');
        expect(out).not.toContain("tolerancia 'fak' mm");
    });

    it('inserta el valor de $1 una sola vez (no dos) aunque el dato contenga la cadena "$1"', () => {
        const out = inlineParams(sql, params);
        expect(contarOcurrencias(out, "'fak'")).toBe(1);
    });

    it('produce el SQL completo exacto, con cada parametro en su lugar', () => {
        expect(inlineParams(sql, params)).toBe(
            'UPDATE amfe_documents SET updated_by = \'fak\', '
            + 'data = \'{"desc":"tolerancia $1 mm"}\', '
            + "checksum = 'abc' WHERE id = 'doc-9'"
        );
    });
});

// ---------------------------------------------------------------------------
// El caso REAL de produccion: saveAmfeDocument (amfeRepository.ts ~303-326)
// ---------------------------------------------------------------------------

describe('inlineParams — caso real de produccion: saveAmfeDocument', () => {
    /**
     * Plantilla real de `saveAmfeDocument` DESPUES de convertPlaceholders()
     * (los `?` de SQLite ya pasaron a $1..$24). Son 24 parametros y el JSON
     * completo del AMFE viaja como $22, detras de 21 parametros: ahi es donde
     * el bug pegaba, porque un AMFE menciona plata en pesos todo el tiempo
     * ("$1", "$10", "$1.500") y esos prefijos matcheaban con la plantilla.
     */
    const SQL_SAVE_AMFE = `INSERT INTO amfe_documents
             (id, amfe_number, project_name, subject, client, part_number, responsible,
              organization, status, operation_count, cause_count, ap_h_count, ap_m_count,
              coverage_percent, start_date, last_revision_date,
              created_at, updated_at, created_by, updated_by, modified_by_type,
              data, revisions, checksum)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                     COALESCE((SELECT created_at FROM amfe_documents WHERE id = $17), NOW()),
                     NOW(),
                     COALESCE((SELECT created_by FROM amfe_documents WHERE id = $18), $19),
                     $20, $21,
                     $22, $23, $24)`;

    // Documento de prueba OBVIAMENTE ficticio, con los 3 textos peligrosos adentro.
    const amfeJsonFicticio = JSON.stringify({
        header: {
            subject: 'PIEZA DE PRUEBA FICTICIA',
            partNumber: 'ZZZ-000-000',
            responsible: "O'Higgins (ficticio)",
        },
        operations: [
            { desc: 'tolerancia $1 mm segun plano ficticio' },
            { desc: 'scrap estimado $10 por pieza' },
            { desc: 'herramental ficticio $1.500' },
        ],
    });

    /** Los 24 parametros en el mismo orden que los manda saveAmfeDocument. */
    function armarParams(dataJson: string): unknown[] {
        return [
            'doc-ficticio-0001', 'AMFE-000', 'PROYECTO FICTICIO',       // $1  $2  $3
            'PIEZA DE PRUEBA FICTICIA', 'CLIENTE-FICTICIO', 'ZZZ-000-000', // $4  $5  $6
            'Responsable Ficticio', 'ORG FICTICIA', 'draft',            // $7  $8  $9
            3, 7, 2, 1,                                                 // $10 $11 $12 $13
            85, '2026-01-01', '2026-01-02',                              // $14 $15 $16
            'doc-ficticio-0001', 'doc-ficticio-0001', 'tester@ejemplo.invalid', // $17 $18 $19
            'tester@ejemplo.invalid', 'user',                            // $20 $21
            dataJson, '[]', 'checksum-ficticio-abc123',                  // $22 $23 $24
        ];
    }

    it('no corrompe los precios en pesos $1, $10 ni $1.500 que vienen dentro del JSON del AMFE', () => {
        const out = inlineParams(SQL_SAVE_AMFE, armarParams(amfeJsonFicticio));

        expect(out).toContain('tolerancia $1 mm segun plano ficticio');
        expect(out).toContain('scrap estimado $10 por pieza');
        expect(out).toContain('herramental ficticio $1.500');
    });

    it('no filtra el valor de $1 ni de $10 dentro del JSON del AMFE', () => {
        const out = inlineParams(SQL_SAVE_AMFE, armarParams(amfeJsonFicticio));

        // $1 = 'doc-ficticio-0001' se usa en $1, $17 y $18 → exactamente 3 veces
        expect(contarOcurrencias(out, "'doc-ficticio-0001'")).toBe(3);
        // $10 = 3 (operation_count). Si se hubiera filtrado adentro del JSON
        // aparecerian textos como "tolerancia 3 mm" o "scrap estimado 3 por pieza"
        expect(out).not.toContain('tolerancia 3 mm');
        expect(out).not.toContain('scrap estimado 3 por pieza');
    });

    it('escapa el apostrofo del JSON del AMFE duplicandolo, sin cortar el literal', () => {
        const out = inlineParams(SQL_SAVE_AMFE, armarParams(amfeJsonFicticio));
        expect(out).toContain("O''Higgins (ficticio)");
        expect(out).not.toContain("O'Higgins (ficticio)");
    });

    it('resuelve los parametros que van DESPUES del JSON ($23 revisions y $24 checksum) sin corrimiento', () => {
        const out = inlineParams(SQL_SAVE_AMFE, armarParams(amfeJsonFicticio));
        expect(out).toContain("'[]', 'checksum-ficticio-abc123')");
    });

    it('no deja ningun marcador $N sin resolver cuando el dato no trae marcadores', () => {
        const jsonLimpio = JSON.stringify({ header: { subject: 'SIN SIMBOLOS' }, operations: [] });
        const out = inlineParams(SQL_SAVE_AMFE, armarParams(jsonLimpio));
        expect(out).not.toMatch(/\$\d+/);
    });

    it('mete los 24 parametros: ninguno queda con su marcador puesto', () => {
        const out = inlineParams(SQL_SAVE_AMFE, armarParams(amfeJsonFicticio));
        expect(out).toContain("'draft'");                          // $9
        expect(out).toContain("85, '2026-01-01', '2026-01-02'");    // $14 $15 $16
        expect(out).toContain("'tester@ejemplo.invalid', 'user'");  // $20 $21
    });
});

// ---------------------------------------------------------------------------
// Marcadores de dos digitos ($1 vs $10) — la razon original del orden inverso
// ---------------------------------------------------------------------------

describe('inlineParams — marcadores de uno y dos digitos conviviendo', () => {
    const doce = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);

    it('resuelve $10 correctamente cuando $1 aparece ANTES en la plantilla', () => {
        expect(inlineParams('SELECT $1, $10 FROM t', doce)).toBe("SELECT 'p1', 'p10' FROM t");
    });

    it('resuelve $10 correctamente cuando $1 aparece DESPUES en la plantilla', () => {
        expect(inlineParams('SELECT $10, $1 FROM t', doce)).toBe("SELECT 'p10', 'p1' FROM t");
    });

    it('no confunde $2 con $12 ni $1 con $11 en la misma plantilla', () => {
        expect(inlineParams('SELECT $1, $11, $2, $12 FROM t', doce))
            .toBe("SELECT 'p1', 'p11', 'p2', 'p12' FROM t");
    });

    it('resuelve los 12 marcadores en orden descendente sin pisarse', () => {
        const plantilla = Array.from({ length: 12 }, (_, i) => `$${12 - i}`).join(', ');
        const esperado = Array.from({ length: 12 }, (_, i) => `'p${12 - i}'`).join(', ');
        expect(inlineParams(plantilla, doce)).toBe(esperado);
    });
});

// ---------------------------------------------------------------------------
// Escape de comillas simples
// ---------------------------------------------------------------------------

describe('inlineParams / sqlLiteral — escape de comillas simples', () => {
    it('duplica el apostrofo de un valor para que no cierre el literal', () => {
        expect(inlineParams('SELECT $1', ["O'Brien"])).toBe("SELECT 'O''Brien'");
    });

    it('duplica TODOS los apostrofos, no solo el primero', () => {
        expect(sqlLiteral("a'b'c")).toBe("'a''b''c'");
    });

    it('deja un payload de inyeccion SQL adentro del literal en vez de terminarlo', () => {
        const malicioso = "x'; DROP TABLE amfe_documents; --";
        const out = inlineParams('DELETE FROM amfe_documents WHERE id = $1', [malicioso]);
        expect(out).toBe("DELETE FROM amfe_documents WHERE id = 'x''; DROP TABLE amfe_documents; --'");
        // La comilla que cerraria el literal quedo escapada: el DROP es texto, no SQL
        expect(out).not.toContain("'x'; DROP");
    });

    it('preserva saltos de linea y comillas dobles del valor sin tocarlos', () => {
        expect(sqlLiteral('linea 1\nlinea "2"')).toBe('\'linea 1\nlinea "2"\'');
    });
});

// ---------------------------------------------------------------------------
// Integridad del valor: lo que entra es EXACTAMENTE lo que sale
//
// Agregado el 2026-07-30 por la verificacion adversarial: de 12 mutaciones de
// prueba, la unica que SOBREVIVIO a los 38 tests originales fue meterle un
// `.trim()` al valor antes de encomillarlo. O sea que nada impedia que el
// traductor recortara silenciosamente los datos. Importa porque el `data` del
// AMFE viaja por aca como JSON y una descripcion con espacios o saltos de linea
// significativos se guardaria distinta de como la escribio Fak, sin ningun error.
// ---------------------------------------------------------------------------

describe('sqlLiteral — integridad del valor (no recorta ni normaliza)', () => {
    it('no recorta los espacios del principio ni del final', () => {
        expect(sqlLiteral('  tolerancia  ')).toBe("'  tolerancia  '");
    });

    it('no recorta saltos de linea ni tabs de los bordes', () => {
        expect(sqlLiteral('\n\tobservacion\t\n')).toBe("'\n\tobservacion\t\n'");
    });

    it('no colapsa los espacios internos', () => {
        expect(sqlLiteral('scrap     estimado')).toBe("'scrap     estimado'");
    });

    it('preserva el valor entero cuando pasa por inlineParams', () => {
        const valor = '  desc con bordes  ';
        expect(inlineParams('UPDATE t SET d = $1', [valor])).toBe("UPDATE t SET d = '  desc con bordes  '");
    });

    it('preserva un JSON indentado sin tocarle el formato', () => {
        const json = JSON.stringify({ desc: '  con espacios  ' }, null, 2);
        const out = inlineParams('UPDATE amfe_documents SET data = $1', [json]);
        expect(out).toBe(`UPDATE amfe_documents SET data = '${json}'`);
        expect(out).toContain('  con espacios  ');
    });
});

// ---------------------------------------------------------------------------
// Tipos de valor
// ---------------------------------------------------------------------------

describe('sqlLiteral — conversion por tipo', () => {
    it('convierte null a NULL sin comillas', () => {
        expect(sqlLiteral(null)).toBe('NULL');
    });

    it('convierte undefined a NULL sin comillas', () => {
        expect(sqlLiteral(undefined)).toBe('NULL');
    });

    it('deja los numeros sin comillas para que Postgres no los trate como texto', () => {
        expect(sqlLiteral(42)).toBe('42');
        expect(sqlLiteral(0)).toBe('0');
        expect(sqlLiteral(-7)).toBe('-7');
        expect(sqlLiteral(85.5)).toBe('85.5');
    });

    it('convierte true a 1 y false a 0', () => {
        expect(sqlLiteral(true)).toBe('1');
        expect(sqlLiteral(false)).toBe('0');
    });

    it('encomilla los strings, incluido el vacio', () => {
        expect(sqlLiteral('draft')).toBe("'draft'");
        expect(sqlLiteral('')).toBe("''");
    });

    it('encomilla el string "NULL" para no confundirlo con el NULL de SQL', () => {
        expect(sqlLiteral('NULL')).toBe("'NULL'");
    });

    it('encomilla los numeros que llegan como string (no los desencomilla)', () => {
        expect(sqlLiteral('42')).toBe("'42'");
    });

    it('mezcla los tipos correctamente en una plantilla completa', () => {
        const out = inlineParams(
            'INSERT INTO t (a, b, c, d, e, f) VALUES ($1, $2, $3, $4, $5, $6)',
            ['texto', 10, true, false, null, undefined]
        );
        expect(out).toBe("INSERT INTO t (a, b, c, d, e, f) VALUES ('texto', 10, 1, 0, NULL, NULL)");
    });
});

// ---------------------------------------------------------------------------
// Marcadores sin parametro correspondiente
// ---------------------------------------------------------------------------

describe('inlineParams — marcador sin parametro', () => {
    it('deja $5 intacto cuando solo llegaron 3 parametros (no lo tapa con NULL)', () => {
        expect(inlineParams('SELECT $1, $5 FROM t', ['a', 'b', 'c'])).toBe("SELECT 'a', $5 FROM t");
    });

    it('deja todos los marcadores intactos cuando no llega ningun parametro', () => {
        expect(inlineParams('SELECT $1, $2 FROM t', [])).toBe('SELECT $1, $2 FROM t');
    });

    it('deja $0 intacto porque los marcadores de Postgres arrancan en $1', () => {
        expect(inlineParams('SELECT $0, $1 FROM t', ['a'])).toBe("SELECT $0, 'a' FROM t");
    });

    it('no toca un SQL sin marcadores', () => {
        expect(inlineParams('SELECT COUNT(*) FROM amfe_documents', [])).toBe('SELECT COUNT(*) FROM amfe_documents');
    });

    it('ignora los parametros de sobra sin agregarlos al SQL', () => {
        expect(inlineParams('SELECT $1 FROM t', ['a', 'b', 'c'])).toBe("SELECT 'a' FROM t");
    });
});

// ---------------------------------------------------------------------------
// Valores que parecen referencias de reemplazo de String.replace
// ---------------------------------------------------------------------------

describe('inlineParams — valores con sintaxis de reemplazo de String.replace', () => {
    /**
     * `String.replace` interpreta `$&`, `$'`, "$`", `$$` y `$1` DENTRO del string
     * de reemplazo. `inlineParams` usa una FUNCION de reemplazo, que devuelve el
     * texto literal, asi que no hay interpretacion. Si alguien "optimiza" la
     * funcion a un string de reemplazo, estos tests se caen.
     */
    it('no interpreta $& como "el texto que matcheo"', () => {
        expect(inlineParams('SELECT $1 AS nota', ['ref $& completa']))
            .toBe("SELECT 'ref $& completa' AS nota");
    });

    it("no interpreta $' como \"lo que viene despues del match\"", () => {
        // El apostrofo se duplica por el escape de SQL; el `$` queda literal.
        expect(inlineParams('SELECT $1 AS nota, 2 AS fin', ["costo $' aprox"]))
            .toBe("SELECT 'costo $'' aprox' AS nota, 2 AS fin");
    });

    it('no interpreta $` como "lo que viene antes del match"', () => {
        expect(inlineParams('SELECT $1 AS nota', ['ref $` previa']))
            .toBe("SELECT 'ref $` previa' AS nota");
    });

    it('no colapsa $$ en un solo $', () => {
        expect(inlineParams('SELECT $1 AS nota', ['precio $$ neto']))
            .toBe("SELECT 'precio $$ neto' AS nota");
    });

    it('no reinterpreta un $2 que viene dentro del valor de $1', () => {
        const out = inlineParams('SELECT $1, $2 FROM t', ['mira $2 aca', 'SEGUNDO']);
        expect(out).toBe("SELECT 'mira $2 aca', 'SEGUNDO' FROM t");
        expect(contarOcurrencias(out, 'SEGUNDO')).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Caracterizacion: comportamientos actuales que conviene tener fijados
// (documentan lo que HOY pasa, no necesariamente lo ideal — ver limitaciones)
// ---------------------------------------------------------------------------

describe('sqlLiteral — caracterizacion de bordes (documenta el comportamiento de HOY)', () => {
    it('NO escapa el backslash: si alguna vez standard_conforming_strings se apaga, esto hay que revisarlo', () => {
        expect(sqlLiteral('C:\\temp\\ficticio')).toBe("'C:\\temp\\ficticio'");
    });

    it('serializa los numeros no finitos como texto sin comillas (NaN / Infinity romperian el SQL)', () => {
        expect(sqlLiteral(NaN)).toBe('NaN');
        expect(sqlLiteral(Infinity)).toBe('Infinity');
    });

    it('convierte un objeto con String(), no con JSON.stringify: el llamador tiene que serializar', () => {
        expect(sqlLiteral({ a: 1 })).toBe("'[object Object]'");
    });

    /**
     * Hoy NINGUN repositorio pasa un Date crudo como binding (los 2 usos de
     * `new Date` en utils/repositories/ son de documentLockRepository y los dos
     * terminan en `.toISOString()`), asi que esto no es un bug alcanzable: es una
     * trampa para el que agregue un binding nuevo. El assert no fija el texto del
     * Date para no depender de la zona horaria de la maquina.
     */
    it('NO convierte un Date a ISO: si un llamador pasa el Date crudo, Postgres recibe basura', () => {
        const fecha = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));
        expect(sqlLiteral(fecha)).not.toBe("'2026-01-02T03:04:05.000Z'");
        expect(sqlLiteral(fecha)).toBe(`'${String(fecha)}'`);
    });
});
