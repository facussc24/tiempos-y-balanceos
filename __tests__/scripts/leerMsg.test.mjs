/**
 * Tests del lector de mails de Outlook (`scripts/_leerMsg.mjs`).
 *
 * El .msg de cada carpeta del Escritorio ES el pedido: si el lector devuelve basura, el
 * triage entero se apoya en un mail mal leido. Como el repo es publico no se puede guardar
 * un mail de la empresa como fixture, asi que el test FABRICA un Compound File Binary
 * valido y lo hace leer. Eso ejercita las tres trampas reales del formato:
 *
 *   - los streams de menos de 4096 bytes NO estan en la FAT normal sino en el mini-FAT
 *     (saltearse esa cadena devuelve bytes de otro stream, no un error);
 *   - el cuerpo HTML viene en CP1252, no en UTF-16 ni UTF-8: leerlo mal come los acentos;
 *   - la fecha de envio es un FILETIME de 1601, no una fecha comun.
 *
 * Vectores:
 *   1-4   decodificarAnsi / desescapar: acentos y comillas de Outlook
 *   5-8   htmlATexto: los saltos de una lista numerada de pedidos
 *   9-10  fileTimeADate
 *  11-15  leerMsg de punta a punta sobre un .msg fabricado
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
    leerMsg, abrirCFB, decodificarAnsi, desescapar, htmlATexto, fileTimeADate, fechaDePropiedades,
} from '../../scripts/_leerMsg.mjs';

/** Los mismos tags de fecha de envio que usa `leerMsg`. */
const leerFechaDeStream = (buf) => fechaDePropiedades(buf, ['0039', '0E06']);

// ─────────────────────────────────────────────────────────────────────────────
// Fabrica de .msg: el minimo Compound File Binary que el lector tiene que entender
// ─────────────────────────────────────────────────────────────────────────────

const MINI = 64;
const LIBRE = 0xffffffff;
const FIN = 0xfffffffe;
const ES_FAT = 0xfffffffd;

function entradaDir({ nombre, tipo, inicio, tam, der = LIBRE, hijo = LIBRE }) {
    const e = Buffer.alloc(128, 0);
    const n = Buffer.from(`${nombre}\0`, 'utf16le');
    n.copy(e, 0);
    e.writeUInt16LE(n.length, 64);
    e[66] = tipo;
    e[67] = 1;                                   // color: negro
    e.writeUInt32LE(LIBRE, 68);                  // left
    e.writeUInt32LE(der, 72);                    // right: el hermano siguiente
    e.writeUInt32LE(hijo, 76);                   // child: el primer hijo del storage
    e.writeUInt32LE(inicio, 116);
    e.writeBigUInt64LE(BigInt(tam), 120);
    return e;
}

/**
 * Arma un .msg con los streams que se le pasen. Los de menos de 4096 bytes van al
 * mini-stream (que es lo que pasa de verdad con el asunto y las propiedades) y los
 * grandes a sectores propios. Un item con `hijos` se arma como sub-carpeta, que es como
 * viajan los adjuntos y los destinatarios.
 */
function fabricarMsg(spec, { SEC = 512, ciclo = false } = {}) {
    // Aplanar: cada nodo se queda con el indice de su padre para poder enlazar el arbol.
    const nodos = [];
    const aplanar = (items, padre) => {
        for (const it of items) {
            const i = nodos.length;
            nodos.push({ ...it, padre, hijosIdx: [] });
            if (padre >= 0) nodos[padre].hijosIdx.push(i);
            if (it.hijos) aplanar(it.hijos, i);
        }
    };
    aplanar(spec, -1);
    const raizHijos = nodos.map((n, i) => (n.padre === -1 ? i : -1)).filter((i) => i >= 0);

    const streams = nodos.filter((n) => n.datos);
    const chicos = streams.filter((s) => s.datos.length < 4096);
    const grandes = streams.filter((s) => s.datos.length >= 4096);

    // Mini-stream: los chicos pegados, cada uno alineado a 64 bytes.
    const trozos = [];
    let miniPos = 0;
    for (const s of chicos) {
        const relleno = Buffer.alloc(Math.ceil(s.datos.length / MINI) * MINI, 0);
        s.datos.copy(relleno);
        trozos.push(relleno);
        s.inicio = miniPos / MINI;
        s.tam = s.datos.length;
        miniPos += relleno.length;
    }
    const miniStream = Buffer.concat(trozos);

    // Sectores: 0 = FAT, despues el directorio (que puede pasar de un sector: entran 4
    // entradas por sector y un mail tiene mas propiedades que eso), la mini-FAT, el
    // mini-stream y al final los streams grandes.
    const secsDir = Math.ceil((nodos.length + 1) / (SEC / 128));
    const SEC_DIR = 1;
    const SEC_MINIFAT = SEC_DIR + secsDir;
    const SEC_MINISTREAM = SEC_MINIFAT + 1;
    const secsMini = Math.ceil(miniStream.length / SEC) || 1;
    let libre = SEC_MINISTREAM + secsMini;
    const cuerposGrandes = [];
    for (const s of grandes) {
        const secs = Math.ceil(s.datos.length / SEC);
        s.inicio = libre;
        s.tam = s.datos.length;
        cuerposGrandes.push({ inicio: libre, secs, datos: s.datos });
        libre += secs;
    }
    const totalSecs = libre;

    const fat = Buffer.alloc(SEC, 0xff);
    const enc = (i, v) => fat.writeUInt32LE(v, i * 4);
    const encadenar = (inicio, cuantos) => {
        for (let i = 0; i < cuantos; i++) enc(inicio + i, i === cuantos - 1 ? FIN : inicio + i + 1);
    };
    enc(0, ES_FAT);
    encadenar(SEC_DIR, secsDir);
    enc(SEC_MINIFAT, FIN);
    encadenar(SEC_MINISTREAM, secsMini);
    for (const g of cuerposGrandes) encadenar(g.inicio, g.secs);
    // FAT corrupta a proposito: el ultimo sector del directorio vuelve al primero.
    if (ciclo) enc(SEC_DIR + secsDir - 1, SEC_DIR);

    const miniFat = Buffer.alloc(SEC, 0xff);
    let mi = 0;
    for (const s of chicos) {
        const n = Math.ceil(s.datos.length / MINI);
        for (let i = 0; i < n; i++) miniFat.writeUInt32LE(i === n - 1 ? FIN : mi + i + 1, (mi + i) * 4);
        mi += n;
    }

    // Los hermanos se encadenan por `der` y el primero de cada nivel cuelga de `hijo` del
    // padre. Sin ese enlace no hay forma de saber que propiedad es del mensaje y cual de
    // un adjunto: los nombres se repiten identicos en los dos niveles.
    const idxDir = (i) => i + 1;                                  // 0 es el Root Entry
    const encadenarHermanos = (hermanos) => (hermanos.length ? idxDir(hermanos[0]) : LIBRE);
    const hermanoSiguiente = (i) => {
        const lista = nodos[i].padre === -1 ? raizHijos : nodos[nodos[i].padre].hijosIdx;
        const pos = lista.indexOf(i);
        return pos >= 0 && pos + 1 < lista.length ? idxDir(lista[pos + 1]) : LIBRE;
    };

    const raiz = entradaDir({
        nombre: 'Root Entry', tipo: 5, inicio: SEC_MINISTREAM, tam: miniStream.length,
        hijo: encadenarHermanos(raizHijos),
    });
    const dirBuf = Buffer.concat([raiz, ...nodos.map((n, i) => entradaDir({
        nombre: n.nombre,
        tipo: n.datos ? 2 : 1,
        inicio: n.datos ? n.inicio : 0,
        tam: n.datos ? n.tam : 0,
        der: hermanoSiguiente(i),
        hijo: encadenarHermanos(n.hijosIdx),
    }))]);
    const dirSectores = Buffer.alloc(secsDir * SEC, 0);
    dirBuf.copy(dirSectores);

    const header = Buffer.alloc(SEC, 0);
    Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(header, 0);
    header.writeUInt16LE(0x003e, 0x18); header.writeUInt16LE(0x0003, 0x1a);
    header.writeUInt16LE(0xfffe, 0x1c);
    header.writeUInt16LE(Math.log2(SEC), 0x1e);    // tamaño de sector (9 = 512, 12 = 4096)
    header.writeUInt16LE(6, 0x20);                 // mini-sectores de 64
    header.writeUInt32LE(1, 0x2c);                 // 1 sector de FAT
    header.writeUInt32LE(SEC_DIR, 0x30);
    header.writeUInt32LE(4096, 0x38);              // corte mini/normal
    header.writeUInt32LE(SEC_MINIFAT, 0x3c);
    header.writeUInt32LE(1, 0x40);
    header.writeUInt32LE(FIN, 0x44);               // sin DIFAT extra
    header.writeUInt32LE(0, 0x48);
    for (let i = 0; i < 109; i++) header.writeUInt32LE(i === 0 ? 0 : LIBRE, 0x4c + i * 4);

    const cuerpo = Buffer.alloc(totalSecs * SEC, 0);
    fat.copy(cuerpo, 0);
    dirSectores.copy(cuerpo, SEC_DIR * SEC);
    miniFat.copy(cuerpo, SEC_MINIFAT * SEC);
    miniStream.copy(cuerpo, SEC_MINISTREAM * SEC);
    for (const g of cuerposGrandes) g.datos.copy(cuerpo, g.inicio * SEC);

    return Buffer.concat([header, cuerpo]);
}

const uni = (s) => Buffer.from(s, 'utf16le');

/** El stream de propiedades: header de 32 bytes y entradas de 16 (tag, flags, valor). */
function propiedades(fechaEnvio) {
    const ticks = (BigInt(fechaEnvio.getTime()) + 11644473600000n) * 10000n;
    const b = Buffer.alloc(32 + 16, 0);
    b.writeUInt16LE(0x0040, 32);                   // tipo PT_SYSTIME
    b.writeUInt16LE(0x0039, 34);                   // tag PR_CLIENT_SUBMIT_TIME
    b.writeBigUInt64LE(ticks, 40);
    return b;
}

describe('decodificar texto de Outlook', () => {
    it('1. CP1252: los acentos del castellano no se comen', () => {
        expect(decodificarAnsi(Buffer.from([0xe1, 0xe9, 0xed, 0xf3, 0xfa, 0xf1]))).toBe('áéíóúñ');
    });
    it('2. CP1252: el rango 0x80-0x9F, donde latin1 daria basura', () => {
        // Outlook escribe el guion largo y las comillas curvas ahi. Leerlo como latin1
        // devuelve caracteres de control invisibles y el texto queda cortado.
        expect(decodificarAnsi(Buffer.from([0x96, 0x93, 0x94, 0x80]))).toBe('–“”€');
    });
    it('3. entidades HTML nombradas y numericas', () => {
        expect(desescapar('caf&eacute; &amp; t&#233; &#x2013; fin')).toBe('café & té – fin');
    });
    it('4. una entidad que no conozco se deja como esta, no se borra', () => {
        expect(desescapar('&thorn; queda')).toBe('&thorn; queda');
    });
});

describe('htmlATexto — que una lista de pedidos se lea como lista', () => {
    it('5. cada punto en su renglon', () => {
        const html = '<p>Necesito:</p><ol><li>Cargar la BOM</li><li>Avisar a Leo</li></ol>';
        expect(htmlATexto(html).split('\n').filter(Boolean))
            .toEqual(['Necesito:', 'Cargar la BOM', 'Avisar a Leo']);
    });
    it('6. la firma con celdas vacias no deja veinte renglones en blanco', () => {
        const html = '<div>Gracias.</div>' + '<div>&nbsp;</div>'.repeat(12) + '<div>Juan</div>';
        expect(htmlATexto(html)).toBe('Gracias.\n\nJuan');
    });
    it('7. los \\r de Outlook no bloquean el colapso de renglones', () => {
        expect(htmlATexto('uno<br>\r\n\r\n\r\n\r\ndos')).toBe('uno\n\ndos');
    });
    it('8. style y script no se cuelan en el texto', () => {
        expect(htmlATexto('<style>p{color:red}</style><p>Hola</p>')).toBe('Hola');
    });
});

describe('fileTimeADate', () => {
    it('9. convierte el FILETIME de 1601 a la fecha real', () => {
        const d = new Date('2026-07-31T19:42:52.000Z');
        const t = (BigInt(d.getTime()) + 11644473600000n) * 10000n;
        expect(fileTimeADate(Number(t & 0xffffffffn), Number(t >> 32n)).toISOString()).toBe(d.toISOString());
    });
    it('10. cero no es 1601: es "no hay fecha"', () => {
        expect(fileTimeADate(0, 0)).toBeNull();
    });
    it('19. ante un stream de propiedades desalineado prefiere no dar fecha', () => {
        // Si el stream no arranca donde se cree, el recorrido lee los bytes de VALOR de una
        // propiedad como si fueran el tag de la siguiente, y casi cualquier combinacion de
        // 8 bytes cae adentro del rango de fechas de JS: sale una fecha creible y falsa.
        // Datar mal una tarea es peor que no datarla, asi que se descarta el stream entero.
        const FECHA = new Date('2026-07-31T19:42:52.000Z');
        const sano = propiedades(FECHA);
        expect(leerFechaDeStream(sano)?.toISOString()).toBe(FECHA.toISOString());

        const corrido = Buffer.concat([sano, Buffer.alloc(8)]);   // ya no es multiplo de 16
        expect(leerFechaDeStream(corrido)).toBeNull();
    });
    it('20. una fecha fuera de lo posible se descarta aunque el layout cierre', () => {
        expect(leerFechaDeStream(propiedades(new Date('1970-01-01T00:00:00Z')))).toBeNull();
        expect(leerFechaDeStream(propiedades(new Date('2199-01-01T00:00:00Z')))).toBeNull();
    });
});

describe('leerMsg — de punta a punta sobre un .msg fabricado', () => {
    // Nombres, empresas y productos INVENTADOS: el repo es publico y un fixture no es
    // excusa para meter datos de la casa. El formato es lo que se prueba, no el contenido.
    const FECHA = new Date('2026-07-31T19:42:52.000Z');
    const cuerpoHtml = `<html><body><p>Ana, necesito que avances:</p><ol>
        <li>Puesta a punto de la prensa</li><li>Cargar la lista de materiales</li></ol>
        <p>Gracias.</p></body></html>`;

    function escribir(streams, opciones) {
        const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'msg-')), 'prueba.msg');
        fs.writeFileSync(p, fabricarMsg(streams, opciones));
        return p;
    }

    const BASE = () => [
        { nombre: '__substg1.0_0037001F', datos: uni('Prioridades de la semana') },
        { nombre: '__substg1.0_0C1A001F', datos: uni('Juan Perez') },
        { nombre: '__substg1.0_5D01001F', datos: uni('jperez@ejemplo.com') },
        { nombre: '__substg1.0_0E04001F', datos: uni('Ana Gomez') },
        { nombre: '__substg1.0_10130102', datos: Buffer.from(cuerpoHtml, 'latin1') },
        { nombre: '__properties_version1.0', datos: propiedades(FECHA) },
    ];

    it('11. saca asunto, remitente, destinatario y fecha de envio', () => {
        const m = leerMsg(escribir(BASE()));
        expect(m.asunto).toBe('Prioridades de la semana');
        expect(m.de).toBe('Juan Perez <jperez@ejemplo.com>');
        expect(m.para).toBe('Ana Gomez');
        expect(m.fecha.toISOString()).toBe(FECHA.toISOString());
    });

    it('17. un .msg con sectores de 4096 se lee igual que uno de 512', () => {
        // El sector n arranca en (n+1)*tamaño, no en 512+n*tamaño. Con sectores de 512 las
        // dos cuentas coinciden y el bug no se ve; con 4096 —los .msg con adjuntos grandes—
        // todo queda corrido 3584 bytes y el lector devolvia "(sin asunto)" y fecha vacia,
        // SIN tirar error. Ese es el peor modo de falla: dato mudo que parece un mail sin datos.
        const m = leerMsg(escribir(BASE(), { SEC: 4096 }));
        expect(m.asunto).toBe('Prioridades de la semana');
        expect(m.de).toBe('Juan Perez <jperez@ejemplo.com>');
        expect(m.fecha.toISOString()).toBe(FECHA.toISOString());
        expect(m.cuerpo).toContain('Puesta a punto de la prensa');
    });

    it('18. una FAT con ciclo se corta con error, no devuelve sectores repetidos', () => {
        expect(() => leerMsg(escribir(BASE(), { ciclo: true }))).toThrow(/ciclo/i);
    });

    it('12. el cuerpo HTML en CP1252 sale como texto con los renglones separados', () => {
        const conAcentos = cuerpoHtml.replace('Gracias.', 'Gracias, coordiná con Leó.');
        const m = leerMsg(escribir([
            ...BASE().filter((s) => !s.nombre.startsWith('__substg1.0_1013')),
            { nombre: '__substg1.0_10130102', datos: Buffer.from(conAcentos, 'latin1') },
        ]));
        expect(m.cuerpo).toContain('Puesta a punto de la prensa');
        expect(m.cuerpo).toContain('Cargar la lista de materiales');
        expect(m.cuerpo).toContain('coordiná con Leó');
        expect(m.cuerpo).not.toContain('<');
    });

    it('13. si hay cuerpo de texto plano, ese gana sobre el HTML', () => {
        const m = leerMsg(escribir([
            ...BASE(),
            { nombre: '__substg1.0_1000001F', datos: uni('El texto plano manda') },
        ]));
        expect(m.cuerpo).toBe('El texto plano manda');
    });

    it('14. un cuerpo largo se lee entero: vive fuera del mini-FAT, en sectores propios', () => {
        // Este es el vector que hace fallar a un parser que solo sigue la FAT normal (o solo
        // el mini-FAT): el mismo archivo usa las DOS cadenas a la vez.
        const largo = `<p>${'Renglon repetido para pasarse del corte del mini-FAT. '.repeat(300)}</p>`;
        const m = leerMsg(escribir([
            ...BASE().filter((s) => !s.nombre.startsWith('__substg1.0_1013')),
            { nombre: '__substg1.0_10130102', datos: Buffer.from(largo, 'latin1') },
        ]));
        expect(largo.length).toBeGreaterThan(4096);
        expect(m.asunto).toBe('Prioridades de la semana');              // el chico sigue bien
        expect(m.cuerpo.match(/Renglon repetido/g)).toHaveLength(300);
    });

    it('16. las propiedades del mensaje le ganan a las del destinatario y las del adjunto', () => {
        // Bug real, encontrado leyendo un mail que Fak habia ENVIADO: destinatarios y
        // adjuntos son sub-carpetas que repiten los MISMOS nombres de propiedad. Agarrar
        // "la primera que aparezca en el directorio" devolvia las del destinatario, y con
        // ellas la fecha de envio se perdia — el mail figuraba "sin fecha" y parecia un
        // borrador nunca mandado.
        const m = leerMsg(escribir([
            ...BASE(),
            { nombre: '__recip_version1.0_#00000000', hijos: [
                { nombre: '__substg1.0_0037001F', datos: uni('NO: asunto del destinatario') },
                { nombre: '__properties_version1.0', datos: propiedades(new Date('2001-01-01T00:00:00.000Z')) },
            ] },
            { nombre: '__attach_version1.0_#00000000', hijos: [
                { nombre: '__substg1.0_0037001F', datos: uni('NO: asunto del adjunto') },
                { nombre: '__substg1.0_3707001F', datos: uni('Lista de materiales revisada.pdf') },
                { nombre: '__substg1.0_3704001F', datos: uni('Modifi~1.pdf') },
                { nombre: '__properties_version1.0', datos: propiedades(new Date('2001-01-01T00:00:00.000Z')) },
            ] },
        ]));
        expect(m.asunto).toBe('Prioridades de la semana');
        expect(m.fecha.toISOString()).toBe(FECHA.toISOString());
        // El nombre largo, no el 8.3 truncado: "Modifi~1.pdf" no sirve para buscar el archivo.
        expect(m.adjuntos).toEqual(['Lista de materiales revisada.pdf']);
    });

    it('15. un archivo que no es .msg falla diciendo por que, no devuelve basura', () => {
        const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'msg-')), 'no.msg');
        fs.writeFileSync(p, Buffer.from('esto es un pdf, no un mail'));
        expect(() => leerMsg(p)).toThrow(/Compound Binary/);
        expect(() => abrirCFB(Buffer.alloc(600))).toThrow(/Compound Binary/);
    });
});
