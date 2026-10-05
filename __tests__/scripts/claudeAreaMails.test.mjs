// @vitest-environment node
/**
 * Pruebas del paso "mails" de "un Claude por area" (tools/claude-area/mails_area.mjs + mails_outlook.ps1):
 * la PC de una persona sube a la nube de Ingenieria sus mails de trabajo SOLO si la lista publicada lo dice.
 *
 * Las dos direcciones, porque esto saca mails de una PC:
 *   - lo que tiene que subir, sube (y solo eso), y lo que es trabajo no se frena de mas;
 *   - lo que NO tiene que salir no sale: PC no habilitada, lista de lo privado ausente, sin completar o mal escrita,
 *     mails de Direccion / RRHH (directos, en copia oculta, "en nombre de", citados, firmados o nombrados adentro de
 *     otro), temas personales en cualquier campo que subiria, una casilla que no se puede leer, el buzon de otra persona.
 * Los casos de ataque salen de las dos auditorias independientes del 05/10/2026
 * (.sgc-cache/claude-por-area/examen/mails-auditoria/ y mails-auditoria-2/HALLAZGOS.md).
 * Todo corre contra carpetas temporales y mails de mentira: no toca Outlook ni la nube real.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    correr, clasificar, cargarPrivados, personaQueSube, carpetaDeMails, autorDe, carpetaSegura, normalizar, paraTemas, nombraTema, casillaLimpia,
    esDeAnthropic, identidadReal, mismaPc, nombreEnPalabras, paraPublicar, NOMBRE_AVISO, ARCHIVO_ESTADO, ARCHIVO_SUBIDOS, GRACIA_HORAS, escribirLote,
} from '../../tools/claude-area/mails_area.mjs';
import { buscarPersona } from '../../scripts/_paquete.mjs';
import { PROGRAMAS } from '../../tools/claude-area/armar_publicable.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const AREA = path.join(RAIZ, 'tools', 'claude-area');
const PROGRAMA = path.join(AREA, 'mails_area.mjs');
const LECTOR = path.join(AREA, 'mails_outlook.ps1');
const AHORA = new Date(2026, 9, 5, 16, 0, 0);   // 05/10/2026 16:00, hora local

const temporales = [];
afterAll(() => { for (const d of temporales) fs.rmSync(d, { recursive: true, force: true }); });

const PRIVADOS_OK = { _que_es: 'de prueba', total_direcciones: 2, direcciones: ['dueno@barack.test', 'rrhh@barack.test'], dominios: ['estudio-contable.test'], nombres: ['Dueño Prueba'], apellidos: ['Zzapellido'], palabras_extra: ['proyecto reservado'] };
const CASILLA = 'c.prueba@barackmercosul.com';
const CARLOS = { nombre: 'Carlos Prueba', mail: CASILLA, usuario_windows: 'Carlos prueba', pc: 'PC-CARLOS', area: 'ingenieria', puesto: 'Gerente', rol: 'usuario', mails: 'sube', baja: null };
const SOY_CARLOS = { usuario: 'Carlos prueba', pc: 'PC-CARLOS' };
const ENV = { SystemRoot: process.env.SystemRoot || 'C:\\Windows' };

/** Una PC de mentira: carpeta de la casa con lo publicado instalado, una biblioteca con las dos carpetas y un estado. */
function armarPc({ personas = [CARLOS], privados = PRIVADOS_OK, conHermana = true, nombreRaiz = 'CLAUDE POR AREA' } = {}) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-area-mails-'));
    temporales.push(t);
    const home = path.join(t, 'ClaudeBarack');
    const comun = path.join(home, 'publicado', 'conocimiento', 'comun');
    fs.mkdirSync(comun, { recursive: true });
    if (personas !== null) fs.writeFileSync(path.join(comun, 'personas.json'), JSON.stringify({ personas }), 'utf8');
    if (privados !== null) fs.writeFileSync(path.join(comun, 'mails_privados.json'), typeof privados === 'string' ? privados : JSON.stringify(privados), 'utf8');
    const raizNube = path.join(t, 'biblioteca', nombreRaiz);
    fs.mkdirSync(raizNube, { recursive: true });
    if (conHermana) fs.mkdirSync(path.join(t, 'biblioteca', 'Claude Barack'), { recursive: true });
    const estado = path.join(t, 'estado');
    return { t, home, comun, raizNube, estado, mails: path.join(t, 'biblioteca', 'Claude Barack', 'mails'), entrada: path.join(t, 'biblioteca', 'Claude Barack', 'mails', '_entrada') };
}

let contador = 0;
function mail(cambios = {}) {
    contador++;
    return {
        id: `<m${contador}@barack.test>`, eid: `E${contador}`, carpeta: 'Bandeja de entrada', fecha: '2026-10-04 10:00',
        de: 'Compras', de_mail: 'compras@barackmercosul.com', representa_mail: '', para: 'Carlos', para_mails: [CASILLA], cc: '', cc_mails: [], cco_mails: [],
        asunto: 'OC 1234', adjuntos: [], conversacion: 'C1', cuerpo: 'Adjunto la orden de compra.', sin_resolver: 0, ...cambios,
    };
}
function fuente(pc, renglones) {
    const ruta = path.join(pc.t, `fuente-${++contador}.jsonl`);
    fs.writeFileSync(ruta, renglones.map((m) => JSON.stringify(m)).join('\n') + '\n', 'utf8');
    return ruta;
}
const ANTES = new Date(AHORA.getTime() - 26 * 3600000);   // 04/10/2026 14:00: el dia en que se prendio
/** Una corrida tal cual, sin preparar nada. */
const directo = (pc, extra = {}) => correr({ home: pc.home, raizNube: pc.raizNube, estado: pc.estado, ahora: AHORA, env: ENV, identidad: SOY_CARLOS, lector: path.join(pc.t, 'no-existe.ps1'), ...extra });
/**
 * Una corrida con el PRIMER DIA ya pasado: el dia que se prende la PC solo se deja el aviso, y la primera copia es al dia
 * siguiente. Casi todas las pruebas miran lo que pasa despues, asi que antes corre ese primer dia (26 horas antes).
 */
const corre = async (pc, extra = {}) => {
    if (!fs.existsSync(path.join(pc.estado, ARCHIVO_ESTADO))) await directo(pc, { ahora: ANTES, ...('identidad' in extra ? { identidad: extra.identidad } : {}), ...(extra.env ? { env: extra.env } : {}) });
    return directo(pc, extra);
};
/** Todos los archivos que hay bajo una carpeta (rutas relativas). */
function archivos(dir) {
    const out = [];
    const anda = (d, rel) => { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) { const r = path.join(rel, e.name); if (e.isDirectory()) anda(path.join(d, e.name), r); else out.push(r); } };
    anda(dir, '');
    return out.sort();
}
const subidos = (pc) => archivos(pc.entrada).flatMap((f) => fs.readFileSync(path.join(pc.entrada, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
const nubeVacia = (pc) => archivos(path.join(pc.t, 'biblioteca')).length === 0;
const estadoDe = (pc) => JSON.parse(fs.readFileSync(path.join(pc.estado, ARCHIVO_ESTADO), 'utf8'));
const avisosDe = (pc) => (fs.existsSync(path.join(pc.home, 'Trabajo')) ? fs.readdirSync(path.join(pc.home, 'Trabajo')).filter((n) => /^AVISO/.test(n)).sort() : []);
const hayAviso = (pc) => fs.existsSync(path.join(pc.home, 'Trabajo', NOMBRE_AVISO));
const listaPrivada = (contenido = PRIVADOS_OK) => cargarPrivados(path.join(armarPc({ privados: contenido }).comun, 'mails_privados.json'));

describe('mails_area: lo FIRME del filtro (Direccion, Recursos Humanos y lo que no se puede leer no salen de la PC)', () => {
    const priv = listaPrivada();
    const casos = [
        ['un mail de trabajo sube', {}, 'entrada'],
        // --- casillas de lo privado
        ['de una direccion privada', { de_mail: 'dueno@barack.test' }, 'privado'],
        ['con una direccion privada en copia (mayusculas)', { cc_mails: ['RRHH@Barack.test'] }, 'privado'],
        ['para un dominio privado', { para_mails: ['juan@estudio-contable.test'] }, 'privado'],
        ['para un subdominio de un dominio privado', { para_mails: ['juan@mail.estudio-contable.test'] }, 'privado'],
        ['con una direccion privada en COPIA OCULTA', { cco_mails: ['dueno@barack.test'] }, 'privado'],
        ['enviado EN NOMBRE DE una direccion privada', { representa_mail: 'dueno@barack.test' }, 'privado'],
        ['"en nombre de" alguien cuya casilla no se pudo leer', { representa_mail: 'el dueno' }, 'privado'],
        // --- casillas sucias: se limpian antes de comparar
        ['privada con espacios', { de_mail: '  Dueno@Barack.test ' }, 'privado'],
        ['privada entre comillas', { cc_mails: ['"dueno@barack.test"'] }, 'privado'],
        ['privada entre < >', { para_mails: ['<dueno@barack.test>'] }, 'privado'],
        ['privada como «Nombre <casilla>»', { para_mails: ['El Dueno <dueno@barack.test>'] }, 'privado'],
        ['privada con smtp: adelante', { de_mail: 'SMTP:dueno@barack.test' }, 'privado'],
        ['privada con un punto al final', { cc_mails: ['rrhh@barack.test.'] }, 'privado'],
        // --- lo que no se puede leer no sube
        ['remitente sin casilla (DN de Exchange)', { de_mail: '/o=exchangelabs/ou=x/cn=recipients/cn=abc' }, 'privado'],
        ['un DN de Exchange que trae una arroba', { de_mail: '/o=ExchangeLabs/ou=x/cn=Recipients/cn=abc@barackmercosul.com' }, 'privado'],
        ['remitente vacio', { de_mail: '' }, 'privado'],
        ['remitente que es un nombre', { de_mail: 'Juan Perez' }, 'privado'],
        ['remitente que no es texto', { de_mail: 12 }, 'privado'],
        ['un destinatario que no es una casilla', { para_mails: [CASILLA, 'Grupo Ingenieria'] }, 'privado'],
        ['los destinatarios no vienen como lista', { para_mails: CASILLA }, 'privado'],
        ['faltan los destinatarios', { para_mails: undefined }, 'privado'],
        ['la copia viene nula', { cc_mails: null }, 'privado'],
        ['la copia oculta no viene como lista', { cco_mails: 'dueno@barack.test' }, 'privado'],
        ['los adjuntos no vienen como lista', { adjuntos: 'recibo de sueldo.pdf' }, 'privado'],
        ['un adjunto que no es texto', { adjuntos: [{ nombre: 'recibo de sueldo.pdf' }] }, 'privado'],
        ['el texto no es texto', { cuerpo: { texto: 'recibo de sueldo' } }, 'privado'],
        ['el texto es un numero', { cuerpo: 5 }, 'privado'],
        ['el asunto es una lista', { asunto: ['recibo de sueldo'] }, 'privado'],
        ['el nombre del remitente es un objeto', { de: { nombre: 'Dueño Prueba' } }, 'privado'],
        ['la fecha no es una fecha', { fecha: 'ayer' }, 'privado'],
        ['el identificador de Outlook trae texto', { eid: 'recibo de sueldo' }, 'privado'],
        ['la conversacion trae texto', { conversacion: 'recibo de sueldo' }, 'privado'],
        ['un destinatario sin resolver (o un grupo de correo)', { sin_resolver: 1 }, 'privado'],
        // --- la cuenta de Claude
        ['codigo de acceso de la cuenta de Claude', { de_mail: 'noreply@mail.anthropic.com' }, 'privado'],
        ['otro subdominio de Anthropic', { de_mail: 'notice@email.anthropic.com' }, 'privado'],
        ['claude.com', { de_mail: 'no-reply@claude.com' }, 'privado'],
        ['un subdominio de claude.ai', { de_mail: 'x@mail.claude.ai' }, 'privado'],
        ['un dominio que solo se parece no se frena', { de_mail: 'ventas@notanthropic.com' }, 'entrada'],
        // --- la casilla privada adentro del mail, como venga escrita
        ['la casilla privada citada en el texto', { cuerpo: 'Te reenvio.\n\nDe: alguien <dueno@barack.test>\nAsunto: plano' }, 'privado'],
        ['la casilla privada en el asunto', { asunto: 'RV: consulta de RRHH@barack.test' }, 'privado'],
        ['la casilla privada en el nombre de un adjunto', { adjuntos: ['dueno@barack.test.vcf'] }, 'privado'],
        ['con espacios alrededor de la arroba', { cuerpo: 'escribile a dueno @ barack.test' }, 'privado'],
        ['con (at)', { cuerpo: 'dueno(at)barack.test' }, 'privado'],
        ['con [at]', { cuerpo: 'dueno[at]barack.test' }, 'privado'],
        ['partida en dos renglones', { cuerpo: 'dueno@\nbarack.test' }, 'privado'],
        ['pegada a la palabra que sigue', { cuerpo: 'escribile a dueno@barack.test.Gracias' }, 'privado'],
        ['entre guiones bajos', { cuerpo: '_dueno@barack.test_' }, 'privado'],
        ['en mayusculas y con mailto', { cuerpo: '<mailto:DUENO@BARACK.TEST>' }, 'privado'],
        // --- el nombre de alguien de lo privado, en cualquier lugar
        ['como remitente mostrado', { de: 'Dueño Prueba' }, 'privado'],
        ['en el Para mostrado', { para: 'Carlos; DUENO PRUEBA' }, 'privado'],
        ['con el apellido adelante en el Para mostrado', { para: 'Juan; Prueba, Dueño' }, 'privado'],
        ['un mail suyo citado: «De: Nombre» sin la casilla', { cuerpo: 'Va abajo.\n\nDe: Dueño Prueba\nEnviado el: lunes\nPara: Carlos\nAsunto: plano' }, 'privado'],
        ['citado con > y en ingles', { cuerpo: '> From: DUENO PRUEBA\n> Sent: Monday' }, 'privado'],
        ['citado en negrita (*De:*)', { cuerpo: '*De:* Dueño Prueba\n*Para:* Carlos' }, 'privado'],
        ['citado con el apellido adelante', { cuerpo: 'De: Prueba, Dueño\nPara: Carlos' }, 'privado'],
        ['citado con algo en el medio del nombre', { cuerpo: 'Para: Carlos; Dueño A. Prueba <otra.casilla@barackmercosul.com>' }, 'privado'],
        ['la cita de una respuesta: «Fulano escribió:»', { cuerpo: 'El 5 oct 2026, a las 10:00, Dueño Prueba escribió:\n> Esto queda entre nosotros' }, 'privado'],
        ['la cita en ingles: «wrote:»', { cuerpo: 'On Mon, Oct 5, 2026 at 10:00 AM Dueno Prueba wrote:\n> Entre nosotros' }, 'privado'],
        ['«De:» y el nombre en el renglon de abajo', { cuerpo: 'De:\nDueño Prueba\nEnviado el: lunes' }, 'privado'],
        ['su firma pegada en el texto', { cuerpo: 'Te copio lo que me mando:\nEsto queda entre nosotros.\nSaludos,\nDueño Prueba\nDirector' }, 'privado'],
        ['nombrado en el texto', { cuerpo: 'Hablé con Dueño Prueba y aprobó el plano.' }, 'privado'],
        ['la inicial y el apellido', { cuerpo: 'De: D. Prueba' }, 'privado'],
        ['en el asunto', { asunto: 'RV: Dueño Prueba - tema reservado' }, 'privado'],
        ['en el nombre de un adjunto', { adjuntos: ['RE Dueno Prueba - reservado.msg'] }, 'privado'],
        ['en el nombre de la carpeta', { carpeta: 'Bandeja de entrada / Dueño Prueba' }, 'privado'],
        ['un apellido de la lista de apellidos, solo', { cuerpo: 'lo aprobó Zzapellido ayer' }, 'privado'],
        ['solo el nombre de pila no frena', { cuerpo: 'Hablé con Dueño y aprobó el plano.' }, 'entrada'],
        ['dos personas distintas que juntan el nombre no frenan', { para: 'Dueño Gomez; Juan Prueba' }, 'entrada'],
        ['lo mismo citado con comas', { cuerpo: 'Para: Dueño Gomez, Juan Prueba' }, 'entrada'],
    ];
    for (const [nombre, cambios, esperado] of casos) it(`${nombre} -> ${esperado}`, () => expect(clasificar(mail(cambios), priv)).toBe(esperado));
    it('algo que no es un mail no sube', () => { for (const x of [null, undefined, 'texto', 5, []]) expect(clasificar(x, priv)).toBe('privado'); });
    it('sin la lista de lo privado completa no sube nada, ni un mail de trabajo', () => {
        for (const p of [null, undefined, {}, listaPrivada(null), listaPrivada({ direcciones: ['dueno@barack.test'] })]) expect(clasificar(mail(), p)).toBe('privado');
    });
    // tercera auditoria (05/10/2026): el nombre o el apellido adentro de una CASILLA, pegado, o en el identificador del mail
    const TERCERA = [
        ['su correo personal con el nombre en la casilla', { de: 'D', de_mail: 'dueno.prueba@gmail.com' }],
        ['la casilla de trabajo con otro dominio', { de: 'DP', de_mail: 'dueno@gmail.com', cuerpo: 'x' }, 'entrada'],     // «dueno» solo no dice nada (5 letras)
        ['el apellido de la lista de apellidos en una casilla', { cc: 'Z', cc_mails: ['zzapellido@estudio.com.ar'] }],
        ['el nombre al reves en una casilla de Para', { para: 'P', para_mails: ['prueba.dueno@hotmail.com'] }],
        ['el nombre en la casilla de la copia oculta', { cco_mails: ['dueno.prueba@gmail.com'] }],
        ['el nombre en «en nombre de»', { representa_mail: 'dueno.prueba@gmail.com' }],
        ['la casilla privada con un + adentro', { de: 'R', de_mail: 'rrhh+avisos@barack.test' }, 'cuarentena'],          // otra casilla: la frena la red (rrhh)
        ['adjunto con el nombre pegado', { adjuntos: ['DuenoPrueba.pdf'] }],
        ['adjunto con el nombre pegado en minusculas', { adjuntos: ['duenoprueba.pdf'] }],
        ['adjunto con el apellido pegado a otra palabra', { adjuntos: ['ContratoZzapellido.pdf'] }],
        ['adjunto con el apellido pegado a una sigla', { adjuntos: ['CVZzapellido.docx'] }],
        ['adjunto con el apellido pegado en minusculas', { adjuntos: ['notazzapellido2026.pdf'] }],
        ['adjunto con la inicial y el apellido pegados', { adjuntos: ['FirmaDPrueba.png'] }],
        ['la inicial y el apellido en una palabra', { cuerpo: 'firma: dprueba' }],
        ['el nombre en el identificador del mail', { id: '<dueno.prueba.123@gmail.com>' }],
        ['la casilla privada con %40', { cuerpo: 'dueno%40barack.test' }],
        ['la casilla privada con &#64;', { cuerpo: 'dueno&#64;barack.test' }],
        ['la casilla privada con (arroba)', { cuerpo: 'dueno (arroba) barack.test' }],
        ['la casilla privada con « at »', { cuerpo: 'dueno at barack.test' }],
        ['la casilla privada con (dot)', { cuerpo: 'dueno@barack (dot) test' }],
        ['la casilla privada con un guion invisible adentro', { cuerpo: 'due­no@barack.test' }],
        ['el nombre con un espacio que no corta', { cuerpo: 'Dueño Prueba' }],
        ['el nombre con un caracter invisible adentro', { cuerpo: 'Due​ño Prueba' }],
    ];
    for (const [nombre, cambios, esperado = 'privado'] of TERCERA) it(`${nombre} -> ${esperado}`, () => expect(clasificar(mail(cambios), priv)).toBe(esperado));
    it('un tema en el identificador del mail lo frena la red', () => expect(clasificar(mail({ id: '<recibo.de.sueldo.octubre@liquidaciones.com>' }), priv)).toBe('cuarentena'));
    it('lo que Outlook tiene marcado como personal, privado o confidencial no sube', () => {
        for (const reserva of [1, 2, 3, 9, '2', null]) expect(clasificar(mail({ reserva }), priv), String(reserva)).toBe('cuarentena');
        expect(clasificar(mail({ reserva: 0 }), priv)).toBe('entrada');
    });
    it('sale lo mismo que se miro: las casillas limpias y de la fecha solo la fecha', () => {
        const p = paraPublicar(mail({ de_mail: ' "Juan" <JPerez@Proveedor.com> ', para_mails: ['Carlos <c.prueba@barackmercosul.com>'], cc_mails: ['smtp:x@y.test;'], fecha: '2026-10-01 10:00 y algo mas' }));
        expect([p.de_mail, p.para_mails, p.cc_mails, p.fecha]).toEqual(['jperez@proveedor.com', ['c.prueba@barackmercosul.com'], ['x@y.test'], '2026-10-01 10:00']);
    });
    it('lo que se publica es una lista cerrada de campos: uno de mas no sale', () => {
        const p = paraPublicar(mail({ cuerpo_html: '<p>recibo de sueldo</p>', cco_mails: ['x@barackmercosul.com'], representa_mail: 'y@barackmercosul.com', otro: { a: 1 } }));
        expect(Object.keys(p).sort()).toEqual(['adjuntos', 'asunto', 'carpeta', 'cc', 'cc_mails', 'conversacion', 'cuerpo', 'de', 'de_mail', 'eid', 'fecha', 'id', 'para', 'para_mails']);
    });
});

describe('mails_area: la red de temas (por palabras, en todo lo que subiria)', () => {
    const priv = listaPrivada();
    const LARGO = 'Detalle del pedido de piezas. '.repeat(400);   // 12.000 caracteres de trabajo
    const FRENA = [
        ['sueldo en el texto', { cuerpo: 'el sueldo no importa aca' }],
        ['licencia medica con tilde en el asunto', { asunto: 'Licencia médica de Juan' }],
        ['sancion en el asunto', { asunto: 'Sanción a un operario' }],
        ['aguinaldo', { cuerpo: 'se paga el aguinaldo el viernes' }],
        ['el tema esta en el nombre de un adjunto', { adjuntos: ['Recibo de sueldo septiembre.pdf'] }],
        ['palabra extra de la lista', { asunto: 'Avance del Proyecto Reservado' }],
        ['un despido de verdad', { cuerpo: 'se resolvio el despido del operario' }],
        ['el tema aparece al final de un texto largo', { cuerpo: `${LARGO}\nPD: ya te mande el recibo de sueldo.` }],
        // adjuntos con guiones, pegados (con y sin mayuscula en el medio) o con numeros
        ...['recibo_de_sueldo_sept.pdf', 'ReciboSueldo.pdf', 'sueldos2026.xlsx', 'LIQUIDACION-HABERES-0926.PDF', 'recibosueldo.pdf', 'RECIBOSUELDO.PDF', 'CERTIFICADOMEDICO.jpg', 'licenciamedica.pdf', 'LIQUIDACIONsueldos.xls'].map((a) => [`adjunto ${a}`, { adjuntos: [a] }]),
        // las formas de la palabra
        ...['hubo dos despidos en el turno', 'fue despedido ayer', 'A Perez lo despido el viernes.', 'los despiden a fin de mes', 'A Perez lo despido el viernes. Sin mas, me despido atentamente.',
            'Hay que despedir a Perez', 'Lo despedimos ayer', 'Lo despedi yo', 'los pedidos de anticipos se cargan hoy', 'quedo sancionado', 'A Perez lo sancionaron', 'Lo sancionamos',
            'Juan renunció ayer', 'Perez esta renunciando', 'Renunciamos los dos', 'Presento la renuncia', 'queda suspendido por tres dias', 'Lo suspendieron una semana', 'Fue suspendido', 'Suspension de Perez',
            'lo ve RR.HH. mañana', 'Saludos\nAna - RRHH', 'llego un oficio de embargo', 'Lo embargaron', 'falto por enfermedad', 'Esta enfermo', 'Se enfermo', 'Lo operaron', 'Lo internaron', 'Se accidento',
            'Indemnizar a Perez', 'El haber de octubre', 'Los haberes', 'Esta embarazada', 'Fallecio el padre', 'Lo apercibieron', 'Lo desvincularon'].map((c) => [`«${c}»`, { cuerpo: c }]),
        // lo que la lista publicada promete de los sueldos, y otros temas de personal
        ...['Suspension de 3 dias', 'Liquidacion octubre', 'Recibo octubre', 'Recibos firmados', 'Liquidacion del mes de Baptista', 'Remuneracion de octubre', 'Remuneraciones', 'Horas extras de Perez', 'Pago de la quincena',
            'Vale de adelanto', 'Categoria y basico de Perez', 'Carpeta medica', 'Parte de enfermo', 'Alta medica', 'Licencia por duelo', 'Ausentismo de Perez', 'Llamado de atencion', 'Amonestacion', 'Descargo de Perez',
            'Acoso laboral', 'Denuncia contra el supervisor', 'Huelga', 'Asamblea en planta', 'Comision interna', 'Demanda laboral', 'Oficio judicial', 'Curriculum de Perez', 'DNI 30.111.222', 'CUIL 20-30111222-3',
            'Tu código de verificación', 'Your verification code is 123456', 'payroll october', 'sick leave', 'senha: 1234', 'Bono de fin de anio', 'PIN de la tarjeta 4455'].map((a) => [`asunto «${a}»`, { asunto: a }]),
        ['una contraseña', { cuerpo: 'tu contraseña nueva es la de siempre' }],
        ['la clave escrita', { cuerpo: 'La clave es Hola1234' }],
        ['usuario y clave', { cuerpo: 'Usuario: csb Clave: 1234' }],
        // los campos que tambien suben: la carpeta, el nombre y la casilla del remitente, los nombres de Para y CC
        ['la carpeta se llama Sueldos', { carpeta: 'Bandeja de entrada / Sueldos 2026', asunto: 'Octubre' }],
        ['la carpeta se llama Personal', { carpeta: 'Bandeja de entrada / Personal / Varios', asunto: 'RE: novedades' }],
        ['la carpeta se llama PRIVADO', { carpeta: 'PRIVADO' }],
        ['el remitente se llama «Liquidacion de Sueldos»', { de: 'Liquidacion de Sueldos - Estudio Lopez', de_mail: 'info@estudiolopez.com.ar', asunto: 'Octubre' }],
        ['la casilla del remitente es sueldos@', { de: 'Maria', de_mail: 'sueldos@estudiolopez.com.ar', asunto: 'Octubre' }],
        ['la casilla del remitente es rrhh@ de un proveedor', { de: 'Maria', de_mail: 'rrhh@proveedor.com', asunto: 'Consulta' }],
        ['una casilla de recursos humanos pegada, en copia', { cc_mails: ['recursoshumanos.planta@otraempresa.com'] }],
        ['una casilla «personal@» de otra empresa', { para: 'Maria', para_mails: ['personal@otraempresa.com'] }],
        ['una casilla «direccion@» que no esta en la lista', { de: 'Maria', de_mail: 'direccion@barackmercosul.com' }],
        ['el remitente se llama «Dirección»', { de: 'Dirección Barack', de_mail: 'x@barackmercosul.com' }],
        ['el remitente es un gremio', { de: 'SMATA Seccional Avellaneda', de_mail: 'info@gremio.org.ar', asunto: 'Novedades' }],
        ['el Para se llama Recursos Humanos', { para: 'Recursos Humanos', para_mails: ['x@otraempresa.com'] }],
        ['la evaluacion de desempeño de una persona', { asunto: 'Evaluación de desempeño de Juan' }],
    ];
    for (const [nombre, cambios] of FRENA) it(`frena: ${nombre}`, () => expect(clasificar(mail(cambios), priv)).toBe('cuarentena'));
    // lo que es TRABAJO no se frena de mas
    const PASA = [
        ['la despedida de un mail no es un despido', { cuerpo: 'Sin mas, me despido atentamente.' }],
        ['"nos despedimos" tampoco', { cuerpo: 'Nos despedimos hasta la proxima reunion.' }],
        ['el anticipo de un molde', { asunto: 'Factura de anticipo del molde' }],
        ['el reposo de un adhesivo', { cuerpo: 'Tiempo de reposo del adhesivo: 24 h.' }],
        ['la unidad de medida (UOM)', { asunto: 'Cambio de UOM en la BOM' }],
        ['el pie legal «confidencial»', { cuerpo: 'Adjunto el plano.\n\nEste mensaje es confidencial y para uso exclusivo del destinatario.' }],
        ['«sin embargo»', { cuerpo: 'Sin embargo, el plano esta bien.' }],
        ['el legajo de un proyecto', { asunto: 'Legajo APQP del proyecto' }],
        ['la evaluacion de desempeño de un proveedor', { asunto: 'Evaluación de desempeño de proveedores - septiembre' }],
        ['una liquidacion de stock', { cuerpo: 'liquidacion de stock de vinilo' }],
        ['la caracteristica clave de un plano', { cuerpo: 'es una caracteristica clave del plano' }],
        ['un despacho', { cuerpo: 'el despacho de piezas sale el martes' }],
        ['una licencia de software', { asunto: 'Renovacion de la licencia de AutoCAD' }],
        ['soldar no es un sueldo', { cuerpo: 'que el proveedor suelde los soportes antes del jueves' }],
        ['acuso recibo', { cuerpo: 'Acuso recibo del plano. Gracias.' }],
        ['un aumento de precios', { asunto: 'Aumento de precios del vinilo' }],
        ['lo interno y lo internacional', { cuerpo: 'codigo interno del proveedor internacional, uso internamente' }],
        ['un operario que opera la maquina', { cuerpo: 'el operario opera la prensa y la operacion 20 sigue igual' }],
        ['la primera quincena como fecha', { cuerpo: 'entregamos en la primera quincena de noviembre' }],
        ['haber, el verbo', { cuerpo: 'puede haber una diferencia en el consumo; debe haber stock' }],
        ['un paro de linea', { asunto: 'Paro de linea por falta de material' }],
    ];
    for (const [nombre, cambios] of PASA) it(`trabajo, pasa: ${nombre}`, () => expect(clasificar(mail(cambios), priv)).toBe('entrada'));
});

describe('mails_area: las piezas del filtro', () => {
    it('paraTemas separa lo pegado y saca signos y numeros', () => {
        expect(paraTemas('ReciboSueldo_0926.PDF')).toBe('recibo sueldo pdf');
        expect(paraTemas('RR.HH.')).toBe('rr hh');
        expect(paraTemas('  Licencia   MÉDICA ')).toBe('licencia medica');
    });
    it('nombraTema mira las palabras extra con el mismo criterio', () => {
        expect(nombraTema('nada personal aca')).toBe(false);
        expect(nombraTema('Proyecto_Reservado.xlsx', [/(?<!\p{L})proyecto reservado(?!\p{L})/u])).toBe(true);
    });
    it('casillaLimpia devuelve la casilla o nada', () => {
        expect(casillaLimpia(' "Juan" <Juan.Perez@Barack.test> ')).toBe('juan.perez@barack.test');
        expect(casillaLimpia('smtp:a@b.test;')).toBe('a@b.test');
        for (const malo of ['', 'juan', 'a@b', 'a b@c.test', '/o=x/cn=y@z.test', null, undefined, 7, ['a@b.test']]) expect(casillaLimpia(malo)).toBe('');
    });
    it('esDeAnthropic mira el dominio entero, con sus subdominios', () => {
        for (const c of ['a@anthropic.com', 'a@mail.anthropic.com', 'a@claude.ai', 'a@x.claude.com']) expect(esDeAnthropic(c)).toBe(true);
        for (const c of ['a@notanthropic.com', 'a@anthropic.com.ar', 'a@barackmercosul.com']) expect(esDeAnthropic(c)).toBe(false);
    });
    it('un nombre se reconoce junto, al reves, con algo en el medio o por inicial y apellido; repartido entre dos personas no', () => {
        const n = ['pedro', 'ergo'];
        for (const t of ['pedro ergo', 'ergo pedro', 'pedro a ergo', 'p ergo', 'ergo p', 'de pedro ergo escribio']) expect(nombreEnPalabras(t.split(' '), n), t).toBe(true);
        for (const t of ['pedro gomez luis ergo', 'pedro', 'ergo', 'pedro cejas daniel ergo', 'a ergo']) expect(nombreEnPalabras(t.split(' '), n), t).toBe(false);
    });
    it('el nombre de la PC: igual, con el dominio, o cortado a 15 letras', () => {
        expect(mismaPc('CARLOS', 'carlos')).toBe(true);
        expect(mismaPc('CARLOS', 'CARLOS.barack.local')).toBe(true);
        expect(mismaPc('NOTEBOOK-DE-CAR', 'notebook-de-carlos')).toBe(true);
        for (const [a, b] of [['CARLOS', 'CARLOS2'], ['', 'CARLOS'], ['CARLOS', ''], ['CAR', 'CARLOS']]) expect(mismaPc(a, b)).toBe(false);
    });
});

describe('mails_area: la lista de lo privado falla cerrada', () => {
    const estado = (contenido) => listaPrivada(contenido).estado;
    const con = (cambios) => ({ ...PRIVADOS_OK, ...cambios });
    it('ausente', () => expect(estado(null)).toBe('falta'));
    it('rota', () => expect(estado('{ esto no es json')).toBe('roto'));
    it('con una coma de mas (no es JSON)', () => expect(estado('{ "total_direcciones": 1, "direcciones": ["dueno@barack.test",] }')).toBe('roto'));
    it('una lista en vez de un objeto', () => expect(estado('[]')).toBe('roto'));
    it('guardada en otra codificacion (un nombre con tilde en ANSI)', () => {
        const pc = armarPc();
        const ruta = path.join(pc.comun, 'mails_privados.json');
        fs.writeFileSync(ruta, Buffer.from(JSON.stringify(con({ nombres: ['Sebastián Pérez'] })), 'latin1'));
        expect(cargarPrivados(ruta).estado).toBe('roto');
        fs.writeFileSync(ruta, JSON.stringify(PRIVADOS_OK), 'utf16le');
        expect(cargarPrivados(ruta).estado).toBe('roto');
    });
    it('vacia', () => expect(estado({ total_direcciones: 0, direcciones: [], dominios: [] })).toBe('incompleto'));
    it('solo con dominios (sin ninguna casilla)', () => expect(estado({ total_direcciones: 0, dominios: ['estudio-contable.test'] })).toBe('incompleto'));
    it('sin la cuenta de casillas', () => expect(estado({ direcciones: ['dueno@barack.test', 'rrhh@barack.test'] })).toBe('incompleto'));
    for (const total of [1, 3, '2', 2.5, null]) it(`con la cuenta de casillas mal: ${JSON.stringify(total)}`, () => expect(estado(con({ total_direcciones: total }))).toBe('incompleto'));
    it('con una casilla repetida (la cuenta no da)', () => expect(estado(con({ direcciones: ['dueno@barack.test', 'Dueno@Barack.test'] }))).toBe('incompleto'));
    it('con la clave de las casillas escrita dos veces', () => {
        expect(estado('{"total_direcciones":1,"direcciones":["dueno@barack.test","rrhh@barack.test"],"direcciones":["x@y.test"]}')).toBe('incompleto');
    });
    for (const [donde, cambios] of [['una casilla', { direcciones: ['dueno@barack.test', 'TBD.rrhh@barack.test'] }], ['un dominio', { dominios: ['tbd.test'] }], ['un nombre', { nombres: ['TBD Apellido'] }], ['un apellido', { apellidos: ['Tbdez'] }], ['una palabra extra', { palabras_extra: ['TBD'] }]]) {
        it(`con un TBD en ${donde}`, () => expect(estado(con(cambios))).toBe('incompleto'));
    }
    for (const mala of ['el dueno', 'dueno @barack.test', '<dueno@barack.test>', 'dueno@barack.test,', 'El Dueno <dueno@barack.test>', 'dueno@barack', 'mailto:dueno@barack.test']) {
        it(`con una casilla mal escrita: ${mala}`, () => expect(estado(con({ direcciones: ['rrhh@barack.test', mala] }))).toBe('incompleto'));
    }
    it('con algo que no es texto en la lista', () => expect(estado(con({ direcciones: ['dueno@barack.test', 5] }))).toBe('incompleto'));
    it('con las direcciones como texto suelto', () => expect(estado(con({ direcciones: 'dueno@barack.test', total_direcciones: 1 }))).toBe('incompleto'));
    it('con una clave mal escrita (direciones)', () => expect(estado(con({ direciones: ['rrhh@barack.test'] }))).toBe('incompleto'));
    it('con un dominio que no es un dominio', () => expect(estado(con({ dominios: ['estudio contable'] }))).toBe('incompleto'));
    for (const malo of ['Ana', 'Direccion', 'A B', 'Juan Perez 2', 'Juan <Perez>']) it(`con un nombre que no es nombre y apellido: ${malo}`, () => expect(estado(con({ nombres: [malo] }))).toBe('incompleto'));
    for (const malo of ['Cal', 'De Luca', 'Ergo2', '']) it(`con un apellido que no sirve solo: «${malo}»`, () => expect(estado(con({ apellidos: [malo] }))).toBe('incompleto'));
    for (const mala of ['  ', 'a', '.*', '12']) it(`con una palabra extra que no sirve: «${mala}»`, () => expect(estado(con({ palabras_extra: [mala] }))).toBe('incompleto'));
    it('completa (con sus comentarios y un dominio con arroba adelante)', () => {
        const p = listaPrivada(con({ _fuentes: 'de prueba', dominios: ['@estudio-contable.test'] }));
        expect(p.estado).toBe('ok');
        expect([p.direcciones.size, p.dominios.has('estudio-contable.test'), p.nombres, p.apellidos, p.palabras.length]).toEqual([2, true, [['dueno', 'prueba']], ['zzapellido'], 1]);
    });
    it('completa con la marca del principio (BOM)', () => expect(estado(`\uFEFF${JSON.stringify(PRIVADOS_OK)}`)).toBe('ok'));
});

describe('mails_area: quien sube lo dice la lista publicada, por el usuario de Windows', () => {
    const lista = { personas: [CARLOS, { ...CARLOS, nombre: 'Pedro', usuario_windows: 'Pedro', pc: 'PC-PEDRO', mails: 'no_sube' }, { ...CARLOS, usuario_windows: 'Ana', pc: '', mails: 'sube' }, { ...CARLOS, usuario_windows: 'Ex', pc: 'PC-EX', baja: '2026-09-01' }] };
    it('el usuario y la PC de la fila', () => expect(personaQueSube(lista, SOY_CARLOS)?.mails).toBe('sube'));
    it('sin mirar mayusculas ni tildes', () => expect(personaQueSube(lista, { usuario: 'CARLOS PRUEBA', pc: 'pc-carlos' })).not.toBeNull());
    it('el mismo usuario en OTRA PC no', () => expect(personaQueSube(lista, { usuario: 'Carlos prueba', pc: 'PC-OTRA' })).toBeNull());
    it('otro usuario en la PC de la fila no (el instalador si lo encontraria por la PC)', () => {
        expect(personaQueSube(lista, { usuario: 'Invitado', pc: 'PC-CARLOS' })).toBeNull();
        expect(buscarPersona(lista, { usuario: 'Invitado', pc: 'PC-CARLOS' })).not.toBeNull();
    });
    it('una fila sin PC no prende nada: la subida es de UNA PC', () => expect(personaQueSube(lista, { usuario: 'ana', pc: 'CUALQUIERA' })).toBeNull());
    it('dos filas con el mismo usuario: ninguna', () => {
        const dos = { personas: [CARLOS, { ...CARLOS, nombre: 'Otro Carlos', mail: 'otro@barackmercosul.com' }] };
        expect(personaQueSube(dos, SOY_CARLOS)).toBeNull();
    });
    it('una baja no cuenta (ni para repetir)', () => {
        expect(personaQueSube(lista, { usuario: 'Ex', pc: 'PC-EX' })).toBeNull();
        expect(personaQueSube({ personas: [CARLOS, { ...CARLOS, baja: '2026-01-01' }] }, SOY_CARLOS)).not.toBeNull();
    });
    it('sin usuario no', () => expect(personaQueSube(lista, { usuario: '', pc: 'PC-CARLOS' })).toBeNull());
    it('sin lista, o con filas que no son filas, no', () => {
        expect(personaQueSube(null, SOY_CARLOS)).toBeNull();
        expect(personaQueSube({ personas: [null, 'texto', 5] }, SOY_CARLOS)).toBeNull();
    });
    it('la identidad sale de Windows, no de las variables de entorno', () => {
        const yo = identidadReal();
        expect(yo.usuario).toBe(os.userInfo().username);
        expect(yo.pc).toBe(os.hostname());
    });
});

describe('mails_area: una corrida', () => {
    it('una PC que no figura en la lista no hace nada: ni nube, ni estado, ni aviso, ni mira Outlook', async () => {
        const pc = armarPc({ personas: [] });
        const r = await corre(pc);
        expect(r).toEqual({ codigo: 0, resumen: { resultado: 'apagado' } });
        expect(nubeVacia(pc)).toBe(true);
        expect(fs.existsSync(pc.estado)).toBe(false);
        expect(fs.existsSync(path.join(pc.home, 'Trabajo'))).toBe(false);
    });
    for (const valor of ['no_sube', 'habilitado', '', undefined, 'SUBE', true]) {
        it(`con "mails": ${JSON.stringify(valor)} sigue apagada`, async () => {
            const pc = armarPc({ personas: [{ ...CARLOS, mails: valor }] });
            expect((await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) })).resumen.resultado).toBe('apagado');
            expect(nubeVacia(pc)).toBe(true);
        });
    }
    it('sin lista de personas instalada: apagada', async () => {
        const pc = armarPc({ personas: null });
        expect((await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) })).resumen.resultado).toBe('apagado');
    });
    it('la fila dice "sube" pero no trae la PC: apagada', async () => {
        const pc = armarPc({ personas: [{ ...CARLOS, pc: '' }] });
        expect((await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) })).resumen.resultado).toBe('apagado');
        expect(nubeVacia(pc)).toBe(true);
    });
    it('dos filas "sube" con el mismo usuario: apagada', async () => {
        const pc = armarPc({ personas: [CARLOS, { ...CARLOS, mail: 'otra@barackmercosul.com' }] });
        expect((await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) })).resumen.resultado).toBe('apagado');
        expect(nubeVacia(pc)).toBe(true);
    });
    it('las variables de entorno NO prenden la subida: vale lo que dice Windows', async () => {
        const pc = armarPc();
        const r = await corre(pc, { identidad: undefined, env: { ...ENV, USERNAME: 'Carlos prueba', COMPUTERNAME: 'PC-CARLOS' }, fuenteJsonl: fuente(pc, [mail()]) });
        expect(r.resumen.resultado).toBe('apagado');
        expect(nubeVacia(pc)).toBe(true);
    });
    it('habilitada pero sin la lista de lo privado: no sube nada (codigo 5)', async () => {
        const pc = armarPc({ privados: null });
        const r = await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) });
        expect([r.codigo, r.resumen.resultado]).toEqual([5, 'sin_filtro']);
        expect(nubeVacia(pc)).toBe(true);
        expect(hayAviso(pc)).toBe(false);
    });
    for (const [nombre, privados] of [['sin completar', { total_direcciones: 2, direcciones: ['g.cal@barack.test', 'TBD.dueno@barack.test'] }], ['mal escrita', { ...PRIVADOS_OK, direciones: ['rrhh@barack.test'] }], ['con la cuenta mal', { ...PRIVADOS_OK, total_direcciones: 5 }]]) {
        it(`habilitada pero con lo privado ${nombre}: no sube nada (codigo 5) y el estado dice que no esta lista`, async () => {
            const pc = armarPc({ privados });
            const r = await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) });
            expect([r.codigo, r.resumen.resultado]).toEqual([5, 'filtro_incompleto']);
            expect(nubeVacia(pc)).toBe(true);
            expect(estadoDe(pc)).toMatchObject({ habilitada: false, subidos_total: 0 });
            expect(hayAviso(pc)).toBe(false);
        });
    }
    it('la casilla de la propia persona en lo privado: no sube nunca', async () => {
        const pc = armarPc({ privados: { total_direcciones: 1, direcciones: [CASILLA] } });
        expect((await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) })).resumen.resultado).toBe('privado');
        expect(nubeVacia(pc)).toBe(true);
        expect(estadoDe(pc).habilitada).toBe(false);
    });
    it('la fila no trae la casilla, o no es una casilla: no sube (codigo 3)', async () => {
        for (const m of ['', 'Carlos Prueba', '/o=x/cn=carlos']) {
            const pc = armarPc({ personas: [{ ...CARLOS, mail: m }] });
            const r = await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) });
            expect([r.codigo, r.resumen.resultado]).toEqual([3, 'sin_casilla']);
            expect(nubeVacia(pc)).toBe(true);
        }
    });
    it('no se ve la biblioteca (o la carpeta no se llama CLAUDE POR AREA): no crea nada (codigo 6) ni deja el aviso', async () => {
        for (const pc of [armarPc({ conHermana: false }), armarPc({ nombreRaiz: 'otra carpeta' })]) {
            const r = await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) });
            expect([r.codigo, r.resumen.resultado]).toEqual([6, 'sin_nube']);
            expect(nubeVacia(pc)).toBe(true);
            expect(hayAviso(pc)).toBe(false);
            expect(estadoDe(pc).habilitada).toBe(false);
        }
        const pc = armarPc();
        expect((await corre(pc, { raizNube: undefined, fuenteJsonl: fuente(pc, [mail()]) })).resumen.resultado).toBe('sin_nube');
    });

    it('habilitada y con el filtro completo: sube SOLO lo de trabajo, anota todo y deja el aviso una vez', async () => {
        const pc = armarPc();
        const buenos = [mail({ asunto: 'Plano nuevo' }), mail({ asunto: 'Consumo de vinilo', adjuntos: ['tizada.pdf'], cco_mails: ['oculto@barackmercosul.com'], representa_mail: 'jefe@barackmercosul.com', campo_de_mas: 'no sale' })];
        const malos = [mail({ de_mail: 'dueno@barack.test' }), mail({ asunto: 'Recibo de sueldo' }), mail({ sin_resolver: 2 }), mail({ de_mail: 'noreply@anthropic.com' }), mail({ cco_mails: ['rrhh@barack.test'] }), mail({ cuerpo: 'Saludos,\nDueño Prueba' })];
        const viejo = mail({ fecha: '2026-05-01 09:00', asunto: 'de hace cinco meses' });
        const r = await corre(pc, { fuenteJsonl: fuente(pc, [{ t: 'buzon', casilla: CASILLA }, buenos[0], ...malos, buenos[1], viejo]) });
        expect(r.codigo).toBe(0);
        expect(r.resumen).toMatchObject({ resultado: 'ok', autor: 'c.prueba', nuevos: 8, en_espera: 0, entrada: 2, cuarentena: 1, privado: 5, privados: '2 casillas, 1 dominios, 1 nombres, 1 apellidos', aviso_nuevo: false });
        const arriba = subidos(pc);
        expect(arriba.map((m) => m.id).sort()).toEqual(buenos.map((m) => m.id).sort());
        // lo que se publica no lleva la copia oculta, ni a nombre de quien, ni los campos internos, ni uno que no se conoce
        for (const m of arriba) for (const campo of ['sin_resolver', 'cco_mails', 'representa_mail', 't', 'campo_de_mas']) expect(m).not.toHaveProperty(campo);
        expect(JSON.stringify(arriba)).not.toContain('oculto@');
        expect(archivos(pc.entrada)).toEqual([path.join('c.prueba', '20261005-160000.jsonl')]);
        // todo lo demas de la biblioteca sigue vacio: no hay carpeta de cuarentena ni copias de lo privado
        expect(archivos(path.join(pc.t, 'biblioteca'))).toEqual([path.join('Claude Barack', 'mails', '_entrada', 'c.prueba', '20261005-160000.jsonl')]);
        const ids = fs.readFileSync(path.join(pc.estado, ARCHIVO_SUBIDOS), 'utf8').split('\n').filter(Boolean);
        expect(ids.sort()).toEqual([...buenos, ...malos].map((m) => m.id).sort());
        expect(estadoDe(pc)).toMatchObject({ habilitada: true, subidos_total: 2, resultado: 'ok', completa: true, marca: '2026-10-05T16:00:00', aviso_desde: '2026-10-04T14:00:00', colgadas: 0 });
        const aviso = fs.readFileSync(path.join(pc.home, 'Trabajo', NOMBRE_AVISO), 'utf8');
        for (const frase of ['Desde el 04/10/2026, en esta PC está prendido', 'La primera copia se hace un día después', 'privados o confidenciales', 'PARA APAGARLO', 'copia oculta', 'citados, reenviados o firmados', 'un día después', 'se copia igual', 'en qué carpeta', '«Personal»']) expect(aviso).toContain(frase);
        // ningun mail queda copiado en el disco de la PC: el estado solo tiene identificadores y cuentas
        for (const f of archivos(pc.estado)) expect(fs.readFileSync(path.join(pc.estado, f), 'utf8')).not.toContain('Plano nuevo');

        // segunda corrida con lo mismo: nada nuevo, ningun archivo mas, y el aviso no se vuelve a escribir
        fs.writeFileSync(path.join(pc.home, 'Trabajo', NOMBRE_AVISO), 'lo leyo y lo cambio la persona', 'utf8');
        const r2 = await corre(pc, { fuenteJsonl: fuente(pc, [...buenos, ...malos]), ahora: new Date(2026, 9, 5, 20, 0, 0) });
        expect(r2.resumen).toMatchObject({ resultado: 'ok', nuevos: 0, entrada: 0, aviso_nuevo: false });
        expect(archivos(pc.entrada).length).toBe(1);
        expect(fs.readFileSync(path.join(pc.home, 'Trabajo', NOMBRE_AVISO), 'utf8')).toBe('lo leyo y lo cambio la persona');
        expect(estadoDe(pc)).toMatchObject({ habilitada: true, subidos_total: 2 });
    });

    it(`el mail de menos de ${GRACIA_HORAS} horas espera: no sube ni se anota, y sube cuando cumple el dia`, async () => {
        const pc = armarPc();
        const deAyer = mail({ fecha: '2026-10-04 15:00', asunto: 'de ayer a las 15' });       // 25 horas
        const deHoy = mail({ fecha: '2026-10-05 09:00', asunto: 'de hoy a la mañana' });      // 7 horas
        const deRecien = mail({ fecha: '2026-10-04 17:00', asunto: 'de ayer a las 17' });     // 23 horas
        const f = fuente(pc, [deAyer, deHoy, deRecien]);
        const r = await corre(pc, { fuenteJsonl: f });
        expect(r.resumen).toMatchObject({ resultado: 'ok', nuevos: 1, en_espera: 2, entrada: 1 });
        expect(subidos(pc).map((m) => m.asunto)).toEqual(['de ayer a las 15']);
        expect(fs.readFileSync(path.join(pc.estado, ARCHIVO_SUBIDOS), 'utf8')).not.toContain(deHoy.id);
        // al dia siguiente, la misma lectura: suben los dos que esperaban
        const r2 = await corre(pc, { fuenteJsonl: f, ahora: new Date(2026, 9, 6, 16, 0, 0) });
        expect(r2.resumen).toMatchObject({ resultado: 'ok', nuevos: 2, en_espera: 0, entrada: 2 });
        expect(subidos(pc).map((m) => m.asunto).sort()).toEqual(['de ayer a las 15', 'de ayer a las 17', 'de hoy a la mañana']);
    });

    it('el buzon abierto es el de OTRA persona: no sube nada (codigo 3)', async () => {
        for (const casilla of ['dueno@barack.test', 'otra@barackmercosul.com', '', 'no se sabe']) {
            const pc = armarPc();
            const r = await corre(pc, { fuenteJsonl: fuente(pc, [{ t: 'buzon', casilla }, mail(), mail()]) });
            expect([r.codigo, r.resumen.resultado]).toEqual([3, 'otro_buzon']);
            expect(nubeVacia(pc)).toBe(true);
            expect(r.resumen.entrada).toBe(0);
        }
    });

    it('lo que subio no baja, y "lista" se dice solo cuando es verdad', async () => {
        const pc = armarPc();
        await corre(pc, { fuenteJsonl: fuente(pc, [mail(), mail()]) });
        expect(estadoDe(pc)).toMatchObject({ habilitada: true, subidos_total: 2 });
        // una corrida sin la nube a la vista: sigue como venia
        await corre(pc, { raizNube: undefined, fuenteJsonl: fuente(pc, [mail()]) });
        expect(estadoDe(pc)).toMatchObject({ habilitada: true, subidos_total: 2, resultado: 'sin_nube' });
        // se rompe la lista de lo privado: ya no esta lista, pero lo que subio, subio
        fs.writeFileSync(path.join(pc.comun, 'mails_privados.json'), '{ roto', 'utf8');
        await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) });
        expect(estadoDe(pc)).toMatchObject({ habilitada: false, subidos_total: 2, resultado: 'sin_filtro' });
        // vuelve la lista: sube uno mas
        fs.writeFileSync(path.join(pc.comun, 'mails_privados.json'), JSON.stringify(PRIVADOS_OK), 'utf8');
        await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) });
        expect(estadoDe(pc)).toMatchObject({ habilitada: true, subidos_total: 3, resultado: 'ok' });
    });

    it('nunca pisa un archivo de la nube: el mismo momento se desempata con -2', async () => {
        const pc = armarPc();
        const a = mail({ asunto: 'primero' });
        const b = mail({ asunto: 'segundo' });
        await corre(pc, { fuenteJsonl: fuente(pc, [a]) });
        const antes = fs.readFileSync(path.join(pc.entrada, 'c.prueba', '20261005-160000.jsonl'), 'utf8');
        await corre(pc, { fuenteJsonl: fuente(pc, [b]) });
        expect(archivos(pc.entrada)).toEqual([path.join('c.prueba', '20261005-160000-2.jsonl'), path.join('c.prueba', '20261005-160000.jsonl')]);
        expect(fs.readFileSync(path.join(pc.entrada, 'c.prueba', '20261005-160000.jsonl'), 'utf8')).toBe(antes);
        expect(() => { for (let i = 0; i < 3; i++) escribirLote(pc.mails, 'c.prueba', [a], AHORA); }).not.toThrow();
        expect(fs.readFileSync(path.join(pc.entrada, 'c.prueba', '20261005-160000.jsonl'), 'utf8')).toBe(antes);
        // no queda ningun archivo a medio escribir
        expect(archivos(pc.entrada).every((f) => f.endsWith('.jsonl'))).toBe(true);
    });

    it('si alguna carpeta del camino en la nube es un enlace a otro lado, no escribe', async () => {
        // la carpeta de la persona, `_entrada` o `mails`: error al escribir
        for (const cual of ['c.prueba', '_entrada', 'mails']) {
            const pc = armarPc();
            const otroLado = path.join(pc.t, 'otro-lado');
            fs.mkdirSync(otroLado, { recursive: true });
            const enlace = cual === 'mails' ? pc.mails : cual === '_entrada' ? pc.entrada : path.join(pc.entrada, 'c.prueba');
            fs.mkdirSync(path.dirname(enlace), { recursive: true });
            fs.symlinkSync(otroLado, enlace, 'junction');
            const r = await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) });
            expect(r.resumen.resultado, cual).toBe('error');
            expect(archivos(otroLado), cual).toEqual([]);
            expect(estadoDe(pc).subidos_total).toBe(0);
        }
        // la carpeta «Claude Barack» entera: no se ve la biblioteca
        const pc = armarPc({ conHermana: false });
        const otroLado = path.join(pc.t, 'otro-lado');
        fs.mkdirSync(otroLado, { recursive: true });
        fs.symlinkSync(otroLado, path.join(pc.t, 'biblioteca', 'Claude Barack'), 'junction');
        const r = await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) });
        expect(r.resumen.resultado).toBe('sin_nube');
        expect(archivos(otroLado)).toEqual([]);
    });

    it('un identificador con saltos de renglon o tabulaciones no rompe la lista de lo ya subido', async () => {
        const pc = armarPc();
        const raros = [mail({ id: '<a@b.test>\n<otro@b.test>' }), mail({ id: '<c@b.test>\t x ' })];
        await corre(pc, { fuenteJsonl: fuente(pc, raros) });
        const r2 = await corre(pc, { fuenteJsonl: fuente(pc, raros), ahora: new Date(2026, 9, 5, 20, 0, 0) });
        expect(r2.resumen.nuevos).toBe(0);
        expect(subidos(pc).length).toBe(2);
    });

    it('--simular cuenta y no escribe nada: ni nube, ni estado, ni aviso', async () => {
        const pc = armarPc();
        const r = await directo(pc, { simular: true, fuenteJsonl: fuente(pc, [mail(), mail({ asunto: 'Sancion' })]) });
        expect(r.resumen).toMatchObject({ resultado: 'simulado', entrada: 1, cuarentena: 1 });
        expect(nubeVacia(pc)).toBe(true);
        expect(fs.existsSync(pc.estado)).toBe(false);
        expect(fs.existsSync(path.join(pc.home, 'Trabajo'))).toBe(false);
    });

    it('una PC que subia y se apaga en la lista: deja de subir, el estado lo dice y la persona tiene otro aviso; si se vuelve a prender, otro mas', async () => {
        const pc = armarPc();
        await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) });
        fs.writeFileSync(path.join(pc.comun, 'personas.json'), JSON.stringify({ personas: [{ ...CARLOS, mails: 'no_sube' }] }), 'utf8');
        const r = await corre(pc, { fuenteJsonl: fuente(pc, [mail({ asunto: 'despues de apagar' })]), ahora: new Date(2026, 9, 20, 9, 0, 0) });
        expect(r.resumen.resultado).toBe('apagado');
        expect(subidos(pc).map((m) => m.asunto)).not.toContain('despues de apagar');
        expect(estadoDe(pc)).toMatchObject({ habilitada: false, subidos_total: 1, resultado: 'apagado', apagada_desde: '2026-10-20T09:00:00' });
        const fin = 'AVISO - desde el 20-10-2026 a las 09.00 los mails de esta PC ya no se comparten.txt';
        expect(avisosDe(pc)).toEqual([fin, NOMBRE_AVISO].sort());
        expect(fs.readFileSync(path.join(pc.home, 'Trabajo', fin), 'utf8')).toMatch(/Desde el 20\/10\/2026, los mails de esta PC ya no se copian/);
        // otra corrida apagada: no escribe otro aviso
        await corre(pc, { ahora: new Date(2026, 9, 21, 9, 0, 0) });
        expect(avisosDe(pc).length).toBe(2);
        // se vuelve a prender: un aviso nuevo con su fecha y su hora, el primero sigue como estaba, y ese dia no copia nada
        fs.writeFileSync(path.join(pc.comun, 'personas.json'), JSON.stringify({ personas: [CARLOS] }), 'utf8');
        const f3 = fuente(pc, [mail({ fecha: '2026-10-30 10:00' })]);
        const r3 = await corre(pc, { fuenteJsonl: f3, ahora: new Date(2026, 10, 1, 9, 0, 0) });
        expect(r3.resumen.resultado).toBe('primer_dia');
        expect(avisosDe(pc)).toContain('AVISO - desde el 01-11-2026 a las 09.00 los mails de esta PC se comparten de nuevo.txt');
        expect(estadoDe(pc)).toMatchObject({ habilitada: true, subidos_total: 1, prendida_de_nuevo: '2026-11-01T09:00:00' });
        expect(estadoDe(pc)).not.toHaveProperty('apagada_desde');
        const r4 = await corre(pc, { fuenteJsonl: f3, ahora: new Date(2026, 10, 2, 10, 0, 0) });
        expect(r4.resumen).toMatchObject({ resultado: 'ok', entrada: 1 });
        expect(estadoDe(pc)).toMatchObject({ habilitada: true, subidos_total: 2 });
        expect(avisosDe(pc).length).toBe(3);
    });

    it('el dia que se prende solo se deja el aviso: la primera copia es un dia despues', async () => {
        const pc = armarPc();
        const f = fuente(pc, [mail({ fecha: '2026-09-20 10:00', asunto: 'de hace dos semanas' })]);
        const r = await directo(pc, { fuenteJsonl: f });
        expect(r).toMatchObject({ codigo: 0, resumen: { resultado: 'primer_dia', aviso_nuevo: true } });
        expect(nubeVacia(pc)).toBe(true);
        expect(hayAviso(pc)).toBe(true);
        expect(estadoDe(pc)).toMatchObject({ habilitada: true, subidos_total: 0, resultado: 'primer_dia', aviso_desde: '2026-10-05T16:00:00' });
        // 23 horas despues: todavia no
        const r2 = await directo(pc, { fuenteJsonl: f, ahora: new Date(2026, 9, 6, 15, 0, 0) });
        expect(r2.resumen.resultado).toBe('primer_dia');
        expect(nubeVacia(pc)).toBe(true);
        // 25 horas despues: ahi copia
        const r3 = await directo(pc, { fuenteJsonl: f, ahora: new Date(2026, 9, 6, 17, 0, 0) });
        expect(r3.resumen).toMatchObject({ resultado: 'ok', entrada: 1, aviso_nuevo: false });
        expect(subidos(pc).map((m) => m.asunto)).toEqual(['de hace dos semanas']);
    });

    it('si se apaga despues de pasar por otro estado (la lista de lo privado rota), la persona igual recibe el aviso de que ya no', async () => {
        const pc = armarPc();
        await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) });
        fs.writeFileSync(path.join(pc.comun, 'mails_privados.json'), JSON.stringify({ ...PRIVADOS_OK, total_direcciones: 9 }), 'utf8');
        expect((await corre(pc, { ahora: new Date(2026, 9, 6, 9, 0, 0) })).resumen.resultado).toBe('filtro_incompleto');
        fs.writeFileSync(path.join(pc.comun, 'personas.json'), JSON.stringify({ personas: [{ ...CARLOS, mails: 'no_sube' }] }), 'utf8');
        expect((await corre(pc, { ahora: new Date(2026, 9, 7, 9, 0, 0) })).resumen.resultado).toBe('apagado');
        expect(avisosDe(pc)).toContain('AVISO - desde el 07-10-2026 a las 09.00 los mails de esta PC ya no se comparten.txt');
        expect(estadoDe(pc).apagada_desde).toBe('2026-10-07T09:00:00');
    });

    it('si no se puede anotar lo que sube, no sube (si no, cada corrida repetiria lo mismo)', async () => {
        const pc = armarPc();
        await directo(pc, { ahora: ANTES });
        fs.mkdirSync(path.join(pc.estado, ARCHIVO_SUBIDOS), { recursive: true });      // una carpeta donde va el archivo: no se puede escribir
        for (let i = 0; i < 2; i++) {
            const r = await directo(pc, { fuenteJsonl: fuente(pc, [mail(), mail()]), ahora: new Date(2026, 9, 5, 16, i, 0) });
            expect(r.resumen.resultado).toBe('error');
        }
        expect(nubeVacia(pc)).toBe(true);
        expect(estadoDe(pc).subidos_total).toBe(0);
    });

    it('el aviso: uno vacio se vuelve a escribir, y lleva la fecha del dia en que se prendio', async () => {
        const pc = armarPc();
        await corre(pc, { fuenteJsonl: fuente(pc, [mail()]) });
        const ruta = path.join(pc.home, 'Trabajo', NOMBRE_AVISO);
        fs.writeFileSync(ruta, '', 'utf8');
        const r = await corre(pc, { fuenteJsonl: fuente(pc, [mail({ fecha: '2026-12-01 10:00' })]), ahora: new Date(2027, 0, 15, 9, 0, 0) });
        expect(r.resumen.aviso_nuevo).toBe(true);
        expect(fs.readFileSync(ruta, 'utf8')).toContain('Desde el 04/10/2026, en esta PC está prendido');
        // borrado: tambien vuelve, con la misma fecha
        fs.rmSync(ruta);
        await corre(pc, { fuenteJsonl: fuente(pc, [mail({ fecha: '2026-12-02 10:00' })]), ahora: new Date(2027, 0, 16, 9, 0, 0) });
        expect(fs.readFileSync(ruta, 'utf8')).toContain('Desde el 04/10/2026');
    });

    it('otro usuario de Windows en la PC de la persona habilitada: apagada', async () => {
        const pc = armarPc();
        const r = await corre(pc, { identidad: { usuario: 'Invitado', pc: 'PC-CARLOS' }, fuenteJsonl: fuente(pc, [mail()]) });
        expect(r.resumen.resultado).toBe('apagado');
        expect(nubeVacia(pc)).toBe(true);
    });

    it('el perfil de la carpeta NO prende la subida (lo puede editar cualquiera)', async () => {
        const pc = armarPc();
        fs.writeFileSync(path.join(pc.home, 'perfil.json'), JSON.stringify({ usuario_windows: 'Carlos prueba', pc: 'PC-CARLOS', area: 'ingenieria' }), 'utf8');
        const r = await corre(pc, { identidad: { usuario: 'Otra persona', pc: 'PC-OTRA' }, fuenteJsonl: fuente(pc, [mail()]) });
        expect(r.resumen.resultado).toBe('apagado');
        expect(nubeVacia(pc)).toBe(true);
    });
});

describe('mails_area: nombres y carpetas', () => {
    it('el autor es lo de antes de la arroba; con otro dominio, la casilla entera', () => {
        expect(autorDe({ mail: 'C.Prueba@BarackMercosul.com' })).toBe('c.prueba');
        expect(autorDe({ mail: 'c.prueba@otra-empresa.test' })).toBe('c.prueba@otra-empresa.test');
        expect(autorDe({ mail: '..\\..\\otra@barack.test' })).not.toMatch(/[\\/]|\.\./);
        expect(autorDe({ mail: 'sin arroba' })).toBe('');
        expect(autorDe({})).toBe('');
    });
    it('un nombre que Windows reserva no se usa tal cual', () => {
        expect(autorDe({ mail: 'con@barackmercosul.com' })).toBe('_con');
        expect(autorDe({ mail: 'NUL@barackmercosul.com' })).toBe('_nul');
        expect(carpetaSegura('lpt1')).toBe('_lpt1');
    });
    it('carpetaSegura saca lo que Windows no acepta y los ".."', () => {
        expect(carpetaSegura('a/b\\c:d*e?"f<g>h|i')).toBe('a-b-c-d-e--f-g-h-i');
        expect(carpetaSegura('..')).toBe('');
        expect(normalizar('  Licencia   MÉDICA ')).toBe('licencia medica');
    });
    it('la carpeta de mails solo sale de una "CLAUDE POR AREA" que existe y con su hermana', () => {
        const pc = armarPc();
        expect(carpetaDeMails(pc.raizNube)).toBe(pc.mails);
        expect(carpetaDeMails(path.join(pc.raizNube, '1- PUBLICADO'))).toBeNull();
        expect(carpetaDeMails(path.join(pc.t, 'no-esta', 'CLAUDE POR AREA'))).toBeNull();
        expect(carpetaDeMails('')).toBeNull();
    });
});

describe('mails_outlook.ps1: solo lee', () => {
    const fuentePs = fs.readFileSync(LECTOR);
    const codigo = fuentePs.toString('ascii').split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');
    it('va solo en ASCII (PowerShell 5.1)', () => expect([...fuentePs].filter((b) => b > 126).length).toBe(0));
    it('no tiene ninguna orden que mande, guarde, mueva, borre, marque, abra o cierre', () => {
        for (const prohibido of [/\.Send\s*\(/i, /\.Delete\s*\(/i, /\.Move\s*\(/i, /\.Save\s*\(/i, /\.SaveAs/i, /\.SaveAsFile/i, /\.Display\s*\(/i, /\.Copy\s*\(/i, /UnRead/i, /\.Quit\s*\(/i, /\.Kill\s*\(/i,
            /Stop-Process/i, /New-Object\s+-ComObject/i, /CreateObject/i, /Set-Content/i, /Out-File/i, /Add-Content/i, /WriteAll/i, /Remove-Item/i, /New-Item/i, /Start-Process/i, /Invoke-WebRequest|Invoke-RestMethod|Net\.WebClient/i]) {
            expect(codigo).not.toMatch(prohibido);
        }
        expect(codigo).toMatch(/GetActiveObject\('Outlook\.Application'\)/);
    });
    it('dice de quien es el buzon ANTES del primer mail, y separa la copia oculta', () => {
        expect(codigo.indexOf("t = 'buzon'")).toBeGreaterThan(0);
        expect(codigo.indexOf("t = 'buzon'")).toBeLessThan(codigo.indexOf('$pila.Push'));
        expect(codigo).toMatch(/cco_mails/);
        expect(codigo).toMatch(/representa_mail/);
    });
    it('lo que no puede ver bien no lo deja pasar: grupos, adjuntos que no se leen, tipo de destinatario, borradores sueltos', () => {
        expect(codigo).toMatch(/AddressEntryUserType/);                                   // un grupo de correo cuenta como sin resolver
        expect(codigo).toMatch(/FileName\)\) \}\s*\} catch \{ \$sinResolver\+\+ \}/);     // los adjuntos que no se pueden leer, tambien
        expect(codigo).toMatch(/\$r\.Type \} catch \{ \$tipo = 3 \}/);                    // sin el tipo, va con la copia oculta (no se publica)
        expect(codigo).toMatch(/\$m\.Sent/);                                              // un borrador fuera de Borradores no es un mail
        expect(codigo).toMatch(/t = 'latido'/);                                           // avisa que sigue vivo
    });
    it('no usa una variable que se llame como un parametro (PowerShell no distingue mayusculas)', () => {
        const parametros = [...codigo.matchAll(/\[(?:string|int)\]\$(\w+)/g)].map((m) => m[1].toLowerCase());
        for (const p of ['conocidos', 'desde']) {
            expect(parametros).toContain(p);
            expect(codigo).not.toMatch(new RegExp(`\\$${p}\\s*=\\s*New-Object`, 'i'));
        }
    });
    const conPowerShell = process.platform === 'win32';
    it.runIf(conPowerShell)('sin Outlook clasico abierto dice "cerrado": no sube nada (codigo 4), pero la PC ya esta lista y la persona ya tiene su aviso', async () => {
        const pc = armarPc();
        await directo(pc, { ahora: ANTES });      // el primer dia: solo el aviso
        const r = await correr({ home: pc.home, raizNube: pc.raizNube, estado: pc.estado, ahora: AHORA, env: { ...process.env, CLAUDE_AREA_SIN_OUTLOOK: '1' }, identidad: SOY_CARLOS, lector: LECTOR, maxMinutos: 2 });
        expect([r.codigo, r.resumen.resultado]).toEqual([4, 'outlook_cerrado']);
        expect(nubeVacia(pc)).toBe(true);
        expect(hayAviso(pc)).toBe(true);
        expect(estadoDe(pc)).toMatchObject({ habilitada: true, subidos_total: 0, resultado: 'outlook_cerrado' });
    }, 60000);
    it.runIf(conPowerShell)('si Outlook deja de contestar (un cartel en la pantalla) se corta enseguida; a la segunda seguida no insiste por una semana', async () => {
        const pc = armarPc();
        // un lector de mentira: dice de quien es el buzon y se queda esperando, como Outlook con un cartel abierto
        const colgado = path.join(pc.t, 'lector-colgado.ps1');
        fs.writeFileSync(colgado, `param([string]$Desde = '', [string]$Conocidos = '', [int]$MaxSegundos = 0)\r\n[Console]::Out.WriteLine('{"t":"buzon","casilla":"${CASILLA}"}')\r\n[Console]::Out.Flush()\r\nStart-Sleep -Seconds 40\r\n`, 'ascii');
        const opciones = { home: pc.home, raizNube: pc.raizNube, estado: pc.estado, env: { ...process.env }, identidad: SOY_CARLOS, lector: colgado, maxMinutos: 2, segundosSinRespuesta: 3 };
        await directo(pc, { ahora: ANTES });      // el primer dia: solo el aviso
        const t0 = Date.now();
        const r1 = await correr({ ...opciones, ahora: AHORA });
        expect([r1.codigo, r1.resumen.resultado]).toEqual([4, 'outlook_no_responde']);
        expect(Date.now() - t0).toBeLessThan(25000);
        expect(estadoDe(pc)).toMatchObject({ habilitada: true, colgadas: 1 });
        expect(estadoDe(pc)).not.toHaveProperty('pausado_hasta');
        const r2 = await correr({ ...opciones, ahora: new Date(2026, 9, 5, 20, 0, 0) });
        expect(r2.resumen.resultado).toBe('outlook_no_responde');
        expect(estadoDe(pc)).toMatchObject({ colgadas: 2, pausado_hasta: '2026-10-12T20:00:00' });
        // tercera: ni llama al lector (el de mentira tardaria): pausado
        const t3 = Date.now();
        const r3 = await correr({ ...opciones, ahora: new Date(2026, 9, 6, 8, 0, 0) });
        expect([r3.codigo, r3.resumen.resultado]).toEqual([0, 'pausado']);
        expect(Date.now() - t3).toBeLessThan(1500);
        expect(estadoDe(pc).habilitada).toBe(true);
        expect(nubeVacia(pc)).toBe(true);
        // pasada la semana vuelve a intentar; con una lectura buena se limpia
        const r4 = await correr({ ...opciones, lector: undefined, fuenteJsonl: fuente(pc, [mail()]), ahora: new Date(2026, 9, 13, 9, 0, 0) });
        expect(r4.resumen.resultado).toBe('ok');
        expect(estadoDe(pc)).toMatchObject({ colgadas: 0, subidos_total: 1 });
        expect(estadoDe(pc)).not.toHaveProperty('pausado_hasta');
    }, 120000);
    it.runIf(conPowerShell)('si Outlook no contesta ni para decir de quien es el buzon, tambien se corta enseguida, cuenta y pausa', async () => {
        const pc = armarPc();
        const mudo = path.join(pc.t, 'lector-mudo.ps1');
        fs.writeFileSync(mudo, "param([string]$Desde = '', [string]$Conocidos = '', [int]$MaxSegundos = 0)\r\nStart-Sleep -Seconds 40\r\n", 'ascii');
        const opciones = { home: pc.home, raizNube: pc.raizNube, estado: pc.estado, env: { ...process.env }, identidad: SOY_CARLOS, lector: mudo, maxMinutos: 2, segundosSinRespuesta: 3 };
        await directo(pc, { ahora: ANTES });
        const t0 = Date.now();
        const r1 = await correr({ ...opciones, ahora: AHORA });
        expect([r1.codigo, r1.resumen.resultado]).toEqual([4, 'outlook_no_responde']);
        expect(Date.now() - t0).toBeLessThan(25000);
        expect(estadoDe(pc)).toMatchObject({ habilitada: true, colgadas: 1 });
        const r2 = await correr({ ...opciones, ahora: new Date(2026, 9, 5, 20, 0, 0) });
        expect(r2.resumen.resultado).toBe('outlook_no_responde');
        expect(estadoDe(pc)).toMatchObject({ colgadas: 2, pausado_hasta: '2026-10-12T20:00:00' });
        expect((await correr({ ...opciones, ahora: new Date(2026, 9, 6, 8, 0, 0) })).resumen.resultado).toBe('pausado');
        expect(nubeVacia(pc)).toBe(true);
    }, 120000);
});

describe('mails_area: como programa y en el paquete', () => {
    /** El programa copiado donde va instalado: `<casa>\publicado\programas\`. */
    function instalado(pc) {
        const dir = path.join(pc.home, 'publicado', 'programas');
        fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(PROGRAMA, path.join(dir, 'mails_area.mjs'));
        fs.copyFileSync(LECTOR, path.join(dir, 'mails_outlook.ps1'));
        return path.join(dir, 'mails_area.mjs');
    }
    const lanzar = (programa, args, env = {}) => spawnSync(process.execPath, [programa, ...args], { encoding: 'utf8', env: { ...process.env, CLAUDE_AREA_SIN_OUTLOOK: '1', ...env } });
    it('desde su instalacion escribe UN renglon JSON', () => {
        const pc = armarPc({ personas: [] });
        const r = lanzar(instalado(pc), ['--home', pc.home, '--raiz-nube', pc.raizNube, '--estado', pc.estado]);
        expect(r.status).toBe(0);
        expect(JSON.parse(r.stdout.trim())).toEqual({ resultado: 'apagado' });
    });
    it('no se le puede apuntar a otra carpeta con otras listas: corre solo desde su instalacion', () => {
        const pc = armarPc();
        // el programa del repo (o una copia suelta), apuntado a una casa armada a mano
        const suelto = path.join(pc.t, 'copia', 'mails_area.mjs');
        fs.mkdirSync(path.dirname(suelto), { recursive: true });
        fs.copyFileSync(PROGRAMA, suelto);
        for (const programa of [PROGRAMA, suelto]) {
            const r = lanzar(programa, ['--home', pc.home, '--raiz-nube', pc.raizNube, '--estado', pc.estado]);
            expect(r.status).toBe(1);
            expect(JSON.parse(r.stdout.trim()).resultado).toBe('error');
        }
        // el instalado, apuntado a OTRA casa
        const otra = armarPc();
        const r = lanzar(instalado(pc), ['--home', otra.home, '--raiz-nube', otra.raizNube, '--estado', otra.estado]);
        expect(r.status).toBe(1);
        expect(nubeVacia(pc) && nubeVacia(otra)).toBe(true);
    });
    it('por la linea de comandos no hay forma de decirle quien soy, ni de darle mails de mentira u otro lector', () => {
        const pc = armarPc();
        const f = fuente(pc, [mail()]);
        const r = lanzar(instalado(pc), ['--home', pc.home, '--raiz-nube', pc.raizNube, '--estado', pc.estado, '--identidad', 'Carlos prueba', '--usuario', 'Carlos prueba', '--pc', 'PC-CARLOS', '--fuente-jsonl', f, '--lector', f, '--ahora', '2026-10-05T16:00:00'],
            { USERNAME: 'Carlos prueba', COMPUTERNAME: 'PC-CARLOS' });
        expect(JSON.parse(r.stdout.trim())).toEqual({ resultado: 'apagado' });
        expect(nubeVacia(pc)).toBe(true);
        // y aunque la fila sea la de quien corre la prueba, la fuente de mentira no se usa (dice lo que dice el Outlook: cerrado)
        const mia = armarPc({ personas: [{ ...CARLOS, usuario_windows: os.userInfo().username, pc: os.hostname() }] });
        // (con el primer dia ya pasado: el aviso es de hace dos dias)
        fs.mkdirSync(mia.estado, { recursive: true });
        fs.writeFileSync(path.join(mia.estado, ARCHIVO_ESTADO), JSON.stringify({ aviso_desde: '2020-01-01T10:00:00' }), 'utf8');
        const r2 = lanzar(instalado(mia), ['--home', mia.home, '--raiz-nube', mia.raizNube, '--estado', mia.estado, '--max-minutos', '2', '--fuente-jsonl', fuente(mia, [mail()])]);
        expect(JSON.parse(r2.stdout.trim()).resultado).toBe('outlook_cerrado');
        expect(nubeVacia(mia)).toBe(true);
    }, 60000);
    it('sin --home o sin --estado no corre (no usa las carpetas de verdad por descuido)', () => {
        const r = lanzar(PROGRAMA, ['--raiz-nube', 'X']);
        expect(r.status).toBe(1);
        expect(JSON.parse(r.stdout.trim()).resultado).toBe('error');
    });
    it('los dos programas viajan en el paquete', () => {
        const destinos = PROGRAMAS.map(([, a]) => a);
        expect(destinos).toContain('programas/mails_area.mjs');
        expect(destinos).toContain('programas/mails_outlook.ps1');
    });
    it('el programa no importa nada de fuera de su carpeta (en la PC viaja solo con el lector)', () => {
        const texto = fs.readFileSync(PROGRAMA, 'utf8');
        const imports = [...texto.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
        expect(imports.length).toBeGreaterThan(3);
        expect(imports.every((i) => i.startsWith('node:'))).toBe(true);
    });
});
