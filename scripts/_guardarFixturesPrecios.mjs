/**
 * Baja las 3 paginas oficiales de Anthropic (precios, creditos, retiro de modelos) y las guarda como
 * fixtures en __tests__/fixtures/precios/ para `--simular` y los tests del vigilante de precios.
 *
 * Es un script de DESARROLLO, no de la noche de Claude: escribe en el repo. Por eso no esta en la lista de
 * archivos de candadosNocturno.test.mjs y `_vigilarPrecios.mjs` no lo importa.
 *
 * Uso: node scripts/_guardarFixturesPrecios.mjs
 * Antes de commitear: recortar cada fixture a las tablas que el vigilante lee (el repo es publico y las
 * paginas enteras son texto de la documentacion de Anthropic; el 08/10/2026 quedaron en ~8, 5 y 3 KB).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bajarPaginas, correr, ARCHIVOS_PAGINA } from './_lib/vigilarPrecios.mjs';
import { guardarFixture } from './_lib/vigilarPreciosFixtures.mjs';

export async function main() {
  try {
    const paginas = await bajarPaginas();
    const r = await correr({ paginas, guardar: false });
    // Solo se guarda lo que se bajo Y se entendio: un fixture que el parser no lee rompe los tests.
    const seccionDe = { pricing: r.precios, creditos: r.creditos, deprecaciones: r.deprecaciones };
    let fallas = 0;
    for (const clave of Object.keys(ARCHIVOS_PAGINA)) {
      if (seccionDe[clave].ok) console.error(`fixture guardado: ${guardarFixture(clave, paginas[clave].cuerpo)}`);
      else { fallas++; console.error(`fixture NO guardado (${clave}): ${seccionDe[clave].error}`); }
    }
    console.error('Recorta los fixtures a las tablas antes de commitear (repo publico).');
    return fallas ? 1 : 0;
  } catch (e) {
    console.error(`Fallo: ${e?.message ?? e}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().then((code) => { process.exitCode = code; });
}
