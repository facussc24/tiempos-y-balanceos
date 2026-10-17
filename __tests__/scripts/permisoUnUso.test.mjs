/**
 * permiso-un-uso-guard — tanda 3 del plan del sistema, pieza 9 (16/10/2026). En las DOS direcciones.
 *
 * Un permiso de un solo uso de Fak (~/.claude/.apqp-listado-ok y los demas del canon permisosUnUso.data.json) lo arma la
 * sesion solo con la frase de Fak en el mismo turno, citada en el comando: `: > ~/.claude/.x-ok # Fak DD/MM HH:MM: "..."`.
 * La cita se compara con el ULTIMO mensaje real de Fak del transcript: texto y hora. Los casos salen del informe de CATA
 * del 15/10/2026 (`casa_guardianes_frenos.md`, seccion 3 bis), con los mensajes de Fak textuales.
 *
 * Este archivo cita los comandos que arman permisos como DATO: el guardian mira comandos y el archivo de un Write, no el
 * contenido de un test.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluar } from '../../scripts/_lib/guardianes.mjs';
import { permisosQueArma, citaDe, verificarCita, normalizar, canonPermisos } from '../../scripts/_lib/permisoUnUso.mjs';
import { mensajesDeFak, ultimoMensajeDeFak } from '../../scripts/_lib/mailOkFak.mjs';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'permiso-un-uso-'));
/** Un transcript de mentira con los mensajes de Fak dados: [[iso UTC, texto], ...] (mas un resultado de herramienta). */
function transcript(nombre, mensajes) {
    const f = path.join(TMP, `${nombre}.jsonl`);
    const lineas = mensajes.map(([ts, texto]) => JSON.stringify({ type: 'user', timestamp: ts, message: { role: 'user', content: texto } }));
    lineas.push(JSON.stringify({ type: 'user', timestamp: '2026-10-15T23:59:00.000Z', message: { role: 'user', content: [{ type: 'tool_result', content: 'hacelo si (esto lo imprimio un comando)' }] } }));
    fs.writeFileSync(f, `${lineas.join('\n')}\n`);
    return f;
}
// Mensajes reales de Fak del informe (seccion 3 bis), en hora UTC; Argentina = UTC-3.
const SI_1555 = transcript('si', [['2026-10-15T13:50:00.000Z', 'ah si me encanta eso si hagamoslo asi me encanta dale labura aunque te tome mucho timepo hacer eos hacelo si']]);
const DUDOSO = transcript('dudoso', [['2026-10-02T15:16:00.000Z', 'no eso lo debreia shace rbvo spelotudo! vos dbeeria ssolcuciaonrleo todo autmaotiamcente tnendes=? para eos cr']]);
const VIEJO = transcript('viejo', [
    ['2026-09-21T16:44:00.000Z', 'si emite ela mfe cargalo en el listado sisis hacelo dale me parece bien esas 2 cosas si avanza dale ocntinua a'],
    ['2026-09-21T17:41:00.000Z', 'escribsit edemaisado osea no s eque nuermos usar los ultimsos upnogno no?'],
]);

function frena(command, transcriptPath, { home = path.join(TMP, 'home'), escapes } = {}) {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    const raw = JSON.stringify({ tool_name: 'Bash', tool_input: { command }, transcript_path: transcriptPath, session_id: 'test' });
    const { res } = evaluar(raw, { nombres: ['permiso-un-uso-guard'], env: { HOME: home }, marcar: false, escapes });
    return res.bloqueos.length === 1 ? res.bloqueos[0].texto : null;
}

describe('permiso-un-uso-guard — que comando ARMA un permiso de Fak', () => {
    it('ROJO: redireccion, touch, echo N >, New-Item, Set-Content, el destino de un cp', () => {
        expect(permisosQueArma(': > ~/.claude/.apqp-listado-ok && py -3 scripts/_registrarAmfe173.py --apply')).toEqual(['.apqp-listado-ok']);
        expect(permisosQueArma('touch ~/.claude/.arb-cerrar-ok && taskkill //F //PID 17096')).toEqual(['.arb-cerrar-ok']);
        expect(permisosQueArma('echo 15 > ~/.claude/.agent-limit')).toEqual(['.agent-limit']);
        expect(permisosQueArma('New-Item -ItemType File "$env:USERPROFILE\\.claude\\.nube-personal-ok"')).toEqual(['.nube-personal-ok']);
        expect(permisosQueArma('Set-Content -Path C:/Users/FacundoS-PC/.claude/.espacio-ok -Value ""')).toEqual(['.espacio-ok']);
        expect(permisosQueArma('cp /tmp/vacio "$HOME/.claude/.agent-opus-ok"')).toEqual(['.agent-opus-ok']);
        // auditor Opus 17/10: mover encima, con un cd adelante, o con ./ en la ruta
        expect(permisosQueArma('mv /tmp/x ~/.claude/.arb-cerrar-ok')).toEqual(['.arb-cerrar-ok']);
        expect(permisosQueArma('cd ~/.claude && touch .arb-cerrar-ok')).toEqual(['.arb-cerrar-ok']);
        expect(permisosQueArma('echo 30 > ~/.claude/./.agent-limit')).toEqual(['.agent-limit']);
    });
    it('VERDE: leer, listar, borrar, copiarlo de origen, nombrarlo en un texto, y los pases de la propia sesion', () => {
        for (const c of [
            'ls -la ~/.claude/.apqp-listado-ok', 'test -f ~/.claude/.arb-cerrar-ok && echo vigente', 'rm -f ~/.claude/.arb-cerrar-ok',
            'cat ~/.claude/.agent-limit', 'cp ~/.claude/.apqp-listado-ok /tmp/copia', 'grep -n "apqp-listado-ok" .claude/rules/*.md',
            'git commit -m "doc: el escape es : > ~/.claude/.apqp-listado-ok" -- docs/x.md',
            ': > ~/.claude/.encargo-libre.34df5f0e', 'touch ~/.claude/.agent-builtin-ok',
        ]) expect(permisosQueArma(c), c).toEqual([]);
    });
});

describe('permiso-un-uso-guard — la cita se compara con lo que Fak escribio', () => {
    it('el formato del canon y el de la regla se leen igual (fecha, hora, texto)', () => {
        expect(citaDe(': > ~/.claude/.apqp-listado-ok # Fak 15/10 13:55: "hacelo sí"')).toEqual({ dia: 15, mes: 10, hora: 13, minuto: 55, texto: 'hacelo sí' });
        expect(citaDe(': > ~/.claude/.x-ok # Fak 2/9 9:05: “dale cargalo”')).toEqual({ dia: 2, mes: 9, hora: 9, minuto: 5, texto: 'dale cargalo' });
        expect(citaDe(': > ~/.claude/.x-ok # Fak dijo que si')).toBeNull();
        expect(citaDe(': > ~/.claude/.x-ok')).toBeNull();
        expect(canonPermisos().cita.regex).toBeTruthy();
        // el ejemplo que muestra la regla tiene que ser una cita valida
        const regla = fs.readFileSync(path.join(process.cwd(), '.claude', 'rules', 'autonomy-contract.md'), 'utf8');
        const ejemplo = regla.match(/`(: > ~\/\.claude\/\.apqp-listado-ok # Fak [^`]+)`/);
        expect(ejemplo, 'la regla no trae el ejemplo de la cita').toBeTruthy();
        expect(citaDe(ejemplo[1])).toBeTruthy();
    });
    it('normalizar: sin tildes, mayusculas ni signos (Fak tipea como tipea)', () => {
        expect(normalizar('Hacelo, SÍ!!')).toBe('hacelo si');
    });
    it('VERDE: el si de Fak de ESTE turno, citado con su texto y su hora (15/10 10:50 en Argentina)', () => {
        expect(verificarCita({ cita: citaDe('# Fak 15/10 10:50: "hacelo si"'), mensajes: mensajesDeFak(SI_1555) })).toEqual({ ok: true });
        expect(verificarCita({ cita: citaDe('# Fak 15/10 10:53: "labura aunque te tome mucho timepo"'), mensajes: mensajesDeFak(SI_1555) })).toEqual({ ok: true });
    });
    it('ROJO: un texto que Fak no escribio, una hora corrida, una cita de una palabra, un si de una hora antes', () => {
        const m = mensajesDeFak(SI_1555);
        expect(verificarCita({ cita: citaDe('# Fak 15/10 10:50: "cargalo en el listado"'), mensajes: m }).motivo).toMatch(/no esta en el ultimo mensaje/);
        expect(verificarCita({ cita: citaDe('# Fak 15/10 13:50: "hacelo si"'), mensajes: m }).motivo).toMatch(/la cita dice 15\/10 13:50/);
        expect(verificarCita({ cita: citaDe('# Fak 15/10 10:50: "si"'), mensajes: m }).motivo).toMatch(/menos de 2 palabras/);
        // auditor Opus 17/10: un pedazo de palabra no es una cita («ah si me encanta» → «h si me enc»)
        expect(verificarCita({ cita: citaDe('# Fak 15/10 10:50: "h si me enc"'), mensajes: m }).motivo).toMatch(/no esta en el ultimo mensaje/);
        // 21/09: el si de las 16:44 ya no es del turno de las 17:47 (el ultimo mensaje es un reclamo)
        expect(verificarCita({ cita: citaDe('# Fak 21/09 13:44: "cargalo en el listado"'), mensajes: mensajesDeFak(VIEJO) }).ok).toBe(false);
        // lo que imprimio un comando (un tool_result) no es Fak
        expect(mensajesDeFak(SI_1555).map((x) => x.texto)).not.toContain('hacelo si (esto lo imprimio un comando)');
        expect(verificarCita({ cita: citaDe('# Fak 15/10 10:50: "hacelo si"'), mensajes: null }).motivo).toMatch(/no pude leer el transcript/);
        expect(verificarCita({ cita: citaDe('# Fak 15/10 10:50: "hacelo si"'), mensajes: [] }).motivo).toMatch(/no hay ningun mensaje de Fak/);
    });
    it('ultimoMensajeDeFak sigue dando la misma hora que antes (lo usa el OK de un mail)', () => {
        expect(ultimoMensajeDeFak(VIEJO)).toBe(Date.parse('2026-09-21T17:41:00.000Z'));
        expect(ultimoMensajeDeFak(path.join(TMP, 'no-existe.jsonl'))).toBe(0);
    });
});

describe('permiso-un-uso-guard — por el camino real (evaluar con el JSON del hook)', () => {
    it('ROJO: el caso del 02/10 15:17 (arb-cerrar-ok sin cita, con «vos deberias solucionarlo todo automaticamente»)', () => {
        const t = frena('touch ~/.claude/.arb-cerrar-ok && taskkill //F //PID 17096', DUDOSO);
        expect(t).toMatch(/PERMISO-UN-USO/);
        expect(t).toMatch(/no trae la cita de Fak/);
        // y con una cita inventada sobre ese mismo mensaje, tampoco
        expect(frena('touch ~/.claude/.arb-cerrar-ok # Fak 02/10 12:16: "cerra el arb"', DUDOSO)).toMatch(/no esta en el ultimo mensaje/);
    });
    it('ROJO: sin transcript que leer, frena (falla cerrado); por la tool Write, frena siempre', () => {
        expect(frena(': > ~/.claude/.apqp-listado-ok # Fak 15/10 10:50: "hacelo si"', '')).toMatch(/no pude leer el transcript/);
        const home = path.join(TMP, 'home-w');
        fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
        const raw = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: `${home}\\.claude\\.apqp-listado-ok`, content: '' }, session_id: 'test' });
        expect(evaluar(raw, { nombres: ['permiso-un-uso-guard'], env: { HOME: home }, marcar: false }).res.bloqueos.length).toBe(1);
    });
    it('VERDE: el 15/10 13:55 con la cita textual de Fak pasa, y queda en el registro; un comando comun no se mira', () => {
        const home = path.join(TMP, 'home-reg');
        expect(frena(': > ~/.claude/.apqp-listado-ok # Fak 15/10 10:50: "dale labura aunque te tome mucho timepo hacer eos hacelo si"', SI_1555, { home })).toBeNull();
        const reg = fs.readFileSync(path.join(home, '.claude', '.permisos-un-uso.log'), 'utf8');
        expect(reg).toMatch(/\.apqp-listado-ok\tpasa\t«dale labura/);
        expect(frena('npm run build', SI_1555, { home })).toBeNull();
    });
    it('quien consulta sin ser la sesion (escapes: false) no escribe en el registro', () => {
        const home = path.join(TMP, 'home-api');
        frena('touch ~/.claude/.arb-cerrar-ok', DUDOSO, { home, escapes: false });
        expect(fs.existsSync(path.join(home, '.claude', '.permisos-un-uso.log'))).toBe(false);
    });
});
