// explicar-prompt.sh (UserPromptSubmit) — cuando Fak dice que no entendio, pide que se lo expliquen o pide corto,
// le recuerda a Claude el skill `explicar-mejor`. No bloquea.
// Origen: 02/10/2026, despues de probar la escalera del post de Karpathy (texto simple -> dibujo -> pagina -> video).
//
// Probado en las dos direcciones. Los rojos son mensajes REALES de Fak (con sus errores de tipeo). Los verdes son
// muletillas, pedidos de trabajo y las frases con que la auditoria del 02/10 hizo saltar de mas a la primera version.
// Cada lista del canon tiene un caso que depende de ella: si alguien la vacia, algo de aca se pone rojo.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CASOS, CANON, EXPLICAR, senales, avisoDe, atender, pideEstado, pideExplicar } from '../../scripts/_lib/explicarGuard.mjs';
import { esAutomatico, sinAvisosAdelante } from '../../scripts/_lib/correccionGuard.mjs';

const RAIZ = process.cwd();
const HOOK = path.join(RAIZ, '.claude', 'hooks', 'explicar-prompt.sh');
const correr = (payload, cwd = RAIZ) => spawnSync('bash', [HOOK], { input: typeof payload === 'string' ? payload : JSON.stringify(payload), encoding: 'utf8', cwd });
const prompt = (t, extra = {}) => ({ hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt: t, ...extra });
const NE = CANON.no_entendi; const EX = CANON.explicame; const FA = CANON.facil;

// 02/10/2026 14:16 (61a9a9ac): lo que escribio Fak, lo que le contestaron (una tabla) y su reclamo de las 14:31.
const INCIDENTE = 'che ene que estaod esta hace que sea faicl de entender esta taare adigmaos le pdoemos apsar las hojas de rpcoeos anico?';
const RECLAMO = 'ojo te pedi atne sque me lo des facil denentende ry no aplcaiste la mejora que habiamos imepletnado hoyu o ayer';
// Asi llego: con un aviso de la app adelante, en el mismo mensaje.
const AVISO_APP = '<system-reminder>\nThe user started your suggested background task task_eee4ad8a ("Agregar guard que frene git commit sin rutas") in a separate local session. It is running independently. You will be notified here when it ends.\n</system-reminder>\n\n';

describe('explicarGuard — los casos del canon', () => {
  it.each(['no_entendi', 'explicame', 'facil', 'corto'])('ROJO: los mensajes reales de "%s" marcan esa senal', (k) => {
    expect(CASOS[k].length).toBeGreaterThan(5);
    for (const t of CASOS[k]) expect(senales(t), t.slice(0, 60)).toContain(k);
  });
  it('VERDE: muletillas, pedidos de trabajo y palabras parecidas no marcan nada', () => {
    for (const t of CASOS.verdes) expect(senales(t), t.slice(0, 60)).toEqual([]);
  });
  it('ROJO y VERDE: el pedido de ESTADO de una tarea se reconoce con sus tipeos, y "haber estado" o "un mail del estado" no', () => {
    for (const t of CASOS.estado) expect(pideEstado(t), t.slice(0, 60)).toBe(true);
    for (const t of CASOS.sin_estado) expect(pideEstado(t), t.slice(0, 60)).toBe(false);
  });
});

describe('explicarGuard — el incidente del 02/10/2026', () => {
  it('ROJO: el mensaje de Fak pedia explicar (no "corto") y pedia el estado de una tarea', () => {
    expect(senales(INCIDENTE)).toEqual(['facil']);
    expect(pideExplicar(INCIDENTE)).toBe(true);
    expect(pideEstado(INCIDENTE)).toBe(true);
    expect(senales('hace que sea facil de entender esta tarea')).toEqual(['facil']);
  });
  it('ROJO: el reclamo de Fak, con "denentende ry", tambien se ve (antes no marcaba nada)', () => {
    expect(senales(RECLAMO)).toEqual(['facil']);
  });
  it('el aviso de ese mensaje manda cargar el skill, dice que va el escalon 3 (una pagina) y con que renglon se pasa si no aplica', () => {
    const a = avisoDe(INCIDENTE);
    expect(a).toMatch(/Carga el skill `explicar-mejor` AHORA/);
    expect(a).toMatch(/ESTADO de una tarea o proyecto: eso es el escalon 3/);
    expect(a).toMatch(/exports\/explicaciones\//);
    expect(a).toMatch(/«No aplica explicar-mejor:»/);
    expect(a.indexOf('escalon 3')).toBeLessThan(a.indexOf('No aplica si'));          // lo que no aplica cierra el aviso
    expect(avisoDe(RECLAMO)).not.toMatch(/escalon 3/);                                 // sin pedido de estado no se manda una pagina
  });
  it('ROJO: un aviso de la app ADELANTE del mensaje no lo tapa (asi llego: ningun hook lo vio)', () => {
    expect(esAutomatico(AVISO_APP + INCIDENTE)).toBe(false);
    expect(sinAvisosAdelante(AVISO_APP + AVISO_APP + INCIDENTE)).toBe(INCIDENTE);
    expect(avisoDe(AVISO_APP + INCIDENTE)).toBe(avisoDe(INCIDENTE));
    expect(atender(prompt(AVISO_APP + INCIDENTE))).toMatch(/escalon 3/);
  });
  it('VERDE: un mensaje que es SOLO avisos, o un aviso seguido de una notificacion de tarea, sigue siendo automatico', () => {
    expect(esAutomatico(AVISO_APP)).toBe(true);
    expect(esAutomatico(`${AVISO_APP}<task-notification>el agente dice: no entendi, explicame</task-notification>`)).toBe(true);
    expect(avisoDe(`${AVISO_APP}<task-notification>el agente dice: no entendi, explicame</task-notification>`)).toBeNull();
    expect(esAutomatico('<system-reminder>sin cerrar y despues no entiendo nada')).toBe(true);
    expect(esAutomatico('')).toBe(false);
    const t0 = Date.now(); esAutomatico('<system-reminder>'.repeat(200000)); expect(Date.now() - t0).toBeLessThan(2000);
  });
});

describe('explicarGuard — "facil de entender"', () => {
  it.each([
    ['mas faicl d etnende rme das muchas tablas', 'hace el nido mas facil de montar'],
    ['de una forma sencilla de etnender', 'una forma sencilla de armar el carro'],
    ['ahcelo faicl de entender asi repsondero', 'hacelo facil de desmontar asi lo limpio'],
    ['dame un resumen bien simple de entender', 'arma un power point bien simple para carlos'],
    ['algo asi facil tamiben d eentnder', 'algo asi facil tambien de imprimir'],
  ])('ROJO "%s" · VERDE "%s"', (rojo, verde) => {
    expect(senales(rojo)).toEqual(['facil']);
    expect(senales(verde)).toEqual([]);
  });
  it('los espacios corridos de Fak: la f en la palabra de antes, el "de" pegado, la ultima letra en la palabra siguiente', () => {
    for (const t of ['claro yf aicl dentned er', 'bine simple y faicl dentnender', 're faicl denntender', 'me lo des facil denentende ry', 'es faicl de entende rque se yo'])
      expect(senales(t), t).toEqual(['facil']);
  });
  it('VERDE: "entendes?" detras es muletilla, y "atender" y "dentro" son otras palabras (dependen de ajenas y otras_palabras)', () => {
    expect(senales('debe ser faicl de leer rapdiod etnendes no es un manual')).toEqual([]);
    expect(senales('es facil entendes')).toEqual([]);
    expect(senales('el cliente es facil de atender')).toEqual([]);
    expect(senales('es una tarea sencicila dentor de todo pero hacelo bien')).toEqual([]);
    expect(FA.ajenas).toContain('entendes');
    for (const p of FA.otras_palabras) expect(senales(`es facil de ${p}`), p).toEqual([]);
  });
  it('VERDE: lo que se midio y quedo AFUERA — "que se entienda" y "mas simple" los dice de un entregable o de un trabajo', () => {
    for (const t of [
      'me ayduscon las de hot melt entendes qiu es eentienda bine cada paso',
      'quiero que se entienda como es el proceso porque es como que se repetia mucho',
      'es und iseno mas simple podes que pensas',
      'hciste un test mas sencicllo que si podias pasar comrpendes',
      'hay que cerrarlo y reabrirlo mas facil',
    ]) expect(senales(t), t).toEqual([]);
    expect(FA._no_entran).toMatch(/que se entienda/);
  });
  // Auditoria del 02/10/2026: 17 de 43 frases armadas para atacar marcaban de mas (en sus mensajes reales, ninguna).
  it('VERDE: la letra corrida solo se toma de una palabra de una o dos letras ("yf aicl" si; "ademas encima" no)', () => {
    for (const t of ['ademas encima tengo que entender yo el codigo?', 'vos encima queres comprender todo el arb', 'eso nos implica entender el proceso', 'las implico a entender', 'los empleos nuevos tienen que entender'])
      expect(senales(t), t).toEqual([]);
    expect(senales('claro yf aicl dentned er')).toEqual(['facil']);
    expect(FA.letra_de_antes).toBe(2);
  });
  it('VERDE: palabras a una o dos letras de facil / simple / sencilla y de entender que son otra cosa (dependen del canon)', () => {
    for (const t of ['la semilla del proyecto es entender al cliente', 'con esa simpleza no vas a entender', 'eso me faculta a entender', 'es facil de sorprender al auditor'])
      expect(senales(t), t).toEqual([]);
    for (const p of FA.no_son_facil) expect(senales(`una ${p} de entender`), p).toEqual([]);
    expect(FA.otras_palabras).toContain('sorprender');
  });
  it('VERDE: "no es facil…" no pide nada, y "sin entender" no es "de entender"', () => {
    expect(senales('no es facil, tenes que entender que calidad no firma')).toEqual([]);
    expect(senales('no es simple hacerle entender a manuel')).toEqual([]);
    expect(senales('nunca fue facil entender a calidad')).toEqual([]);
    expect(senales('que facil es criticar sin entender')).not.toContain('facil');
    expect(senales('hacelo facil de entender')).toEqual(['facil']);                    // el control: sin negacion adelante, marca
    expect(senales('no se, hacelo bien facil de entender')).toEqual(['facil']);        // un "no" lejos no la apaga
  });
  it('el tope de 20.000 caracteres se cuenta sobre lo que escribio Fak, no sobre el aviso que la app le pega adelante', () => {
    const avisoLargo = `<system-reminder>\n${'contexto '.repeat(3000)}\n</system-reminder>\n\n`;
    expect(avisoLargo.length).toBeGreaterThan(25000);
    expect(senales(avisoLargo + INCIDENTE)).toEqual(['facil']);
    expect(avisoDe(avisoLargo + INCIDENTE)).toBe(avisoDe(INCIDENTE));
  });
  it('lo que manda otra sesion no son palabras de Fak (lista unica `no_es_de_fak`), venga o no con un aviso adelante', () => {
    const deOtra = '<cross-session-message from="local_20b5">no entendi nada, explicame mejor</cross-session-message>';
    for (const t of [deOtra, AVISO_APP + deOtra, `Another Claude session sent a message: ${deOtra}`, 'This session is being continued from a previous conversation. Fak: no entiendo, explicame'])
      expect(avisoDe(t), t.slice(0, 50)).toBeNull();
  });
  it('"facil de entender" pide explicar aunque ademas pida corto: gana el aviso de explicar', () => {
    expect(senales('r epsodne breve y de una fomra bine facil de entender')).toEqual(['facil', 'corto']);
    expect(avisoDe('r epsodne breve y de una fomra bine facil de entender')).toMatch(/cambia la FORMA/);
    expect(EXPLICAR).toEqual(['no_entendi', 'explicame', 'facil']);
    expect(pideExplicar('sintetiza')).toBe(false);
    expect(pideExplicar('<task-notification>no entendi, explicame</task-notification>')).toBe(false);
  });
});

describe('explicarGuard — "no entendi"', () => {
  it('"entendes?" y "entendiste?" van para Claude o son muletilla; la primera persona si marca, aun mal tipeada', () => {
    expect(senales('no etnenedes comoc funciona el rpoceos?')).toEqual([]);
    expect(senales('pasame la bom entendes? asi lo reviso comprendes')).toEqual([]);
    expect(senales('no entenidste bien creo')).toEqual([]);
    expect(senales('carlos no entiende la tabla')).toEqual([]);
    expect(senales('noe ntenid nada')).toEqual(['no_entendi']);
    expect(senales('la verdad noentiendo')).toEqual(['no_entendi']);
    expect(senales('yo lo mire y no la entendi sinceramente')).toEqual(['no_entendi']);
  });
  it('cada forma propia tiene su caso: entiendo, entendi, comprendo, comprendi', () => {
    for (const t of ['no entiendo', 'no lo entendi', 'no comprendo', 'no lo comprendi']) expect(senales(t), t).toEqual(['no_entendi']);
  });
  it('sin negacion no marca; con la negacion a mas de 3 palabras tampoco; a 3 si', () => {
    expect(senales('ah listo ya entiendo dale')).toEqual([]);
    expect(senales('entiendo de que falta disenar el nido')).toEqual([]);
    expect(senales('no la verdad eso lo entiendo')).toEqual([]);
    expect(senales('no te lo entiendo')).toEqual(['no_entendi']);
    expect(NE.negacion_antes).toBe(3);
  });
  it('"nunca", "tampoco" y la negacion con una letra pegada ("sno", "eno") niegan; "uno" no', () => {
    expect(senales('nunca entendi eso')).toEqual(['no_entendi']);
    expect(senales('tampoco entiendo lo otro')).toEqual(['no_entendi']);
    expect(senales('que hago entoence sno entendi')).toEqual(['no_entendi']);
    expect(senales('no los corregist eno comprendo porque')).toEqual(['no_entendi']);
    expect(senales('de a uno entiendo mejor los pasos')).toEqual([]);
  });
  it('una negacion seguida de coma o punto no niega, y "si" o "ya" en el medio la cortan', () => {
    expect(senales('no, ahora si entiendo')).toEqual([]);
    expect(senales('eso no. entiendo que va en el legajo')).toEqual([]);
    expect(senales('no ahora si entiendo')).toEqual([]);
    expect(senales('ahora si no entendi como lo modificaste')).toEqual(['no_entendi']);
    expect(senales('si no entendi mal va despues del flujograma')).toEqual([]);
  });
  it('el infinitivo pide "sin" pegado o un auxiliar ("no termino de entender"); "no hace falta entender" no es no entender', () => {
    expect(senales('sigo sin entender vas re rapido')).toEqual(['no_entendi']);
    expect(senales('no termino de comprender esto')).toEqual(['no_entendi']);
    expect(senales('no puedo entender la tabla')).toEqual(['no_entendi']);
    expect(senales('no hace falta entender el codigo')).toEqual([]);
    expect(senales('carlos no va a entender esa tabla')).toEqual([]);
    expect(senales('no quiero entender el codigo quiero que ande')).toEqual([]);
  });
  it('el participio pide la negacion pegada: "no entenido" es de Fak; "no lo has entendido" y "entendido?" no', () => {
    expect(senales('no entenido loc argas te ala nube si o no?')).toEqual(['no_entendi']);
    expect(senales('no he entendido nada')).toEqual(['no_entendi']);
    expect(senales('no lo has entendido, era el apb')).toEqual([]);
    expect(senales('cuando no es verdad entendido')).toEqual([]);
  });
  it('una palabra comun a una o dos letras no es un tipeo de "entiendo" — ni exacta ni mal tipeada — y no le gana a un tipeo real', () => {
    const marcan = NE.otras_palabras.filter((p) => senales(`no ${p}`).length);
    expect(marcan, `marcan con "no" adelante: ${marcan.join(', ')}`).toEqual([]);
    expect(senales('no la seguis teniendo')).toEqual([]);
    expect(senales('el material no esta comprado todavia')).toEqual([]);
    expect(senales('no estoy comrpando nada todavia')).toEqual([]);                      // tipeo de "comprando"
    expect(senales('que carajo es la scp ?? no etneindo?')).toEqual(['no_entendi']);     // empata con "teniendo": se queda
    expect(senales('hay algo que noe tiendo')).toEqual(['no_entendi']);                  // empata con "atiendo": se queda
    for (const p of NE.otras_palabras) expect([...NE.conjugadas, ...NE.participios, ...NE.infinitivos]).not.toContain(p);
  });
  it('"no me queda claro" marca; "nota" no es una negacion pegada', () => {
    expect(senales('no me queda claro lo del consumo')).toEqual(['no_entendi']);
    expect(senales('de la nota entiendo que hay que subir la revision')).toEqual([]);
  });
});

describe('explicarGuard — "explicame"', () => {
  it('el pedido directo y el verbo con "me" antes o "mejor / facil" despues', () => {
    for (const t of ['explciame mejor', 'explicamelo dale', 'explicalo mejor', 'explicate mejor', 'me podes explicar que paso', 'me lo explcias de nuevo', 'explcia bien faicl'])
      expect(senales(t), t).toEqual(['explicame']);
  });
  it('"explicales", "explicarle", "explicaste" y "explicado" no son un pedido (depende de la lista de ajenas)', () => {
    expect(senales('explicales que les comparto la carpeta')).toEqual([]);
    expect(senales('hay que explicarle a manuel como se carga')).toEqual([]);
    expect(senales('ayer me lo explicaste mejor')).toEqual([]);
    expect(senales('quedo bien explicado en la hoja')).toEqual([]);
    expect(senales('no me lo expliquen mejor que no hace falta')).toEqual([]);
    for (const a of ['explicarle', 'explicaste']) expect(EX.ajenas).toContain(a);
  });
  it('alguien que le cuenta algo no es un pedido: "te explico", "eso explica por que", "me explica que..."', () => {
    expect(senales('como te explico que vos manejes el arb')).toEqual([]);
    expect(senales('eso justamente explica por que los informes dicen otra cosa')).toEqual([]);
    expect(senales('gamboa me explica que el consumo sale del marker')).toEqual([]);
    expect(senales('arma un pdf para explicar la mejora del dispositivo')).toEqual([]);
  });
  it('"replicame" y "aplicame" quedan a dos letras y son otro trabajo (depende de otras_palabras)', () => {
    const marcan = EX.otras_palabras.filter((p) => senales(`me podes ${p} mejor`).length);
    expect(marcan, `marcan: ${marcan.join(', ')}`).toEqual([]);
    expect(senales('replicame eso en los otros amfe')).toEqual([]);
    expect(senales('aplicame el cambio en el 173 tambien')).toEqual([]);
  });
});

describe('explicarGuard — "corto"', () => {
  it('"sintetiza" en sus tipeos reales; "sintetico" y "sintomas" no', () => {
    for (const t of ['sintetiza', 'sinteteiza', 'sintetniza', 'sintientiez', 'sisntetniezame', 'sintteitzar', 'sintentiz']) expect(senales(t), t).toEqual(['corto']);
    expect(senales('el vinilo sintetico no llego')).toEqual([]);
    expect(senales('los sintomas de la maquina')).toEqual([]);
  });
  it.each([
    ['es mucho texto', 'la lamina tiene poco texto'],
    ['no voy a leer eso', 'no vas a leer el pdf entero, lee la pagina 3'],
    ['me da paja leer eso', 'me da paja ir hasta el deposito'],
    ['resumime que paso', 'ya resumi los cambios en el mail de ayer'],
    ['anda al grano', 'el grano del vinilo es otro'],
    ['haceme una sintesis', 'la sintesis del adhesivo'],
    ['se breve', 'tuve una reunion breve con carlos'],
    ['repsonde rapido y breve si o no', 'el video es breve'],
    ['r epsodne breve por favor', 'la respuesta de carlos llego'],
  ])('ROJO "%s" · VERDE "%s"', (rojo, verde) => {
    expect(senales(rojo)).toEqual(['corto']);
    expect(senales(verde)).toEqual([]);
  });
  it('"resumir" y "resumiendo" como parte de un pedido no; "mas corto" tampoco (tambien es una orden de diseno)', () => {
    expect(senales('redactar y resumir mails')).toEqual([]);
    expect(senales('estoy resumiendo el proyecto')).toEqual([]);
    expect(senales('hace el cano mas corto')).toEqual([]);
  });
});

describe('explicarGuard — lo que no escribio Fak', () => {
  const dentro = 'no entendi nada del plan de control, explicame mejor';
  it('una cita larga entre comillas no cuenta; la misma frase sin comillas si', () => {
    expect(senales(`el cliente escribio: ${dentro} que opinas`)).toEqual(['no_entendi', 'explicame']);
    expect(senales(`mira "el cliente escribio: ${dentro}" que opinas`)).toEqual([]);
  });
  it('lo pegado (<pasted_content>) no cuenta: ni corto, ni de mas de 20.000 caracteres con el cierre cortado', () => {
    expect(senales(`${dentro}. pasame esto a un mail`)).toContain('no_entendi');
    expect(senales(`<pasted_content id="a1">${dentro}</pasted_content> pasame esto a un mail`)).toEqual([]);
    const largo = `<pasted_content id="a1">${dentro}. ${'relleno '.repeat(4000)}</pasted_content> pasame esto a un mail`;
    expect(largo.length).toBeGreaterThan(25000);
    expect(senales(largo)).toEqual([]);
  });
});

describe('explicarGuard — el aviso', () => {
  const skill = path.join(RAIZ, '.claude', 'skills', 'explicar-mejor', 'SKILL.md');
  it('no entendio o pide explicacion -> aviso de explicar, que nombra un skill que EXISTE', () => {
    const a = avisoDe(CASOS.no_entendi[0]);
    expect(a).toMatch(/\[EXPLICAR-MEJOR\]/); expect(a).toMatch(/skill `explicar-mejor`/); expect(a).toMatch(/cambia la FORMA/);
    expect(avisoDe(CASOS.explicame[0])).toBe(a);
    expect(fs.existsSync(skill), 'el aviso manda a un skill que no esta').toBe(true);
    expect(fs.readFileSync(skill, 'utf8')).toMatch(/^---\nname: explicar-mejor\n/);
  });
  it('ante un "por que": se explica y se PARA (memoria feedback_si_pide_que_le_explique_se_explica_y_se_para), en el aviso y en el skill', () => {
    const a = avisoDe('explicame te dije antes de hacer algo idiota');
    expect(a).toMatch(/se le explica y se PARA/);
    expect(a).not.toMatch(/y segui\b/);
    const s = fs.readFileSync(skill, 'utf8');
    expect(s).toMatch(/se le explica y \*\*se para\*\*/);
    expect(s).not.toMatch(/en un rengl[oó]n y se sigue/);
  });
  it('el aviso dice cuando NO aplica (un entregable, palabras de un tercero) y que ante correccion-guard manda ese', () => {
    for (const a of [avisoDe('no entiendo'), avisoDe('sintetiza')]) { expect(a).toMatch(/No aplica/); expect(a).toMatch(/\[CORRECCION-GUARD\], manda ese/); }
  });
  it('pide corto -> aviso corto; si ademas no entendio, gana el de explicar', () => {
    expect(avisoDe('sintetiza')).toMatch(/1 a 4 renglones/);
    expect(avisoDe('sintetiza')).not.toMatch(/cambia la FORMA/);
    expect(avisoDe('no enteindo sintetiza que hay que ahacer')).toMatch(/cambia la FORMA/);
    expect(avisoDe('sigo sin entneder sinteitiz amejore xpclaime emjro')).toMatch(/cambia la FORMA/);
  });
  it('VERDE: un mensaje comun, un aviso automatico, un subagente y un prompt que no es texto no reciben nada', () => {
    expect(avisoDe('corregi el amfe 173, ojo con la op 20')).toBeNull();
    expect(avisoDe('<task-notification>el agente dice: no entendi el pedido, explicame</task-notification>')).toBeNull();
    expect(atender(prompt('no entendi nada', { agent_id: 'a1' }))).toBeNull();
    expect(atender({ hook_event_name: 'PreToolUse', prompt: 'no entendi nada' })).toBeNull();
    for (const raro of [null, 42, 'texto', [], prompt(null), prompt(42), prompt({ a: 1 }), prompt(['no entendi'])]) expect(atender(raro)).toBeNull();
  });
});

describe('explicar-prompt.sh — el hook de verdad (bash -> node)', () => {
  it('ROJO: "no te entendi un carajo" -> exit 0 y additionalContext con el aviso', () => {
    const r = correr(prompt('no te entendi un carajo, no te entendi literalmente nada.'));
    expect(r.status, r.stderr).toBe(0); expect(r.stderr).toBe('');
    const j = JSON.parse(r.stdout);
    expect(j.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    expect(j.hookSpecificOutput.additionalContext).toMatch(/explicar-mejor/);
  });
  it('ROJO desde otra carpeta: el hook encuentra su script aunque el directorio de trabajo sea otro', () => {
    const r = correr(prompt('no entiendo explicame mejor'), os.tmpdir());
    expect(r.status, r.stderr).toBe(0); expect(r.stderr).toBe('');
    expect(JSON.parse(r.stdout).hookSpecificOutput.additionalContext).toMatch(/explicar-mejor/);
  });
  it('ROJO: el mensaje del incidente tal como llego (con el aviso de la app adelante) -> el aviso sale, con la pagina', () => {
    const r = correr(prompt(AVISO_APP + INCIDENTE));
    expect(r.status, r.stderr).toBe(0); expect(r.stderr).toBe('');
    const a = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    expect(a).toMatch(/\[EXPLICAR-MEJOR\]/); expect(a).toMatch(/escalon 3/);
  });
  it('VERDE: un pedido comun -> exit 0 y nada en la salida', () => {
    const r = correr(prompt('pasame el archivo de la bom entendes? asi lo reviso'));
    expect(r.status, r.stderr).toBe(0); expect(r.stdout).toBe(''); expect(r.stderr).toBe('');
  });
  it('JSON roto, vacio o con un prompt que no es texto -> exit 0 y sin ruido en ninguna salida: node no revienta', () => {
    for (const basura of ['', '{no es json', '[]', 'null', JSON.stringify(prompt(42)), JSON.stringify(prompt(null))]) {
      const r = correr(basura);
      expect(r.status, basura).toBe(0); expect(r.stdout, basura).toBe(''); expect(r.stderr, basura).toBe('');
    }
  });
});
