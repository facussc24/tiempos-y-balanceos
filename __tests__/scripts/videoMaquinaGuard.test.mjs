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
function correr(cmd, { horasDelCruce = null, file = '', tool = 'Bash', env = {} } = {}) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vmg-'));
    if (horasDelCruce !== null) {
        fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(home, '.claude', '.cruce-video'), String(AHORA - horasDelCruce * 3600));
    }
    const ctx = parsear(JSON.stringify({ tool_name: tool, tool_input: { command: cmd, file_path: file } }));
    const r = GUARDIANES['video-maquina-guard'](ctx, { ahora: AHORA, env: { HOME: home, ...env } });
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

    // 07/09/2026: el guardian miraba si "Desktop" aparecia en CUALQUIER lado del comando, asi
    // que frenaba tambien SACAR un video de una carpeta de tarea — que es justo lo que la regla
    // pide. Aparecio con un video PERSONAL que habia caido en una carpeta de trabajo y habia que
    // sacar de ahi. Ahora mira el DESTINO.
    it('VERDE: sacar un video del Escritorio al disco de transito (fuera de OneDrive) pasa', () => {
        expect(correr(`mv ${ESCRITORIO} /c/Dev/_telefono/2026-09-03/`, { horasDelCruce: 0 })).toBeNull();
        expect(correr(`Move-Item -LiteralPath ${ESCRITORIO} -Destination C:\\Dev\\_telefono\\2026-09-03\\`, { horasDelCruce: 0 })).toBeNull();
    });

    it('ROJO: si el destino no se puede identificar, sigue bloqueando (ante la duda, frena)', () => {
        expect(correr(`cp ${ESCRITORIO} .`, { horasDelCruce: 0 })?.tipo).toBe('bloqueo');
    });

    // El destino sale de la sentencia que MUEVE. Antes se tomaba la ultima ruta del comando
    // entero, asi que un `mv` correcto seguido de un `ls` a la carpeta de la tarea se bloqueaba.
    it('VERDE: comando compuesto — el mv va afuera aunque despues haya un ls al Escritorio', () => {
        expect(correr(`cat ${ESCRITORIO} > /dev/null ; mv ${ESCRITORIO} "/c/Dev/_telefono/_PERSONAL - NO ARCHIVAR/" && ls -l "/c/Users/FacundoS-PC/OneDrive - BARACK ARGENTINA SRL/Desktop/tarea/Videos del celular de Fak/"`,
            { horasDelCruce: 0 })).toBeNull();
    });

    it('ROJO: comando compuesto donde el que mueve SI deja el video en el Escritorio', () => {
        expect(correr(`ls /c/Dev/_telefono ; cp /c/Dev/_telefono/IMG_0645.MOV ${ESCRITORIO}`,
            { horasDelCruce: 0 })?.tipo).toBe('bloqueo');
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

describe('video-maquina-guard — la raiz de una carpeta de maquina es solo para originales', () => {
    // Pedido de Fak el 21/09/2026. Antes de ordenarlas, las tres carpetas de la linea Top Roll
    // tenian en la raiz el generador de las hojas, los fotogramas de OTRA maquina, el PDF de un
    // caso y dos carpetas numeradas: 228 hallazgos, y un video de 1,19 GB guardado dos veces.
    const RAIZ = '/c/Users/FacundoS-PC/BARACK ARGENTINA SRL/Ing/INGENIERIA BARACK (NUNCA BORRAR)/5- VIDEOS Y FOTOS/1- CLIENTES/NOVAX/TOP ROLL/MAQUINA MOLDEADORA IMG';

    it('ROJO: dejar un PDF, un script o una carpeta de trabajo en la raiz', () => {
        for (const x of ['CASO - burbuja en la punta.pdf', 'hojas_spec.py', '_INFO SACADA DE LOS VIDEOS']) {
            const r = correr(`mv "algo" "${RAIZ}/${x}"`, { horasDelCruce: 0 });
            expect(r?.tipo, x).toBe('bloqueo');
            expect(r.texto).toMatch(/SOLO los originales/);
            expect(r.texto).toMatch(/\.claude/);
        }
    });

    it('ROJO: un video con nombre que no es el de la casa, y el mensaje dice cual es el formato', () => {
        const r = correr(`mv "x.MOV" "${RAIZ}/Prensa KingPower - Parte 1 (02-09, 18 min).MOV"`, { horasDelCruce: 0 });
        expect(r?.tipo).toBe('bloqueo');
        expect(r.texto).toMatch(/AAAA-MM-DD - lo que se ve \(IMG_xxxx\)/);
    });

    it('ROJO: tambien cuando lo escribe la tool Write, no solo un mv', () => {
        const r = correr('', { horasDelCruce: 0, file: `${RAIZ}/notas.txt`, tool: 'Write' });
        expect(r?.tipo).toBe('bloqueo');
    });

    it('VERDE: un original con el nombre de la casa entra a la raiz', () => {
        const ok = `${RAIZ}/2026-09-09 - PIZARRA - tiradas T1 a T10 de la manana (IMG_0802).HEIC`;
        expect(correr(`mv "origen.HEIC" "${ok}"`, { horasDelCruce: 0 })).toBeNull();
    });

    it('VERDE: lo que va adentro de .claude pasa, que para eso esta', () => {
        for (const d of ['.claude', '.claude/transcripciones/IMG_0802.txt', '.claude/casos/CASO - burbuja.pdf']) {
            expect(correr(`mv "algo" "${RAIZ}/${d}"`, { horasDelCruce: 0 }), d).toBeNull();
        }
    });

    it('VERDE: una carpeta que no es de maquina no la mira este candado', () => {
        const otra = '/c/Users/FacundoS-PC/BARACK ARGENTINA SRL/Ing/INGENIERIA BARACK (NUNCA BORRAR)/5- VIDEOS Y FOTOS/3- INSTITUCIONAL/2026-09-10 - La prensa/_LEEME.txt';
        expect(correr(`mv "algo" "${otra}"`, { horasDelCruce: 0 })).toBeNull();
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

// 16/10/2026 (tanda 1.6 del plan del sistema; v2 tras el auditor Opus de esa noche): con menos de 10 GB libres en la PC
// principal, lo PESADO se baja desde CATA. Los casos son los 28 comandos REALES de 10 dias de charlas que la v1 frenaba
// (el auditor los listo: 3 pesados, 2 discutibles, 2 agarrados por casualidad, 21 que no eran pesados) mas lo pesado que la
// v1 dejaba pasar. El nombre de maquina y los GB libres de C: entran por `env` (COMPUTERNAME, BARACK_ESPACIO_LIBRE_GB): el
// test no depende del disco real de la PC donde corre, y los tests de arriba (sin COMPUTERNAME) no cambian.
describe('video-maquina-guard — lo pesado se baja desde CATA (v2): frena lo pesado de verdad y deja pasar los 21 comandos reales que no lo eran', () => {
    const PC = { COMPUTERNAME: 'DESKTOP-14JG95B' };
    const POCO = { ...PC, BARACK_ESPACIO_LIBRE_GB: '6' };
    const BIB = '/c/Users/FacundoS-PC/BARACK ARGENTINA SRL/Ingeniería y Proyecto - General/INGENIERIA BARACK (NUNCA BORRAR)/5- VIDEOS Y FOTOS';
    const BIBW = BIB.replace(/\//g, '\\').replace(/^\\c\\/, 'C:\\');
    const telCopiar = `cd /c/Dev/BarackMercosul; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/video/tel_copiar.ps1 -Mes 202610 -Archivos IMG_1246.MOV,IMG_1248.MOV,IMG_1249.MOV -Destino 'C:\\Dev\\_telefono\\2026-10-14' 2>&1 | tail -15`;
    const poco = (cmd, extra = {}) => correr(cmd, { horasDelCruce: 0, env: { ...POCO, ...extra } });
    // Dos archivos de tamano conocido: el guardian MIDE el origen cuando es local.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmg-pesado-'));
    const grande = path.join(dir, 'grande.mp4').replace(/\\/g, '/');
    const chico = path.join(dir, 'chico.zip').replace(/\\/g, '/');
    beforeAll(() => {
        for (const [f, mb] of [[grande, 120], [chico, 5]]) { const fd = fs.openSync(f, 'w'); fs.ftruncateSync(fd, mb * 1e6); fs.closeSync(fd); }
    });
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('ROJO (los 3 pesados reales): tel_copiar.ps1 del 07 y del 14/10, y el cp "$D"/*.mp4 de la biblioteca del 16/10, con 6 GB -> BLOQUEA y dice por que, los GB y como dejarle el pedido a CATA', () => {
        const r = poco(telCopiar);
        expect(r?.tipo).toBe('bloqueo');
        expect(r.texto).toMatch(/copia videos del telefono \(tel_copiar\.ps1\)/);
        expect(r.texto).toMatch(/C:\/ de esta PC tiene 6\.0 GB libres \(menos de 10\)/);
        expect(r.texto).toMatch(/desde CATA/);
        expect(r.texto).toMatch(/FACUNDO/);
        expect(r.texto).toMatch(/\.espacio-ok/);
        expect(poco(`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/video/tel_copiar.ps1 -Mes 202610 -Archivos "IMG_1083.MOV,IMG_1086.MOV,SASN9865.MP4" -Destino 'C:\\Dev\\_telefono\\2026-10-07'`)?.tipo).toBe('bloqueo');
        const glob = poco(`D="${BIB}/1- CLIENTES/NOVAX/INSERT/MAQUINA HOT PRESS BMA101"; W="C:/Users/FACUND~1/AppData/Local/Temp/claude/x/scratchpad"; mkdir -p "$W" && cp "$D"/*.mp4 "$W/" && ls "$W"`);
        expect(glob?.tipo).toBe('bloqueo');
        expect(glob.texto).toMatch(/5- VIDEOS Y FOTOS|biblioteca/);
    });

    it('ROJO (lo que la v1 dejaba pasar): yt-dlp sin -o, y la copia recursiva de una carpeta de maquina con robocopy, cp -r y Copy-Item -Recurse', () => {
        expect(poco('yt-dlp https://www.youtube.com/watch?v=abc')?.tipo).toBe('bloqueo');
        expect(poco('yt-dlp -f best https://www.youtube.com/watch?v=abc')?.tipo).toBe('bloqueo');
        expect(poco(`robocopy "${BIBW}\\1- CLIENTES\\NOVAX\\INSERT\\MAQUINA HOT PRESS BMA101" C:\\Dev\\copia /E`)?.tipo).toBe('bloqueo');
        expect(poco(`cp -r "${BIB}/1- CLIENTES/NOVAX/INSERT/MAQUINA HOT PRESS BMA101" /c/Dev/copia`)?.tipo).toBe('bloqueo');
        expect(poco(`Copy-Item -Recurse "${BIBW}\\1- CLIENTES\\NOVAX\\INSERT\\MAQUINA HOT PRESS BMA101" C:\\Dev\\copia`)?.tipo).toBe('bloqueo');
        expect(poco(MTP)?.tipo).toBe('bloqueo');                                              // CopyHere del telefono, con cruce fresco
        const medido = poco(`cp "${grande}" /c/Dev/_telefono/copia.mp4`);
        expect(medido?.tipo).toBe('bloqueo');
        expect(medido.texto).toMatch(/copia un archivo de 120 MB/);
    });

    it('VERDE (los 21 reales que no eran pesados): expulsar el pendrive, mover o renombrar, zips chicos o sin medir, codigo adentro de echo/python/node/heredoc, el copy del codec de ffmpeg', () => {
        const pasan = [
            // Namespace(17) es «Este equipo»: expulsar o listar el pendrive no copia nada (5 comandos reales)
            `powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).Namespace(17).ParseName('D:').InvokeVerb('Eject'); Start-Sleep -Seconds 3; if (Get-PSDrive -Name D -ErrorAction SilentlyContinue) { 'sigue montado' } else { 'expulsado' }"`,
            `ls /d/ | head; powershell -NoProfile -Command "$d = (New-Object -ComObject Shell.Application).Namespace(17).ParseName('D:'); $d.Verbs() | ForEach-Object { $_.Name }"`,
            // mover o renombrar adentro del disco no ocupa un byte: es el paso 6 de la regla (Move-Item del 14/10, shutil.move del 07/10, mv y os.rename)
            `powershell -NoProfile -Command " Move-Item 'C:\\Dev\\_telefono\\2026-10-14\\IMG_1246.MOV' '${BIBW}\\1- CLIENTES\\NOVAX\\TOP ROLL\\MAQUINA MOLDEADORA IMG\\2026-10-14 - ROBOT LASER sobre tela (IMG_1246).MOV'"`,
            // el comando REAL del 14/10 18:42 tiene varios renglones y un Copy-Item de una foto en el de abajo (auditor ronda 2, H2)
            `powershell -NoProfile -Command "\n $b='${BIBW}\\1- CLIENTES\\NOVAX\\TOP ROLL\\MAQUINA MOLDEADORA IMG'\n Move-Item 'C:\\Dev\\_telefono\\2026-10-14\\IMG_1246.MOV' (Join-Path $b '2026-10-14 - ROBOT LASER sobre tela (IMG_1246).MOV')\n Copy-Item 'C:\\Dev\\_telefono\\2026-10-14\\IMG_1247.HEIC' (Join-Path $b '2026-10-14 - PIZARRA del robot (IMG_1247).HEIC')\n"`,
            // codigo con punto y coma adentro de las comillas sigue siendo UNA sentencia que empieza con node (ronda 2, H5)
            `node -e "const re=/tel_copiar/; const x='a.mp4'; console.log(re.test(process.argv[1]), x)" x`,
            `cd /c/Dev/_telefono && python - <<'EOF'\nimport os, shutil\nL=r"C:\\Users\\FacundoS-PC\\BARACK ARGENTINA SRL\\x"\nshutil.move(os.path.join(L, "IMG_1083.MOV"), os.path.join(L, "2026-10-07 - ductos (IMG_1083).MOV"))\nEOF`,
            `N="/c/Users/FacundoS-PC/BARACK ARGENTINA SRL/Ingeniería y Proyecto - General/INSTALAR EN UNA PC NUEVA"; mv "$N/5- Mails para el asistente de Leo.zip" "$N/viejo.zip"`,
            `python - <<'EOF'\nimport os\nd=r"${BIBW}\\3- INSTITUCIONAL\\2026-10-07 - Videos para Andres"\nos.rename(os.path.join(d,"a.zip"), os.path.join(d,"b.zip"))\nEOF`,
            // zips chicos (55 KB a 58 MB) o que no se pueden medir: pasan
            `cp /c/Dev/_pedro_20261009/herramientas/repo.zip /c/Dev/_pedro_20261009/herramientas2/repo.zip && ls -la /c/Dev/_pedro_20261009/herramientas2/`,
            `cd /c/Dev/BarackMercosul && mkdir -p exports/impresion_3d/mail && cp -n ".claude/worktrees/impresora-tanda17-496e43/exports/impresion_3d/skill_impresion-3d-bambu_2026-10-16.zip" exports/impresion_3d/`,
            `cp "${chico}" /c/Dev/x/chico.zip`,
            `D="C:/Users/FACUND~1/AppData/Local/Temp/claude/x/scratchpad/leo_zip"; cp "C:/Users/FacundoS-PC/Downloads/base_mount.3mf.zip" "$D/base_mount.3mf"`,
            // la copia va a OTRO disco (el pendrive D:): no se mide contra C:
            `DEST="/d/INSTALAR MI PC (Facundo)"; mkdir -p "$DEST/programa" && cp tools/instalar_mi_pc/Instalar-Mi-PC.cmd "$DEST/" && cp "${grande}" "$DEST/programa/grande.zip"`,
            // codigo o texto, no copias
            'echo cp prueba.zip',
            `node -e "const re=/tel_copiar/; console.log(re.test(process.argv[1]))" x`,
            `S="C:/Users/FACUND~1/AppData/Local/Temp/claude/x/scratchpad"; cd "$S"; python -I -c "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); [print(i.filename,i.file_size) for i in z.infolist()]" "$S/deck.zip"`,
            `mkdir -p /c/tmp/setup/agentes/ippad/zipx && cd /c/tmp/setup/agentes/ippad/zipx && python -I -c "import zipfile,shutil; z=zipfile.ZipFile(r'Y:\\BARACK\\CALIDAD\\HO 985 - IP PAD\\IP PAD.zip'); shutil.copyfileobj(z.open('IP PAD.xlsx'), open('IP PAD.xlsx','wb'))"`,
            `cd "/c/x/entrega" && ffmpeg -v error -y -i apc_costura.mp4 -map 0:v -map 0:a -c:v copy -af "volume=-1.2dB" -c:a aac apc_costura_ok.mp4`,
            `cd "/c/x/scratchpad" && cat > com_drafts.py <<'EOF'\n# SOLO LECTURA: Borradores y Bandeja de salida\ncp = dict(a=1)\nEXT = ['.zip', '.msg']\nEOF`,
            `mkdir -p /c/Dev/BarackMercosul/.claude/skills/plotter-aol/scripts && cp "C:/Users/FACUND~1/AppData/Local/Temp/claude/x/scratchpad/cuadradito/acomodar.py" /c/Dev/BarackMercosul/.claude/skills/plotter-aol/scripts/`,
            // un video editado que no se puede medir y NO viene de la biblioteca (los dos «discutibles» del 08/10): pasa
            `T="/c/Users/FacundoS-PC/BARACK ARGENTINA SRL/Ingeniería y Proyecto - General/INGENIERIA BARACK (NUNCA BORRAR)/1- GENERAL/TIEMPOS Y BALANCEOS/VWA/PROYECTO PATAGONIA/DUCTOS"; W=/c/Dev/_telefono/tiempos_paulo_20261007_trabajo; cp "$W/salida/DEFROSTER componente lateral.mp4" "$T/DEFROSTER componente lateral.mp4"`,
            // lo liviano de siempre
            `ls -la ${BIBLIOTECA}`, `ffprobe -v error ${BIBLIOTECA}`,
            'cp plancha.jpg "/c/Users/FacundoS-PC/OneDrive - BARACK ARGENTINA SRL/Desktop/tarea/x.jpg"',
            'curl -s -o datos.txt https://x/datos.txt',
        ];
        for (const cmd of pasan) expect(poco(cmd), cmd.slice(0, 90)).toBeNull();
    });

    it('VERDE: con 50 GB pasa; en CATA pasa con 6 (tambien escrito «Cata»); sin medicion no frena', () => {
        expect(correr(telCopiar, { horasDelCruce: 0, env: { ...PC, BARACK_ESPACIO_LIBRE_GB: '50' } })).toBeNull();
        expect(correr(telCopiar, { horasDelCruce: 0, env: { COMPUTERNAME: 'CATA', BARACK_ESPACIO_LIBRE_GB: '6' } })).toBeNull();
        expect(correr(telCopiar, { horasDelCruce: 0, env: { COMPUTERNAME: 'Cata', BARACK_ESPACIO_LIBRE_GB: '1' } })).toBeNull();
        expect(correr(telCopiar, { horasDelCruce: 0, env: { ...PC, BARACK_ESPACIO_LIBRE_GB: 'no-se-pudo' } })).toBeNull();
    });

    it('el pase de Fak (~/.claude/.espacio-ok) vale UNA vez: pasa con aviso, queda «consumido» y la siguiente vuelve a frenar; con escapes:false (el agente por API) ni se usa ni se gasta', () => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vmg-pase-'));
        fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(home, '.claude', '.cruce-video'), String(AHORA));
        const pase = path.join(home, '.claude', '.espacio-ok');
        fs.writeFileSync(pase, '');
        const ctx = parsear(JSON.stringify({ tool_name: 'Bash', tool_input: { command: telCopiar, file_path: '' } }));
        const env = { HOME: home, ...POCO };
        expect(GUARDIANES['video-maquina-guard'](ctx, { ahora: AHORA, env, escapes: false })?.tipo).toBe('bloqueo');
        expect(fs.readFileSync(pase, 'utf8')).toBe('');                                   // el agente por API no lo gasta
        const conPase = GUARDIANES['video-maquina-guard'](ctx, { ahora: AHORA, env });
        expect(conPase?.tipo).toBe('aviso');
        expect(conPase.texto).toMatch(/se consumio ~\/\.claude\/\.espacio-ok/);
        expect(fs.readFileSync(pase, 'utf8')).toBe('consumido');
        expect(GUARDIANES['video-maquina-guard'](ctx, { ahora: AHORA, env })?.tipo).toBe('bloqueo');
        fs.rmSync(home, { recursive: true, force: true });
    });

    it('la regla 4 va ULTIMA: si la regla 1 frena (video al Escritorio), el pase no se gasta', () => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vmg-pase2-'));
        fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(home, '.claude', '.cruce-video'), String(AHORA));
        const pase = path.join(home, '.claude', '.espacio-ok');
        fs.writeFileSync(pase, '');
        const ctx = parsear(JSON.stringify({ tool_name: 'Bash', tool_input: { command: `cp "${grande}" ${ESCRITORIO}`, file_path: '' } }));
        const r = GUARDIANES['video-maquina-guard'](ctx, { ahora: AHORA, env: { HOME: home, ...POCO } });
        expect(r?.tipo).toBe('bloqueo');
        expect(r.texto).toMatch(/dejando un video en una carpeta del Escritorio/);
        expect(fs.readFileSync(pase, 'utf8')).toBe('');
        fs.rmSync(home, { recursive: true, force: true });
    });
});
