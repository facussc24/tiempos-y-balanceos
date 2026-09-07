/**
 * video-maquina-guard — probado EN ROJO y EN VERDE.
 *
 * Incidente 2026-09-07: baje 39 videos del iPhone a carpetas de tarea del Escritorio y 13 de
 * ellos (el 02/09 entero, 5,59 GB) YA ESTABAN archivados en `5- VIDEOS Y FOTOS\1- CLIENTES\
 * NOVAX\TOP ROLL\MAQUINA MOLDEADORA IMG` desde el 02/09, con su nombre descriptivo. Fak:
 * "es gravisimo lo que paso", "no se pone algo que te obligue a recordar? un seguro",
 * "porque sino se me hace que va a volver a pasar".
 *
 * Un control no esta probado hasta que se lo vio fallar, y un verde puede venir del motivo
 * equivocado: cada rojo de aca comprueba tambien el TEXTO del bloqueo (LECCIONES 05/09).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GUARDIANES, matriz } from '../../scripts/_lib/guardianes.mjs';
import { parsear } from '../../scripts/_lib/guardianes.mjs';

const AHORA = Math.floor(Date.now() / 1000);

/** Corre el guardian con un HOME de mentira, para no depender del cruce real de la sesion. */
function correr(cmd, { horasDelCruce = null, file = '', tool = 'Bash' } = {}) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vmg-'));
    if (horasDelCruce !== null) {
        fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(home, '.claude', '.cruce-video'), String(AHORA - horasDelCruce * 3600));
    }
    const ctx = parsear(JSON.stringify({ tool_name: tool, tool_input: { command: cmd, file_path: file } }));
    const r = GUARDIANES['video-maquina-guard'](ctx, { ahora: AHORA, env: { HOME: home } });
    fs.rmSync(home, { recursive: true, force: true });
    return r;
}

const ESCRITORIO = '"/c/Users/FacundoS-PC/OneDrive - BARACK ARGENTINA SRL/Desktop/Cambio de molde IMG/Videos/IMG_0645.MOV"';
const BIBLIOTECA = '"/c/Users/FacundoS-PC/BARACK ARGENTINA SRL/Ing/INGENIERIA BARACK (NUNCA BORRAR)/5- VIDEOS Y FOTOS/1- CLIENTES/NOVAX/TOP ROLL/MAQUINA MOLDEADORA IMG/2026-09-04 - cambio de molde (IMG_0645).MOV"';
const MTP = 'powershell -File tel_a_nube.ps1 ; $s.NameSpace($d).CopyHere($it,16)';

describe('video-maquina-guard — un video en el Escritorio', () => {
    it('ROJO: copiar un video a una carpeta de tarea del Escritorio BLOQUEA, y dice por que', () => {
        const r = correr(`cp /c/Dev/_telefono/IMG_0645.MOV ${ESCRITORIO}`, { horasDelCruce: 0 });
        expect(r?.tipo).toBe('bloqueo');
        expect(r.texto).toMatch(/dejando un video en una carpeta del Escritorio/i);
        expect(r.texto).toMatch(/5- VIDEOS Y FOTOS/);
    });

    it('ROJO: tambien con Move-Item de PowerShell', () => {
        expect(correr(`Move-Item -LiteralPath X.MOV -Destination ${ESCRITORIO}`, { horasDelCruce: 0 })?.tipo).toBe('bloqueo');
    });

    it('VERDE: el MISMO video hacia la biblioteca pasa — sacarlo del Escritorio es la correccion', () => {
        expect(correr(`mv ${ESCRITORIO} ${BIBLIOTECA}`, { horasDelCruce: 0 })).toBeNull();
    });

    it('VERDE: leer, listar o ffprobe un video del Escritorio no mueve nada', () => {
        expect(correr(`ls -la ${ESCRITORIO}`, { horasDelCruce: 0 })).toBeNull();
        expect(correr(`ffprobe -v error ${ESCRITORIO}`, { horasDelCruce: 0 })).toBeNull();
    });

    it('VERDE: un .jpg (plancha de contacto, keyframe) en la carpeta de la tarea SI va', () => {
        expect(correr('cp _PLANCHA_IMG_0645.jpg "/c/Users/FacundoS-PC/OneDrive - BARACK ARGENTINA SRL/Desktop/tarea/x.jpg"', { horasDelCruce: 0 })).toBeNull();
    });
});

describe('video-maquina-guard — copiar del telefono sin cruzar', () => {
    it('ROJO: sin ningun cruce hecho, BLOQUEA y nombra el script que lo destraba', () => {
        const r = correr(MTP);
        expect(r?.tipo).toBe('bloqueo');
        expect(r.texto).toMatch(/No hay ningun cruce hecho/);
        expect(r.texto).toMatch(/_videoBiblioteca\.mjs --cruzar/);
    });

    it('ROJO: un cruce de hace 25 h ya no vale, y el mensaje dice la edad', () => {
        const r = correr(MTP, { horasDelCruce: 25 });
        expect(r?.tipo).toBe('bloqueo');
        expect(r.texto).toMatch(/hace 25\.0 h/);
    });

    it('VERDE: con el cruce recien hecho, la copia pasa', () => {
        expect(correr(MTP, { horasDelCruce: 0.5 })).toBeNull();
    });

    it('VERDE: mirar el telefono sin copiar (indexar) pasa aunque no haya cruce', () => {
        expect(correr('$s.NameSpace(17).Items() | ForEach-Object { $_.Name }')).toBeNull();
    });
});

describe('video-maquina-guard — no estorba a quien lo documenta', () => {
    it('VERDE: la regla, el test, la memoria y LECCIONES nombran estas rutas como dato', () => {
        for (const f of ['.claude/rules/video-maquina.md', '__tests__/scripts/videoMaquinaGuard.test.mjs',
            'docs/LECCIONES_APRENDIDAS.md', 'scripts/_lib/guardianes.mjs']) {
            expect(correr(`cp x.MOV ${ESCRITORIO}`, { horasDelCruce: 0, file: f, tool: 'Write' }), f).toBeNull();
        }
    });

    it('esta cableado para correr con Bash, PowerShell, Write y Edit', () => {
        for (const t of ['Bash', 'PowerShell', 'Write', 'Edit']) {
            expect(matriz(t), t).toContain('video-maquina-guard');
        }
    });
});
