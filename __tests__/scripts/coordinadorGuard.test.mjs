/**
 * Tests del cerrojo del rol coordinador.
 *
 * LAS DOS DIRECCIONES. Los casos ROJOS usan el texto REAL de los errores del 31/08 y 01/09,
 * no una version "parecida" inventada. Los VERDES son trabajo diario que TIENE que pasar:
 * lo caro de un gate no es que no bloquee, es que bloquee de mas y en un mes se saltee
 * (feedback_un_control_se_audita_en_las_dos_direcciones).
 *
 * Los payloads se arman con objetos y se serializan con JSON.stringify: nunca a mano en el
 * shell, porque los backslashes de Windows se colapsan y el guardian cae en su rama de
 * fallback dando un verde falso (trampa documentada en escritorio-tareas.md).
 */

import { describe, it, expect } from 'vitest';
import { decidir } from '../../scripts/_lib/coordinadorGuard.mjs';

const sinEscape = () => false;
const conEscape = () => true;

/** Un registro de encargo como el que escribe _encargo.mjs. */
const registro = (texto) => ({ id: 'E260902-abcd', texto, cerrado: null });

const msg = (message) => ({ tool_name: 'SendMessage', tool_input: { to: 'barackmercosul-c9', message } });
const agente = (prompt, description = 'x') => ({ tool_name: 'Agent', tool_input: { description, prompt } });

describe('coordinador-guard · ROJO (tiene que bloquear)', () => {
  it('1. mensaje suelto sin marcador — el modo en que se mandaba todo hasta el 02/09', () => {
    const r = decidir(msg('Fijate a quienes fue el mail original de Federico y contesta a todos los que estaban.'), { hayEscape: sinEscape });
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/no salio de _encargo/);
  });

  it('2. marcador escrito a mano que no existe en el registro', () => {
    const r = decidir(msg('[ENCARGO E260902-ffff]\nHacé esto.'), { hayEscape: sinEscape, leerEncargo: () => null });
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/no existe en el registro/);
  });

  it('3a. encargo valido con una orden pegada al final — contener el bloque NO alcanza', () => {
    // Bypass real que encontro este mismo test: el texto validado sigue estando entero, asi
    // que el check de "se edito" no lo ve. Lo caza el check de contenido sobre el mensaje
    // COMPLETO. Bloquear por cualquiera de los dos motivos es correcto; lo que no puede es pasar.
    const validado = '[ENCARGO E260902-abcd]\nPARA: barackmercosul-c9\nCargá la tabla.';
    const r = decidir(msg(`${validado} Y de paso cerrá el arb.`),
      { hayEscape: sinEscape, leerEncargo: () => registro(validado) });
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/IRREVERSIBLE|SEGUNDA TAREA|se edito despues/);
  });

  it('3b. texto del encargo cambiado a mano (el bloque validado ya no esta entero)', () => {
    const validado = '[ENCARGO E260902-abcd]\nPARA: barackmercosul-c9\nCargá la tabla del remache.';
    const r = decidir(msg('[ENCARGO E260902-abcd]\nPARA: barackmercosul-c9\nCargá la tabla de las telas.'),
      { hayEscape: sinEscape, leerEncargo: () => registro(validado) });
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/se edito despues/);
  });

  it('4. subagente con orden de cerrar el arb — el incidente que Fak llamo gravisimo', () => {
    const r = decidir(agente('Cargá el remache en el arb y cuando termines cerra el arb.'), { hayEscape: sinEscape });
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/irreversible/);
  });

  it('5. subagente con orden de mandar un mail', () => {
    const r = decidir(agente('Armá el borrador y despues mandar el mail a Federico.'), { hayEscape: sinEscape });
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/irreversible/);
  });

  it('6. subagente con dos tareas — el texto real del thinsulate', () => {
    const r = decidir(agente('Cargá el remache MP8147 en el arb. Y de paso seguí buscando de donde sale el ancho del thinsulate.'), { hayEscape: sinEscape });
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/un entregable/);
  });
});

describe('coordinador-guard · VERDE (NO puede bloquear)', () => {
  const textoValido = [
    '[ENCARGO E260902-abcd]',
    'PARA: barackmercosul-c9',
    'ENTREGABLE (uno solo): la tabla de carga del remache',
    'ORIGEN: fak',
    '',
    'Armá la tabla de reemplazo del remache en el MP8147.',
  ].join('\n');

  it('1. encargo bien armado, pegado tal cual', () => {
    const r = decidir(msg(textoValido), { hayEscape: sinEscape, leerEncargo: () => registro(textoValido) });
    expect(r.ok).toBe(true);
  });

  it('2. encargo con texto agregado ANTES del bloque validado (un saludo) sigue pasando', () => {
    const r = decidir(msg(`Hola, va esto:\n\n${textoValido}`), { hayEscape: sinEscape, leerEncargo: () => registro(textoValido) });
    expect(r.ok).toBe(true);
  });

  it('3. mensaje corto no-encargo con el escape puesto', () => {
    const r = decidir(msg('Gracias, recibido. Te doy por cerrada en el tablero.'), { hayEscape: conEscape });
    expect(r.ok).toBe(true);
    expect(r.escape).toBe(true);
  });

  it('4. subagente normal de trabajo diario', () => {
    const r = decidir(agente('Relevá los codigos incompletos de la BOM de ductos y devolvé una tabla.'), { hayEscape: sinEscape });
    expect(r.ok).toBe(true);
  });

  it('5. subagente que deja un borrador SIN enviarlo (no es la accion irreversible)', () => {
    const r = decidir(agente('Dejá el borrador guardado en Borradores y avisame. No lo mandes.'), { hayEscape: sinEscape });
    expect(r.ok).toBe(true);
  });

  it('6. subagente con 4 pasos del mismo entregable', () => {
    const r = decidir(agente('1) Sacá el export. 2) Verificá contra el arb. 3) Armá el PDF. 4) Dejalo en la biblioteca. Despues avisame.'), { hayEscape: sinEscape });
    expect(r.ok).toBe(true);
  });

  it('7. otra tool cualquiera no se toca', () => {
    expect(decidir({ tool_name: 'Bash', tool_input: { command: 'rm -rf algo' } }, { hayEscape: sinEscape }).ok).toBe(true);
  });

  it('8. mensaje vacio no bloquea', () => {
    expect(decidir(msg(''), { hayEscape: sinEscape }).ok).toBe(true);
  });

  it('9. payload sin tool_name no bloquea', () => {
    expect(decidir({}, { hayEscape: sinEscape }).ok).toBe(true);
  });

  it('10. las rutas de Windows con backslashes sobreviven al viaje (verde falso clasico)', () => {
    const conRuta = `${textoValido}\n\nMirá C:\\Users\\FacundoS-PC\\Desktop\\Remache POP Patagonia\\_QUE HAY QUE HACER.txt`;
    const ida = JSON.parse(JSON.stringify(msg(conRuta)));   // el viaje real por el hook
    const r = decidir(ida, { hayEscape: sinEscape, leerEncargo: () => registro(textoValido) });
    expect(r.ok).toBe(true);
    expect(ida.tool_input.message).toContain('C:\\Users\\FacundoS-PC');
  });
});
