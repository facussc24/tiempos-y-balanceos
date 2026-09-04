/**
 * Tests del gate de cierre de turno (scripts/_lib/cierreGuard.mjs) — LAS DOS DIRECCIONES.
 *
 * Los ROJOS son las colas REALES de los mensajes con que termine turnos entre el 21/08 y el
 * 04/09/2026 y a los que Fak contesto "hacelo" de alguna forma (informe de chats del 04/09,
 * familia B). Los VERDES son cierres reales que TIENEN que pasar: esperar una accion fisica
 * de Fak, un dato que solo el tiene, el OK de un mail, o un cierre con ruta.
 * Un falso positivo cuesta lo mismo que un agujero: este gate corre en CADA fin de turno.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluarPermiso, declaraCierre, tieneRuta, evaluarBullets, decidir, normalizar, CANON,
} from '../../scripts/_lib/cierreGuard.mjs';

const ROJOS = [
  ['203c4748 28/08', 'Sobre el resto: no toqué los 6 PDFs originales ni la carpeta "PARA BEON" — siguen como estaban. Si querés, redacto el mail a HamPu pidiendo el reemplazo con QR vigente.'],
  ['41dbb703 28/08 14:46', 'lo que pasó Carlos del nuevo dice sólo "50% BICO". Si querés se lo pregunto a Carlos al confirmarle la carga. No toqué nada todavía. Decime y arranco.'],
  ['5be2561c 25/08 16:43', 'La respuesta corta para Marcelo, también lista. Si querés que empuje por el lado de HamPu, decime y armo el mail completo con los seis números de informe para que salga de una.'],
  ['5be2561c 25/08 16:47', 'Si querés, decodifico el QR de la carátula para que sepas exactamente contra qué resuelve, y con eso tenés medido el riesgo de los que ya están afuera. Decime y lo hago.'],
  ['5be2561c 25/08 16:49', 'La constancia quedó a medio armar en el scratchpad. No sigo con eso salvo que me digas. Decime qué querés que agarre y me pongo con eso.'],
  ['7f8f2c4b 24/08 11:32', 'pero son dos versiones distintas dando vueltas. Decime si querés que le mande dos líneas avisando, o lo dejamos para la próxima entrega. Listo para el punto 2 cuando quieras: enfundado y varilla.'],
  ['7f8f2c4b 24/08 14:34', 'te dejo listado lo que la HO tiene en TBD para que lo definas vos o Producción. Los OP11 quedan afuera hasta que exista algo que los describa. ¿Arranco con eso?'],
  ['7f8f2c4b 24/08 14:36', 'Los otros 8 quedan como están, y te doy la lista de qué falta escribir para poder cerrarlos. ¿Le doy?'],
  ['819a516e 28/08 09:38', 'ahí te muevo el QR, le cambio tipo/número/revisión, lo re-sello y te demuestro la verificación rompiéndose. Decime y lo hago sobre esos.'],
  ['97ffa544 02/09 13:41', 'Falta el séptimo candado completo —el del tablero— porque es el más grande y el único que no evita un daño irreversible. Ese lo hago cuando digas.'],
  ['c90f901f 03/09 15:04', 'No hay nada más para hacer en esto — ¿seguimos con la cola de tareas o querés que mire otra cosa?'],
  ['d24e5d74 31/08 22:02', 'y **no armo la versión en inglés** porque Carlos hoy pidió el deck en castellano — si la querés, la hago apenas cierre ésta. Dame el OK y arranco.'],
  ['e088f15d 01/09 15:13', 'Si son 250/día, hay que recargar INCA. ¿Querés que arranque por la demanda del Armrest, o preferís que primero limpie los tres archivos de los restos de plantilla?'],
  ['eb18fbd5 25/08 17:07', '¿Tenés a mano algo que lo confirme (orden, mail), o querés que arme el mail igual pidiéndoles que revisen?'],
  ['eb18fbd5 25/08 17:08', 'la misma que ya tenés en los otros 5 informes de este mismo lote, para que se las copien igual. ¿Querés que te lo redacte para mandarlo ya?'],
  ['efb991de 31/08 14:48', 'El guardián sigue funcionando —bloquea todo lo que bloqueaba antes— pero su suite tiene 2 casos en rojo que son del test, no del guardián. Lo cierro cuando me digas.'],
  ['819a516e 28/08 09:51', 'Para cualquier otra cosa sobre estos archivos o cualquier PDF —layout, textos, imágenes, portadas, unir, traducir, OCR, lo que sea— decime y lo hago sin vueltas.'],
  ['sintetico (familia B)', 'Dejé el borrador armado. ¿Avanzo con la carga en el arb?'],
  ['sintetico (familia B)', 'Tengo los tres archivos listos para regenerar. Dame luz verde y los corro.'],
  ['sintetico sin acento', 'Queres que lo mande ahora? Decime y arranco.'],
];

const VERDES = [
  ['41dbb703 28/08 14:53 — accion fisica de Fak', 'con las teclas y las fotos lo reconstruyo. **Avisame cuando termines** y ahí corto la grabación, lo escribo en la skill `arb-operar` y sigo yo con la sustitución en las 4 telas.'],
  ['812ecdc6 30/08 — dato que solo Fak tiene', 'Listo. Quedo a la espera de los dos datos: cómo se fija un nido en el taller, y tu marca sobre la imagen del IP.'],
  ['c90f901f 03/09 14:24 — el OK de un mail SI es de Fak', 'Cuando me digas "dale" o "enviá" lo mando por `_mailEnviar.py` — así queda. No lo voy a enviar solo porque digas "obviamente": necesito el OK explícito para ESE envío, es la regla de la casa con los mails.'],
  ['c90f901f 03/09 14:25 — que lo mire', 'Ahí te lo mandé de nuevo — el PDF de las 4 láminas del Día 5, ya con la corrección del molde. Debería abrirse solo en tu pantalla. Avisame cuando lo veas y me digas si sale.'],
  ['04823dba 25/08 — verificacion visual en su Adobe', 'Abrilo en Adobe y contame si ahora sí aparecen "BARACK MERCOSUL S.R.L." y la dirección. Voy a actualizar la memoria con este hallazgo apenas confirmes que quedó bien.'],
  ['2d2b14da 01/09 — cierre con todo hecho', 'los códigos corregidos y verificados contra el export, el mail a Federico enviado, la tarea archivada, y la herramienta en el repo lista para la próxima vez que aparezca una fila partida. El arb quedó abierto.'],
  ['40ae1376 24/08 — estado', 'Todo pusheado (`13135b4e`), árbol limpio, discos montados. **El mail sigue en Borradores, sin enviar**, con sus dos adjuntos intactos.'],
  ['e7ac3c88 24/08 — entrega con ruta', 'En `C:\\Users\\FacundoS-PC\\OneDrive - BARACK ARGENTINA SRL\\Desktop\\Gancho mochila\\` te quedaron los dos listos para laminar — el **doble** para dos mochilas y el **v2** para una. La v1 vieja está guardada en `_superado`.'],
  ['e088f15d 01/09 14:44 — lo unico pendiente es de Fak', 'Los dos listos para que los revises y los mandes. Lo único que queda de tu lado es apretar Enviar en esos dos. Y del lado de VW, que liberen la BKA.'],
  ['120d7793 03/09 — sigue trabajando', 'Renders del conjunto listos. Ahora la animación (~20 min).'],
  ['97ffa544 31/08 13:55 — espera la carga fisica', 'Listo, queda esperándote para verificar apenas cargues. Dale que está todo servido.'],
  ['c90f901f 03/09 12:37 — lista de lo que espera de Fak (datos)', '**Lo que sigue esperando algo tuyo:** mandar el informe a Carlos, el Nº de HO del HOTMELT, y el Nº de plano del dispositivo — ese último es lo único que traba archivar la tarea del 3D.'],
  ['negacion en la misma cola', 'Sigo con la carga; no hace falta que me digas nada, te aviso cuando termine con la ruta del PDF.'],
  ['pregunta que solo Fak sabe, sin pedir permiso', '¿La torreta ciega del Insert es la que va del lado del operario o la de atrás? No está en el plano ni en los mails.'],
  ['estado de sesiones (coordinador)', 'Tablero: de las cuatro sesiones, dos terminaron (video y telas). Siguen trabajando la del rol 3D y la del dispositivo de adhesivado.'],
];

describe('cierre-guard · ROJO: pedir permiso para mi propio trabajo (textos reales)', () => {
  for (const [origen, texto] of ROJOS) {
    it(`bloquea — ${origen}`, () => {
      const r = evaluarPermiso(texto);
      expect(r.bloquea, `deberia bloquear: …${texto.slice(-90)}`).toBe(true);
      expect(r.patron).toBeTruthy();
      expect(r.fuente).toBeTruthy();
    });
  }
});

describe('cierre-guard · VERDE: cierres legitimos que tienen que pasar', () => {
  for (const [origen, texto] of VERDES) {
    it(`pasa — ${origen}`, () => {
      const r = evaluarPermiso(texto);
      expect(r.bloquea, `NO deberia bloquear: …${texto.slice(-90)}`).toBe(false);
    });
  }
});

describe('cierre-guard · la cola, no el mensaje entero', () => {
  it('un "decime y arranco" enterrado 2.000 caracteres antes del final no cuenta: lo que importa es como TERMINA', () => {
    const texto = 'Decime y arranco. ' + 'x'.repeat(2000) + '\nListo: quedó en C:\\Dev\\salida.pdf';
    expect(evaluarPermiso(texto).bloquea).toBe(false);
  });
  it('normalizar quita acentos y markdown', () => {
    expect(normalizar('**¿Querés** que _arme_ el mail?')).toContain('Queres que arme el mail');
  });
});

describe('cierre-guard · declaraCierre y tieneRuta', () => {
  it('reconoce un cierre declarado', () => {
    expect(declaraCierre('Build OK, commit y push hechos. Listo.')).toBe(true);
    expect(declaraCierre('La tarea quedó archivada y el PDF en su carpeta.')).toBe(true);
    expect(declaraCierre('Sigo midiendo la torreta, falta la mitad.')).toBe(false);
  });
  it('detecta rutas de Windows, UNC, Git Bash y OneDrive', () => {
    expect(tieneRuta('quedó en C:\\Dev\\x.pdf')).toBe(true);
    expect(tieneRuta('en \\\\SERVER\\compartido\\BARACK\\x')).toBe(true);
    expect(tieneRuta('lo dejé en /c/Users/FacundoS-PC/Desktop/')).toBe(true);
    expect(tieneRuta('en OneDrive - BARACK ARGENTINA SRL\\Desktop')).toBe(true);
    expect(tieneRuta('quedó listo en la carpeta de la tarea')).toBe(false);
  });
});

describe('cierre-guard · decidir (con relevadores inyectados)', () => {
  const sinFuera = async () => ({ fuera: false });
  const conFuera = async () => ({ fuera: true, ejemplo: 'Write C:\\Users\\x\\Desktop\\tarea\\informe.pdf' });
  const sinPend = () => [];
  const conPend = () => ['hay 2 archivo(s) sin commitear (a.mjs, b.md)'];
  const nunca = () => false;
  const noMarcar = () => {};

  it('stop_hook_active=true siempre pasa (sin loops Stop→Stop)', async () => {
    const r = await decidir({ stop_hook_active: true, last_assistant_message: 'Dame el OK y arranco.' }, { fueraEnEsteTurno: sinFuera });
    expect(r.ok).toBe(true);
  });
  it('permiso → bloquea y dice la frase y el incidente de origen', async () => {
    const r = await decidir({ last_assistant_message: 'Dejé todo listo. ¿Le doy?' }, { fueraEnEsteTurno: sinFuera });
    expect(r.ok).toBe(false);
    expect(r.detalle).toMatch(/le doy/i);
    expect(r.detalle).toMatch(/7f8f2c4b/);
  });
  it('entrego afuera del repo en este turno y no dice la ruta → bloquea', async () => {
    const r = await decidir({ last_assistant_message: 'Quedó el informe listo en la carpeta de la tarea.' }, { fueraEnEsteTurno: conFuera, pendientes: sinPend, enCooldown: nunca, marcar: noMarcar });
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/DONDE quedo/);
  });
  it('entrego afuera del repo y SI dice la ruta → pasa', async () => {
    const r = await decidir({ last_assistant_message: 'Quedó en C:\\Users\\x\\Desktop\\tarea\\informe.pdf, abrilo con doble click.' }, { fueraEnEsteTurno: conFuera, pendientes: sinPend, enCooldown: nunca, marcar: noMarcar });
    expect(r.ok).toBe(true);
  });
  it('declara cierre con pendientes medibles → recordatorio (una vez por cooldown)', async () => {
    let marcado = false;
    const r = await decidir({ session_id: 's1', last_assistant_message: 'Todo commiteado y pusheado. Listo.' }, { fueraEnEsteTurno: sinFuera, pendientes: conPend, enCooldown: nunca, marcar: () => { marcado = true; } });
    expect(r.ok).toBe(false);
    expect(r.detalle).toMatch(/sin commitear/);
    expect(marcado).toBe(true);
  });
  it('declara cierre con pendientes pero dentro del cooldown → pasa (no se repite cada turno)', async () => {
    const r = await decidir({ session_id: 's1', last_assistant_message: 'Listo, quedó todo.' }, { fueraEnEsteTurno: sinFuera, pendientes: conPend, enCooldown: () => true, marcar: noMarcar });
    expect(r.ok).toBe(true);
  });
  it('NO declara cierre (sigue trabajando) → no consulta pendientes aunque git este sucio', async () => {
    let consulto = false;
    const r = await decidir({ session_id: 's1', last_assistant_message: 'Voy por la segunda torreta, falta medir la de atrás.' }, { fueraEnEsteTurno: sinFuera, pendientes: () => { consulto = true; return conPend(); }, enCooldown: nunca, marcar: noMarcar });
    expect(r.ok).toBe(true);
    expect(consulto).toBe(false);
  });
  it('mensaje vacio o JSON sin texto → pasa', async () => {
    expect((await decidir({}, { fueraEnEsteTurno: sinFuera })).ok).toBe(true);
  });
});

describe('gate por bullet de LECCIONES (evaluarBullets)', () => {
  const cfg = CANON.lecciones;
  it('un bullet corto pasa; uno de mas de 600 caracteres no', () => {
    const corto = '- **04/09 — Regla corta.** Una linea de conducta con el minimo de historia.\n';
    const largo = '- **04/09 — Regla larga.** ' + 'narrativa '.repeat(70) + '\n';
    expect(evaluarBullets(corto, cfg)).toHaveLength(0);
    const m = evaluarBullets(largo, cfg);
    expect(m).toHaveLength(1);
    expect(m[0].motivo).toMatch(/maximo 600/);
  });
  it('un bullet "graduado a X" con 3 lineas de narrativa no pasa; con 2 si', () => {
    const tres = '- **Regla.** Graduado a `cad-3d.md` GATE E.\n  Y sin embargo aca sigue contando el caso entero,\n  con sus tres fotos y los numeros.\n';
    const dos = '- **Regla.** Graduado a `cad-3d.md` GATE E + `gate_entregable.py`;\n  memoria `entregables_para_fak`.\n';
    expect(evaluarBullets(tres, cfg)[0].motivo).toMatch(/graduado a/);
    expect(evaluarBullets(dos, cfg)).toHaveLength(0);
  });
  it('la cabecera (Snapshots, Tabla incidente) no cuenta como leccion', () => {
    const cab = '- **Snapshots** (la version larga): ' + 'x'.repeat(900) + '\n- **Tabla incidente → regla**: `docs/_archive/X.md`\n';
    expect(evaluarBullets(cab, cfg)).toHaveLength(0);
  });
  it('un bullet se corta en la linea en blanco: dos lecciones seguidas se miden por separado', () => {
    const dos = '- **A.** corta.\n\n- **B.** ' + 'y'.repeat(650) + '\n';
    const m = evaluarBullets(dos, cfg);
    expect(m).toHaveLength(1);
    expect(m[0].inicio).toMatch(/^\*\*B/);
  });
});
