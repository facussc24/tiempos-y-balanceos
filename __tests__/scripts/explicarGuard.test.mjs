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
import { CASOS, CANON, senales, avisoDe, atender } from '../../scripts/_lib/explicarGuard.mjs';

const RAIZ = process.cwd();
const HOOK = path.join(RAIZ, '.claude', 'hooks', 'explicar-prompt.sh');
const correr = (payload, cwd = RAIZ) => spawnSync('bash', [HOOK], { input: typeof payload === 'string' ? payload : JSON.stringify(payload), encoding: 'utf8', cwd });
const prompt = (t, extra = {}) => ({ hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt: t, ...extra });
const NE = CANON.no_entendi; const EX = CANON.explicame;

describe('explicarGuard — los casos del canon', () => {
  it.each(['no_entendi', 'explicame', 'corto'])('ROJO: los mensajes reales de "%s" marcan esa senal', (k) => {
    for (const t of CASOS[k]) expect(senales(t), t.slice(0, 60)).toContain(k);
  });
  it('VERDE: muletillas, pedidos de trabajo y palabras parecidas no marcan nada', () => {
    for (const t of CASOS.verdes) expect(senales(t), t.slice(0, 60)).toEqual([]);
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
    ['mas faicl d etnende rme das muchas tablas', 'hace el nido mas facil de montar'],
    ['de una forma sencilla de etnender', 'una forma sencilla de armar el carro'],
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
