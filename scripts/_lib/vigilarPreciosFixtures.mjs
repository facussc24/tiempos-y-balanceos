/**
 * Guarda una pagina oficial como fixture en __tests__/fixtures/precios/: la UNICA escritura en el repo del
 * vigilante de precios. Vive aparte de vigilarPrecios.mjs a proposito: ese archivo es de la noche de Claude
 * y no puede escribir en el repo (candado 1 de api-claude.md; lo mide candadosNocturno.test.mjs). Lo corre
 * scripts/_guardarFixturesPrecios.mjs, a mano, desde una sesion.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ARCHIVOS_PAGINA, DIR_FIXTURES, ErrorVigilante, esMarkdown } from './vigilarPrecios.mjs';

/** Guarda `cuerpo` (markdown) como el fixture de la pagina `clave`, por un temporal y un renombre. */
export function guardarFixture(clave, cuerpo, { dir = DIR_FIXTURES } = {}) {
  const archivo = ARCHIVOS_PAGINA[clave];
  if (!archivo) throw new ErrorVigilante('uso', `pagina desconocida: ${clave}`);
  if (!esMarkdown(cuerpo)) throw new ErrorVigilante('formato', `no guardo el fixture ${clave}: no es markdown`);
  const destino = path.join(dir, archivo);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${destino}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tmp, cuerpo, 'utf8');
    fs.renameSync(tmp, destino);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* el temporal ya no estaba */ }
    throw e;
  }
  return destino;
}
