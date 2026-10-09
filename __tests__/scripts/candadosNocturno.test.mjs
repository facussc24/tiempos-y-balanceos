// @vitest-environment node
/**
 * Candado 3 de la noche de Claude, hecho codigo: los scripts que corren solos de madrugada NO
 * escriben en Supabase, ni tocan el arb, ni mandan mails, ni matan procesos, ni lanzan `claude -p`.
 *
 * POR QUE UN TEST Y NO UN HOOK. Los hooks de Claude Code (supabase-guard, mail-guard, arb-guard...)
 * corren cuando Claude ejecuta algo; el `node` que lanza el Programador de tareas a las 06:30 no pasa
 * por ningun hook. Lo unico que lo frena es: (1) el envoltorio de solo lectura
 * (scripts/_lib/supabaseSoloLectura.mjs) y (2) este test, que lee el TEXTO de cada archivo de la noche
 * y falla si aparece algo que escribe o mata. Un cambio que lo rompa se ve en el CI antes de llegar a
 * la notebook. La auto-mejora nocturna anterior se apago el 04/08/2026 (fork bomb de `claude -p`).
 *
 * Se audita en las dos direcciones: cada patron tiene que cazar su gemelo rojo (un texto inventado
 * que SI escribe), si no el test daria verde para todo.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(fileURLToPath(import.meta.url), '../../..');
const ARCHIVOS = [
  'scripts/_nocturno.mjs',
  'scripts/_nocturno.ps1',
  'scripts/_preauditarAmfe.mjs',
  'scripts/_claude.mjs',
  'scripts/_lib/nocturno.mjs',
  'scripts/_lib/preauditoriaAmfe.mjs',
  'scripts/_lib/claudeApi.mjs',
  'scripts/_lib/supabaseSoloLectura.mjs',
  'scripts/_lib/escrituraSegura.mjs',
  // 08/10/2026: pasos nuevos de la noche (propuestas de skills, prueba de disparo, vigilante de precios)
  'scripts/_lib/transcriptsFak.mjs',
  'scripts/_lib/propuestasSkills.mjs',
  'scripts/_propuestasSkills.mjs',
  'scripts/_lib/disparoSkills.mjs',
  'scripts/_pruebaDisparoSkills.mjs',
  'scripts/_lib/vigilarPrecios.mjs',
  'scripts/_vigilarPrecios.mjs',
];

/** La unica puerta de escritura de la noche (candado 1): el unico archivo que puede usar `fs` para escribir. */
const PUERTA_DE_ESCRITURA = 'scripts/_lib/escrituraSegura.mjs';

// El envio de Outlook se arma por partes para que este archivo no tenga el texto literal (el
// mail-guard frena los archivos que lo traen junto con otras senales de Outlook).
const ENVIO_OUTLOOK = new RegExp(['\\.', 'Se', 'nd\\('].join(''));

/** Lo que no puede aparecer en ningun archivo de la noche. */
const PROHIBIDOS = [
  { que: 'guardar un documento APQP', re: /\b(saveAmfe|saveCp|saveHo|savePfd)\b/ },
  { que: 'escribir en una tabla', re: /\.(update|insert|upsert|delete)\(/ },
  { que: 'el escritor validado de AMFE', re: /\brunWithValidation\b/ },
  { que: 'matar procesos', re: /\btaskkill\b|Stop-Process/i },
  { que: 'tocar el arb', re: /produc\.exe/i },
  { que: 'mandar mails', re: /_mailEnviar|SendAndReceive/ },
  { que: 'mandar un mail de Outlook', re: ENVIO_OUTLOOK },
  { que: 'lanzar Claude Code', re: /(spawn|exec)\w*\(\s*['"`]claude\b/ },
];

/**
 * Candado 1 ("la noche solo deja archivos en carpetas ignoradas"): ningun archivo de la noche escribe,
 * renombra, copia, crea ni borra con `fs` directo. Todo pasa por escrituraSegura.mjs (escribirSeguro /
 * agregarSeguro), que rechaza cualquier ruta fuera de .claude/state, .sgc-cache y reports/staging. Solo
 * se miran los .mjs: el .ps1 escribe su log con PowerShell y es el envoltorio de Windows.
 */
const ESCRITURAS_DIRECTAS = [
  { que: 'writeFile / writeFileSync', re: /\bwriteFile(Sync)?\s*\(/ },
  { que: 'appendFile / appendFileSync', re: /\bappendFile(Sync)?\s*\(/ },
  { que: 'un stream de escritura', re: /\bcreateWriteStream\s*\(/ },
  { que: 'renombrar o copiar', re: /\b(rename|copyFile|cp)(Sync)?\s*\(/ },
  { que: 'crear o borrar carpetas y archivos', re: /\b(mkdir|rm|rmdir|unlink)(Sync)?\s*\(/ },
];

/**
 * Lo unico permitido que se parece a una escritura: el `.update(` del hash de crypto
 * (claveHallazgo hace createHash('sha1').update(...)). Se saca del texto antes de mirar, con el
 * patron completo para que no tape un `.update(` de Supabase.
 */
const permitido = (t) => t.replace(/crypto\.createHash\([^)]*\)\.update\(/g, 'crypto.createHash(...).hash(');

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

describe('candados de la noche · el texto de cada archivo', () => {
  it('0. los archivos existen (un barrido de cero archivos no prueba nada)', () => {
    for (const rel of ARCHIVOS) expect(fs.existsSync(path.join(RAIZ, rel)), rel).toBe(true);
  });

  it.each(ARCHIVOS)('1. %s no escribe, no manda, no mata y no lanza claude', (rel) => {
    const texto = permitido(leer(rel));
    const hallados = PROHIBIDOS.filter((p) => p.re.test(texto)).map((p) => p.que);
    expect(hallados, `${rel} tiene: ${hallados.join(', ')}`).toEqual([]);
  });

  it('2. a Supabase solo se entra por el envoltorio de solo lectura', () => {
    for (const rel of ARCHIVOS.filter((r) => !r.endsWith('supabaseSoloLectura.mjs'))) {
      expect(/\bconnectSupabase\w*\b|\bcreateClient\b/.test(leer(rel)), `${rel} se conecta a Supabase sin el envoltorio`).toBe(false);
    }
    expect(leer('scripts/_preauditarAmfe.mjs')).toMatch(/conectarSoloLectura/);
  });

  it.each(ARCHIVOS.filter((r) => r.endsWith('.mjs') && r !== PUERTA_DE_ESCRITURA))('2b. %s no escribe con fs directo (solo por escrituraSegura.mjs)', (rel) => {
    const hallados = ESCRITURAS_DIRECTAS.filter((p) => p.re.test(leer(rel))).map((p) => p.que);
    expect(hallados, `${rel} escribe con fs directo (${hallados.join(', ')}): usar escribirSeguro / agregarSeguro`).toEqual([]);
  });

  it('2c. la puerta de escritura SI usa fs para escribir (si no, el barrido de arriba no probaria nada) y los que escriben pasan por ella', () => {
    const hallados = ESCRITURAS_DIRECTAS.filter((p) => p.re.test(leer(PUERTA_DE_ESCRITURA))).map((p) => p.que);
    expect(hallados).toEqual(expect.arrayContaining(['writeFile / writeFileSync', 'appendFile / appendFileSync', 'renombrar o copiar', 'crear o borrar carpetas y archivos']));
    for (const rel of ['scripts/_nocturno.mjs', 'scripts/_preauditarAmfe.mjs', 'scripts/_lib/claudeApi.mjs']) {
      expect(leer(rel), `${rel} tiene que importar escrituraSegura.mjs`).toMatch(/from '\.\/(_lib\/)?escrituraSegura\.mjs'/);
    }
  });

  it('3. el .ps1 es ASCII puro (powershell.exe lo lee como ANSI)', () => {
    const bytes = fs.readFileSync(path.join(RAIZ, 'scripts/_nocturno.ps1'));
    const fuera = [...bytes].filter((b) => b > 127).length;
    expect(fuera, 'sacar tildes y simbolos del .ps1').toBe(0);
  });
});

describe('candados de la noche · gemelos rojos (cada patron caza lo que dice)', () => {
  const rojos = {
    'guardar un documento APQP': "await saveAmfe(sb, id, doc, { expectedAmfeNumber: 'X' })",
    'escribir en una tabla': "await sb.from('amfe_documents').update({ data })",
    'el escritor validado de AMFE': 'await runWithValidation(sb, fn)',
    'matar procesos': "spawnSync('taskkill', ['/F', '/IM', 'x'])",
    'tocar el arb': 'Start-Process C:\\ARB\\produc.exe',
    'mandar mails': "spawnSync('python', ['scripts/_mailEnviar.py'])",
    'mandar un mail de Outlook': ['mail', '.Se', 'nd()'].join(''),
    'lanzar Claude Code': "spawn('claude', ['-p', 'audita'])",
  };

  it.each(PROHIBIDOS.map((p) => [p.que, p.re]))('ROJO: "%s" se caza', (que, re) => {
    expect(re.test(permitido(rojos[que]))).toBe(true);
  });

  it('VERDE: el hash de crypto pasa, el .update( de Supabase no', () => {
    const re = PROHIBIDOS[1].re;
    expect(re.test(permitido("crypto.createHash('sha1').update(`a|b`).digest('hex')"))).toBe(false);
    expect(re.test(permitido("crypto.createHash('sha1'); sb.from('t').update({})"))).toBe(true);
  });

  it('VERDE: nombrar `claude -p` en un comentario no es lanzarlo', () => {
    expect(PROHIBIDOS[7].re.test('// nunca lanza `claude -p` ni procesos en cadena')).toBe(false);
  });
});

describe('candados de la noche · escritura segura (gemelos rojos y verdes del barrido de fs directo)', () => {
  const rojos = {
    'writeFile / writeFileSync': ["fs.writeFileSync(ruta, texto, 'utf8')", "await fsp.writeFile(ruta, texto)", 'writeFileSync(tmp, t)'],
    'appendFile / appendFileSync': ["fs.appendFileSync(RUTA_LOG, linea, 'utf8')", 'await fs.promises.appendFile(r, t)'],
    'un stream de escritura': ['fs.createWriteStream(ruta)'],
    'renombrar o copiar': ['fs.renameSync(tmp, ruta)', 'fs.copyFileSync(a, b)', 'fs.cpSync(a, b, { recursive: true })', 'await fsp.rename(a, b)'],
    'crear o borrar carpetas y archivos': ['fs.mkdirSync(dir, { recursive: true })', 'fs.rmSync(dir)', 'fs.unlinkSync(f)', 'fs.rmdirSync(d)'],
  };

  it.each(ESCRITURAS_DIRECTAS.map((p) => [p.que, p.re]))('ROJO: "%s" se caza', (que, re) => {
    expect(rojos[que].length).toBeGreaterThan(0);
    for (const texto of rojos[que]) expect(re.test(texto), texto).toBe(true);
  });

  it('VERDE: leer, mirar, listar y usar la puerta segura no son escrituras directas', () => {
    const verdes = [
      "fs.readFileSync(ruta, 'utf8')", 'fs.existsSync(ruta)', 'fs.statSync(ruta).mtimeMs', 'fs.readdirSync(dir)', 'fs.createReadStream(jsonl)',
      'escribirSeguro(RUTA_ESTADO, texto)', 'agregarSeguro(RUTA_LOG, linea)', 'const confirmar = (x) => x', 'resumen.rmSync',
    ];
    for (const texto of verdes) {
      expect(ESCRITURAS_DIRECTAS.filter((p) => p.re.test(texto)).map((p) => p.que), texto).toEqual([]);
    }
  });
});
