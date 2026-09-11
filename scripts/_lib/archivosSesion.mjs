/**
 * archivosSesion.mjs — CLI: los archivos del repo que ESTA sesion toco (Write/Edit, o nombrados
 * en un comando: sed -i, cat >, python x.py), subagentes incluidos.
 *
 * Lo usa el hook Stop dev-server-guard.sh para reclamar solo lo que esta sesion cambio (A4,
 * 10/09/2026: 8 falsos positivos en la semana por `.claude/settings.json`, `.mcp.json` y archivos
 * de OTRA sesion sobre el mismo repo). La logica vive en cierreGuard.mjs (`relevarTranscript`).
 *
 * Uso:
 *   node scripts/_lib/archivosSesion.mjs --transcript <ruta.jsonl> [--repo <dir>]
 *   printf '%s' "$JSON_DEL_HOOK" | node scripts/_lib/archivosSesion.mjs [--repo <dir>]
 * Salida: una ruta repo-relativa por linea. `*` si no se puede atribuir (sin transcript, o sesion
 * que corrio comandos/agentes sin ningun archivo atribuible): el que llama cuenta todo lo sucio.
 * `--repo` acepta la forma de Git Bash (/c/Dev/x); por defecto es el repo de este script.
 */
import fs from 'node:fs';
import { archivosTocadosEnSesion } from './cierreGuard.mjs';

const args = process.argv.slice(2);
const valor = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };

let transcript = valor('--transcript');
if (!transcript) {
  try {
    const j = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
    transcript = j.transcript_path;
  } catch { /* sin JSON: sin transcript */ }
}

const opts = valor('--repo') ? { repo: valor('--repo') } : undefined;
const tocados = await archivosTocadosEnSesion(transcript, opts);
process.stdout.write(tocados instanceof Set ? [...tocados].map((r) => `${r}\n`).join('') : '*\n');
