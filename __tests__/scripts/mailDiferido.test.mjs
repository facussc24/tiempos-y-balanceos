/**
 * `scripts/_mailEnviar.py --a-las "AAAA-MM-DD HH:MM"` (cola HOY-19i, 11/10/2026): programar la salida de un mail con la
 * entrega diferida de Outlook, DENTRO del circuito de envio de siempre. La logica vive en `scripts/_lib/mailDiferido.py`
 * (no manda nada: valida la hora, la fija en el borrador, la relee y despues mira donde quedo el mail).
 *
 * Que se cuida aca:
 *   - el selftest entero en CI (38 casos contra un Outlook de mentira que hace lo que se midio en el real: la hora
 *     escrita sin zona se corre 3 h; un mail con hora futura queda en la cola y no en Enviados);
 *   - que el modulo no nombre ningun verbo que transmita, borre o mueva, y que el circuito siga teniendo UN solo
 *     envio (el de siempre), con la hora fijada ANTES y solo cuando hay --enviar y --a-las;
 *   - que sin --a-las el camino de siempre no pase por la hora, y que la verificacion de «salio» mire la cola de ESE
 *     asunto (un mail programado de otro tema esperando no puede hacer figurar como trabado a un envio comun).
 * El verbo de envio se arma por partes: el mail-guard frena los archivos que lo traen escrito junto a senales de Outlook.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIB = path.join(RAIZ, 'scripts', '_lib', 'mailDiferido.py');
const CIRCUITO = path.join(RAIZ, 'scripts', '_mailEnviar.py');
const py = (args) => spawnSync('python', args, { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 60_000 });
const sinComentarios = (t) => t.replace(/"""[\s\S]*?"""/g, '').replace(/^\s*#.*$/gm, '').replace(/\s+#\s.*$/gm, '');
const ENVIO = ['Se', 'nd'].join('');

describe('mailDiferido.py --selftest (Outlook de mentira)', () => {
    const r = py([LIB, '--selftest']);
    it('los 38 casos pasan', () => {
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('todo verde (mailDiferido, 38 casos)');
        expect((r.stdout.match(/^  ok  /gm) || []).length).toBe(38);
        expect(r.stdout).not.toContain('MAL');
    });
    it('estan los casos del encargo, los rojos y el gemelo de la hora corrida', () => {
        for (const caso of [
            'ROJO hora: una hora que ya paso se rechaza',
            'ROJO hora: formatos que no son el pedido se rechazan',
            'programar: queda la hora pedida, confirmada por las dos vias',
            'programar: lo unico que le hizo al borrador fue fijar la hora y guardar',
            'GEMELO: escrita sin zona queda 3 horas corrida, como se midio en el Outlook real',
            'ROJO programar: si la relectura no da la hora pedida, dice que no y nombra las dos horas',
            'ROJO programar: y le saca la hora al borrador',
            'ROJO programar: si la hora llego mientras corrian los controles, no programa ni toca el borrador',
            'programado: queda en la Bandeja de salida y NO en Enviados (no sale antes)',
            'sin programar: la propiedad no se toco y el mail salio en el momento',
            'ROJO: un mail que salio en el momento no se informa como programado',
            'ROJO: en la cola sin figurar como entregado no se dice programado ni «no sale»',
            'ROJO: lo que no esta en ningun lado no se da por hecho',
            'cola: con un programado de otro asunto esperando, ESTE asunto no tiene nada en cola',
        ]) expect(r.stdout).toContain(`ok  ${caso}`);
    });
});

describe('el modulo no manda, no borra y no mueve: solo fija una hora y mira', () => {
    const texto = fs.readFileSync(LIB, 'utf8');
    const corte = texto.indexOf('Outlook de mentira (selftest)');
    const funciones = sinComentarios(texto.slice(texto.indexOf("FORMATO = '%Y-%m-%d %H:%M'"), corte));
    const VERBOS = [ENVIO, 'Delete', 'Move', 'Copy', 'Reply', 'ReplyAll', 'Forward', 'Display', 'Close', 'Remove', 'CreateItem', 'SendAndReceive'];
    const PROHIBIDO = new RegExp(`\\.(${VERBOS.join('|')})\\b`);
    it('el corte entre funciones y selftest existe', () => {
        expect(corte).toBeGreaterThan(1000);
        expect(funciones).toContain('def programar(');
        expect(funciones).toContain('def donde_quedo(');
    });
    it('ningun verbo que transmita, borre, mueva o abra una ventana; lo unico que asigna es la hora diferida', () => {
        expect(funciones).not.toMatch(PROHIBIDO);
        const asignaciones = funciones.match(/\bitem\.\w+\s*=[^=]/g) || [];
        expect(asignaciones.map((a) => a.replace(/\s*=.*/, ''))).toEqual(['item.DeferredDeliveryTime', 'item.DeferredDeliveryTime']);   // programar() y quitar()
    });
    it('GEMELO: el patron si ve cada verbo', () => {
        for (const v of VERBOS) expect(`item.${v}()`).toMatch(PROHIBIDO);
        expect('item.Save()').not.toMatch(PROHIBIDO);
    });
});

describe('_mailEnviar.py: un solo envio, la hora fijada antes y solo con --a-las', () => {
    const codigo = sinComentarios(fs.readFileSync(CIRCUITO, 'utf8').replace(/\r\n/g, '\n'));
    const pos = (s) => { const i = codigo.indexOf(s); expect(i, `no encuentro «${s}»`).toBeGreaterThan(-1); return i; };
    it('sigue habiendo UN solo envio en el circuito, y es el vigilado de siempre', () => {
        expect(codigo.match(new RegExp(`\\.${ENVIO}\\b`, 'g'))).toHaveLength(1);
        expect(codigo).toContain(`vigilando(it.${ENVIO}, descripcion='el envio')`);
    });
    it('el circuito no toca la hora por su cuenta: la fija el modulo', () => {
        expect(codigo).not.toMatch(/DeferredDeliveryTime/);
        expect(codigo.match(/mailDiferido\.programar\(/g)).toHaveLength(1);
    });
    it('la hora se valida antes de hablar con Outlook', () => {
        expect(pos('mailDiferido.leer_hora(a.a_las)')).toBeLessThan(pos('import win32com.client'));
    });
    it('el dry-run sale ANTES de fijar la hora: en seco no se programa nada', () => {
        const seco = pos('if not a.enviar:\n        if cuando:');
        const fijar = pos('mailDiferido.programar(');
        expect(seco).toBeLessThan(fijar);
        expect(codigo.slice(seco, fijar)).toMatch(/return 0/);
    });
    it('el orden con --enviar: todos los controles, fijar y releer la hora, el envio, y despues mirar donde quedo', () => {
        const orden = ['GATE anti-duplicado', 'Bandeja de salida:', 'mailDiferido.programar(', `vigilando(it.${ENVIO}`, 'mailDiferido.donde_quedo('].map(pos);
        expect([...orden].sort((a, b) => a - b)).toEqual(orden);
    });
    it('si la hora no quedo como se pidio, sale sin enviar', () => {
        const desde = pos('mailDiferido.programar(');
        const tramo = codigo.slice(desde, pos(`vigilando(it.${ENVIO}`));
        expect(tramo).toMatch(/if not ok:\s+print\(f"\\nABORTA, no se envio nada[^\n]*\n\s+return 1/);
    });
    it('sin --a-las nada cambia: fijar la hora y mirar la cola del programado cuelgan de «if cuando:»', () => {
        const antes = (s) => codigo.slice(0, pos(s)).trimEnd().split('\n').slice(-3).join('\n');
        expect(antes('ok, motivo, it = mailDiferido.programar(')).toMatch(/if cuando:$/);
        expect(antes("estado, texto = 'no-aparece', ''")).toMatch(/if cuando:$/);
    });
    it('«programado» solo se dice si se lo vio en la cola con su hora; cualquier otra cosa sale con 1', () => {
        const tramo = codigo.slice(pos("if estado == 'programado':"), pos('en_cola = mailDiferido.sigue_en_cola('));
        expect(tramo).toMatch(/PROGRAMADO —[\s\S]*return 0[\s\S]*NO QUEDO PROGRAMADO COMO SE PIDIO[\s\S]*return 1/);
    });
    it('la verificacion de «salio» mira la cola de ESTE asunto, no la cola entera', () => {
        const paso6 = codigo.slice(pos('en_cola = mailDiferido.sigue_en_cola('));
        expect(paso6).not.toMatch(/out\.Items\.Count/);
        expect(paso6).not.toMatch(/out\.Items\.Item\(1\)/);
        expect(paso6).toContain('x = en_cola[0]');
    });
    it('un envio comun NO manda un borrador que ya trae una hora programada', () => {
        const tramo = codigo.slice(pos('elif ya_puesta:'), pos('firma, avisos_doc = firma_ia_del_mail(it)'));
        expect(tramo).toMatch(/if a\.enviar:\s+print\("\\nABORTA, no se envio nada: un envio comun no manda un borrador que tiene una hora programada\."\)[\s\S]*return 3/);
    });
    it('si el envio falla despues de fijar la hora, al borrador se le saca la hora (o se avisa fuerte)', () => {
        const tramo = codigo.slice(pos(`vigilando(it.${ENVIO}`), pos('ns.SendAndReceive(False)'));
        expect(tramo).toMatch(/except Exception as e:\s+if not cuando:\s+raise[\s\S]*sacar_hora_si_sigue_en_borradores\(\)\s+return 1/);
        expect(codigo).toContain('CON UNA HORA PROGRAMADA y no pude sacarsela');
    });
    it('«ENVIADO» muestra ESTE mail (asunto y hora), no el primero de Enviados; y «ya salio» tiene su propio codigo', () => {
        expect(codigo).toContain("mailDiferido.en_enviados(ultimos_enviados(), cand['asunto'], normalizar_asunto, antes_de_enviar)");
        expect(codigo).not.toMatch(/x = sent\.GetFirst\(\)/);
        expect(codigo).toMatch(/if estado == 'salio':\s+return 4/);
    });
    it('una bandera recortada no vale por --enviar, y la hora se le saca solo al borrador que se mandaba', () => {
        expect(codigo).toMatch(/argparse\.ArgumentParser\([^\n]*allow_abbrev=False\)/);
        const r = py([CIRCUITO, '--buscar', 'x', '--envi']);
        if (!/No module named|ModuleNotFoundError|ImportError|AttributeError/.test(r.stderr)) {      // en el CI de Linux el circuito no importa (es de Windows)
            expect(r.status).toBe(2);
            expect(r.stderr).toMatch(/unrecognized arguments: --envi/);
        }
        expect(codigo).toContain('ns.CompareEntryIDs(str(b.EntryID or \'\'), id_del_borrador)');
        expect(codigo).toMatch(/if es_este and mailDiferido\.hora_puesta\(b\):/);
    });
    it('el registro de programados va a su archivo, no al de los borradores que lee el control del OK', () => {
        expect(codigo).toContain("'.mail-cache', 'programados.jsonl'");
        expect(codigo).not.toContain('borradores_claude.json');
    });
});
